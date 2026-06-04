import type { Database } from "../lib/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export interface SimilarQuestion {
	question: Question;
	score: number;
	reasons: string[];
}

const normalizeText = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[，。！？、；：“”"'`~!@#$%^&*()[\]{}<>/?\\|+=_-]/g, "")
		.replace(/\s+/g, "");

const DOMAIN_TERMS = [
	"引体向上",
	"负重引体",
	"双力臂",
	"单臂引体",
	"前水平",
	"俄挺",
	"倒立",
	"深蹲",
	"硬拉",
	"卧推",
	"实力推",
	"训练计划",
	"训练容量",
	"训练强度",
	"训练频率",
	"组间休息",
	"突破瓶颈",
	"新手入门",
	"热身",
	"恢复",
	"肩",
	"肘",
	"腕",
	"腰",
	"疼痛",
	"康复",
	"腱鞘炎",
	"拉伤",
	"体态",
	"读博",
	"科研",
	"论文",
	"英语",
	"时间管理",
	"执行力",
	"拖延",
	"MBTI",
	"心态",
	"焦虑",
	"AI",
	"大模型",
	"Claude",
	"GPT",
	"Cursor",
	"小程序",
	"备案",
	"自媒体",
	"账号",
	"流量",
	"变现",
	"创业",
] as const;

const INTENT_TERMS: Record<string, string[]> = {
	plan: ["计划", "安排", "周期", "频率", "组数", "次数", "容量"],
	pain: ["疼", "痛", "伤", "康复", "恢复", "不适", "拉伤"],
	breakthrough: ["突破", "瓶颈", "退步", "提升", "进步", "提高"],
	technique: ["动作", "姿势", "技术", "标准", "发力", "握法"],
	compare: ["区别", "对比", "选择", "哪个好", "是否"],
	learning: ["学习", "读博", "论文", "英语", "科研"],
	tooling: ["AI", "工具", "模型", "编程", "小程序", "备案"],
};

const gramsFor = (value: string): Set<string> => {
	const text = normalizeText(value);
	const grams = new Set<string>();
	if (text.length <= 2) {
		if (text) grams.add(text);
		return grams;
	}
	for (let index = 0; index < text.length - 1; index += 1) {
		grams.add(text.slice(index, index + 2));
	}
	for (let index = 0; index < text.length - 2; index += 1) {
		grams.add(text.slice(index, index + 3));
	}
	return grams;
};

const keywordsFor = (value: string, tags: string[] = []): Set<string> => {
	const normalized = normalizeText(value);
	const keywords = new Set<string>();
	DOMAIN_TERMS.forEach((term) => {
		if (normalized.includes(normalizeText(term))) keywords.add(term.toLowerCase());
	});
	tags.forEach((tag) => {
		const clean = tag.trim().toLowerCase();
		if (clean) keywords.add(clean);
	});
	value
		.toLowerCase()
		.match(/[a-z][a-z0-9+.-]{1,}/g)
		?.forEach((term) => keywords.add(term));
	return keywords;
};

const intentsFor = (value: string): Set<string> => {
	const normalized = normalizeText(value);
	const intents = new Set<string>();
	Object.entries(INTENT_TERMS).forEach(([intent, terms]) => {
		if (terms.some((term) => normalized.includes(normalizeText(term)))) {
			intents.add(intent);
		}
	});
	return intents;
};

const jaccard = (left: Set<string>, right: Set<string>): number => {
	if (!left.size || !right.size) return 0;
	let intersection = 0;
	left.forEach((item) => {
		if (right.has(item)) intersection += 1;
	});
	return intersection / (left.size + right.size - intersection);
};

const containment = (left: Set<string>, right: Set<string>): number => {
	if (!left.size || !right.size) return 0;
	let shared = 0;
	left.forEach((item) => {
		if (right.has(item)) shared += 1;
	});
	return shared / Math.min(left.size, right.size);
};

const overlap = (left: string[] = [], right: string[] = []): number => {
	if (!left.length || !right.length) return 0;
	const rightSet = new Set(right);
	const shared = left.filter((item) => rightSet.has(item)).length;
	return shared / Math.min(left.length, right.length);
};

export const scoreQuestionSimilarity = (
	input: string,
	question: Question,
	topic?: string | null,
	tags: string[] = [],
): SimilarQuestion => {
	const textScore = jaccard(gramsFor(input), gramsFor(question.content));
	const keywordScore = containment(
		keywordsFor(input, tags),
		keywordsFor(question.content, question.tags || []),
	);
	const intentScore = containment(intentsFor(input), intentsFor(question.content));
	const tagScore = overlap(tags, question.tags || []);
	const topicScore = topic && question.topic === topic ? 0.12 : 0;
	const exactPhraseScore =
		normalizeText(input).includes(normalizeText(question.content).slice(0, 12)) ||
		normalizeText(question.content).includes(normalizeText(input).slice(0, 12))
			? 0.12
			: 0;
	const score = Math.min(
		1,
		keywordScore * 0.34 +
			textScore * 0.28 +
			tagScore * 0.18 +
			intentScore * 0.08 +
			topicScore +
			exactPhraseScore,
	);

	const reasons: string[] = [];
	if (keywordScore > 0.25) reasons.push("核心词重合");
	if (textScore > 0.2) reasons.push("问法接近");
	if (tagScore > 0) reasons.push("标签重合");
	if (intentScore > 0) reasons.push("需求意图相似");
	if (topicScore > 0) reasons.push("同一分类");
	if ((question.same_question_count || 0) > 0) reasons.push("已有同问");
	if ((question.source_count || 0) > 1) reasons.push("多次出现");

	return { question, score, reasons };
};

export const findSimilarQuestions = (
	input: string,
	questions: Question[],
	options?: {
		topic?: string | null;
		tags?: string[];
		limit?: number;
		minScore?: number;
	},
): SimilarQuestion[] => {
	if (normalizeText(input).length < 6) return [];
	return questions
		.map((question) =>
			scoreQuestionSimilarity(
				input,
				question,
				options?.topic,
				options?.tags || [],
			),
		)
		.filter((item) => item.score >= (options?.minScore ?? 0.18))
		.sort((left, right) => right.score - left.score)
		.slice(0, options?.limit ?? 5);
};

export const scoreBetweenQuestions = (
	left: Question,
	right: Question,
): number => {
	const textScore = jaccard(gramsFor(left.content), gramsFor(right.content));
	const keywordScore = containment(
		keywordsFor(left.content, left.tags || []),
		keywordsFor(right.content, right.tags || []),
	);
	const intentScore = containment(intentsFor(left.content), intentsFor(right.content));
	const tagScore = overlap(left.tags || [], right.tags || []);
	const topicScore = left.topic && left.topic === right.topic ? 0.08 : 0;
	const exactPhraseScore =
		normalizeText(left.content).includes(normalizeText(right.content).slice(0, 12)) ||
		normalizeText(right.content).includes(normalizeText(left.content).slice(0, 12))
			? 0.08
			: 0;
	return Math.min(
		1,
		keywordScore * 0.38 +
			textScore * 0.24 +
			tagScore * 0.2 +
			intentScore * 0.08 +
			topicScore +
			exactPhraseScore,
	);
};
