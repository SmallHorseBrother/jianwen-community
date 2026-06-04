/**
 * Q&A 提问箱服务
 * 马健文的数字大脑 - 核心功能
 */

import { supabase } from "../lib/supabase";
import type { Database, QuestionStatus } from "../lib/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];
type QuestionUpdate = Database["public"]["Tables"]["questions"]["Update"];
export type QuestionEdge = Database["public"]["Tables"]["question_edges"]["Row"];
type QuestionReaction =
	Database["public"]["Tables"]["question_reactions"]["Row"];

export const QUESTION_TOPICS = [
	"街头健身",
	"疼痛康复",
	"学习科研",
	"个人成长",
	"AI/产品",
	"自媒体/创业",
	"社区事务",
	"其他",
] as const;

export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export const topicLabels: Record<string, QuestionTopic> = {
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

export interface QuestionStats {
	total: number;
	published: number;
	pending: number;
	answered: number;
	totalSameQuestions: number;
	sourcePlatformCount: number;
	byTopic: Record<string, number>;
}

export interface QuestionListOptions {
	limit?: number;
	offset?: number;
	tag?: string;
	topic?: string;
	searchQuery?: string;
	featuredOnly?: boolean;
	answeredOnly?: boolean;
	sort?: "default" | "same" | "source" | "latest";
}

export interface QuestionStarMapData {
	questions: Question[];
	edges: QuestionEdge[];
}

const ANON_KEY_STORAGE = "jw_question_planet_anon_key";

export const normalizeQuestionTopic = (topic?: string | null): QuestionTopic => {
	if (!topic) return "其他";
	return topicLabels[topic] || (QUESTION_TOPICS.includes(topic as QuestionTopic)
		? (topic as QuestionTopic)
		: "其他");
};

const getAnonKey = (): string => {
	if (typeof window === "undefined") {
		return `server-${Math.random().toString(36).slice(2)}`;
	}

	const existing = window.localStorage.getItem(ANON_KEY_STORAGE);
	if (existing) return existing;

	const key = typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	window.localStorage.setItem(ANON_KEY_STORAGE, key);
	return key;
};

const sanitizeSearch = (value: string): string =>
	value.replace(/[%,]/g, " ").replace(/\s+/g, " ").trim();

const chunksOf = <T,>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const queueQuestionSemantics = (questionId: string) => {
	void supabase.functions
		.invoke("question-semantics", { body: { questionId } })
		.catch((error) => {
			console.warn("问题语义计算后台触发失败:", error);
		});
};

// ==================== 用户端功能 ====================

/**
 * 提交问题
 */
export const submitQuestion = async (
	content: string,
	options?: {
		isAnonymous?: boolean;
		askerId?: string;
		askerNickname?: string;
		tags?: string[];
		topic?: string;
		needType?: string;
	},
): Promise<Question> => {
	const { data, error } = await supabase
		.from("questions")
		.insert({
			content,
			is_anonymous: options?.isAnonymous ?? false,
			asker_id: options?.isAnonymous ? null : options?.askerId,
      asker_nickname: options?.isAnonymous
				? "匿名用户"
				: options?.askerNickname,
			tags: options?.tags ?? [],
			topic: options?.topic || "其他",
			need_type: options?.needType || "website_submission",
			audience_value: "medium",
			source_count: 1,
			source_platforms: ["website"],
			source_channels: ["jwcommunity.space/qa"],
			status: "pending",
		})
    .select()
    .single();

  if (error) throw error;
	queueQuestionSemantics(data.id);
  return data;
};

/**
 * 获取问答列表 (知识广场)
 * 显示所有未被忽略的问题（包括待回答和已发布）
 */
export const getPublishedQuestions = async (options?: {
	limit?: number;
	offset?: number;
	tag?: string;
	topic?: string;
	searchQuery?: string;
	featuredOnly?: boolean;
	answeredOnly?: boolean;
	sort?: "default" | "same" | "source" | "latest";
}): Promise<{ questions: Question[]; total: number }> => {
	let query = supabase
		.from("questions")
		.select("*", { count: "exact" })
		.neq("status", "ignored") // 排除被忽略的，显示 pending 和 published
		.limit(options?.limit || 20);

	if (options?.featuredOnly) {
		// 精选只显示已发布的
		query = query.eq("is_featured", true).eq("status", "published");
	}

	if (options?.answeredOnly) {
		query = query.not("answer", "is", null);
	}

	if (options?.tag) {
		query = query.contains("tags", [options.tag]);
	}

	if (options?.topic) {
		query = query.eq("topic", options.topic);
	}

	if (options?.searchQuery) {
		const term = sanitizeSearch(options.searchQuery);
		if (term) {
			query = query.or(
				`content.ilike.%${term}%,answer.ilike.%${term}%,topic.ilike.%${term}%,need_type.ilike.%${term}%`,
			);
		}
	}

	if (options?.sort === "latest") {
		query = query.order("created_at", { ascending: false });
	} else if (options?.sort === "source") {
		query = query
			.order("source_count", { ascending: false })
			.order("same_question_count", { ascending: false })
			.order("created_at", { ascending: false });
	} else if (options?.sort === "same") {
		query = query
			.order("same_question_count", { ascending: false })
			.order("source_count", { ascending: false })
			.order("created_at", { ascending: false });
	} else {
		query = query
			.order("is_featured", { ascending: false })
			.order("same_question_count", { ascending: false })
			.order("source_count", { ascending: false })
			.order("created_at", { ascending: false });
	}

	if (options?.offset !== undefined) {
		query = query.range(
			options.offset,
			options.offset + (options.limit || 10) - 1,
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { questions: data || [], total: count || 0 };
};

/**
 * 获取星图节点。只取当前筛选下最值得展示的一小批，避免移动端渲染过重。
 */
export const getQuestionStars = async (options?: {
	limit?: number;
	topic?: string;
	tag?: string;
	searchQuery?: string;
}): Promise<QuestionStarMapData> => {
	const limit = options?.limit || 5000;
	const pageSize = 1000;
	const rows: Question[] = [];

	for (let offset = 0; offset < limit; offset += pageSize) {
		let query = supabase
			.from("questions")
			.select(
				"id,content,answer,status,tags,topic,source_count,source_platforms,source_channels,same_question_count,is_featured,view_count,created_at,answered_at,asker_id,asker_nickname,is_anonymous,need_type,audience_value,community_answer_count,updated_at,imported_key,origin_batch,is_imported",
			)
			.neq("status", "ignored")
			.order("same_question_count", { ascending: false })
			.order("source_count", { ascending: false })
			.range(offset, Math.min(offset + pageSize - 1, limit - 1));

		if (options?.topic) {
			query = query.eq("topic", options.topic);
		}
		if (options?.tag) {
			query = query.contains("tags", [options.tag]);
		}
		if (options?.searchQuery) {
			const term = sanitizeSearch(options.searchQuery);
			if (term) {
				query = query.or(
					`content.ilike.%${term}%,answer.ilike.%${term}%,topic.ilike.%${term}%,need_type.ilike.%${term}%`,
				);
			}
		}

		const { data, error } = await query;
		if (error) throw error;
		rows.push(...((data || []) as Question[]));
		if (!data || data.length < pageSize) break;
	}

	const questions = rows.slice(0, limit);
	const questionIds = questions.map((question) => question.id);
	let edges: QuestionEdge[] = [];

	if (questionIds.length) {
		try {
			const idSet = new Set(questionIds);
			const edgeMap = new Map<string, QuestionEdge>();
			for (const ids of chunksOf(questionIds, 250)) {
				const { data, error } = await supabase
					.from("question_edges")
					.select("*")
					.in("question_id", ids)
					.eq("edge_type", "semantic")
					.order("similarity", { ascending: false })
					.limit(1400);

				if (error) throw error;
				(data || []).forEach((edge) => {
					if (!idSet.has(edge.related_question_id)) return;
					const key = `${edge.question_id}:${edge.related_question_id}:${edge.edge_type}`;
					edgeMap.set(key, edge as QuestionEdge);
				});
			}
			edges = Array.from(edgeMap.values())
				.sort((left, right) => right.similarity - left.similarity)
				.slice(0, 2400);
		} catch (error) {
			console.warn("语义连线暂不可用，使用前端相似度 fallback:", error);
			edges = [];
		}
	}

	return { questions, edges };
};

/**
 * 获取问题星球首页统计。
 */
export const getQuestionStats = async (): Promise<QuestionStats> => {
	const countQuestions = async (
		apply: (
			query: ReturnType<typeof supabase.from>,
		) => ReturnType<typeof supabase.from> = (query) => query,
	): Promise<number> => {
		const { count, error } = await apply(
			supabase.from("questions").select("id", {
				count: "exact",
				head: true,
			}),
		).neq("status", "ignored");
		if (error) throw error;
		return count || 0;
	};

	const [total, published, pending, answered, topicCounts, sampleResult] =
		await Promise.all([
			countQuestions(),
			countQuestions((query) => query.eq("status", "published")),
			countQuestions((query) => query.eq("status", "pending")),
			countQuestions((query) => query.not("answer", "is", null)),
			Promise.all(
				QUESTION_TOPICS.map(async (topic) => [
					topic,
					await countQuestions((query) => query.eq("topic", topic)),
				] as const),
			),
			supabase
				.from("questions")
				.select("same_question_count,source_platforms")
				.neq("status", "ignored")
				.order("same_question_count", { ascending: false })
				.limit(1000),
		]);

	if (sampleResult.error) throw sampleResult.error;

	const byTopic = Object.fromEntries(topicCounts);
	const platforms = new Set<string>();
	let totalSameQuestions = 0;

	(sampleResult.data || []).forEach((question) => {
		totalSameQuestions += question.same_question_count || 0;
		question.source_platforms?.forEach((platform) => platforms.add(platform));
	});

	return {
		total,
		published,
		pending,
		answered,
		totalSameQuestions,
		sourcePlatformCount: Math.max(platforms.size, 6),
		byTopic,
	};
};

export const getQuestionStatsLegacy = async (): Promise<QuestionStats> => {
	const { data, error, count } = await supabase
		.from("questions")
		.select(
			"id,status,answer,topic,same_question_count,source_platforms",
			{ count: "exact" },
		)
		.neq("status", "ignored")
		.limit(10000);

	if (error) throw error;

	const byTopic: Record<string, number> = {};
	const platforms = new Set<string>();
	let answered = 0;
	let pending = 0;
	let published = 0;
	let totalSameQuestions = 0;

	(data || []).forEach((question) => {
		const topic = normalizeQuestionTopic(question.topic);
		byTopic[topic] = (byTopic[topic] || 0) + 1;
		totalSameQuestions += question.same_question_count || 0;
		question.source_platforms?.forEach((platform) => platforms.add(platform));
		if (question.answer) answered += 1;
		if (question.status === "pending") pending += 1;
		if (question.status === "published") published += 1;
	});

	return {
		total: count || data?.length || 0,
		published,
		pending,
		answered,
		totalSameQuestions,
		sourcePlatformCount: platforms.size,
		byTopic,
	};
};

/**
 * 匿名或登录用户点击“我也想问”。重复点击不会重复计数。
 */
export const markSameQuestion = async (
	questionId: string,
	userId?: string,
): Promise<{ inserted: boolean; reaction?: QuestionReaction }> => {
	const anonKey = userId ? null : getAnonKey();
	const { data, error } = await supabase
		.from("question_reactions")
		.insert({
			question_id: questionId,
			reaction_type: "same_question",
			anon_key: anonKey,
			user_id: userId || null,
		})
		.select()
		.single();

	if (error) {
		if (error.code === "23505") return { inserted: false };
		throw error;
	}

	return { inserted: true, reaction: data };
};

/**
 * 获取单个问答详情
 */
export const getQuestionById = async (id: string): Promise<Question | null> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // 增加浏览次数
  await supabase
    .from("questions")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id);

  return data;
};

/**
 * 获取用户自己提的问题
 */
export const getMyQuestions = async (userId: string): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("asker_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有已使用的标签
 */
export const getAllTags = async (): Promise<string[]> => {
	const { data, error } = await supabase
		.from("questions")
		.select("tags")
		.neq("status", "ignored");

  if (error) throw error;

  const tagSet = new Set<string>();
  data?.forEach((q) => q.tags?.forEach((tag: string) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
};

// ==================== 管理员功能 ====================

/**
 * 检查用户是否是管理员
 * 使用 profiles.user_role 字段判断，支持 'admin' 和 'super_admin' 两种角色
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("id", userId)
    .single();

  if (error) return false;
  return data?.user_role === "admin" || data?.user_role === "super_admin";
};

/**
 * 获取待回答的问题列表 (管理员)
 */
export const getPendingQuestions = async (): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有问题 (管理员)
 */
export const getAllQuestions = async (
  status?: QuestionStatus,
): Promise<Question[]> => {
  let query = supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

/**
 * 回答问题 (管理员)
 */
export const answerQuestion = async (
	questionId: string,
	answer: string,
	tags?: string[],
	options?: {
		topic?: string;
		needType?: string;
		audienceValue?: string;
	},
): Promise<Question> => {
	const updateData: QuestionUpdate = {
		answer,
		status: "published",
		answered_at: new Date().toISOString(),
  };

	if (tags) {
		updateData.tags = tags;
	}
	if (options?.topic) updateData.topic = options.topic;
	if (options?.needType) updateData.need_type = options.needType;
	if (options?.audienceValue) updateData.audience_value = options.audienceValue;

	const { data, error } = await supabase
    .from("questions")
    .update(updateData)
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 更新问题状态 (管理员)
 */
export const updateQuestionStatus = async (
  questionId: string,
  status: QuestionStatus,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 设置/取消精选 (管理员)
 */
export const toggleFeatured = async (
  questionId: string,
  isFeatured: boolean,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update({ is_featured: isFeatured })
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 删除问题 (管理员)
 */
export const deleteQuestion = async (questionId: string): Promise<void> => {
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (error) throw error;
};

/**
 * 更新问题内容 (管理员)
 */
export const updateQuestion = async (
  questionId: string,
  updates: QuestionUpdate,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update(updates)
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ==================== 群友帮答功能 ====================

type CommunityAnswer = Database["public"]["Tables"]["community_answers"]["Row"];

/**
 * 获取某问题的所有群友回答
 */
export const getCommunityAnswers = async (
  questionId: string,
): Promise<CommunityAnswer[]> => {
  const { data, error } = await supabase
    .from("community_answers")
    .select("*")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 提交群友回答
 */
export const submitCommunityAnswer = async (
  questionId: string,
  content: string,
  userId: string,
  userNickname: string,
): Promise<CommunityAnswer> => {
  const { data, error } = await supabase
    .from("community_answers")
    .insert({
      question_id: questionId,
      user_id: userId,
      user_nickname: userNickname,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 删除群友回答（仅限本人）
 */
export const deleteCommunityAnswer = async (
  answerId: string,
): Promise<void> => {
  const { error } = await supabase
    .from("community_answers")
    .delete()
    .eq("id", answerId);

  if (error) throw error;
};
