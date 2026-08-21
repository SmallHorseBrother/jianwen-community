import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  PACF_DIMENSIONS,
  PACF_QUICK_INSTRUMENT,
  publicPACFQuickForm,
  scorePACFQuick,
  type PACFDimension,
  type PACFQuickItem,
} from "../_shared/pacfQuick.ts";
import {
  AI_STYLE_AXES,
  AI_STYLE_INSTRUMENT,
  publicAIStyleForm,
  scoreAIStyle,
  type AIStyleAxis,
  type ExperimentalItem,
  type ScoredItem,
} from "../_shared/aiUsageStyle.ts";
import {
  EXAM_DIMENSIONS,
  EXAM_SECTIONS,
  FIRST_AI_EXAM_BANK,
  FIRST_AI_EXAM_INSTRUMENT,
  buildFirstAIExamReview,
  publicExamForm,
  scoreFirstAIExam,
  type ExamDimension,
  type ExamItem,
} from "../_shared/firstAIExam.ts";

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
type SessionPresentation = {
  items: PACFQuickItem[] | ExamItem[] | ScoredItem[];
  experiments?: ExperimentalItem[];
};
type AssessmentSession = {
  id: string;
  assessment_kind: AssessmentKind;
  instrument_id: string;
  item_bank_version: string;
  presentation: SessionPresentation;
  status: "open" | "completed" | "expired";
  expires_at: string;
};
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
  if (result.frameworkVersion === AI_STYLE_INSTRUMENT.frameworkVersion) {
    const confidence = (result.axisConfidence || {}) as Record<string, string>;
    const balancedCount = Object.values(confidence).filter((value) =>
      value === "balanced"
    ).length;
    return {
      headline: `你的AI使用风格是${String(result.name)}`,
      overview: `${String(result.tagline)}${balancedCount > 0 ? ` 其中有 ${balancedCount} 条风格轴较为平衡，具体偏好可能随任务变化。` : ""}`,
      strengths: [
        "你的回答呈现出一组可用于选择学习方式和项目形式的偏好。",
        "连续轴比单一标签更能反映你在不同任务中的真实选择。",
      ],
      risks: [
        String(result.likelyBlindSpot),
        "使用风格不代表能力高低，也不应限制你尝试相反侧的方法。",
      ],
      nextSteps: [
        "选择一个符合当前偏好的低风险 AI 项目",
        "在同一任务中刻意尝试一项相反侧的工作方式",
        "完成能力测评，把偏好与真实能力分开理解",
      ],
      courseRecommendations: [
        "个人 AI 工作方式设计",
        "人机协作与任务边界",
        "AI 能力等级测评",
      ],
      combinedPortrait: companion
        ? "使用风格决定哪种练习更容易进入状态；能力结果决定当前应先补哪一级台阶。"
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

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}题库数据不完整`);
  }
  return value as Record<string, unknown>;
}

function asPACFItem(row: Record<string, unknown>): PACFQuickItem {
  const prompt = requireRecord(row.prompt_payload, "PACF");
  const scoring = requireRecord(row.scoring_payload, "PACF");
  if (!Array.isArray(prompt.options) || !Array.isArray(scoring.option_scores)) {
    throw new Error("PACF题库缺少选项或评分规则");
  }
  const scores = new Map(
    scoring.option_scores.map((option) => {
      const item = requireRecord(option, "PACF");
      return [String(item.id), Number(item.score)];
    }),
  );
  const options = prompt.options.map((option) => {
    const item = requireRecord(option, "PACF");
    const id = String(item.id);
    const score = scores.get(id);
    if (!/[ABCD]/.test(id) || typeof item.text !== "string" || ![0, 1, 2, 3].includes(score ?? -1)) {
      throw new Error("PACF题库选项配置无效");
    }
    return { id: id as "A" | "B" | "C" | "D", text: item.text, score: score as 0 | 1 | 2 | 3 };
  });
  if (options.length !== 4) throw new Error("PACF题库每题必须有四个选项");
  return {
    id: String(row.id),
    competencyId: String(row.competency_id),
    dimension: String(row.dimension_code) as PACFDimension,
    type: String(row.item_type) as "objective" | "scenario",
    stem: String(prompt.stem),
    options,
  };
}

const styleAxisFromCode: Record<string, AIStyleAxis> = {
  ES: "explore", CO: "create", RA: "reason", PD: "partner",
};

function asStyleItem(row: Record<string, unknown>): ScoredItem | ExperimentalItem {
  const prompt = requireRecord(row.prompt_payload, "风格");
  const scoring = requireRecord(row.scoring_payload, "风格");
  const axis = styleAxisFromCode[String(row.axis_code)];
  if (!axis) throw new Error("风格题库维度无效");
  if (row.item_type === "likert") {
    const pole = scoring.pole;
    if ((pole !== "first" && pole !== "second") || typeof prompt.statement !== "string") {
      throw new Error("风格题库计分规则无效");
    }
    return { id: String(row.id), kind: "likert", axis, pole, statement: prompt.statement };
  }
  if (row.item_type === "forced_choice" && typeof prompt.prompt === "string" && Array.isArray(prompt.options)) {
    const options = prompt.options.map((option) => {
      const item = requireRecord(option, "风格");
      if ((item.id !== "first" && item.id !== "second") || typeof item.text !== "string") {
        throw new Error("风格题库行为题选项无效");
      }
      return { id: item.id, text: item.text } as { id: "first" | "second"; text: string };
    });
    return { id: String(row.id), kind: "forced_choice", axis, prompt: prompt.prompt, options };
  }
  throw new Error("风格题库数据无效");
}

function publicSessionForm<T extends Record<string, unknown>>(form: T, sessionId: string) {
  return { ...form, session_id: sessionId };
}

async function createPACFSession(
  service: ReturnType<typeof serviceClient>,
  userId: string,
) {
  const { data, error } = await service.from("ai_assessment_items")
    .select("id, competency_id, dimension_code, item_type, prompt_payload, scoring_payload")
    .eq("item_bank_version", PACF_QUICK_INSTRUMENT.itemBankVersion)
    .eq("quick_eligible", true)
    .eq("status", "active");
  if (error) throw error;
  const allItems = (data || []).map((row) => asPACFItem(row as Record<string, unknown>));
  const selected: PACFQuickItem[] = [];
  for (const dimension of Object.keys(PACF_DIMENSIONS) as PACFDimension[]) {
    const candidates = allItems.filter((item) => item.dimension === dimension);
    const byCompetency = new Map<string, PACFQuickItem[]>();
    for (const item of candidates) {
      byCompetency.set(item.competencyId, [...(byCompetency.get(item.competencyId) || []), item]);
    }
    if (byCompetency.size !== 5 || candidates.length < 7) {
      throw new Error(`PACF ${dimension} 维度题库不足，暂时无法随机出题`);
    }
    const anchors = [...byCompetency.values()].map((items) => shuffled(items)[0]);
    const extras = shuffled(candidates.filter((item) => !anchors.some((anchor) => anchor.id === item.id))).slice(0, 2);
    if (extras.length !== 2) throw new Error(`PACF ${dimension} 维度缺少补充题`);
    selected.push(...anchors, ...extras);
  }
  const items = shuffled(selected);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await service.from("ai_assessment_sessions").insert({
    user_id: userId,
    assessment_kind: "capability",
    instrument_id: PACF_QUICK_INSTRUMENT.id,
    item_bank_version: PACF_QUICK_INSTRUMENT.itemBankVersion,
    presentation: { items },
    expires_at: expiresAt,
  }).select("id").single();
  if (sessionError) throw sessionError;
  return publicSessionForm(publicPACFQuickForm(items), String(session.id));
}

const examOptionIds = ["A", "B", "C", "D"] as const;

function shuffleExamOptions(item: ExamItem): ExamItem {
  if (!item.options) return item;
  return {
    ...item,
    options: shuffled(item.options).map((option, index) => ({
      ...option,
      id: examOptionIds[index],
    })),
  };
}

function sampleFirstAIExam(): ExamItem[] {
  const selected: ExamItem[] = [];
  for (const dimension of Object.keys(EXAM_DIMENSIONS) as ExamDimension[]) {
    const dimensionItems = FIRST_AI_EXAM_BANK.filter((item) => item.dimension === dimension);
    const basics = shuffled(dimensionItems.filter((item) => item.section === "basic")).slice(0, 2);
    const scenarios = shuffled(dimensionItems.filter((item) => item.section === "scenario")).slice(0, 1);
    const fills = shuffled(dimensionItems.filter((item) => item.section === "fill")).slice(0, 1);
    const technical = dimensionItems.filter((item) => item.section === "technical");
    if (basics.length !== 2 || scenarios.length !== 1 || fills.length !== 1 || technical.length !== 1) {
      throw new Error(`第一届能力考试 ${dimension} 维度题库配额不完整`);
    }
    selected.push(...basics, ...scenarios, ...fills, ...technical);
  }
  const openItems = shuffled(FIRST_AI_EXAM_BANK.filter((item) => item.section === "open")).slice(0, 2);
  if (openItems.length !== 2) throw new Error("第一届能力考试主观题不足");
  selected.push(...openItems);
  return (Object.keys(EXAM_SECTIONS) as Array<keyof typeof EXAM_SECTIONS>)
    .sort((left, right) => EXAM_SECTIONS[left].order - EXAM_SECTIONS[right].order)
    .flatMap((section) => shuffled(selected.filter((item) => item.section === section)).map(shuffleExamOptions));
}

async function createFirstAIExamSession(
  service: ReturnType<typeof serviceClient>,
  userId: string,
) {
  const items = sampleFirstAIExam();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await service.from("ai_assessment_sessions").insert({
    user_id: userId,
    assessment_kind: "capability",
    instrument_id: FIRST_AI_EXAM_INSTRUMENT.id,
    item_bank_version: FIRST_AI_EXAM_INSTRUMENT.itemBankVersion,
    presentation: { items },
    expires_at: expiresAt,
  }).select("id").single();
  if (sessionError) throw sessionError;
  return publicExamForm(items, String(session.id));
}

async function createAIStyleSession(
  service: ReturnType<typeof serviceClient>,
  userId: string,
) {
  const { data, error } = await service.from("ai_style_items")
    .select("id, axis_code, item_type, prompt_payload, scoring_payload")
    .eq("item_bank_version", AI_STYLE_INSTRUMENT.itemBankVersion)
    .eq("status", "active");
  if (error) throw error;
  const allItems = (data || []).map((row) => asStyleItem(row as Record<string, unknown>));
  const scored = allItems.filter((item): item is ScoredItem => item.kind === "likert");
  const experiments = allItems.filter((item): item is ExperimentalItem => item.kind === "forced_choice");
  const selected: ScoredItem[] = [];
  for (const axis of Object.keys(AI_STYLE_AXES) as AIStyleAxis[]) {
    for (const pole of ["first", "second"] as const) {
      const bucket = scored.filter((item) => item.axis === axis && item.pole === pole);
      if (bucket.length < 4) throw new Error(`风格测评 ${axis} 轴题库不足，暂时无法随机出题`);
      selected.push(...shuffled(bucket).slice(0, 4));
    }
  }
  if (experiments.length < 4) throw new Error("风格测评行为题库不足");
  const deliveredScored = shuffled(selected);
  const deliveredExperiments = shuffled(experiments).slice(0, 4);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await service.from("ai_assessment_sessions").insert({
    user_id: userId,
    assessment_kind: "personality",
    instrument_id: AI_STYLE_INSTRUMENT.id,
    item_bank_version: AI_STYLE_INSTRUMENT.itemBankVersion,
    presentation: { items: deliveredScored, experiments: deliveredExperiments },
    expires_at: expiresAt,
  }).select("id").single();
  if (sessionError) throw sessionError;
  return publicSessionForm(publicAIStyleForm(deliveredScored, deliveredExperiments), String(session.id));
}

async function loadOpenSession(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  sessionId: unknown,
  kind: AssessmentKind,
): Promise<AssessmentSession> {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new HttpError(400, "测评会话无效，请重新开始");
  }
  const { data, error } = await service.from("ai_assessment_sessions")
    .select("id, assessment_kind, instrument_id, item_bank_version, presentation, status, expires_at")
    .eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data || data.assessment_kind !== kind || data.status !== "open") {
    throw new HttpError(400, "本次测评已失效或已提交，请重新开始");
  }
  if (new Date(String(data.expires_at)).getTime() < Date.now()) {
    await service.from("ai_assessment_sessions").update({ status: "expired" }).eq("id", sessionId);
    throw new HttpError(400, "本次测评已超过一小时，请重新开始");
  }
  return data as AssessmentSession;
}

function pacfItemsFromSession(session: AssessmentSession): PACFQuickItem[] {
  if (session.instrument_id !== PACF_QUICK_INSTRUMENT.id || !Array.isArray(session.presentation?.items)) {
    throw new HttpError(400, "能力测评版本不匹配，请重新开始");
  }
  return session.presentation.items as PACFQuickItem[];
}

function examItemsFromSession(session: AssessmentSession): ExamItem[] {
  if (session.instrument_id !== FIRST_AI_EXAM_INSTRUMENT.id || !Array.isArray(session.presentation?.items)) {
    throw new HttpError(400, "能力考试版本不匹配，请重新开始");
  }
  return session.presentation.items as ExamItem[];
}

function styleItemsFromSession(session: AssessmentSession) {
  if (session.instrument_id !== AI_STYLE_INSTRUMENT.id || !Array.isArray(session.presentation?.items) || !Array.isArray(session.presentation?.experiments)) {
    throw new HttpError(400, "风格测评版本不匹配，请重新开始");
  }
  return {
    scored: session.presentation.items as ScoredItem[],
    experiments: session.presentation.experiments as ExperimentalItem[],
  };
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
  const session = await loadOpenSession(service, userId, body.session_id, "capability");
  const deliveredItems = examItemsFromSession(session);
  let result: ReturnType<typeof scoreFirstAIExam>;
  try {
    result = scoreFirstAIExam(body.responses, deliveredItems);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "能力考试答案无效",
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
    strongest: EXAM_DIMENSIONS[result.strongest],
    growthArea: EXAM_DIMENSIONS[result.growthArea],
    gates: result.gates,
    openResponses: result.openResponses,
    evidenceGrade: FIRST_AI_EXAM_INSTRUMENT.evidenceGrade,
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
    value: string | number;
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
    assessment_session_id: session.id,
    kind: "capability",
    assessment_version: FIRST_AI_EXAM_INSTRUMENT.id,
    framework_version: FIRST_AI_EXAM_INSTRUMENT.frameworkVersion,
    scoring_version: FIRST_AI_EXAM_INSTRUMENT.scoringVersion,
    result_status: "provisional",
    evidence_grade: FIRST_AI_EXAM_INSTRUMENT.evidenceGrade,
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
      instrument_id: FIRST_AI_EXAM_INSTRUMENT.id,
      item_bank_version: FIRST_AI_EXAM_INSTRUMENT.itemBankVersion,
      scoring_version: FIRST_AI_EXAM_INSTRUMENT.scoringVersion,
      assessment_session_id: session.id,
      scorer: "server_rule",
      scored_item_count: FIRST_AI_EXAM_INSTRUMENT.scoredItemCount,
      subjective_item_count: FIRST_AI_EXAM_INSTRUMENT.itemCount - FIRST_AI_EXAM_INSTRUMENT.scoredItemCount,
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
    response_payload: { value: item.response },
    raw_score: item.rawScore,
    max_score: item.scored ? 3 : null,
    normalized_score: item.normalizedScore,
    scorer_type: "rule",
    rubric_version: FIRST_AI_EXAM_INSTRUMENT.scoringVersion,
    scoring_evidence: {
      instrument_id: FIRST_AI_EXAM_INSTRUMENT.id,
      item_bank_version: FIRST_AI_EXAM_INSTRUMENT.itemBankVersion,
      scored: item.scored,
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
    assessment_version: FIRST_AI_EXAM_INSTRUMENT.id,
    framework_version: FIRST_AI_EXAM_INSTRUMENT.frameworkVersion,
    scoring_version: FIRST_AI_EXAM_INSTRUMENT.scoringVersion,
    result_status: "provisional",
    evidence_grade: FIRST_AI_EXAM_INSTRUMENT.evidenceGrade,
    requires_reassessment: false,
    updated_at: now,
  }, { onConflict: "user_id" });
  if (latestError) {
    await service.from("ai_assessment_attempts").delete().eq("id", attempt.id);
    throw latestError;
  }

  await routeCapabilityMembership(service, userId, result.routeLevel);
  const { error: completeSessionError } = await service.from("ai_assessment_sessions")
    .update({ status: "completed", completed_at: now }).eq("id", session.id).eq("status", "open");
  if (completeSessionError) throw completeSessionError;
  return {
    attempt: publicAttempt(attempt as Record<string, unknown>),
    answer_review: buildFirstAIExamReview(deliveredItems, responses, result.itemScores),
  };
}

async function loadFirstAIExamReview(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  attemptId: unknown,
) {
  if (typeof attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
    throw new HttpError(400, "能力考试记录无效");
  }
  const { data: attempt, error: attemptError } = await service.from("ai_assessment_attempts")
    .select("id, assessment_session_id, assessment_version, answers")
    .eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt || attempt.assessment_version !== FIRST_AI_EXAM_INSTRUMENT.id) {
    throw new HttpError(404, "本次能力考试不支持逐题复盘");
  }
  const { data: session, error: sessionError } = await service.from("ai_assessment_sessions")
    .select("instrument_id, presentation")
    .eq("id", attempt.assessment_session_id).eq("user_id", userId).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.instrument_id !== FIRST_AI_EXAM_INSTRUMENT.id || !Array.isArray(session.presentation?.items)) {
    throw new HttpError(404, "本次能力考试题目已无法读取");
  }
  const responses = Array.isArray(attempt.answers) ? attempt.answers as Array<{ item_id: string; value: string | number }> : [];
  const { data: scores, error: scoresError } = await service.from("ai_assessment_responses")
    .select("item_id, raw_score, max_score").eq("attempt_id", attemptId);
  if (scoresError) throw scoresError;
  return buildFirstAIExamReview(
    session.presentation.items as ExamItem[],
    responses,
    (scores || []).map((score) => ({
      itemId: String(score.item_id),
      rawScore: score.raw_score === null ? null : Number(score.raw_score),
      scored: score.max_score !== null,
    })),
  );
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

async function submitAIStyle(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const session = await loadOpenSession(service, userId, body.session_id, "personality");
  const deliveredItems = styleItemsFromSession(session);
  let result: ReturnType<typeof scoreAIStyle>;
  try {
    result = scoreAIStyle(body.responses, deliveredItems.scored, deliveredItems.experiments);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "AI 使用风格答案无效",
    );
  }
  const previous = await latestAttempts(service, userId);
  const reportInput = {
    frameworkVersion: AI_STYLE_INSTRUMENT.frameworkVersion,
    code: result.code,
    name: result.name,
    englishName: result.englishName,
    tagline: result.tagline,
    likelyBlindSpot: result.likelyBlindSpot,
    axes: result.axes,
    axisConfidence: result.axisConfidence,
    axisDefinitions: AI_STYLE_AXES,
    experimentalAnswersExcludedFromScore: true,
  };
  const generated = await generateReport(
    "personality",
    reportInput,
    previous.capability ? publicAttempt(previous.capability) : null,
  );
  const deterministic = fallbackReport(
    "personality",
    reportInput,
    previous.capability,
  );
  const responses = body.responses as Array<{
    item_id: string;
    value: number | string;
  }>;
  const now = new Date().toISOString();
  const gateStatus = {
    axis_confidence: result.axisConfidence,
    balanced_axes: Object.entries(result.axisConfidence)
      .filter(([, value]) => value === "balanced")
      .map(([axis]) => axis),
    experimental_items_scored: false,
  };
  const { data: attempt, error: attemptError } = await service.from(
    "ai_assessment_attempts",
  ).insert({
    user_id: userId,
    assessment_session_id: session.id,
    kind: "personality",
    assessment_version: AI_STYLE_INSTRUMENT.id,
    framework_version: AI_STYLE_INSTRUMENT.frameworkVersion,
    scoring_version: AI_STYLE_INSTRUMENT.scoringVersion,
    result_status: "provisional",
    evidence_grade: AI_STYLE_INSTRUMENT.evidenceGrade,
    requires_reassessment: false,
    answers: responses,
    personality_code: result.code,
    dimension_scores: result.axes,
    competency_scores: {},
    gate_status: gateStatus,
    scoring_audit: {
      instrument_id: AI_STYLE_INSTRUMENT.id,
      item_bank_version: AI_STYLE_INSTRUMENT.itemBankVersion,
      scoring_version: AI_STYLE_INSTRUMENT.scoringVersion,
      assessment_session_id: session.id,
      scored_item_count: AI_STYLE_INSTRUMENT.scoredItemCount,
      experimental_item_count: 4,
      scorer: "server_rule",
      scored_at: now,
    },
    deterministic_report: deterministic,
    ai_report: generated.report,
    report_status: generated.status,
    report_model: generated.model,
  }).select("*").single();
  if (attemptError) throw attemptError;

  const axisCodes = {
    explore: "ES", create: "CO", reason: "RA", partner: "PD",
  } as const;
  const responseRows = [
    ...result.itemScores.map((item) => ({
      attempt_id: attempt.id,
      instrument_version: AI_STYLE_INSTRUMENT.id,
      item_id: item.itemId,
      axis_code: axisCodes[item.axis],
      response_payload: { value: item.response },
      response_value: item.response,
      forced_choice: null,
      centered_score: item.centeredScore,
      scored: true,
    })),
    ...result.experiments.map((item) => ({
      attempt_id: attempt.id,
      instrument_version: AI_STYLE_INSTRUMENT.id,
      item_id: item.itemId,
      axis_code: axisCodes[item.axis],
      response_payload: { value: item.response },
      response_value: null,
      forced_choice: item.response,
      centered_score: null,
      scored: false,
    })),
  ];
  const { error: responseError } = await service.from(
    "ai_style_responses",
  ).insert(responseRows);
  if (responseError) {
    await service.from("ai_assessment_attempts").delete().eq("id", attempt.id);
    throw responseError;
  }
  const { error: completeSessionError } = await service.from("ai_assessment_sessions")
    .update({ status: "completed", completed_at: now }).eq("id", session.id).eq("status", "open");
  if (completeSessionError) throw completeSessionError;
  return publicAttempt(attempt as Record<string, unknown>);
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

    const user = await requireUser(req);
    if (action === "pacf-quick-form") {
      return json(await createFirstAIExamSession(service, user.id));
    }
    if (action === "ai-style-form") {
      return json(await createAIStyleSession(service, user.id));
    }
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
    if (action === "answer-review") {
      return json({ answer_review: await loadFirstAIExamReview(service, user.id, body.attempt_id) });
    }
    if (action === "submit-pacf-quick") {
      return json(
        await submitPACFQuick(service, user.id, body),
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
    if (action === "submit-ai-style") {
      return json(
        { attempt: await submitAIStyle(service, user.id, body) },
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
