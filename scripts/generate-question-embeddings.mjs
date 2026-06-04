import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const refreshAll = args.has("--refresh-all");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;
const batchSizeArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = batchSizeArg ? Number(batchSizeArg.split("=")[1]) : 128;
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 3;
const modelArg = process.argv.find((arg) => arg.startsWith("--model="));
const dimensionsArg = process.argv.find((arg) => arg.startsWith("--dimensions="));

const readEnv = () => {
	const envPath = path.join(projectRoot, ".env");
	if (!existsSync(envPath)) return {};
	const values = {};
	for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index === -1) continue;
		values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
	}
	return values;
};

const getEmbeddingConfig = () => {
	const env = { ...readEnv(), ...process.env };
	const baseUrl = (
		env.OPENAI_BASE_URL ||
		env.OFOX_BASE_URL ||
		"https://api.openai.com/v1"
	).replace(/\/$/, "");
	const dimensions = dimensionsArg
		? Number(dimensionsArg.split("=")[1])
		: Number(env.EMBEDDING_DIMENSIONS || 1536);
	const model = modelArg
		? modelArg.split("=")[1]
		: env.EMBEDDING_MODEL || "openai/text-embedding-3-large";
	const isOfox = baseUrl.includes("ofox.ai");

	return {
		apiKey: isOfox
			? env.OFOX_API_KEY || env.OPENAI_API_KEY
			: env.OPENAI_API_KEY || env.OFOX_API_KEY,
		baseUrl,
		dimensions,
		httpClient: env.EMBEDDING_HTTP_CLIENT || (process.platform === "win32" ? "curl" : "fetch"),
		model,
	};
};

const embeddingInputFor = (question) => [
	`问题：${question.content || ""}`,
	`分类：${question.topic || "其他"}`,
	`标签：${(question.tags || []).join("，")}`,
	`需求类型：${question.need_type || "未标注"}`,
	`受众价值：${question.audience_value || "medium"}`,
].join("\n");

const inputHashFor = (input) =>
	createHash("sha1").update(input).digest("hex");

const chunksOf = (items, size) => {
	const chunks = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runPool = async (items, worker, poolSize) => {
	let nextIndex = 0;
	const workers = Array.from({ length: Math.max(1, poolSize) }, async () => {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			await worker(items[currentIndex], currentIndex);
		}
	});
	await Promise.all(workers);
};

const withRetry = async (task, label, maxAttempts = 5) => {
	let lastError;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			const message = String(error?.message || error);
			const causeCode = String(error?.cause?.code || "");
			const retryable =
				message.includes("429") ||
				message.includes("500") ||
				message.includes("502") ||
				message.includes("503") ||
				message.includes("504") ||
				message.toLowerCase().includes("timeout") ||
				message.toLowerCase().includes("fetch failed") ||
				causeCode.includes("TIMEOUT") ||
				causeCode.includes("ECONNRESET") ||
				causeCode.includes("ENOTFOUND");
			if (!retryable || attempt === maxAttempts) break;
			const delay = 800 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
			console.warn(`${label} failed, retrying in ${delay}ms (${attempt}/${maxAttempts})`);
			await sleep(delay);
		}
	}
	throw lastError;
};

const postJsonWithCurl = async (url, apiKey, body) =>
	new Promise((resolve, reject) => {
		const bodyPath = path.join(
			tmpdir(),
			`ofox-embedding-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		writeFileSync(bodyPath, Buffer.from(JSON.stringify(body), "utf8"));
		const child = spawn(
			"curl.exe",
			[
				"-sS",
				"--connect-timeout",
				"30",
				"--max-time",
				"180",
				"-X",
				"POST",
				url,
				"-H",
				`Authorization: Bearer ${apiKey}`,
				"-H",
				"Content-Type: application/json",
				"--data-binary",
				`@${bodyPath}`,
				"-w",
				"\n__HTTP_STATUS__:%{http_code}",
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			try {
				unlinkSync(bodyPath);
			} catch {
				// Best-effort cleanup.
			}
			if (code !== 0) {
				reject(new Error(`curl exited ${code}: ${stderr || stdout}`));
				return;
			}
			const marker = "\n__HTTP_STATUS__:";
			const markerIndex = stdout.lastIndexOf(marker);
			const responseText = markerIndex === -1 ? stdout : stdout.slice(0, markerIndex);
			const status = markerIndex === -1
				? 0
				: Number(stdout.slice(markerIndex + marker.length).trim());
			if (status < 200 || status >= 300) {
				reject(new Error(`Embedding HTTP ${status}: ${responseText || stderr}`));
				return;
			}
			try {
				resolve(JSON.parse(responseText));
			} catch (error) {
				reject(new Error(`Failed to parse embedding response: ${error.message}`));
			}
		});
	});

const postJsonWithFetch = async (url, apiKey, body) => {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Embedding HTTP ${response.status}: ${text}`);
	}

	return response.json();
};

const createSupabase = () => {
	const env = { ...readEnv(), ...process.env };
	const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			"Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
		);
	}

	return createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false },
	});
};

const fetchQuestions = async (supabase) => {
	const rows = [];
	const pageSize = 1000;

	for (let offset = 0; rows.length < limit; offset += pageSize) {
		const { data, error } = await supabase
			.from("questions")
			.select(
				"id,content,tags,topic,need_type,audience_value,embedding_model,embedding_input_hash,embedding_updated_at,status",
			)
			.neq("status", "ignored")
			.range(offset, offset + pageSize - 1)
			.order("source_count", { ascending: false })
			.order("same_question_count", { ascending: false });

		if (error) throw error;
		if (!data?.length) break;
		rows.push(...data);
		if (data.length < pageSize) break;
	}

	return rows.slice(0, limit);
};

const embedBatch = async (apiKey, inputs, config) => {
	const body = {
		model: config.model,
		input: inputs,
	};
	if (Number.isFinite(config.dimensions) && config.dimensions > 0) {
		body.dimensions = config.dimensions;
	}

	const json = config.httpClient === "curl"
		? await postJsonWithCurl(`${config.baseUrl}/embeddings`, apiKey, body)
		: await postJsonWithFetch(`${config.baseUrl}/embeddings`, apiKey, body);
	const embeddings = json.data
		.sort((left, right) => left.index - right.index)
		.map((item) => item.embedding);
	const expectedDimensions = config.dimensions;
	if (
		Number.isFinite(expectedDimensions) &&
		expectedDimensions > 0 &&
		embeddings.some((embedding) => embedding.length !== expectedDimensions)
	) {
		throw new Error(
			`Embedding dimension mismatch. Expected ${expectedDimensions}, got ${embeddings[0]?.length}. ` +
				"Check whether the provider supports the dimensions parameter, or adjust the pgvector migration.",
		);
	}
	return embeddings;
};

const updateEmbeddingRows = async (supabase, batch, embeddings, model) => {
	const updates = batch.map((item, index) => ({
		item,
		embedding: embeddings[index],
	}));
	await runPool(
		updates,
		async ({ item, embedding }) => {
			const { error } = await supabase
				.from("questions")
				.update({
					embedding,
					embedding_model: model,
					embedding_input_hash: item.inputHash,
					embedding_updated_at: new Date().toISOString(),
				})
				.eq("id", item.question.id);

			if (error) throw error;
		},
		8,
	);
};

const main = async () => {
	const config = getEmbeddingConfig();
	const apiKey = config.apiKey;
	const model = config.model;
	const supabase = createSupabase();
	const questions = await fetchQuestions(supabase);

	const candidates = questions
		.map((question) => {
			const input = embeddingInputFor(question);
			const inputHash = inputHashFor(input);
			return { question, input, inputHash };
		})
		.filter(({ question, inputHash }) =>
			refreshAll ||
			question.embedding_model !== model ||
			question.embedding_input_hash !== inputHash ||
			!question.embedding_updated_at
		);

	console.log(`Question embeddings${dryRun ? " dry-run" : ""}`);
	console.log(`Model: ${model}`);
	console.log(`Dimensions: ${config.dimensions || "provider default"}`);
	console.log(`Base URL: ${config.baseUrl}`);
	console.log(`HTTP client: ${config.httpClient}`);
	console.log(`Fetched questions: ${questions.length}`);
	console.log(`Need embedding: ${candidates.length}`);
	console.log(`Batch size: ${batchSize}`);
	console.log(`Request concurrency: ${concurrency}`);

	if (!candidates.length) return;
	if (dryRun) {
		console.log("Sample input:");
		console.log(candidates[0].input);
		return;
	}
	if (!apiKey) {
		throw new Error("Missing OPENAI_API_KEY/OFOX_API_KEY. Add it to .env or process env.");
	}

	let updated = 0;
	const batches = chunksOf(candidates, batchSize);
	await runPool(
		batches,
		async (batch, batchIndex) => {
			const embeddings = await withRetry(
				() => embedBatch(apiKey, batch.map((item) => item.input), config),
				`Embedding batch ${batchIndex + 1}`,
			);
			await updateEmbeddingRows(supabase, batch, embeddings, model);
			updated += batch.length;
			console.log(`Updated embeddings: ${updated}/${candidates.length}`);
		},
		concurrency,
	);
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
