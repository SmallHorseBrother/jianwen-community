import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  PACF_DIMENSIONS,
  PACF_QUICK_INSTRUMENT,
  publicPACFQuickForm,
  scorePACFQuick,
} from "../_shared/pacfQuick.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CAPABILITY_VERSION = "capability-v2-2026-08";
const PERSONALITY_VERSION = "personality-v1-2026-08";
const LEGACY_CAPABILITY_FRAMEWORK = "legacy-ai-portrait-v2";
const LEGACY_CAPABILITY_SCORING = "legacy-self-report-v2";
const DIMENSIONS = [
  "cognition",
  "usage",
  "communication",
  "verification",
  "creation",
  "systems",
] as const;
const AXES = ["exploration", "goal", "thinking", "mode"] as const;
const PERSONALITY_NAMES: Record<string, string> = {
  ECTH: "AI灵感探险家",
  ECTS: "AI未来构建者",
  ECAH: "AI创意玩伴",
  ECAS: "AI创作导演",
  EOTH: "AI工具猎人",
  EOTS: "AI自动化先锋",
  EOAH: "AI效率加速器",
  EOAS: "AI智能运营官",
  DCTH: "AI深度创研者",
  DCTS: "AI产品架构师",
  DCAH: "AI匠心共创者",
  DCAS: "AI内容系统师",
  DOTH: "AI方法优化师",
  DOTS: "AI流程工程师",
  DOAH: "AI效率管家",
  DOAS: "AI稳健运营师",
};
const LEVELS = [
  ["AI观察者", "听说过AI，但还没有形成稳定的使用习惯。"],
  ["AI使用者", "会向AI提问，也能完成一些简单的生成任务。"],
  ["AI协作者", "能够与AI多轮协作，完成真实任务的一部分。"],
  ["AI生产者", "能够持续产出内容、产品原型或工作成果。"],
  ["AI系统设计者", "能够设计稳定的工作流、自动化和Agent。"],
  ["AI变革者", "能够推动团队或组织形成新的AI工作方式。"],
] as const;

type CapabilityDimension = typeof DIMENSIONS[number];
type PersonalityAxis = typeof AXES[number];
type AssessmentKind = "capability" | "personality";
type Report = {
  headline: string;
  overview: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  courseRecommendations?: string[];
  combinedPortrait?: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
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
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

async function requireUser(req: Request) {
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
  if (error || !data.user) {
    throw new HttpError(401, "游客身份已失效，请刷新后重试");
  }
  return data.user;
}

function integerAnswers(value: unknown, length: number, allowed: number[]) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new HttpError(400, `测评答案必须包含${length}题`);
  }
  const answers = value.map(Number);
  if (
    answers.some((answer) =>
      !Number.isInteger(answer) || !allowed.includes(answer)
    )
  ) {
    throw new HttpError(400, "测评答案包含无效选项");
  }
  return answers;
}

function scoreCapability(answers: number[]) {
  const raw = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, 0]),
  ) as Record<CapabilityDimension, number>;
  answers.forEach((answer, index) => {
    raw[DIMENSIONS[index % DIMENSIONS.length]] += answer;
  });
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((
      dimension,
    ) => [dimension, Math.round((raw[dimension] / 15) * 100)]),
  ) as Record<CapabilityDimension, number>;
  const total = answers.reduce((sum, answer) => sum + answer, 0);
  let level = Math.min(5, Math.floor(total / 15));
  if (
    level >= 3 && (dimensions.creation < 40 || dimensions.verification < 35)
  ) level = 2;
  if (level >= 4 && (dimensions.systems < 55 || dimensions.creation < 50)) {
    level = 3;
  }
  if (
    level >= 5 &&
    (dimensions.systems < 75 || dimensions.creation < 70 ||
      dimensions.verification < 65)
  ) level = 4;
  const strongest =
    [...DIMENSIONS].sort((a, b) => dimensions[b] - dimensions[a])[0];
  const growthArea =
    [...DIMENSIONS].sort((a, b) => dimensions[a] - dimensions[b])[0];
  return {
    total,
    percentage: Math.round((total / 90) * 100),
    level,
    levelTitle: LEVELS[level][0],
    levelSummary: LEVELS[level][1],
    routeLevel: (level <= 1
      ? "starter"
      : level <= 3
      ? "application"
      : "practice") as "starter" | "application" | "practice",
    dimensions,
    strongest,
    growthArea,
  };
}

function scorePersonality(answers: number[]) {
  const axes = Object.fromEntries(AXES.map((axis) => [axis, 0])) as Record<
    PersonalityAxis,
    number
  >;
  const first = {} as Record<PersonalityAxis, number>;
  answers.forEach((answer, index) => {
    const axis = AXES[Math.floor(index / 7)];
    axes[axis] += answer;
    if (first[axis] === undefined) first[axis] = answer;
  });
  const letterPairs = [["E", "D"], ["C", "O"], ["T", "A"], ["H", "S"]] as const;
  const code = AXES.map((axis, index) =>
    axes[axis] < 0 || (axes[axis] === 0 && first[axis] < 0)
      ? letterPairs[index][0]
      : letterPairs[index][1]
  ).join("");
  return { code, name: PERSONALITY_NAMES[code], axes };
}

function fallbackReport(
  kind: AssessmentKind,
  result: Record<string, unknown>,
  companion?: Record<string, unknown> | null,
): Report {
  if (kind === "capability") {
    const levelTitle = String(result.levelTitle);
    return {
      headline: `你已经站在${levelTitle}的起点上`,
      overview: String(result.levelSummary),
      strengths: [
        "你已经形成了可继续放大的AI使用优势。",
        "真实任务会是你升级最快的训练场。",
      ],
      risks: [
        "不要只追求生成速度，验证质量同样重要。",
        "最低维度会成为进入下一等级的主要瓶颈。",
      ],
      nextSteps: [
        "选择一个每周重复出现的真实任务",
        "为它建立提示词和验收清单",
        "连续使用两周并记录节省时间与返工次数",
      ],
      courseRecommendations: [
        "任务拆解与高质量提问",
        "AI结果验证与信息安全",
        "个人AI工作流入门",
      ],
      combinedPortrait: companion
        ? "你的人格偏好决定了最舒服的学习方式，能力等级决定了当前最需要补齐的台阶。"
        : undefined,
    };
  }
  return {
    headline: `你是${String(result.name)}`,
    overview: "这代表你更自然的人机协作偏好，不代表能力高低。",
    strengths: [
      "你有清晰的AI使用偏好，选对场景时容易进入高效状态。",
      "你的自然倾向可以成为个人AI工作方式的起点。",
    ],
    risks: [
      "长期只使用偏好的一侧，可能忽略另一类任务的价值。",
      "人格标签不能替代真实能力训练。",
    ],
    nextSteps: [
      "选择一个符合你偏好的AI项目",
      "刻意练习一个相反侧的工作方式",
      "继续完成能力测评，获得成长路线",
    ],
    courseRecommendations: [
      "个人AI使用方式设计",
      "人机协作实践",
      "AI能力等级测评",
    ],
    combinedPortrait: companion
      ? "把人格优势用在最薄弱的能力维度上，会形成更适合你的成长路径。"
      : undefined,
  };
}

function normalizeReport(value: unknown, fallback: Report): Report {
  if (!value || typeof value !== "object") return fallback;
  const source = value as Record<string, unknown>;
  const strings = (key: string, count: number, backup: string[]) =>
    Array.isArray(source[key])
      ? (source[key] as unknown[]).filter((item): item is string =>
        typeof item === "string" && item.trim().length > 0
      ).slice(0, count)
      : backup;
  return {
    headline: typeof source.headline === "string"
      ? source.headline
      : fallback.headline,
    overview: typeof source.overview === "string"
      ? source.overview
      : fallback.overview,
    strengths: strings("strengths", 3, fallback.strengths),
    risks: strings("risks", 3, fallback.risks),
    nextSteps: strings("nextSteps", 4, fallback.nextSteps),
    courseRecommendations: strings(
      "courseRecommendations",
      4,
      fallback.courseRecommendations || [],
    ),
    combinedPortrait: typeof source.combinedPortrait === "string"
      ? source.combinedPortrait
      : fallback.combinedPortrait,
  };
}

async function generateReport(
  kind: AssessmentKind,
  result: Record<string, unknown>,
  companion?: Record<string, unknown> | null,
) {
  const fallback = fallbackReport(kind, result, companion);
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  if (!apiKey) return { report: fallback, status: "fallback", model: null };

  const baseUrl =
    (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(
      /\/$/,
      "",
    );
  const model = Deno.env.get("DEEPSEEK_ASSESSMENT_MODEL")?.trim() ||
    Deno.env.get("DEEPSEEK_MODEL")?.trim() || "deepseek-chat";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是AI教育测评报告师。等级和人格编码已经由规则确定，绝不能修改。只输出JSON对象，字段为headline、overview、strengths、risks、nextSteps、courseRecommendations、combinedPortrait。语气温暖、具体、不制造焦虑，不做医学或心理诊断。数组每项不超过45个汉字。",
          },
          {
            role: "user",
            content: JSON.stringify({
              currentAssessment: kind,
              fixedResult: result,
              otherAssessment: companion || null,
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`AI report request failed: ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("AI report response is empty");
    }
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    return {
      report: normalizeReport(parsed, fallback),
      status: "ready",
      model,
    };
  } catch (error) {
    console.error("[ai-assessment-engine] report fallback", error);
    return { report: fallback, status: "fallback", model };
  } finally {
    clearTimeout(timer);
  }
}

function publicAttempt(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    assessment_version: row.assessment_version,
    framework_version: row.framework_version,
    scoring_version: row.scoring_version,
    result_status: row.result_status,
    evidence_grade: row.evidence_grade,
    requires_reassessment: row.requires_reassessment,
    track: row.track,
    learning_goal: row.learning_goal,
    total_score: row.total_score,
    ability_level: row.ability_level,
    personality_code: row.personality_code,
    dimension_scores: row.dimension_scores,
    competency_scores: row.competency_scores,
    gate_status: row.gate_status,
    report: row.ai_report || row.deterministic_report,
    report_status: row.report_status,
    share_token: row.share_token,
    created_at: row.created_at,
  };
}

async function latestAttempts(
  service: ReturnType<typeof serviceClient>,
  userId: string,
) {
  const { data, error } = await service.from("ai_assessment_attempts").select(
    "*",
  )
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  const rows = (data || []) as Record<string, unknown>[];
  return {
    capability: rows.find((row) => row.kind === "capability") || null,
    personality: rows.find((row) => row.kind === "personality") || null,
  };
}

function capabilityContext(body: Record<string, unknown>) {
  const track = body.track === "daily" || body.track === "work"
    ? body.track
    : null;
  const goal =
    ["office", "content", "learning", "product", "programming"].includes(
        String(body.learning_goal),
      )
      ? String(body.learning_goal)
      : null;
  if (!track || !goal) throw new HttpError(400, "请选择使用场景和学习目标");
  return { track, goal };
}

async function routeCapabilityMembership(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  routeLevel: "starter" | "application" | "practice",
) {
  const { data: membership, error: membershipError } = await service.from(
    "ai_group_memberships",
  )
    .select("id, access_status").eq("user_id", userId).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    const { error } = await service.from("ai_group_memberships").insert({
      user_id: userId,
      route_level: routeLevel,
    });
    if (error) throw error;
  } else if (membership.access_status !== "active") {
    const { error } = await service.from("ai_group_memberships").update({
      route_level: routeLevel,
    }).eq("id", membership.id);
    if (error) throw error;
  }
}

async function submitPACFQuick(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  let result: ReturnType<typeof scorePACFQuick>;
  try {
    result = scorePACFQuick(body.responses);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "PACF 快测答案无效",
    );
  }
  const { track, goal } = capabilityContext(body);
  const previous = await latestAttempts(service, userId);
  const reportInput = {
    totalScore: result.totalScore,
    estimatedLevel: result.estimatedLevel,
    level: result.level,
    levelTitle: result.levelTitle,
    levelSummary: result.levelSummary,
    dimensionScores: result.dimensionScores,
    strongest: PACF_DIMENSIONS[result.strongest],
    growthArea: PACF_DIMENSIONS[result.growthArea],
    gates: result.gates,
    evidenceGrade: PACF_QUICK_INSTRUMENT.evidenceGrade,
  };
  const generated = await generateReport(
    "capability",
    reportInput,
    previous.personality ? publicAttempt(previous.personality) : null,
  );
  const deterministic = fallbackReport(
    "capability",
    reportInput,
    previous.personality,
  );
  const responses = body.responses as Array<{
    item_id: string;
    option_id: string;
  }>;
  const now = new Date().toISOString();
  const gateStatus = {
    ...result.gates,
    estimated_level: result.estimatedLevel,
    awarded_level: result.level,
  };

  const { data: attempt, error: attemptError } = await service.from(
    "ai_assessment_attempts",
  ).insert({
    user_id: userId,
    kind: "capability",
    assessment_version: PACF_QUICK_INSTRUMENT.id,
    framework_version: PACF_QUICK_INSTRUMENT.frameworkVersion,
    scoring_version: PACF_QUICK_INSTRUMENT.scoringVersion,
    result_status: "provisional",
    evidence_grade: PACF_QUICK_INSTRUMENT.evidenceGrade,
    requires_reassessment: false,
    answers: responses,
    track,
    learning_goal: goal,
    total_score: result.totalScore,
    ability_level: result.level,
    dimension_scores: result.dimensionScores,
    competency_scores: result.competencyScores,
    gate_status: gateStatus,
    scoring_audit: {
      instrument_id: PACF_QUICK_INSTRUMENT.id,
      item_bank_version: PACF_QUICK_INSTRUMENT.itemBankVersion,
      scoring_version: PACF_QUICK_INSTRUMENT.scoringVersion,
      scorer: "server_rule",
      scored_at: now,
    },
    deterministic_report: deterministic,
    ai_report: generated.report,
    report_status: generated.status,
    report_model: generated.model,
  }).select("*").single();
  if (attemptError) throw attemptError;

  const responseRows = result.itemScores.map((item) => ({
    attempt_id: attempt.id,
    item_id: item.itemId,
    competency_id: item.competencyId,
    response_payload: { option_id: item.optionId },
    raw_score: item.rawScore,
    max_score: 3,
    normalized_score: item.normalizedScore,
    scorer_type: "rule",
    rubric_version: PACF_QUICK_INSTRUMENT.scoringVersion,
    scoring_evidence: {
      instrument_id: PACF_QUICK_INSTRUMENT.id,
      item_bank_version: PACF_QUICK_INSTRUMENT.itemBankVersion,
    },
    scored_at: now,
  }));
  const { error: responsesError } = await service.from(
    "ai_assessment_responses",
  ).insert(responseRows);
  if (responsesError) {
    await service.from("ai_assessment_attempts").delete().eq("id", attempt.id);
    throw responsesError;
  }

  const { error: latestError } = await service.from("ai_assessments").upsert({
    user_id: userId,
    answers: responses,
    score: Math.round(result.totalScore),
    level: result.routeLevel,
    learning_goal: goal,
    ability_level: result.level,
    dimension_scores: result.dimensionScores,
    competency_scores: result.competencyScores,
    gate_status: gateStatus,
    track,
    assessment_version: PACF_QUICK_INSTRUMENT.id,
    framework_version: PACF_QUICK_INSTRUMENT.frameworkVersion,
    scoring_version: PACF_QUICK_INSTRUMENT.scoringVersion,
    result_status: "provisional",
    evidence_grade: PACF_QUICK_INSTRUMENT.evidenceGrade,
    requires_reassessment: false,
    updated_at: now,
  }, { onConflict: "user_id" });
  if (latestError) {
    await service.from("ai_assessment_attempts").delete().eq("id", attempt.id);
    throw latestError;
  }

  await routeCapabilityMembership(service, userId, result.routeLevel);
  return publicAttempt(attempt as Record<string, unknown>);
}

async function submitCapability(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const answers = integerAnswers(body.answers, 30, [0, 1, 2, 3]);
  const { track, goal } = capabilityContext(body);
  const result = scoreCapability(answers);
  const previous = await latestAttempts(service, userId);
  const generated = await generateReport(
    "capability",
    result,
    previous.personality ? publicAttempt(previous.personality) : null,
  );
  const deterministic = fallbackReport(
    "capability",
    result,
    previous.personality,
  );

  const { data: attempt, error: attemptError } = await service.from(
    "ai_assessment_attempts",
  ).insert({
    user_id: userId,
    kind: "capability",
    assessment_version: CAPABILITY_VERSION,
    framework_version: LEGACY_CAPABILITY_FRAMEWORK,
    scoring_version: LEGACY_CAPABILITY_SCORING,
    result_status: "legacy",
    evidence_grade: "self_report",
    requires_reassessment: true,
    answers,
    track,
    learning_goal: goal,
    total_score: result.total,
    ability_level: result.level,
    dimension_scores: result.dimensions,
    competency_scores: {},
    gate_status: {},
    deterministic_report: deterministic,
    ai_report: generated.report,
    report_status: generated.status,
    report_model: generated.model,
  }).select("*").single();
  if (attemptError) throw attemptError;

  const { error: latestError } = await service.from("ai_assessments").upsert({
    user_id: userId,
    answers,
    score: result.total,
    level: result.routeLevel,
    learning_goal: goal,
    ability_level: result.level,
    dimension_scores: result.dimensions,
    track,
    assessment_version: CAPABILITY_VERSION,
    framework_version: LEGACY_CAPABILITY_FRAMEWORK,
    scoring_version: LEGACY_CAPABILITY_SCORING,
    result_status: "legacy",
    evidence_grade: "self_report",
    requires_reassessment: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (latestError) throw latestError;

  await routeCapabilityMembership(service, userId, result.routeLevel);
  return publicAttempt(attempt as Record<string, unknown>);
}

async function submitPersonality(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const answers = integerAnswers(body.answers, 28, [-2, -1, 1, 2]);
  const result = scorePersonality(answers);
  const previous = await latestAttempts(service, userId);
  const generated = await generateReport(
    "personality",
    result,
    previous.capability ? publicAttempt(previous.capability) : null,
  );
  const deterministic = fallbackReport(
    "personality",
    result,
    previous.capability,
  );
  const { data, error } = await service.from("ai_assessment_attempts").insert({
    user_id: userId,
    kind: "personality",
    assessment_version: PERSONALITY_VERSION,
    framework_version: "ai-personality-v1",
    scoring_version: "personality-rules-v1",
    result_status: "final",
    evidence_grade: "profile",
    requires_reassessment: false,
    answers,
    personality_code: result.code,
    dimension_scores: result.axes,
    deterministic_report: deterministic,
    ai_report: generated.report,
    report_status: generated.status,
    report_model: generated.model,
  }).select("*").single();
  if (error) throw error;
  return publicAttempt(data as Record<string, unknown>);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const service = serviceClient();

    if (action === "shared-result") {
      const token = String(body.share_token || "");
      if (!/^[0-9a-f-]{36}$/i.test(token)) {
        throw new HttpError(400, "分享链接无效");
      }
      const { data, error } = await service.from("ai_assessment_attempts")
        .select("*").eq("share_token", token).maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, "分享结果不存在");
      return json({ attempt: publicAttempt(data as Record<string, unknown>) });
    }

    if (action === "pacf-quick-form") {
      return json(publicPACFQuickForm());
    }

    const user = await requireUser(req);
    if (action === "status") {
      const attempts = await latestAttempts(service, user.id);
      const { data: legacy, error: legacyError } = await service.from(
        "ai_assessment_legacy_snapshots",
      ).select("id").eq("user_id", user.id).limit(1);
      if (legacyError) throw legacyError;
      return json({
        capability: publicAttempt(attempts.capability),
        personality: publicAttempt(attempts.personality),
        legacy_capability_available: Boolean(legacy?.length),
      });
    }
    if (action === "submit-pacf-quick") {
      return json(
        { attempt: await submitPACFQuick(service, user.id, body) },
        201,
      );
    }
    if (action === "submit-capability") {
      return json(
        { attempt: await submitCapability(service, user.id, body) },
        201,
      );
    }
    if (action === "submit-personality") {
      return json(
        { attempt: await submitPersonality(service, user.id, body) },
        201,
      );
    }
    throw new HttpError(400, "未知操作");
  } catch (error) {
    console.error("[ai-assessment-engine]", error);
    return json({
      error: error instanceof Error ? error.message : "服务暂时不可用",
    }, error instanceof HttpError ? error.status : 500);
  }
});
