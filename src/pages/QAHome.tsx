/**
 * 问题星球
 * 沉浸式问题星空入口
 */

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle, MessageSquareText, Search, Send, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import MathCaptcha from "../components/Common/MathCaptcha";
import QuestionStarMap from "../components/QA/QuestionStarMap";
import {
	QUESTION_TOPICS,
	getPublishedQuestions,
	getQuestionStars,
	getQuestionStats,
	markSameQuestion,
	submitQuestion,
	type QuestionEdge,
	type QuestionStats,
} from "../services/questionService";
import type { Database } from "../lib/database.types";
import { findSimilarQuestions, type SimilarQuestion } from "../utils/questionSimilarity";

type Question = Database["public"]["Tables"]["questions"]["Row"];
type StarGranularity = "constellation" | "cluster" | "raw";

const PAGE_SIZE = 24;
const SUBMIT_RATE_KEY = "jw_question_submit_last_at";
const STAR_CACHE_PREFIX = "jw_question_star_cache_v2";
const STAR_MAP_LIMITS: Record<StarGranularity, { desktop: number; mobile: number }> = {
	constellation: { desktop: 260, mobile: 160 },
	cluster: { desktop: 420, mobile: 260 },
	raw: { desktop: 5000, mobile: 900 },
};
const FULL_STAR_PROGRESSIVE_STOPS = [500, 1200, 2200, 3400, 5000];

const compactNumber = (value: number) => {
	if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
	return value.toLocaleString("zh-CN");
};

const canSubmitNow = () => {
	const last = Number(window.localStorage.getItem(SUBMIT_RATE_KEY) || 0);
	return Date.now() - last > 60_000;
};

const getStarMapLimit = (granularity: StarGranularity) => {
	const limits = STAR_MAP_LIMITS[granularity];
	if (typeof window === "undefined") return limits.desktop;
	return window.matchMedia("(max-width: 640px)").matches
		? limits.mobile
		: limits.desktop;
};

const getStarCacheKey = (
	granularity: StarGranularity,
	topic: string | null,
	tag: string | null,
	search: string,
) => {
	const parts = [
		granularity,
		topic || "all-topics",
		tag || "all-tags",
		search || "no-search",
		getStarMapLimit(granularity),
	];
	return `${STAR_CACHE_PREFIX}:${parts.map(encodeURIComponent).join(":")}`;
};

const mergeQuestionsById = (existing: Question[], next: Question[]) => {
	const byId = new Map(existing.map((question) => [question.id, question]));
	next.forEach((question) => byId.set(question.id, question));
	return Array.from(byId.values());
};

const yieldToBrowser = () =>
	new Promise((resolve) => window.setTimeout(resolve, 180));

const QAHome: React.FC = () => {
	const { user } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const initialTag = searchParams.get("tag");

	const [questions, setQuestions] = useState<Question[]>([]);
	const [stars, setStars] = useState<Question[]>([]);
	const [starEdges, setStarEdges] = useState<QuestionEdge[]>([]);
	const [stats, setStats] = useState<QuestionStats | null>(null);
	const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
	const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery.trim());
	const [viewMode, setViewMode] = useState<"cosmos" | "list">("cosmos");
	const [starGranularity, setStarGranularity] = useState<StarGranularity>("constellation");
	const [loading, setLoading] = useState(true);
	const [starLoading, setStarLoading] = useState(true);
	const [sameToast, setSameToast] = useState<string | null>(null);

	const [questionContent, setQuestionContent] = useState("");
	const [questionTopic, setQuestionTopic] = useState<string>("街头健身");
	const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
	const [isAnonymous, setIsAnonymous] = useState(true);
	const [captchaValid, setCaptchaValid] = useState(false);
	const [honeypot, setHoneypot] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitSuccess, setSubmitSuccess] = useState(false);
	const questionRequestIdRef = useRef(0);

	useEffect(() => {
		void loadInitialData();
	}, []);

	useEffect(() => {
		void loadQuestionData();
	}, [selectedTopic, selectedTag, deferredSearchQuery, starGranularity]);

	const loadInitialData = async () => {
		try {
			const statsResult = await getQuestionStats();
			setStats(statsResult);
		} catch (error) {
			console.error("加载问题星球统计失败:", error);
		}
	};

	useEffect(() => {
		setSimilarQuestions(
			findSimilarQuestions(questionContent, stars.concat(questions), {
				topic: questionTopic,
				tags: [questionTopic],
				limit: 4,
				minScore: 0.16,
			}),
		);
	}, [questionContent, questionTopic, stars, questions]);

	const loadQuestionData = async () => {
		const requestId = questionRequestIdRef.current + 1;
		questionRequestIdRef.current = requestId;
		const starLimit = getStarMapLimit(starGranularity);
		const starCacheKey = getStarCacheKey(
			starGranularity,
			selectedTopic,
			selectedTag,
			deferredSearchQuery,
		);
		let cachedStarQuestions: Question[] = [];
		let cachedStarEdges: QuestionEdge[] = [];

		try {
			setLoading(true);
			setStarLoading(true);
			try {
				const cached = window.sessionStorage.getItem(starCacheKey);
				if (cached) {
					const parsed = JSON.parse(cached) as { questions?: Question[]; edges?: QuestionEdge[] };
					if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
						cachedStarQuestions = parsed.questions;
						cachedStarEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
						setStars(parsed.questions);
						setStarEdges(cachedStarEdges);
						setStarLoading(false);
					}
				}
			} catch (error) {
				console.warn("读取星图缓存失败:", error);
			}

			const persistStarCache = (questionsToCache: Question[], edgesToCache: QuestionEdge[]) => {
				try {
					window.sessionStorage.setItem(
						starCacheKey,
						JSON.stringify({
							questions: questionsToCache,
							edges: edgesToCache,
							cachedAt: Date.now(),
						}),
					);
				} catch (error) {
					console.warn("写入星图缓存失败:", error);
				}
			};

			const loadStars = async () => {
				try {
					if (starGranularity === "raw") {
						let mergedQuestions = cachedStarQuestions;
						let offset = cachedStarQuestions.length;
						const stops = FULL_STAR_PROGRESSIVE_STOPS
							.map((stop) => Math.min(stop, starLimit))
							.filter((stop, index, items) => stop > 0 && items.indexOf(stop) === index);

						for (const stop of stops) {
							if (questionRequestIdRef.current !== requestId) return;
							if (offset >= stop) continue;
							const batchLimit = stop - offset;
							const starsResult = await getQuestionStars({
								limit: batchLimit,
								offset,
								topic: selectedTopic || undefined,
								tag: selectedTag || undefined,
								searchQuery: deferredSearchQuery || undefined,
								includeEdges: false,
							});
							if (questionRequestIdRef.current !== requestId) return;
							if (starsResult.questions.length === 0) break;
							mergedQuestions = mergeQuestionsById(mergedQuestions, starsResult.questions);
							offset += starsResult.questions.length;
							setStars(mergedQuestions);
							setStarEdges([]);
							persistStarCache(mergedQuestions, []);
							await yieldToBrowser();
							if (starsResult.questions.length < batchLimit) break;
						}
						return;
					}

					const starsResult = await getQuestionStars({
						limit: starLimit,
						topic: selectedTopic || undefined,
						tag: selectedTag || undefined,
						searchQuery: deferredSearchQuery || undefined,
						includeEdges: false,
					});
					if (questionRequestIdRef.current !== requestId) return;
					setStars(starsResult.questions);
					setStarEdges(starsResult.edges);
					persistStarCache(starsResult.questions, starsResult.edges);
				} catch (error) {
					if (questionRequestIdRef.current !== requestId) return;
					console.error("加载问题星图失败:", error);
					setStars([]);
					setStarEdges([]);
				} finally {
					if (questionRequestIdRef.current === requestId) setStarLoading(false);
				}
			};

			void loadStars();

			const questionsResult = await getPublishedQuestions({
				limit: PAGE_SIZE,
				offset: 0,
				topic: selectedTopic || undefined,
				tag: selectedTag || undefined,
				searchQuery: deferredSearchQuery || undefined,
				sort: "default",
			});
			if (questionRequestIdRef.current !== requestId) return;
			setQuestions(questionsResult.questions);
		} catch (error) {
			if (questionRequestIdRef.current !== requestId) return;
			console.error("加载问题失败:", error);
		} finally {
			if (questionRequestIdRef.current === requestId) setLoading(false);
		}
	};

	const statCards = useMemo(
		() => [
			{ label: "收录问题", value: stats ? compactNumber(stats.total) : "2,800+" },
			{ label: "来源渠道", value: stats ? compactNumber(Math.max(stats.sourcePlatformCount, 6)) : "6" },
			{ label: "已点亮", value: stats ? compactNumber(stats.answered) : "0" },
			{ label: "累计同问", value: stats ? compactNumber(stats.totalSameQuestions) : "0" },
		],
		[stats],
	);

	const updateQuestionSameCount = (questionId: string) => {
		const bump = (question: Question) =>
			question.id === questionId
				? {
					...question,
					same_question_count: (question.same_question_count || 0) + 1,
				}
				: question;
		setQuestions((prev) => prev.map(bump));
		setStars((prev) => prev.map(bump));
		setStats((prev) =>
			prev
				? { ...prev, totalSameQuestions: prev.totalSameQuestions + 1 }
				: prev,
		);
	};

	const handleSameQuestion = async (question: Question) => {
		try {
			const result = await markSameQuestion(question.id, user?.id);
			if (result.inserted) {
				updateQuestionSameCount(question.id);
				setSameToast("已加入同问热度");
			} else {
				setSameToast("这个问题已经记录过你的同问");
			}
			setTimeout(() => setSameToast(null), 2200);
		} catch (error) {
			console.error("同问失败:", error);
			setSameToast("同问记录失败，请稍后再试");
			setTimeout(() => setSameToast(null), 2200);
		}
	};

	const handleTopicSelect = (topic: string | null) => {
		setSelectedTopic(topic);
		setSelectedTag(null);
		setSearchParams({});
	};

	const handleTagSelect = (tag: string | null) => {
		setSelectedTag(tag);
		if (tag) setSearchParams({ tag });
		else setSearchParams({});
	};

	const handleClearFilters = () => {
		setSelectedTopic(null);
		handleTagSelect(null);
		setSearchQuery("");
	};

	const handleSubmitQuestion = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!questionContent.trim() || submitting) return;
		if (honeypot.trim()) return;
		if (!captchaValid) {
			alert("请先完成验证码");
			return;
		}
		if (similarQuestions[0]?.score >= 0.42) {
			const ok = confirm("这个问题可能已经有人问过了。仍然要提交一个新问题吗？");
			if (!ok) return;
		}
		if (!canSubmitNow()) {
			alert("提交太频繁了，稍等一分钟再试");
			return;
		}

		try {
			setSubmitting(true);
			await submitQuestion(questionContent.trim(), {
				isAnonymous,
				askerId: user?.id,
				askerNickname: user?.nickname || "访客",
				tags: [questionTopic],
				topic: questionTopic,
			});
			window.localStorage.setItem(SUBMIT_RATE_KEY, String(Date.now()));
			setQuestionContent("");
			setSubmitSuccess(true);
			await Promise.all([loadInitialData(), loadQuestionData()]);
			setTimeout(() => setSubmitSuccess(false), 3000);
		} catch (error) {
			console.error("提交问题失败:", error);
			alert("提交失败，请稍后重试");
		} finally {
			setSubmitting(false);
		}
	};

	const questionComposer = (
		<form onSubmit={handleSubmitQuestion} className="grid gap-3">
			<select
				value={questionTopic}
				onChange={(event) => setQuestionTopic(event.target.value)}
				className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400"
			>
				{QUESTION_TOPICS.map((topic) => (
					<option key={topic} value={topic}>
						{topic}
					</option>
				))}
			</select>
			<textarea
				value={questionContent}
				onChange={(event) => setQuestionContent(event.target.value)}
				placeholder="写下一个你真正卡住的问题"
				className="min-h-36 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400"
				maxLength={500}
			/>
			{similarQuestions.length > 0 && (
				<div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
					<div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
						<Search className="h-4 w-4" />
						可能已经有人问过
					</div>
					<div className="mt-3 space-y-2">
						{similarQuestions.map(({ question, score, reasons }) => (
							<Link
								key={question.id}
								to={`/qa/${question.id}`}
								className="block rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200 transition hover:bg-slate-900/80"
							>
								<div className="line-clamp-2 font-semibold">
									{question.content}
								</div>
								<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
									<span>{Math.round(score * 100)}% 相似</span>
									{reasons.slice(0, 3).map((reason) => (
										<span key={reason}>· {reason}</span>
									))}
								</div>
							</Link>
						))}
					</div>
				</div>
			)}
			<input
				value={honeypot}
				onChange={(event) => setHoneypot(event.target.value)}
				tabIndex={-1}
				autoComplete="off"
				className="hidden"
				aria-hidden="true"
			/>
			<div className="flex items-center justify-between text-xs text-slate-400">
				<label className="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						checked={isAnonymous}
						onChange={(event) => setIsAnonymous(event.target.checked)}
						className="rounded border-slate-600 bg-slate-900"
					/>
					匿名展示
				</label>
				<span>{questionContent.length}/500</span>
			</div>
			<MathCaptcha onVerify={setCaptchaValid} />
			<button
				type="submit"
				disabled={submitting || !questionContent.trim() || !captchaValid}
				className="neon-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? "提交中..." : "提交到待回答星区"}
				<Send className="h-4 w-4" />
			</button>
			{submitSuccess && (
				<p className="text-center text-sm text-emerald-200">
					问题已进入待审核列表。
				</p>
			)}
		</form>
	);

	const questionListPanel = (
		<div className="grid gap-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
						<Sparkles className="h-3.5 w-3.5" />
						星际索引
					</p>
					<h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
						按问题列表快速穿梭
					</h2>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
						这里和上方搜索、分类完全联动。想沉浸探索就回到星空，想快速扫题就切到列表。
					</p>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
					当前索引 <span className="font-black text-cyan-100">{questions.length}</span> 个问题
				</div>
			</div>

			{loading ? (
				<div className="rounded-3xl border border-white/10 bg-slate-950/55 p-8 text-center text-sm text-slate-300">
					正在从星云里整理问题索引...
				</div>
			) : questions.length === 0 ? (
				<div className="rounded-3xl border border-white/10 bg-slate-950/55 p-8 text-center">
					<p className="text-lg font-bold text-white">这片星域暂时没有匹配问题</p>
					<p className="mt-2 text-sm text-slate-400">可以清空筛选，或者直接把你的问题送上星空。</p>
				</div>
			) : (
				<div className="grid gap-3">
					{questions.map((question, index) => (
						<article
							key={question.id}
							className="group rounded-[1.4rem] border border-white/10 bg-slate-950/58 p-4 shadow-xl shadow-black/20 backdrop-blur transition hover:border-cyan-300/30 hover:bg-slate-900/78 sm:p-5"
						>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2 text-xs">
										<span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-semibold text-cyan-100">
											#{String(index + 1).padStart(2, "0")}
										</span>
										{question.topic && (
											<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
												{question.topic}
											</span>
										)}
										{question.answer ? (
											<span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-emerald-100">
												<CheckCircle className="h-3 w-3" />
												已点亮
											</span>
										) : (
											<span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
												<Sparkles className="h-3 w-3" />
												待点亮
											</span>
										)}
									</div>
									<Link
										to={`/qa/${question.id}`}
										className="mt-3 block text-lg font-black leading-snug text-white transition group-hover:text-cyan-50 sm:text-xl"
									>
										{question.content}
									</Link>
									<div className="mt-3 flex flex-wrap gap-2">
										{(question.tags || []).slice(0, 4).map((tag) => (
											<span
												key={tag}
												className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400"
											>
												#{tag}
											</span>
										))}
									</div>
									<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
										<span>{question.source_count || 1} 次来源</span>
										<span>{question.same_question_count || 0} 人同问</span>
										{question.answer && (
											<span className="inline-flex items-center gap-1 text-emerald-200">
												<MessageSquareText className="h-3.5 w-3.5" />
												已有回答
											</span>
										)}
									</div>
								</div>
								<div className="flex shrink-0 gap-2 sm:flex-col">
									<button
										type="button"
										onClick={() => handleSameQuestion(question)}
										className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/18"
									>
										我也想问
									</button>
									<Link
										to={`/qa/${question.id}`}
										className="inline-flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/16"
									>
										详情
										<ArrowUpRight className="h-3.5 w-3.5" />
									</Link>
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</div>
	);

	return (
		<div className="min-h-[calc(100svh-4rem)]">
			<QuestionStarMap
				questions={stars}
				semanticEdges={starEdges}
				loading={loading || starLoading}
				onSameQuestion={handleSameQuestion}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				selectedTopic={selectedTopic}
				onTopicSelect={handleTopicSelect}
				selectedTag={selectedTag}
				topicCounts={stats?.byTopic}
				onClearFilters={handleClearFilters}
				stats={statCards}
				askPanel={questionComposer}
				listPanel={questionListPanel}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				granularity={starGranularity}
				onGranularityChange={setStarGranularity}
				totalLoadedStars={stars.length}
			/>

			{sameToast && (
				<div className="fixed bottom-4 left-3 right-3 z-50 rounded-2xl border border-cyan-300/25 bg-slate-950/90 px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-2xl shadow-cyan-950/40 backdrop-blur sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full sm:px-5">
					{sameToast}
				</div>
			)}
		</div>
	);
};

export default QAHome;
