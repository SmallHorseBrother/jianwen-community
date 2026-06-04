import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const refreshExisting = args.has("--refresh-existing");
const qaHarvesterDir =
	process.env.QA_HARVESTER_DIR ||
	"C:\\Users\\29454\\Documents\\qa-harvester";

const inputFiles = [
	{
		batch: "social_high_medium_20260603",
		path: path.join(
			qaHarvesterDir,
			"data",
			"processed",
			"social_media_deepseek_final",
			"final_high_medium_context_sufficient_questions.csv",
		),
		questionField: "refined_question",
		platformField: "platforms",
		channelField: "channels",
	},
	{
		batch: "private_messages_20260603",
		path: path.join(
			qaHarvesterDir,
			"data",
			"processed",
			"private_messages_deepseek_final",
			"private_message_questions.csv",
		),
		questionField: "refined_question",
		platformField: "platforms",
		channelField: "channels",
	},
	{
		batch: "early_all_channel_final",
		path: path.join(
			qaHarvesterDir,
			"data",
			"processed",
			"final_questions.csv",
		),
		questionField: "question",
		platformField: "source_kinds",
		channelField: "channels",
	},
];

const topicLabels = {
	fitness: "街头健身",
	injury_rehab: "疼痛康复",
	learning: "学习科研",
	learning_research: "学习科研",
	personal_growth: "个人成长",
	ai_product: "AI/产品",
	creator: "自媒体/创业",
	business_service: "社区事务",
	other: "其他",
};

const tagRules = [
	["负重引体", ["负重引体", "负重", "最大重量", "冲单次"]],
	["引体向上", ["引体", "单手引体", "高位引体"]],
	["双力臂", ["双力臂", "翻腕", "摆荡"]],
	["训练计划", ["训练计划", "计划", "容量", "周期", "力竭", "减载"]],
	["新手入门", ["新手", "零基础", "做不了", "入门"]],
	["疼痛康复", ["疼", "伤", "康复", "肩袖", "手肘", "手腕", "腰突"]],
	["读博学习", ["博士", "读博", "科研", "学习", "英语", "时间管理"]],
	["执行力", ["执行力", "拖延", "懒", "行动力", "知行不一"]],
	["MBTI", ["MBTI", "ENTP", "ENTJ", "INFP", "INFJ", "人格"]],
	["自媒体创业", ["自媒体", "账号", "视频", "流量", "创业", "内容"]],
	["AI产品", ["AI", "产品", "大模型", "智能体"]],
	["社区事务", ["粉丝群", "进群", "加入", "咨询"]],
];

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

const parseCsv = (text) => {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		const next = text[i + 1];

		if (char === "\"") {
			if (inQuotes && next === "\"") {
				cell += "\"";
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(cell);
			cell = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") i += 1;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			continue;
		}

		cell += char;
	}

	if (cell || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}

	const [headers, ...records] = rows.filter((item) =>
		item.some((value) => value.trim()),
	);
	return records.map((record) =>
		Object.fromEntries(headers.map((header, index) => [header, record[index] || ""])),
	);
};

const normalizeText = (value) =>
	value
		.replace(/\s+/g, "")
		.replace(/[？?。.!！,，、；;：“”"']/g, "")
		.toLowerCase();

const importedKeyFor = (question) =>
	`question_planet:${createHash("sha1").update(normalizeText(question)).digest("hex")}`;

const splitList = (value) =>
	(value || "")
		.split("|")
		.map((item) => item.trim())
		.filter(Boolean);

const topicFor = (row) => topicLabels[row.topic] || row.topic || "其他";

const tagsFor = (question, topic) => {
	const tags = new Set([topic]);
	for (const [tag, keywords] of tagRules) {
		if (keywords.some((keyword) => question.includes(keyword))) {
			tags.add(tag);
		}
	}
	return Array.from(tags).slice(0, 8);
};

const mergeQuestion = (existing, incoming) => {
	const merged = { ...existing };
	merged.source_count = Math.max(
		Number(existing.source_count || 1),
		Number(incoming.source_count || 1),
	);
	merged.source_platforms = Array.from(
		new Set([...(existing.source_platforms || []), ...(incoming.source_platforms || [])]),
	).slice(0, 16);
	merged.source_channels = Array.from(
		new Set([...(existing.source_channels || []), ...(incoming.source_channels || [])]),
	).slice(0, 32);
	merged.tags = Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])).slice(0, 12);

	if (existing.audience_value !== "high" && incoming.audience_value === "high") {
		merged.audience_value = "high";
	}

	return merged;
};

const collectRows = () => {
	const byKey = new Map();
	const missing = [];

	for (const input of inputFiles) {
		if (!existsSync(input.path)) {
			missing.push(input.path);
			continue;
		}

		const rows = parseCsv(readFileSync(input.path, "utf8").replace(/^\uFEFF/, ""));
		for (const row of rows) {
			const content = (row[input.questionField] || "").trim();
			if (!content || content.length < 4) continue;

			const topic = topicFor(row);
			const record = {
				content,
				answer: null,
				status: "pending",
				asker_id: null,
				asker_nickname: "匿名用户",
				is_anonymous: true,
				tags: tagsFor(content, topic),
				topic,
				need_type: row.need_type || null,
				audience_value: row.audience_value || "medium",
				source_count: Number(row.source_count || 1),
				source_platforms: splitList(row[input.platformField]),
				source_channels: splitList(row[input.channelField]),
				same_question_count: 0,
				imported_key: importedKeyFor(content),
				origin_batch: input.batch,
				is_imported: true,
			};

			const existing = byKey.get(record.imported_key);
			byKey.set(
				record.imported_key,
				existing ? mergeQuestion(existing, record) : record,
			);
		}
	}

	return { rows: Array.from(byKey.values()), missing };
};

const main = async () => {
	const { rows, missing } = collectRows();
	const byTopic = rows.reduce((acc, row) => {
		acc[row.topic] = (acc[row.topic] || 0) + 1;
		return acc;
	}, {});

	console.log(`Question Planet import${dryRun ? " dry-run" : ""}`);
	console.log(`Collected unique questions: ${rows.length}`);
	console.log("By topic:", byTopic);
	if (missing.length) {
		console.warn("Missing inputs:", missing);
	}

	if (dryRun) return;

	const env = { ...readEnv(), ...process.env };
	const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false },
	});
	const batchSize = 250;
	let imported = 0;
	let updated = 0;

	for (let index = 0; index < rows.length; index += batchSize) {
		const batch = rows.slice(index, index + batchSize);
		const importedKeys = batch.map((row) => row.imported_key);
		const { data: existingRows, error: existingError } = await supabase
			.from("questions")
			.select("id, imported_key")
			.in("imported_key", importedKeys);
		if (existingError) throw existingError;

		const existingByKey = new Map(
			(existingRows || []).map((row) => [row.imported_key, row.id]),
		);
		const toInsert = batch.filter((row) => !existingByKey.has(row.imported_key));
		const toUpdate = refreshExisting
			? batch.filter((row) => existingByKey.has(row.imported_key))
			: [];

		if (toInsert.length > 0) {
			const { error } = await supabase.from("questions").insert(toInsert);
			if (error) throw error;
			imported += toInsert.length;
		}

		for (const row of toUpdate) {
			const { error } = await supabase
				.from("questions")
				.update({
					tags: row.tags,
					topic: row.topic,
					need_type: row.need_type,
					audience_value: row.audience_value,
					source_count: row.source_count,
					source_platforms: row.source_platforms,
					source_channels: row.source_channels,
					origin_batch: row.origin_batch,
					is_imported: true,
				})
				.eq("imported_key", row.imported_key);
			if (error) throw error;
			updated += 1;
		}

		const skipped = Math.min(index + batch.length, rows.length) - imported - updated;
		console.log(
			`Processed ${Math.min(index + batch.length, rows.length)}/${rows.length} ` +
				`(inserted ${imported}, updated ${updated}, skipped ${skipped})`,
		);
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
