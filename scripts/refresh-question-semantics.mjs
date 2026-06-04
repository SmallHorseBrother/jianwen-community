import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const refreshAll = args.has("--refresh-all");

const argValue = (name) => {
	const item = process.argv.find((arg) => arg.startsWith(`${name}=`));
	return item ? item.slice(name.length + 1) : null;
};

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

const envFile = readEnv();
const embedBatchSize = Number(
	argValue("--embed-batch-size") || envFile.EMBEDDING_BATCH_SIZE || 128,
);
const embedConcurrency = Number(
	argValue("--embed-concurrency") || envFile.EMBEDDING_CONCURRENCY || 6,
);
const edgeConcurrency = Number(
	argValue("--edge-concurrency") || envFile.QUESTION_EDGE_CONCURRENCY || 10,
);
const sinceHours = Number(
	argValue("--since-hours") || envFile.QUESTION_EDGE_UPDATED_HOURS || 2,
);
const limit = argValue("--limit");
const maxEdges = argValue("--max-edges");
const model = argValue("--model");
const dimensions = argValue("--dimensions");

const runNodeScript = (label, scriptPath, scriptArgs) =>
	new Promise((resolve, reject) => {
		console.log(`\n=== ${label} ===`);
		const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
			cwd: projectRoot,
			env: process.env,
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${label} failed with exit code ${code}`));
		});
	});

const main = async () => {
	const embedArgs = [
		`--batch-size=${embedBatchSize}`,
		`--concurrency=${embedConcurrency}`,
	];
	const edgeArgs = [
		"--only-missing",
		`--since-hours=${sinceHours}`,
		`--concurrency=${edgeConcurrency}`,
	];

	if (dryRun) {
		embedArgs.push("--dry-run");
		edgeArgs.push("--dry-run");
	}
	if (refreshAll) embedArgs.push("--refresh-all");
	if (limit) {
		embedArgs.push(`--limit=${limit}`);
		edgeArgs.push(`--limit=${limit}`);
	}
	if (maxEdges) edgeArgs.push(`--max-edges=${maxEdges}`);
	if (model) {
		embedArgs.push(`--model=${model}`);
		edgeArgs.push(`--model=${model}`);
	}
	if (dimensions) embedArgs.push(`--dimensions=${dimensions}`);

	console.log("Question semantics refresh");
	console.log(`Embedding concurrency: ${embedConcurrency}`);
	console.log(`Edge concurrency: ${edgeConcurrency}`);
	console.log(`Rebuild updated edges within: ${sinceHours} hours`);

	await runNodeScript(
		"Generate missing/stale question embeddings",
		"scripts/generate-question-embeddings.mjs",
		embedArgs,
	);
	await runNodeScript(
		"Build missing/recent semantic edges",
		"scripts/build-question-edges.mjs",
		edgeArgs,
	);
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
