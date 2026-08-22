import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PATH_ID = "first-real-ai-task-v1";
const PROJECT_STEP_ID = "AI7-S7";
const MASTERY_STEP_ID = "AI7-S8";

const dimensionLabels: Record<string, string> = {
  M: "AI心智模型",
  F: "任务定义与沟通",
  T: "工具与信息素养",
  V: "核验、安全与责任",
  C: "创造与执行",
  S: "工作流与系统思维",
};

const legacyDimensionMap: Record<string, string> = {
  cognition: "M",
  usage: "T",
  communication: "F",
  verification: "V",
  creation: "C",
  systems: "S",
};

const moduleByDimension: Record<string, string> = {
  M: "TECH-01",
  F: "CORE-03",
  T: "DIGI-01",
  V: "CORE-04",
  C: "CORE-05",
  S: "SYS-01",
};

const levelTitles = [
  "AI观察者",
  "AI辅助使用者",
  "AI独立操作者",
  "AI协作者",
  "AI系统构建者",
  "AI变革推动者",
] as const;

type JsonObject = Record<string, unknown>;

type UserLike = {
  id: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serviceClient() {
  return createClient(
    env("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireUser(req: Request): Promise<UserLike> {
  const authorization = req.headers.get("authorization");
  if (!authorization) throw new HttpError(401, "游客身份已失效，请刷新后重试");
  const client = createClient(
    env("SUPABASE_URL"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "游客身份已失效，请刷新后重试");
  return data.user as UserLike;
}

function isAnonymousUser(user: UserLike) {
  return user.is_anonymous === true || user.app_metadata?.provider === "anonymous";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function normalizeDimensionScores(value: unknown) {
  const source = asObject(value);
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const dimension = legacyDimensionMap[key] || key;
    if (!(dimension in dimensionLabels)) continue;
    const score = Number(raw);
    if (Number.isFinite(score)) result[dimension] = Math.max(0, Math.min(100, score));
  }
  return result;
}

function recommendationFor(scores: Record<string, number>, goal: string | null) {
  const dimensions = Object.keys(dimensionLabels);
  const ranked = dimensions
    .map((dimension) => ({ dimension, score: scores[dimension] ?? 0 }))
    .sort((a, b) => a.score - b.score);
  const safety = ranked.find((entry) => entry.dimension === "V");
  const growth = safety && safety.score < 60 ? safety : ranked[0];
  const goalNames: Record<string, string> = {
    office: "办公提效",
    content: "内容创作",
    learning: "学习研究",
    product: "产品创业",
    programming: "编程自动化",
  };
  return {
    gate: {
      dimension: growth.dimension,
      label: dimensionLabels[growth.dimension],
      score: Math.round(growth.score),
      module_code: moduleByDimension[growth.dimension],
      reason: growth.dimension === "V"
        ? "核验和安全是进入更复杂任务前必须补齐的基础闸门。"
        : `这是当前六维中最值得优先补齐的一项。`,
    },
    lesson: {
      content_unit_id: growth.dimension === "V" ? "AI7-D4" : "AI7-D2",
      title: growth.dimension === "V" ? "把AI答案变成证据链" : "把模糊想法改成任务契约",
    },
    project: {
      content_unit_id: "AI7-D7",
      task_code: "F01-LITE-V1",
      title: "完成第一份可验收、可修改、可交接的AI作品",
      goal_label: goalNames[goal || ""] || "通用真实任务",
    },
  };
}

async function latestCapabilityAttempt(service: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await service
    .from("ai_assessment_attempts")
    .select("id, assessment_version, framework_version, result_status, evidence_grade, ability_level, total_score, dimension_scores, competency_scores, learning_goal, created_at")
    .eq("user_id", userId)
    .eq("kind", "capability")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function pathDefinition(service: ReturnType<typeof serviceClient>) {
  const { data: path, error: pathError } = await service
    .from("ai_learning_paths")
    .select("id, version, title, summary, duration_days, target_levels, status, config")
    .eq("id", PATH_ID)
    .eq("status", "pilot")
    .single();
  if (pathError) throw pathError;

  const { data: steps, error: stepError } = await service
    .from("ai_learning_path_steps")
    .select("id, day_no, position, content_unit_id, step_type, required, config")
    .eq("path_id", PATH_ID)
    .order("position", { ascending: true });
  if (stepError) throw stepError;

  const unitIds = (steps || []).map((step) => step.content_unit_id);
  const { data: units, error: unitError } = await service
    .from("ai_content_units")
    .select("id, module_code, title, summary, estimated_minutes, content_kind, metadata")
    .in("id", unitIds)
    .eq("status", "pilot");
  if (unitError) throw unitError;
  const unitMap = new Map((units || []).map((unit) => [unit.id, unit]));
  return { path, steps: (steps || []).map((step) => ({ ...step, unit: unitMap.get(step.content_unit_id) })) };
}

async function ownEnrollment(service: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await service
    .from("ai_learning_enrollments")
    .select("id, path_id, source_attempt_id, learning_goal, status, current_position, started_at, completed_at, updated_at")
    .eq("user_id", userId)
    .eq("path_id", PATH_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function learningProgress(service: ReturnType<typeof serviceClient>, enrollmentId: string | null) {
  if (!enrollmentId) return [];
  const { data, error } = await service
    .from("ai_learning_progress")
    .select("step_id, status, score, started_at, completed_at")
    .eq("enrollment_id", enrollmentId);
  if (error) throw error;
  return data || [];
}

async function groupStatus(service: ReturnType<typeof serviceClient>, userId: string) {
  const { data: membership, error } = await service
    .from("ai_group_memberships")
    .select("route_level, access_status, display_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return null;
  const { data: route } = await service
    .from("ai_group_routes")
    .select("group_name, description")
    .eq("level", membership.route_level)
    .maybeSingle();
  return { ...membership, group_name: route?.group_name || null, description: route?.description || null };
}

async function routeCatalog(service: ReturnType<typeof serviceClient>, currentLevel: number | null) {
  const { data: routes, error: routeError } = await service.from("ai_learning_routes")
    .select("level, title, group_code, module_codes, gate_config, status").order("level", { ascending: true });
  if (routeError) throw routeError;
  const codes = [...new Set((routes || []).flatMap((route) => Array.isArray(route.module_codes) ? route.module_codes.map(String) : []))];
  const { data: modules, error: moduleError } = await service.from("ai_learning_modules")
    .select("code, title, module_type, learning_outcome, status").in("code", codes);
  if (moduleError) throw moduleError;
  const moduleMap = new Map((modules || []).map((module) => [module.code, module]));
  const recommendedLevel = currentLevel === null ? null : Math.max(0, Math.min(4, currentLevel));
  return (routes || []).map((route) => ({
    level: route.level,
    title: route.title,
    group_code: route.group_code,
    gate_config: route.gate_config,
    recommended: route.level === recommendedLevel,
    modules: (Array.isArray(route.module_codes) ? route.module_codes : []).map((code) => moduleMap.get(String(code))).filter(Boolean),
  }));
}

async function dashboard(service: ReturnType<typeof serviceClient>, user: UserLike) {
  const [attempt, definition, enrollment, group] = await Promise.all([
    latestCapabilityAttempt(service, user.id),
    pathDefinition(service),
    ownEnrollment(service, user.id),
    groupStatus(service, user.id),
  ]);
  const progress = await learningProgress(service, enrollment?.id || null);
  const progressMap = new Map(progress.map((row) => [row.step_id, row]));
  const scores = normalizeDimensionScores(attempt?.dimension_scores);
  const isCurrent = Boolean(
    attempt && attempt.result_status !== "legacy" && attempt.result_status !== "invalidated" &&
      attempt.framework_version !== "legacy-ai-portrait-v2",
  );
  const currentAttempt = isCurrent ? attempt! : null;
  const currentPosition = enrollment?.current_position || 1;
  const routes = await routeCatalog(service, currentAttempt ? Number(currentAttempt.ability_level || 0) : null);
  return {
    account: {
      anonymous: isAnonymousUser(user),
      can_enroll: !isAnonymousUser(user),
    },
    assessment: currentAttempt
      ? {
        id: currentAttempt.id,
        ability_level: currentAttempt.ability_level,
        level_title: levelTitles[Math.max(0, Math.min(5, Number(currentAttempt.ability_level || 0)))],
        total_score: currentAttempt.total_score,
        learning_goal: currentAttempt.learning_goal,
        dimension_scores: scores,
        created_at: currentAttempt.created_at,
      }
      : null,
    needs_assessment: !isCurrent,
    recommendation: currentAttempt ? recommendationFor(scores, currentAttempt.learning_goal) : null,
    path: {
      id: definition.path.id,
      title: definition.path.title,
      summary: definition.path.summary,
      duration_days: definition.path.duration_days,
      enrolled: Boolean(enrollment),
      enrollment_status: enrollment?.status || null,
      current_position: currentPosition,
      completed_count: progress.filter((row) => row.status === "completed").length,
      steps: definition.steps.map((step) => {
        const row = progressMap.get(step.id);
        return {
          id: step.id,
          day_no: step.day_no,
          position: step.position,
          step_type: step.step_type,
          title: step.unit?.title || "学习步骤",
          summary: step.unit?.summary || "",
          module_code: step.unit?.module_code || null,
          estimated_minutes: step.unit?.estimated_minutes || 0,
          status: row?.status || (enrollment && step.position === currentPosition ? "in_progress" : "not_started"),
          locked: !enrollment || step.position > currentPosition,
        };
      }),
    },
    route_library: routes,
    group,
  };
}

async function enroll(service: ReturnType<typeof serviceClient>, user: UserLike) {
  if (isAnonymousUser(user)) throw new HttpError(403, "登录正式账号后才能保存学习进度");
  const attempt = await latestCapabilityAttempt(service, user.id);
  if (!attempt || attempt.result_status === "legacy" || attempt.result_status === "invalidated") {
    throw new HttpError(409, "请先完成当前AI能力测评");
  }
  const existing = await ownEnrollment(service, user.id);
  if (existing) return existing;
  const goal = ["office", "content", "learning", "product", "programming"].includes(attempt.learning_goal)
    ? attempt.learning_goal
    : "learning";
  const { data, error } = await service
    .from("ai_learning_enrollments")
    .insert({
      user_id: user.id,
      path_id: PATH_ID,
      source_attempt_id: attempt.id,
      learning_goal: goal,
      status: "active",
      current_position: 1,
    })
    .select("id, path_id, source_attempt_id, learning_goal, status, current_position, started_at")
    .single();
  if (error) throw error;
  const { data: steps, error: stepsError } = await service
    .from("ai_learning_path_steps")
    .select("id, position")
    .eq("path_id", PATH_ID);
  if (stepsError) throw stepsError;
  const { error: progressError } = await service.from("ai_learning_progress").insert(
    (steps || []).map((step) => ({
      enrollment_id: data.id,
      step_id: step.id,
      status: step.position === 1 ? "in_progress" : "not_started",
      started_at: step.position === 1 ? new Date().toISOString() : null,
    })),
  );
  if (progressError) throw progressError;
  return data;
}

async function loadStep(service: ReturnType<typeof serviceClient>, user: UserLike, stepId: string) {
  const { data: step, error: stepError } = await service
    .from("ai_learning_path_steps")
    .select("id, day_no, position, content_unit_id, step_type, config")
    .eq("id", stepId)
    .eq("path_id", PATH_ID)
    .single();
  if (stepError) throw new HttpError(404, "学习步骤不存在");
  const enrollment = await ownEnrollment(service, user.id);
  const preview = !enrollment && step.position === 1;
  if (!preview && !enrollment) throw new HttpError(403, "请先登录并领取学习路径");
  if (enrollment && step.position > enrollment.current_position) throw new HttpError(403, "请先完成前面的学习步骤");
  const { data: unit, error: unitError } = await service
    .from("ai_content_units")
    .select("id, module_code, title, summary, body_markdown, estimated_minutes, content_kind, metadata")
    .eq("id", step.content_unit_id)
    .eq("status", "pilot")
    .single();
  if (unitError) throw unitError;
  const config = asObject(step.config);
  const publicConfig = { ...config };
  if (Array.isArray(config.questions)) {
    publicConfig.questions = config.questions.map((question) => {
      const record = asObject(question);
      return { id: record.id, prompt: record.prompt, options: record.options };
    });
  }
  return { step: { ...step, config: publicConfig, unit }, preview, enrollment_id: enrollment?.id || null };
}

async function completeStep(
  service: ReturnType<typeof serviceClient>,
  user: UserLike,
  stepId: string,
  response: unknown,
) {
  if (isAnonymousUser(user)) throw new HttpError(403, "登录正式账号后才能保存学习进度");
  const loaded = await loadStep(service, user, stepId);
  const enrollment = await ownEnrollment(service, user.id);
  if (!enrollment) throw new HttpError(403, "请先领取学习路径");
  if (["project", "mastery_check"].includes(loaded.step.step_type)) {
    throw new HttpError(400, "该步骤需要使用专用提交入口");
  }
  const config = asObject(loaded.step.config);
  const text = typeof response === "string" ? response.trim() : "";
  const minimum = Number(config.minimum_characters || 10);
  if (config.response_required !== false && text.length < minimum) {
    throw new HttpError(400, `请至少填写${minimum}个字，留下可复核的学习证据`);
  }
  const now = new Date().toISOString();
  const { error } = await service.from("ai_learning_progress").upsert({
    enrollment_id: enrollment.id,
    step_id: stepId,
    status: "completed",
    response_payload: { text },
    started_at: now,
    completed_at: now,
  }, { onConflict: "enrollment_id,step_id" });
  if (error) throw error;
  if (loaded.step.position >= enrollment.current_position) {
    const nextPosition = loaded.step.position + 1;
    const { error: enrollmentError } = await service
      .from("ai_learning_enrollments")
      .update({ current_position: nextPosition })
      .eq("id", enrollment.id)
      .eq("user_id", user.id);
    if (enrollmentError) throw enrollmentError;
    await service.from("ai_learning_progress").update({ status: "in_progress", started_at: now })
      .eq("enrollment_id", enrollment.id)
      .eq("step_id", `AI7-S${nextPosition}`)
      .eq("status", "not_started");
  }
  return { completed: true, next_position: loaded.step.position + 1 };
}

function deterministicFeedback(submission: string) {
  const lower = submission.toLowerCase();
  const hasUnderstanding = /任务理解|待确认|目标|受众/.test(submission);
  const hasDrafts = /初稿/.test(submission) && /终稿/.test(submission);
  const hasAcceptance = /验收|检查清单|发布前/.test(submission);
  const hasChange = /变更|修改|修订/.test(submission);
  const hasEvidence = /来源|核验|记录|工具/.test(submission);
  const forbidden = /权威认证|完全匿名|绝不泄露|必须付费|自动进群/.test(submission);
  const scores = {
    task_understanding: hasUnderstanding ? 16 : 8,
    fact_accuracy: forbidden ? 4 : lower.length >= 500 ? 17 : 12,
    acceptance_and_risk: hasAcceptance ? 17 : 8,
    iteration_quality: hasDrafts && hasChange ? 13 : 6,
    user_usability: submission.length >= 450 ? 12 : 8,
    handoff_evidence: hasEvidence ? 8 : 4,
  };
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const strengths = [
    hasUnderstanding ? "已经显式说明任务目标与受众。" : "已经形成一份可继续修改的完整提交。",
    hasAcceptance ? "包含发布前验收意识。" : "表达结构具备继续打磨的基础。",
  ];
  const improvements = [
    !hasDrafts ? "补齐初稿与终稿，让迭代证据可见。" : null,
    !hasChange ? "说明关键修改以及修改理由。" : null,
    !hasEvidence ? "补充工具、核验或关键决策记录。" : null,
    forbidden ? "删除权威认证、绝对隐私、必须付费或自动进群等不实承诺。" : null,
  ].filter(Boolean);
  return {
    total_score: Math.max(0, Math.min(100, total)),
    rubric_scores: scores,
    overview: forbidden
      ? "提交包含重大事实或承诺风险，需要先修正后再发布。"
      : "你已经完成从模糊需求到可检查交付物的第一次闭环。",
    strengths,
    improvements: improvements.length ? improvements : ["下一步可以进一步压缩表达并让证据定位更精确。"],
    next_action: improvements[0] || "选择一条用户反馈，再做一次针对性修订。",
  };
}

async function llmFeedback(submission: string, fallback: ReturnType<typeof deterministicFeedback>) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  if (!apiKey) return { payload: fallback, source: "fallback", model: null };
  const baseUrl = (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, "");
  const model = Deno.env.get("DEEPSEEK_LEARNING_MODEL")?.trim() ||
    Deno.env.get("DEEPSEEK_ASSESSMENT_MODEL")?.trim() ||
    Deno.env.get("DEEPSEEK_MODEL")?.trim() || "deepseek-chat";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是AI学习作品教练。只根据用户提交给出可执行反馈，不披露内部答案或隐藏思维。输出JSON：total_score(0-100), rubric_scores对象, overview, strengths字符串数组, improvements字符串数组, next_action。重点检查任务理解、事实准确、验收风险、迭代、可用性和交接证据。出现权威认证、完全匿名、绝不泄露、必须付费或自动进群等错误时明确指出。",
          },
          { role: "user", content: submission.slice(0, 12000) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const body = await response.json();
    const raw = body?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(String(raw || "{}"));
    if (!Number.isFinite(Number(parsed.total_score))) throw new Error("Invalid learning feedback");
    return {
      payload: {
        total_score: Math.max(0, Math.min(100, Number(parsed.total_score))),
        rubric_scores: asObject(parsed.rubric_scores),
        overview: String(parsed.overview || fallback.overview),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 4) : fallback.strengths,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 4) : fallback.improvements,
        next_action: String(parsed.next_action || fallback.next_action),
      },
      source: "llm",
      model,
    };
  } catch {
    return { payload: fallback, source: "fallback", model };
  } finally {
    clearTimeout(timeout);
  }
}

async function submitProject(service: ReturnType<typeof serviceClient>, user: UserLike, body: JsonObject) {
  if (isAnonymousUser(user)) throw new HttpError(403, "登录正式账号后才能提交作品");
  const enrollment = await ownEnrollment(service, user.id);
  if (!enrollment) throw new HttpError(403, "请先领取学习路径");
  if (enrollment.current_position < 7) throw new HttpError(403, "请先完成前面的学习步骤");
  const submission = typeof body.submission_text === "string" ? body.submission_text.trim() : "";
  if (submission.length < 300) throw new HttpError(400, "结课作品至少需要300个字");
  if (submission.length > 12000) throw new HttpError(400, "结课作品不能超过12000个字");
  const submissionUrl = typeof body.submission_url === "string" && body.submission_url.trim()
    ? body.submission_url.trim().slice(0, 1000)
    : null;
  const deterministic = deterministicFeedback(submission);
  const generated = await llmFeedback(submission, deterministic);
  const now = new Date().toISOString();
  const { data: project, error } = await service.from("ai_learning_projects").upsert({
    user_id: user.id,
    enrollment_id: enrollment.id,
    task_code: "F01-LITE-V1",
    learning_goal: enrollment.learning_goal,
    submission_text: submission,
    submission_url: submissionUrl,
    status: generated.source === "llm" ? "scored" : "feedback_fallback",
    rubric_scores: generated.payload.rubric_scores,
    feedback_summary: generated.payload.overview,
    submitted_at: now,
  }, { onConflict: "enrollment_id,task_code" })
    .select("id, status, rubric_scores, feedback_summary, submitted_at")
    .single();
  if (error) throw error;
  const { error: feedbackError } = await service.from("ai_learning_feedback").insert({
    project_id: project.id,
    scorer_type: generated.source,
    status: generated.source === "llm" ? "ready" : "fallback",
    model: generated.model,
    prompt_version: "f01-lite-feedback-1.0.0",
    feedback_payload: generated.payload,
  });
  if (feedbackError) throw feedbackError;
  await service.from("ai_learning_progress").upsert({
    enrollment_id: enrollment.id,
    step_id: PROJECT_STEP_ID,
    status: "completed",
    response_payload: { project_id: project.id },
    score: generated.payload.total_score,
    started_at: now,
    completed_at: now,
  }, { onConflict: "enrollment_id,step_id" });
  await service.from("ai_learning_progress").update({ status: "in_progress", started_at: now })
    .eq("enrollment_id", enrollment.id)
    .eq("step_id", MASTERY_STEP_ID);
  await service.from("ai_learning_enrollments").update({ current_position: 8 })
    .eq("id", enrollment.id)
    .eq("user_id", user.id);
  return { project, feedback: generated.payload, feedback_source: generated.source };
}

async function submitMastery(service: ReturnType<typeof serviceClient>, user: UserLike, body: JsonObject) {
  if (isAnonymousUser(user)) throw new HttpError(403, "登录正式账号后才能完成掌握检查");
  const enrollment = await ownEnrollment(service, user.id);
  if (!enrollment || enrollment.current_position < 8) throw new HttpError(403, "请先提交结课作品");
  const { data: step, error: stepError } = await service
    .from("ai_learning_path_steps")
    .select("config")
    .eq("id", MASTERY_STEP_ID)
    .single();
  if (stepError) throw stepError;
  const questions = asObject(step.config).questions;
  if (!Array.isArray(questions)) throw new Error("Mastery questions missing");
  const responses = Array.isArray(body.responses) ? body.responses : [];
  const responseMap = new Map(responses.map((entry) => {
    const record = asObject(entry);
    return [String(record.item_id || ""), String(record.value || "")];
  }));
  if (responseMap.size !== questions.length) throw new HttpError(400, `请完成全部${questions.length}题`);
  let correct = 0;
  for (const question of questions) {
    const record = asObject(question);
    if (responseMap.get(String(record.id)) === String(record.answer)) correct += 1;
  }
  const masteryScore = Math.round((correct / questions.length) * 100);
  const attempt = await latestCapabilityAttempt(service, user.id);
  const scores = normalizeDimensionScores(attempt?.dimension_scores);
  const baselineValues = ["M", "F", "V", "C"].map((key) => scores[key]).filter(Number.isFinite);
  const baseline = baselineValues.length
    ? Math.round(baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length)
    : null;
  const now = new Date().toISOString();
  const resultPayload = {
    correct,
    total: questions.length,
    label: masteryScore >= 80 ? "已掌握" : masteryScore >= 60 ? "基本掌握" : "建议复习",
    note: "该分数只表示7天路径掌握程度，不改变正式AI能力等级或群权益。",
  };
  const { error: retestError } = await service.from("ai_learning_retests").upsert({
    user_id: user.id,
    enrollment_id: enrollment.id,
    source_attempt_id: attempt?.id || null,
    response_payload: responses,
    baseline_score: baseline,
    mastery_score: masteryScore,
    result_payload: resultPayload,
    completed_at: now,
  }, { onConflict: "enrollment_id" });
  if (retestError) throw retestError;
  await service.from("ai_learning_progress").upsert({
    enrollment_id: enrollment.id,
    step_id: MASTERY_STEP_ID,
    status: "completed",
    response_payload: { responses },
    score: masteryScore,
    started_at: now,
    completed_at: now,
  }, { onConflict: "enrollment_id,step_id" });
  await service.from("ai_learning_enrollments").update({
    status: "completed",
    current_position: 8,
    completed_at: now,
  }).eq("id", enrollment.id).eq("user_id", user.id);
  return { mastery_score: masteryScore, baseline_score: baseline, result: resultPayload };
}

async function projects(service: ReturnType<typeof serviceClient>, user: UserLike) {
  const { data, error } = await service
    .from("ai_learning_projects")
    .select("id, task_code, learning_goal, status, rubric_scores, feedback_summary, submitted_at, submission_url")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  const projectIds = (data || []).map((project) => project.id);
  const { data: feedback } = projectIds.length
    ? await service.from("ai_learning_feedback")
      .select("project_id, status, model, feedback_payload, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
    : { data: [] };
  const latestFeedback = new Map<string, unknown>();
  for (const row of feedback || []) {
    if (!latestFeedback.has(row.project_id)) latestFeedback.set(row.project_id, row);
  }
  return (data || []).map((project) => ({ ...project, feedback: latestFeedback.get(project.id) || null }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const service = serviceClient();
    const body = asObject(await req.json().catch(() => ({})));
    const action = String(body.action || "dashboard");
    if (action === "dashboard") return json(await dashboard(service, user));
    if (action === "enroll") return json({ enrollment: await enroll(service, user) });
    if (action === "step") return json(await loadStep(service, user, String(body.step_id || "")));
    if (action === "complete-step") {
      return json(await completeStep(service, user, String(body.step_id || ""), body.response));
    }
    if (action === "submit-project") return json(await submitProject(service, user, body));
    if (action === "submit-mastery") return json(await submitMastery(service, user, body));
    if (action === "projects") return json({ projects: await projects(service, user) });
    throw new HttpError(400, "未知学习操作");
  } catch (error) {
    console.error("ai-learning-engine", error);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : "学习服务暂时不可用" }, 500);
  }
});
