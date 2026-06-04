import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const clearExisting = args.has("--clear-existing");
const onlyMissing = args.has("--only-missing");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;
const maxEdgesArg = process.argv.find((arg) => arg.startsWith("--max-edges="));
const maxEdgesPerQuestion = maxEdgesArg ? Number(maxEdgesArg.split("=")[1]) : 5;
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 6;
const modelArg = process.argv.find((arg) => arg.startsWith("--model="));
const sinceHoursArg = process.argv.find((arg) => arg.startsWith("--since-hours="));
const sinceHours = sinceHoursArg ? Number(sinceHoursArg.split("=")[1]) : null;

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

const modelForRun = () => {
	const env = { ...readEnv(), ...process.env };
	return modelArg
		? modelArg.split("=")[1]
		: env.EMBEDDING_MODEL || "openai/text-embedding-3-large";
};

const parseEmbedding = (value) => {
	if (Array.isArray(value)) return value;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed
		.replace(/^\[/, "")
		.replace(/\]$/, "")
		.split(",")
		.map((item) => Number(item.trim()))
		.filter((item) => Number.isFinite(item));
};

const vectorLiteral = (embedding) => `[${embedding.join(",")}]`;

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

const withRetry = async (task, label, maxAttempts = 4) => {
	let lastError;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			const message = String(error?.message || error);
			const retryable =
				message.includes("429") ||
				message.includes("500") ||
				message.includes("502") ||
				message.includes("503") ||
				message.includes("504") ||
				message.toLowerCase().includes("timeout");
			if (!retryable || attempt === maxAttempts) break;
			const delay = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
			console.warn(`${label} failed, retrying in ${delay}ms (${attempt}/${maxAttempts})`);
			await sleep(delay);
		}
	}
	throw lastError;
};

const overlap = (left = [], right = []) => {
	if (!left.length || !right.length) return 0;
	const rightSet = new Set(right);
	const shared = left.filter((item) => rightSet.has(item)).length;
	return shared / Math.min(left.length, right.length);
};

const finalScoreFor = (source, candidate) => {
	const embeddingSimilarity = Number(candidate.similarity || 0);
	const tagOverlap = overlap(source.tags || [], candidate.tags || []);
	const sameTopic = source.topic && source.topic === candidate.topic ? 1 : 0;
	const sameNeedType =
		source.need_type && source.need_type === candidate.need_type ? 1 : 0;
	const valueBoost =
		(candidate.answer ? 0.5 : 0) +
		(candidate.is_featured ? 0.5 : 0) +
		(Number(candidate.source_count || 1) > 1 ? 0.25 : 0);

	return Math.min(
		1,
		embeddingSimilarity * 0.72 +
			tagOverlap * 0.14 +
			sameTopic * 0.08 +
			sameNeedType * 0.04 +
			Math.min(valueBoost, 1) * 0.02,
	);
};

const reasonFor = (source, candidate, score) => {
	const reasons = [`embedding ${Math.round(Number(candidate.similarity || 0) * 100)}%`];
	if (source.topic && source.topic === candidate.topic) reasons.push("同分类");
	const sharedTags = (source.tags || []).filter((tag) =>
		(candidate.tags || []).includes(tag),
	);
	if (sharedTags.length) reasons.push(`标签: ${sharedTags.slice(0, 3).join("/")}`);
	if (source.need_type && source.need_type === candidate.need_type) {
		reasons.push("需求类型相同");
	}
	if (candidate.answer) reasons.push("候选已回答");
	reasons.push(`final ${Math.round(score * 100)}%`);
	return reasons.join(" · ");
};

const fetchSources = async (supabase, model) => {
	const rows = [];
	const pageSize = 500;

	for (let offset = 0; ; offset += pageSize) {
		const { data, error } = await supabase
			.from("questions")
			.select(
				"id,content,tags,topic,need_type,audience_value,source_count,same_question_count,answer,is_featured,embedding,embedding_model,embedding_updated_at,status",
			)
			.not("embedding", "is", null)
			.eq("embedding_model", model)
			.neq("status", "ignored")
			.range(offset, offset + pageSize - 1)
			.order("source_count", { ascending: false })
			.order("same_question_count", { ascending: false });

		if (error) throw error;
		if (!data?.length) break;
		rows.push(...data);
		if (data.length < pageSize) break;
	}

	return rows;
};

const chunksOf = (items, size) => {
	const chunks = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const fetchQuestionIdsWithEdges = async (supabase, ids, model) => {
	const withEdges = new Set();
	for (const chunk of chunksOf(ids, 100)) {
		const { data, error } = await supabase
			.from("question_edges")
			.select("question_id")
			.in("question_id", chunk)
			.eq("edge_type", "semantic")
			.eq("model", model);
		if (error) throw error;
		for (const row of data || []) {
			withEdges.add(row.question_id);
		}
	}
	return withEdges;
};

const deleteOutgoingEdges = async (supabase, ids, model) => {
	for (const chunk of chunksOf(ids, 100)) {
		const { error } = await supabase
			.from("question_edges")
			.delete()
			.in("question_id", chunk)
			.eq("edge_type", "semantic")
			.eq("model", model);
		if (error) throw error;
	}
};

const selectSourcesForRun = async (supabase, sources, model) => {
	if (clearExisting) return sources.slice(0, limit);
	if (!onlyMissing && !sinceHours) return sources.slice(0, limit);

	const sourcePool = Number.isFinite(limit) ? sources.slice(0, limit) : sources;
	const selectedIds = new Set();

	if (onlyMissing) {
		const idsWithEdges = await fetchQuestionIdsWithEdges(
			supabase,
			sourcePool.map((source) => source.id),
			model,
		);
		for (const source of sourcePool) {
			if (!idsWithEdges.has(source.id)) selectedIds.add(source.id);
		}
	}

	if (sinceHours) {
		const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
		for (const source of sourcePool) {
			if (
				source.embedding_updated_at &&
				new Date(source.embedding_updated_at).getTime() >= cutoff
			) {
				selectedIds.add(source.id);
			}
		}
	}

	return sourcePool.filter((source) => selectedIds.has(source.id));
};

const matchCandidates = async (supabase, source, embedding) => {
	const calls = [
		supabase.rpc("match_question_embeddings", {
			query_embedding: vectorLiteral(embedding),
			match_count: 24,
			exclude_question_id: source.id,
			match_topic: source.topic || null,
		}),
		supabase.rpc("match_question_embeddings", {
			query_embedding: vectorLiteral(embedding),
			match_count: 10,
			exclude_question_id: source.id,
			match_topic: null,
		}),
	];
	const results = await Promise.all(calls);
	const byId = new Map();

	for (const { data, error } of results) {
		if (error) throw error;
		for (const candidate of data || []) {
			const existing = byId.get(candidate.id);
			if (!existing || candidate.similarity > existing.similarity) {
				byId.set(candidate.id, candidate);
			}
		}
	}

	return Array.from(byId.values());
};

const main = async () => {
	const supabase = createSupabase();
	const model = modelForRun();
	const allSources = await fetchSources(supabase, model);
	const sources = await selectSourcesForRun(supabase, allSources, model);
	const originBatch = `semantic_edges_${new Date().toISOString().slice(0, 10)}`;
	let builtEdges = [];

	console.log(`Question semantic edges${dryRun ? " dry-run" : ""}`);
	console.log(`Model: ${model}`);
	console.log(`Sources with embeddings: ${allSources.length}`);
	console.log(`Selected sources: ${sources.length}`);
	if (onlyMissing) console.log("Mode: only questions without outgoing semantic edges");
	if (sinceHours) console.log(`Mode: embeddings updated within ${sinceHours} hours`);
	console.log(`Max edges per question: ${maxEdgesPerQuestion}`);
	console.log(`RPC concurrency: ${concurrency}`);

	if (clearExisting && !dryRun) {
		const { error } = await supabase
			.from("question_edges")
			.delete()
			.eq("edge_type", "semantic")
			.eq("model", model);
		if (error) throw error;
		console.log("Cleared existing semantic edges.");
	}

	if (!clearExisting && !dryRun && sources.length) {
		await deleteOutgoingEdges(
			supabase,
			sources.map((source) => source.id),
			model,
		);
		console.log("Cleared selected outgoing semantic edges.");
	}

	await runPool(sources, async (source, index) => {
		const embedding = parseEmbedding(source.embedding);
		if (!embedding?.length) return;

		const candidates = await withRetry(
			() => matchCandidates(supabase, source, embedding),
			`Match ${source.id}`,
		);
		const edges = candidates
			.map((candidate) => {
				const similarity = finalScoreFor(source, candidate);
				const sameTopic = source.topic && source.topic === candidate.topic;
				return {
					question_id: source.id,
					related_question_id: candidate.id,
					similarity,
					embedding_similarity: Number(candidate.similarity || 0),
					edge_type: "semantic",
					reason: reasonFor(source, candidate, similarity),
					model,
					origin_batch: originBatch,
					_sameTopic: sameTopic,
				};
			})
			.filter((edge) =>
				edge._sameTopic
					? edge.similarity >= 0.66
					: edge.similarity >= 0.78 && edge.embedding_similarity >= 0.82,
			)
			.sort((left, right) => right.similarity - left.similarity)
			.slice(0, maxEdgesPerQuestion)
			.map(({ _sameTopic, ...edge }) => edge);

		builtEdges.push(...edges);

		if (!dryRun && edges.length) {
			await withRetry(async () => {
				const { error } = await supabase
					.from("question_edges")
					.upsert(edges, {
						onConflict: "question_id,related_question_id,edge_type",
					});
				if (error) throw error;
			}, `Upsert edges ${source.id}`);
		}

		if ((index + 1) % 100 === 0 || index === sources.length - 1) {
			console.log(
				`Processed ${index + 1}/${sources.length}; edges ${builtEdges.length}`,
			);
		}
	}, concurrency);

	console.log(`Built edges: ${builtEdges.length}`);
	if (dryRun) {
		console.log("Sample edges:", builtEdges.slice(0, 10));
	}
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
