/**
 * 问题星球
 * 视频引流入口 + 全渠道问题地图
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
	ArrowUpRight,
	CheckCircle,
	Clock,
	Eye,
	Filter,
	MessageCircle,
	Search,
	Send,
	Sparkles,
	Tag,
	Users,
	Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import MathCaptcha from "../components/Common/MathCaptcha";
import QuestionStarMap from "../components/QA/QuestionStarMap";
import {
	QUESTION_TOPICS,
	getAllTags,
	getPublishedQuestions,
	getQuestionStars,
	getQuestionStats,
	markSameQuestion,
	normalizeQuestionTopic,
	submitQuestion,
	type QuestionEdge,
	type QuestionStats,
} from "../services/questionService";
import type { Database } from "../lib/database.types";
import { findSimilarQuestions, type SimilarQuestion } from "../utils/questionSimilarity";

type Question = Database["public"]["Tables"]["questions"]["Row"];

const PAGE_SIZE = 24;
const SUBMIT_RATE_KEY = "jw_question_submit_last_at";
const DESKTOP_STAR_MAP_LIMIT = 240;
const MOBILE_STAR_MAP_LIMIT = 160;

const topicCopy: Record<string, string> = {
	"街头健身": "引体、双力臂、训练计划",
	"疼痛康复": "肩肘腕腰与恢复策略",
	"学习科研": "读博、英语、时间管理",
	"个人成长": "执行力、MBTI、心态",
	"AI/产品": "产品、工具、大模型",
	"自媒体/创业": "账号、内容、流量",
	"社区事务": "进群、咨询、协作",
	"其他": "暂未归类的问题",
};

const topicAccent: Record<string, string> = {
	"街头健身": "from-cyan-300/25 to-blue-500/10 text-cyan-100 border-cyan-300/25",
	"疼痛康复": "from-emerald-300/20 to-teal-500/10 text-emerald-100 border-emerald-300/25",
	"学习科研": "from-blue-300/20 to-indigo-500/10 text-blue-100 border-blue-300/25",
	"个人成长": "from-pink-300/20 to-rose-500/10 text-pink-100 border-pink-300/25",
	"AI/产品": "from-violet-300/22 to-purple-500/10 text-violet-100 border-violet-300/25",
	"自媒体/创业": "from-amber-300/20 to-orange-500/10 text-amber-100 border-amber-300/25",
	"社区事务": "from-rose-300/20 to-red-500/10 text-rose-100 border-rose-300/25",
	"其他": "from-slate-300/15 to-slate-500/10 text-slate-100 border-slate-300/20",
};

const formatDate = (dateStr: string) => {
	const date = new Date(dateStr);
	return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

const compactNumber = (value: number) => {
	if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
	return value.toLocaleString("zh-CN");
};

const canSubmitNow = () => {
	const last = Number(window.localStorage.getItem(SUBMIT_RATE_KEY) || 0);
	return Date.now() - last > 60_000;
};

const getInitialStarMapLimit = () => {
	if (typeof window === "undefined") return DESKTOP_STAR_MAP_LIMIT;
	return window.matchMedia("(max-width: 640px)").matches
		? MOBILE_STAR_MAP_LIMIT
		: DESKTOP_STAR_MAP_LIMIT;
};

const QAHome: React.FC = () => {
	const { user } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const initialTag = searchParams.get("tag");

	const [questions, setQuestions] = useState<Question[]>([]);
	const [stars, setStars] = useState<Question[]>([]);
	const [starEdges, setStarEdges] = useState<QuestionEdge[]>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [stats, setStats] = useState<QuestionStats | null>(null);
	const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
	const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
	const [searchQuery, setSearchQuery] = useState("");
	const [sort, setSort] = useState<"default" | "same" | "source" | "latest">(
		"default",
	);
	const [loading, setLoading] = useState(true);
	const [starLoading, setStarLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
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
		const timer = window.setTimeout(() => {
			void loadInitialData();
		}, 450);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		loadQuestionData(false);
	}, [selectedTopic, selectedTag, searchQuery, sort]);

	const loadInitialData = async () => {
		try {
			const [statsResult, tagsResult] = await Promise.all([
				getQuestionStats(),
				getAllTags(),
			]);
			setStats(statsResult);
			setTags(tagsResult);
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

	const loadQuestionData = async (isLoadMore: boolean) => {
		const requestId = isLoadMore
			? questionRequestIdRef.current
			: questionRequestIdRef.current + 1;
		if (!isLoadMore) questionRequestIdRef.current = requestId;

		try {
			if (isLoadMore) {
				setLoadingMore(true);
			} else {
				setLoading(true);
				setLoadingMore(false);
				setStarLoading(true);
				void getQuestionStars({
					limit: getInitialStarMapLimit(),
					topic: selectedTopic || undefined,
					tag: selectedTag || undefined,
					searchQuery: searchQuery || undefined,
					includeEdges: false,
				})
					.then((starsResult) => {
						if (questionRequestIdRef.current !== requestId) return;
						setStars(starsResult.questions);
						setStarEdges(starsResult.edges);
					})
					.catch((error) => {
						if (questionRequestIdRef.current !== requestId) return;
						console.error("加载问题星图失败:", error);
						setStars([]);
						setStarEdges([]);
					})
					.finally(() => {
						if (questionRequestIdRef.current === requestId) setStarLoading(false);
					});
			}

			const currentOffset = isLoadMore ? offset : 0;
			const questionsResult = await getPublishedQuestions({
				limit: PAGE_SIZE,
				offset: currentOffset,
				topic: selectedTopic || undefined,
				tag: selectedTag || undefined,
				searchQuery: searchQuery || undefined,
				sort,
			});
			if (questionRequestIdRef.current !== requestId) return;

			if (isLoadMore) {
				setQuestions((prev) => [...prev, ...questionsResult.questions]);
			} else {
				setQuestions(questionsResult.questions);
			}

			setHasMore(
				currentOffset + questionsResult.questions.length < questionsResult.total,
			);
			setOffset(currentOffset + questionsResult.questions.length);
		} catch (error) {
			if (questionRequestIdRef.current !== requestId) return;
			console.error("加载问题失败:", error);
		} finally {
			if (questionRequestIdRef.current === requestId) {
				setLoading(false);
				setLoadingMore(false);
			}
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
			await Promise.all([loadInitialData(), loadQuestionData(false)]);
			setTimeout(() => setSubmitSuccess(false), 3000);
		} catch (error) {
			console.error("提交问题失败:", error);
			alert("提交失败，请稍后重试");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen pb-8 sm:pb-10">
			<section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/70 shadow-2xl shadow-cyan-950/30 sm:rounded-[2rem]">
				<div className="relative px-4 py-7 sm:px-5 md:px-10 md:py-10">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.24),transparent_28%),radial-gradient(circle_at_86%_8%,rgba(236,72,153,0.18),transparent_32%)]" />
					<div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
						<div>
							<div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 sm:px-4 sm:text-sm">
								<Sparkles className="h-4 w-4" />
								健文社区问题宇宙
							</div>
							<h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl md:text-6xl">
								问题星空
							</h1>
							<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base md:text-lg md:leading-8">
								从评论区、平台私信、微信群聊、网站和腾讯文档里沉淀出的 3D 问题宇宙。相似问题会彼此连线，重复问题会自动提示。
							</p>
							<div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
								<a
									href="#question-submit"
									className="neon-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold sm:px-5"
								>
									提交新问题
									<Send className="h-4 w-4" />
								</a>
								<a
									href="#question-cosmos"
									className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/12 sm:px-5"
								>
									进入星空
									<ArrowUpRight className="h-4 w-4" />
								</a>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2 sm:gap-3">
							{statCards.map((item) => (
								<div
									key={item.label}
									className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur sm:rounded-3xl sm:p-5"
								>
									<p className="text-xl font-black text-white sm:text-2xl md:text-3xl">
										{item.value}
									</p>
									<p className="mt-2 text-sm text-slate-400">{item.label}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<section id="question-cosmos" className="mt-8">
				<QuestionStarMap
					questions={stars}
					semanticEdges={starEdges}
					loading={starLoading && stars.length === 0}
					onSameQuestion={handleSameQuestion}
				/>
			</section>

			<section className="mt-8">
				<div className="mb-4 flex items-center justify-between gap-4">
					<h2 className="flex items-center gap-2 text-lg font-black text-white sm:text-xl">
						<Filter className="h-5 w-5 text-cyan-200" />
						问题星座
					</h2>
					<button
						type="button"
						onClick={() => handleTopicSelect(null)}
						className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
					>
						全部星区
					</button>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
					{QUESTION_TOPICS.map((topic) => {
						const active = selectedTopic === topic;
						const count = stats?.byTopic[topic] || 0;
						return (
							<button
								key={topic}
								type="button"
								onClick={() => handleTopicSelect(active ? null : topic)}
								className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition hover:-translate-y-1 sm:rounded-3xl ${
									topicAccent[topic]
								} ${active ? "ring-2 ring-white/60" : ""}`}
							>
								<div className="flex items-center justify-between gap-3">
									<p className="font-black">{topic}</p>
									<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
										{count || "·"}
									</span>
								</div>
								<p className="mt-2 text-sm opacity-80">{topicCopy[topic]}</p>
							</button>
						);
					})}
				</div>
			</section>

			<section className="mt-8 grid gap-5 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)] lg:gap-8">
				<aside id="question-submit" className="space-y-6">
					<form
						onSubmit={handleSubmitQuestion}
						className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 shadow-xl shadow-slate-950/25 sm:rounded-3xl sm:p-6"
					>
						<h2 className="flex items-center gap-2 text-xl font-black text-white">
							<MessageCircle className="h-5 w-5 text-cyan-200" />
							把你的问题送上星球
						</h2>
						<div className="mt-5 grid gap-3">
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
									<p className="mt-3 text-xs text-amber-100/75">
										如果已有问题很接近，点进去“我也想问”会比重复提交更容易把它推上回答优先级。
									</p>
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
								disabled={
									submitting || !questionContent.trim() || !captchaValid
								}
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
						</div>
					</form>

					<div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 sm:rounded-3xl sm:p-6">
						<h3 className="flex items-center gap-2 text-base font-bold text-white">
							<Tag className="h-4 w-4 text-cyan-200" />
							热门标签
						</h3>
						<div className="mt-4 flex flex-wrap gap-2">
							{tags.slice(0, 18).map((tag) => (
								<button
									key={tag}
									type="button"
									onClick={() => handleTagSelect(selectedTag === tag ? null : tag)}
									className={`rounded-full border px-3 py-1.5 text-xs transition ${
										selectedTag === tag
											? "border-cyan-300/50 bg-cyan-300/15 text-cyan-50"
											: "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
									}`}
								>
									#{tag}
								</button>
							))}
						</div>
					</div>
				</aside>

				<section id="question-list" className="min-w-0">
					<div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 sm:rounded-3xl sm:p-5">
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
							<div className="relative">
								<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
								<input
									type="text"
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									placeholder="搜索问题、回答、标签"
									className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400"
								/>
							</div>
							<select
								value={sort}
								onChange={(event) => setSort(event.target.value as typeof sort)}
								className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400"
							>
								<option value="default">综合优先</option>
								<option value="same">同问优先</option>
								<option value="source">来源优先</option>
								<option value="latest">最新优先</option>
							</select>
						</div>

						<div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
							<span>当前星区：</span>
							<span className="rounded-full bg-white/8 px-3 py-1 text-slate-200">
								{selectedTopic || selectedTag || "全部问题"}
							</span>
							{(selectedTopic || selectedTag || searchQuery) && (
								<button
									type="button"
									onClick={() => {
										setSelectedTopic(null);
										handleTagSelect(null);
										setSearchQuery("");
									}}
									className="text-cyan-200 hover:text-cyan-100"
								>
									清空筛选
								</button>
							)}
						</div>
					</div>

					<div className="mt-5">
						{loading ? (
							<div className="rounded-2xl border border-white/10 bg-slate-950/65 py-14 text-center sm:rounded-3xl sm:py-16">
								<div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
								<p className="mt-3 text-slate-400">问题星区加载中...</p>
							</div>
						) : questions.length === 0 ? (
							<div className="rounded-2xl border border-white/10 bg-slate-950/65 py-14 text-center sm:rounded-3xl sm:py-16">
								<Sparkles className="mx-auto h-10 w-10 text-slate-500" />
								<p className="mt-3 text-slate-400">没有找到匹配的问题。</p>
							</div>
						) : (
							<div className="space-y-3">
								{questions.map((question) => {
									const topic = normalizeQuestionTopic(question.topic);
									const isAnswered = Boolean(question.answer);
									return (
										<article
											key={question.id}
											className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 transition hover:border-cyan-300/25 hover:bg-slate-900/70 sm:rounded-3xl sm:p-5"
										>
											<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
															{topic}
														</span>
														{isAnswered ? (
															<span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-200">
																<CheckCircle className="h-3.5 w-3.5" />
																已点亮
															</span>
														) : (
															<span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">
																<Clock className="h-3.5 w-3.5" />
																待回答
															</span>
														)}
													</div>
													<Link
														to={`/qa/${question.id}`}
														className="mt-3 block text-base font-bold leading-snug text-white transition hover:text-cyan-100 sm:text-lg"
													>
														{question.content}
													</Link>
													{question.answer && (
														<p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
															{question.answer.replace(/[#*`]/g, "").slice(0, 110)}
															...
														</p>
													)}
													<div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
														<span className="inline-flex items-center gap-1">
															<Users className="h-3.5 w-3.5" />
															{question.same_question_count || 0} 人同问
														</span>
														<span className="inline-flex items-center gap-1">
															<Zap className="h-3.5 w-3.5" />
															{question.source_count || 1} 次来源
														</span>
														<span className="inline-flex items-center gap-1">
															<Eye className="h-3.5 w-3.5" />
															{question.view_count || 0}
														</span>
														<span>{formatDate(question.answered_at || question.created_at)}</span>
														{question.tags?.slice(0, 3).map((tag) => (
															<span key={tag} className="text-cyan-300/80">
																#{tag}
															</span>
														))}
													</div>
												</div>
												<div className="grid shrink-0 grid-cols-2 gap-2 md:flex md:flex-col">
													<button
														type="button"
														onClick={() => handleSameQuestion(question)}
														className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 sm:px-4"
													>
														我也想问
													</button>
													<Link
														to={`/qa/${question.id}`}
														className="inline-flex items-center justify-center gap-1 rounded-2xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:px-4"
													>
														详情
														<ArrowUpRight className="h-4 w-4" />
													</Link>
												</div>
											</div>
										</article>
									);
								})}
							</div>
						)}

						{questions.length > 0 && hasMore && (
							<div className="mt-7 text-center">
								<button
									type="button"
									onClick={() => loadQuestionData(true)}
									disabled={loadingMore}
									className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
								>
									{loadingMore ? "加载中..." : "加载更多问题"}
								</button>
							</div>
						)}
					</div>
				</section>
			</section>

			{sameToast && (
				<div className="fixed bottom-4 left-3 right-3 z-50 rounded-2xl border border-cyan-300/25 bg-slate-950/90 px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-2xl shadow-cyan-950/40 backdrop-blur sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full sm:px-5">
					{sameToast}
				</div>
			)}
		</div>
	);
};

export default QAHome;
