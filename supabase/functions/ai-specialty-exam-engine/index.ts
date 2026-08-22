import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BANK_VERSION = "ai-six-paper-bank-1.0.0-candidate";
const MATERIAL_BUCKET = "ai-assessment-private";
const MATERIAL_PATH = "f-v1/candidate/student-materials-v1.zip";

const papers = {
  A: { title: "AI技术原理与模型认知", short: "模型不是魔法，先把概念和边界弄明白。", minutes: { standard: 45, full: 85 } },
  B: { title: "AI使用与任务工程", short: "从会聊天到能把真实任务交付清楚。", minutes: { standard: 45, full: 85 } },
  C: { title: "信息检索、核验与安全", short: "判断来源、数字、隐私和高风险边界。", minutes: { standard: 50, full: 90 } },
  D: { title: "计算机与编程基础", short: "文件、终端、代码、API和调试的数字底座。", minutes: { standard: 50, full: 95 } },
  E: { title: "Workflow、Agent与系统能力", short: "把流程、状态、工具、权限和失败恢复连起来。", minutes: { standard: 55, full: 100 } },
  F: { title: "AI综合实战", short: "用真实任务证明你能把事情可靠地做成。", minutes: { standard: 90, full: 180 } },
} as const;

const fTaskGuidance: Record<string, { title: string; summary: string; deliverables: string[] }> = {
  F00: { title: "跨任务过程记录、自检与交接", summary: "贯穿F01—F09记录关键操作、版本、自检和人机分工。", deliverables: ["工具与环境披露", "3—8个关键操作记录", "版本与修改说明", "自检、耗时与未完成项"] },
  F01: { title: "模糊需求到可验收交付物", summary: "根据多方材料完成一份准确、克制、能真正发布的产品说明。", deliverables: ["任务理解与待确认事项", "初稿与终稿", "发布前验收清单", "变更说明与关键操作记录"] },
  F02: { title: "证据审计、数字核验与安全判断", summary: "拆解AI简报中的主张，逐条核验来源、数字、因果和安全风险。", deliverables: ["8条主张判定表", "主张—来源—问题—改写证据表", "300—500字纠正版摘要", "关键核验记录"] },
  F03: { title: "技术与系统诊断", summary: "阅读配置、日志和Agent轨迹，形成可执行的止损、修复和测试方案。", deliverables: ["问题优先级表", "证据、假设、验证与最小修复", "系统数据流", "至少6个测试用例"] },
  F04: { title: "多文件综合与双受众交付", summary: "围绕断点续答功能，同时服务产品负责人、用户和技术隐私团队。", deliverables: ["上线决策备忘录", "面向用户的功能说明", "技术与隐私验收清单", "灰度、监测和回退方案"] },
  F05: { title: "数据分析与决策建议", summary: "清洗合成数据、统一口径、正确计算并避免把相关性写成因果。", deliverables: ["数据质量与清洗规则", "核心指标与分层计算", "限制与混杂说明", "可执行决策备忘录"] },
  F06: { title: "AI辅助代码修复与测试", summary: "和Coding Agent协作完成最小修复，用真实测试、安全检查和回退证明结果。", deliverables: ["项目理解与修改计划", "可运行修复文件", "测试结果与新增边界测试", "风险、变更和回退说明"] },
  F07: { title: "客户反馈Workflow / Agent设计", summary: "设计一个受控、可恢复、有人工审批和可观测性的反馈处理工作流。", deliverables: ["流程图与数据契约", "状态、异常、重试和幂等设计", "权限与人工审批", "评测、成本和试点计划"] },
  F08: { title: "高权限Agent事故诊断与恢复", summary: "在事故压力下先止损、保全证据，再完成根因、恢复和长期改进。", deliverables: ["30分钟止损动作", "事实、影响与未知", "24小时与7天计划", "回归测试和制度改进"] },
  F09: { title: "组织级AI试点组合", summary: "用统一框架筛选组织AI用例，给出基线、治理、资源和停止条件。", deliverables: ["用例排序框架", "试点组合与取舍", "业务基线与成功指标", "治理、预算和停止条件"] },
  F10: { title: "Day 90真实项目", summary: "把AI用进自己的真实学习、工作、创作、产品或团队流程。", deliverables: ["真实问题与使用前基线", "最终成果与外部验证", "时间、质量、成本和风险比较", "复用资产、交接和继续/停止决定"] },
};

type JsonObject = Record<string, unknown>;
type UserLike = { id: string; is_anonymous?: boolean; app_metadata?: Record<string, unknown> };
type PaperCode = keyof typeof papers;

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serviceClient() {
  return createClient(env("SUPABASE_URL"), Deno.env.get("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireUser(req: Request): Promise<UserLike> {
  const authorization = req.headers.get("authorization");
  if (!authorization) throw new HttpError(401, "游客身份已失效，请刷新页面后重试");
  const client = createClient(env("SUPABASE_URL"), Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "游客身份已失效，请刷新页面后重试");
  return data.user as UserLike;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function paperCode(value: unknown): PaperCode {
  const code = String(value || "").toUpperCase();
  if (!(code in papers)) throw new HttpError(400, "卷子编号无效");
  return code as PaperCode;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function publicItem(row: JsonObject) {
  const prompt = asObject(row.prompt_payload);
  return {
    id: String(row.id),
    paper_code: String(row.paper_code),
    unit_code: String(row.paper_unit_code || prompt.unit_code || ""),
    unit_title: String(prompt.unit_title || ""),
    item_type: String(row.item_type),
    target_level: Number(row.target_level || 0),
    prompt: String(prompt.prompt || ""),
    options: Array.isArray(prompt.options) ? prompt.options : null,
    code: typeof prompt.code === "string" ? prompt.code : null,
  };
}

function selectStandard(rows: JsonObject[]) {
  const choice = shuffle(rows.filter((row) => row.item_type === "choice"));
  const other = shuffle(rows.filter((row) => row.item_type !== "choice"));
  const chosen: JsonObject[] = [];
  const used = new Set<string>();
  for (const row of choice) {
    const unit = String(row.paper_unit_code || "");
    if (used.has(unit)) continue;
    chosen.push(row); used.add(unit);
  }
  for (const row of choice) {
    if (chosen.some((item) => item.id === row.id) || chosen.length >= 13) continue;
    chosen.push(row);
  }
  return shuffle([...chosen.slice(0, 13), ...other.slice(0, 12)]);
}

async function catalog(service: ReturnType<typeof serviceClient>, user: UserLike) {
  const { data: counts, error: countError } = await service.from("ai_assessment_items")
    .select("paper_code, id, item_type, prompt_payload")
    .eq("item_bank_version", BANK_VERSION).eq("status", "candidate");
  if (countError) throw countError;
  const { data: history, error: historyError } = await service.from("ai_specialty_exam_sessions")
    .select("id, paper_code, mode, status, objective_score, objective_max_score, result, completed_at, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  if (historyError) throw historyError;
  const rows = (counts || []) as JsonObject[];
  return {
    beta_notice: "专项卷用于学习诊断和题库练习，不改变正式Level、群分流或支付权益。",
    comprehensive: { id: "comprehensive", title: "AI能力综合摸底卷", item_count: 32, status: "active", price_cents: 0, purpose: "建立Level 0—5正式学习基线" },
    style: { id: "style", title: "AI使用风格画像", item_count: 36, status: "beta", price_cents: 0, purpose: "识别使用偏好，不评价能力高低" },
    papers: (Object.keys(papers) as PaperCode[]).map((code) => {
      const items = rows.filter((row) => row.paper_code === code);
      return {
        code, ...papers[code], item_count: items.length, status: "practice_beta", price_cents: 0,
        modes: code === "F" ? [{ id: "practical", label: "11项真实任务", count: items.length }] : [
          { id: "standard", label: "标准卷", count: 25 }, { id: "full", label: "完整卷", count: items.length },
        ],
        completed_attempts: (history || []).filter((entry) => entry.paper_code === code && entry.status === "completed").length,
        latest: (history || []).find((entry) => entry.paper_code === code) || null,
      };
    }),
    f_tasks: rows.filter((row) => row.paper_code === "F").map((row) => ({
      id: String(row.id), ...(fTaskGuidance[String(row.id)] || { title: String(row.id), summary: "真实任务", deliverables: [] }),
      completed: (history || []).some((entry) => entry.status === "completed" && asObject(entry.result).task_id === row.id),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function startSession(service: ReturnType<typeof serviceClient>, user: UserLike, body: JsonObject) {
  const code = paperCode(body.paper_code);
  const mode = code === "F" ? "practical" : String(body.mode || "standard");
  if (code !== "F" && !["standard", "full"].includes(mode)) throw new HttpError(400, "请选择标准卷或完整卷");
  let selected: JsonObject[] = [];
  let presentation: JsonObject;
  if (code === "F") {
    const taskId = String(body.task_id || "");
    if (!(taskId in fTaskGuidance)) throw new HttpError(400, "请选择一个F卷任务");
    const { data, error } = await service.from("ai_assessment_items").select("id, paper_code, item_type, prompt_payload")
      .eq("item_bank_version", BANK_VERSION).eq("paper_code", "F").eq("id", taskId).eq("status", "candidate").single();
    if (error) throw error;
    selected = [data as JsonObject];
    presentation = { paper: { code, ...papers[code] }, mode, task: { id: taskId, ...fTaskGuidance[taskId] } };
  } else {
    const { data, error } = await service.from("ai_assessment_items")
      .select("id, paper_code, paper_unit_code, item_type, target_level, prompt_payload")
      .eq("item_bank_version", BANK_VERSION).eq("paper_code", code).eq("status", "candidate");
    if (error) throw error;
    const rows = (data || []) as JsonObject[];
    selected = mode === "full" ? shuffle(rows) : selectStandard(rows);
    presentation = { paper: { code, ...papers[code] }, mode, items: selected.map(publicItem), item_count: selected.length };
  }
  const { data: session, error: sessionError } = await service.from("ai_specialty_exam_sessions").insert({
    user_id: user.id, paper_code: code, mode, item_ids: selected.map((row) => String(row.id)), presentation,
  }).select("id, paper_code, mode, presentation, status, expires_at, created_at").single();
  if (sessionError) throw sessionError;
  return session;
}

async function ownedSession(service: ReturnType<typeof serviceClient>, user: UserLike, sessionId: unknown) {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new HttpError(400, "考试会话无效");
  const { data, error } = await service.from("ai_specialty_exam_sessions").select("*").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "没有找到这次考试");
  return data;
}

async function loadSession(service: ReturnType<typeof serviceClient>, user: UserLike, body: JsonObject) {
  const session = await ownedSession(service, user, body.session_id);
  let material_url: string | null = null;
  const taskId = String(asObject(asObject(session.presentation).task).id || "");
  if (session.paper_code === "F" && taskId !== "F10") {
    const { data } = await service.storage.from(MATERIAL_BUCKET).createSignedUrl(MATERIAL_PATH, 3600);
    material_url = data?.signedUrl || null;
  }
  return { session, material_url };
}

function responseValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "").trim();
}

function letters(value: unknown) {
  return [...new Set(String(value || "").toUpperCase().match(/[A-E]/g) || [])];
}

function scoreRuleItem(row: JsonObject, value: unknown) {
  const scoring = asObject(row.scoring_payload);
  const itemType = String(row.item_type);
  const answer = responseValue(value);
  if (itemType === "choice") {
    const options = Array.isArray(scoring.option_scores) ? scoring.option_scores.map(asObject) : [];
    const raw = Number(options.find((option) => String(option.id) === String(answer))?.score ?? 0);
    const max = Math.max(1, ...options.map((option) => Number(option.score || 0)));
    return { raw, max };
  }
  if (itemType === "multi_select") {
    const correct = new Set(letters(scoring.standard_answer));
    const selected = new Set(Array.isArray(answer) ? answer : letters(answer));
    const right = [...selected].filter((item) => correct.has(item)).length;
    const wrong = [...selected].filter((item) => !correct.has(item)).length;
    const raw = Math.max(0, Math.min(4, Math.round((right / Math.max(1, correct.size) * 4 - wrong * 1.5) * 10) / 10));
    return { raw, max: 4 };
  }
  if (itemType === "ordering") {
    const correct = letters(scoring.standard_answer);
    const selected = Array.isArray(answer) ? answer.map(String) : letters(answer);
    const matching = correct.filter((item, index) => selected[index] === item).length;
    return { raw: Math.round((matching / Math.max(1, correct.length) * 4) * 10) / 10, max: 4 };
  }
  return { raw: null, max: null };
}

function fallbackPractical(submission: string) {
  const hasSections = (submission.match(/(^|\n)(#+|\d+\.|[-*])\s/g) || []).length >= 4;
  const hasEvidence = /来源|证据|日志|测试|数据|版本|核验/.test(submission);
  const hasRisk = /风险|隐私|权限|回退|停止|人工/.test(submission);
  const score = Math.min(88, 35 + (submission.length >= 800 ? 18 : 8) + (hasSections ? 14 : 5) + (hasEvidence ? 14 : 4) + (hasRisk ? 12 : 3));
  return { total_score: score, overview: "已收到完整实战提交，当前先提供结构化规则反馈。", strengths: [hasSections ? "交付结构较完整。" : "已经形成可继续迭代的提交。", hasEvidence ? "提交中出现了核验或证据意识。" : "能够围绕任务形成具体内容。"], improvements: [!hasEvidence ? "补充来源、测试或关键判断证据。" : "把证据定位到具体结论。", !hasRisk ? "补充权限、隐私、失败回退或人工责任。" : "明确风险触发后的停止条件。"], next_action: "对照任务交付物清单补齐一轮，再提交人工或AI复核。", source: "fallback" };
}

async function practicalFeedback(task: JsonObject, submission: string) {
  const fallback = fallbackPractical(submission);
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  if (!apiKey) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${(Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get("DEEPSEEK_LEARNING_MODEL") || Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat",
        temperature: 0.2, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是AI综合实战阅卷教练。只按给定任务、量规与提交物评分，不奖励冗长，不索要隐藏思维，不泄露内部参考。输出JSON字段total_score(0-100)、overview、strengths数组、improvements数组、next_action。" },
          { role: "user", content: JSON.stringify({ task: fTaskGuidance[String(task.id)], rubric: asObject(task.scoring_payload).rubric, submission: submission.slice(0, 16000) }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`model ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(String(payload?.choices?.[0]?.message?.content || "{}").replace(/^```json\s*|\s*```$/g, ""));
    if (!Number.isFinite(Number(parsed.total_score))) throw new Error("invalid score");
    return { total_score: Math.max(0, Math.min(100, Number(parsed.total_score))), overview: String(parsed.overview || fallback.overview), strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 4) : fallback.strengths, improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 4) : fallback.improvements, next_action: String(parsed.next_action || fallback.next_action), source: "llm" };
  } catch {
    return fallback;
  } finally { clearTimeout(timer); }
}

async function submitSession(service: ReturnType<typeof serviceClient>, user: UserLike, body: JsonObject) {
  const session = await ownedSession(service, user, body.session_id);
  if (session.status === "completed") return { session, result: session.result };
  if (session.status !== "open" || new Date(session.expires_at).getTime() < Date.now()) throw new HttpError(409, "这次考试已经过期，请重新领取");
  const answers = Array.isArray(body.responses) ? body.responses.map(asObject) : [];
  const responseMap = new Map(answers.map((entry) => [String(entry.item_id), entry.value]));
  if (session.paper_code === "F") {
    const submission = String(responseMap.get(session.item_ids[0]) || "").trim();
    if (submission.length < 300) throw new HttpError(400, "F卷实战提交至少需要300字");
    const { data: task, error } = await service.from("ai_assessment_items").select("id, scoring_payload").eq("id", session.item_ids[0]).single();
    if (error) throw error;
    const feedback = await practicalFeedback(task as JsonObject, submission);
    const { error: responseError } = await service.from("ai_specialty_exam_responses").upsert({ session_id: session.id, item_id: task.id, response_payload: { value: submission }, raw_score: feedback.total_score, max_score: 100, scorer_type: feedback.source === "llm" ? "llm" : "fallback", feedback }, { onConflict: "session_id,item_id" });
    if (responseError) throw responseError;
    const result = { paper_code: "F", task_id: task.id, score: feedback.total_score, feedback, formal_level_effect: false };
    const { data: completed, error: completeError } = await service.from("ai_specialty_exam_sessions").update({ status: "completed", objective_score: feedback.total_score, objective_max_score: 100, result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "open").select("*").single();
    if (completeError) throw completeError;
    return { session: completed, result };
  }
  if (answers.length !== session.item_ids.length || session.item_ids.some((id: string) => !responseMap.has(id))) throw new HttpError(400, `请完成全部${session.item_ids.length}题后交卷`);
  const { data: rows, error } = await service.from("ai_assessment_items").select("id, competency_id, dimension_code, item_type, prompt_payload, scoring_payload, rationale, primary_module").in("id", session.item_ids);
  if (error) throw error;
  const ordered = session.item_ids.map((id: string) => (rows || []).find((row) => row.id === id)).filter(Boolean) as JsonObject[];
  let total = 0; let maxTotal = 0; const reviews: JsonObject[] = []; const responseRows: JsonObject[] = [];
  for (const row of ordered) {
    const value = responseMap.get(String(row.id));
    const score = scoreRuleItem(row, value);
    if (score.raw !== null && score.max !== null) { total += score.raw; maxTotal += score.max; }
    const scoring = asObject(row.scoring_payload);
    const review = { item_id: row.id, item_type: row.item_type, prompt: asObject(row.prompt_payload).prompt, user_answer: value, score: score.raw, max_score: score.max, standard_answer: scoring.standard_answer || null, rationale: row.rationale, rubric: row.item_type === "open" ? scoring.rubric : null, reference_answer: row.item_type === "open" ? scoring.reference_answer : null, module_code: row.primary_module };
    reviews.push(review);
    responseRows.push({ session_id: session.id, item_id: row.id, response_payload: { value }, raw_score: score.raw, max_score: score.max, scorer_type: score.raw === null ? "self_review" : "rule", feedback: review });
  }
  const percent = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0;
  const result = { paper_code: session.paper_code, mode: session.mode, objective_score: Math.round(total * 10) / 10, objective_max_score: maxTotal, percent, objective_items: reviews.filter((item) => item.score !== null).length, self_review_items: reviews.filter((item) => item.score === null).length, label: percent >= 85 ? "掌握扎实" : percent >= 70 ? "基础稳定" : percent >= 55 ? "正在形成" : "建议系统补课", reviews, formal_level_effect: false };
  const { error: responseError } = await service.from("ai_specialty_exam_responses").upsert(responseRows, { onConflict: "session_id,item_id" });
  if (responseError) throw responseError;
  const { data: completed, error: completeError } = await service.from("ai_specialty_exam_sessions").update({ status: "completed", objective_score: total, objective_max_score: maxTotal, result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "open").select("*").single();
  if (completeError) throw completeError;
  return { session: completed, result };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const body = asObject(await req.json().catch(() => ({})));
    const action = String(body.action || "catalog");
    const service = serviceClient();
    if (action === "catalog") return json(await catalog(service, user));
    if (action === "start") return json(await startSession(service, user, body), 201);
    if (action === "session") return json(await loadSession(service, user, body));
    if (action === "submit") return json(await submitSession(service, user, body));
    throw new HttpError(400, "未知操作");
  } catch (error) {
    console.error("ai-specialty-exam-engine", error);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : "专项考试服务暂不可用" }, 500);
  }
});
