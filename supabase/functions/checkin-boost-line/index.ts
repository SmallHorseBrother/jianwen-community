import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type BoostLineSource = 'deepseek' | 'fallback';

type AchievementInput = {
  label?: unknown;
  value?: unknown;
};

type StatsInput = {
  totalCount?: unknown;
  currentStreak?: unknown;
  longestStreak?: unknown;
  monthCount?: unknown;
};

type BoostLineRequest = {
  content?: unknown;
  achievements?: unknown;
  themeLabel?: unknown;
  completedCount?: unknown;
  stats?: StatsInput | null;
  nickname?: unknown;
  groupName?: unknown;
};

type NormalizedAchievement = {
  label: string;
  value: string;
};

type NormalizedPayload = {
  content: string;
  achievements: NormalizedAchievement[];
  themeLabel: string;
  completedCount: number;
  stats: {
    totalCount: number;
    currentStreak: number;
    longestStreak: number;
    monthCount: number;
  };
  nickname: string;
  groupName: string;
};

const DEFAULT_FALLBACK_BOOST = '今天也很可以，继续冲呀！';

const STYLE_PROMPT = `
你是健文社区分享海报里的「马哥打气」文案助手。

你只需要实时生成 1 句简短的鼓励话。
语气要像本人在群里随手说的一句，活泼、自然、有点开心，不要像老板讲话。
不用分析，不用总结，不用上价值，不用解释。

硬性规则：
1. 只输出 1 句话，不要编号，不要多句。
2. 每句 8 到 22 个中文字符左右。
3. 可以轻微结合用户这次打卡内容，但不要硬总结，不要复述完成项。
4. 不要写累计次数、连续天数、扫码、二维码、注册、关注、转发。
5. 不要写“长期主义、本质、核心、系统、复利、锚点、执行到位、向前推进、加把劲”这类套话。
6. 不要写 emoji、话题标签、引号、括号补充说明。
`.trim();

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: NormalizedPayload;

  try {
    payload = normalizePayload((await req.json()) as BoostLineRequest);
  } catch (error) {
    console.error('checkin-boost-line payload error:', error);
    return jsonResponse({ error: 'Invalid request payload' }, 400);
  }

  const fallback = buildFallbackBoostLine(payload);
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  const baseUrl = Deno.env.get('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com';
  const model = Deno.env.get('DEEPSEEK_BOOST_MODEL')?.trim() || 'deepseek-chat';

  if (!apiKey) {
    return buildBoostResponse(fallback, 'fallback', 'missing_deepseek_api_key');
  }

  const controller = new AbortController();
  const timeoutMs = clampNumber(Number(Deno.env.get('DEEPSEEK_TIMEOUT_MS') || 6500), 2500, 12000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 1.05,
        max_tokens: 720,
        messages: [
          {
            role: 'system',
            content: STYLE_PROMPT,
          },
          {
            role: 'user',
            content: buildUserPrompt(payload),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const answer = extractModelContent(data);
    const sanitized = pickBestGeneratedLine(answer, fallback, payload);
    const boostLine = sanitized.boostLine;
    const source: BoostLineSource = boostLine === fallback ? 'fallback' : 'deepseek';
    if (source === 'fallback') {
      console.warn('checkin-boost-line model output rejected:', {
        reason: sanitized.reason,
        rawLength: typeof answer === 'string' ? answer.length : 0,
      });
    }

    return buildBoostResponse(boostLine, source, source === 'fallback' ? sanitized.reason : undefined);
  } catch (error) {
    console.error('checkin-boost-line deepseek error:', error);
    const reason = error instanceof DOMException && error.name === 'AbortError'
      ? 'deepseek_timeout'
      : 'deepseek_request_failed';
    return buildBoostResponse(fallback, 'fallback', reason);
  } finally {
    clearTimeout(timer);
  }
});

function normalizePayload(input: BoostLineRequest): NormalizedPayload {
  const achievements = Array.isArray(input.achievements)
    ? input.achievements
        .slice(0, 8)
        .map((item) => normalizeAchievement(item as AchievementInput))
        .filter((item): item is NormalizedAchievement => Boolean(item))
    : [];
  const content = normalizeLongText(input.content, 1400);
  const themeLabel = normalizeShortText(input.themeLabel, 16) || inferTheme(content, achievements);
  const statsInput = input.stats || {};

  return {
    content,
    achievements,
    themeLabel,
    completedCount: normalizeNumber(input.completedCount, 0, 99, 0),
    stats: {
      totalCount: normalizeNumber(statsInput.totalCount, 0, 99999, 1),
      currentStreak: normalizeNumber(statsInput.currentStreak, 0, 99999, 1),
      longestStreak: normalizeNumber(statsInput.longestStreak, 0, 99999, 1),
      monthCount: normalizeNumber(statsInput.monthCount, 0, 31, 1),
    },
    nickname: normalizeShortText(input.nickname, 24) || '社区伙伴',
    groupName: normalizeShortText(input.groupName, 32) || '健文社区成员',
  };
}

function normalizeAchievement(item: AchievementInput): NormalizedAchievement | null {
  const label = normalizeShortText(item.label, 12);
  const value = normalizeShortText(item.value, 80);
  if (!label || !value) return null;
  return { label, value };
}

function normalizeLongText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeShortText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(clampNumber(parsed, min, max));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function inferTheme(content: string, achievements: NormalizedAchievement[]) {
  const text = `${content}\n${achievements.map((item) => `${item.label}${item.value}`).join('\n')}`.toLowerCase();
  if (/运动|训练|跑|腿|胸|背|肩|公里|健身|卧推|深蹲|硬拉|引体|有氧|力量/.test(text)) return '健身成长';
  if (/单词|学习|读书|阅读|练字|英语|论文|课程|刷题|复习|背|写作/.test(text)) return '学习成长';
  if (/冥想|早睡|饮食|生活|情绪|习惯|自律|饮水/.test(text)) return '生活习惯';
  return '长期主义';
}

function buildUserPrompt(payload: NormalizedPayload) {
  const achievementText = payload.achievements.length
    ? payload.achievements.map((item) => `- ${item.label}: ${item.value}`).join('\n')
    : '无结构化完成项';
  const content = payload.content || '用户今天完成了一次打卡，但没有填写详细正文。';
  const shortContent = content.slice(0, 220);

  return `
请根据这条打卡，实时生成 1 句鼓励话。

用户昵称：${payload.nickname}
主题：${payload.themeLabel}

打卡内容参考：
${achievementText}
${shortContent}

就说 1 句自然的打气话。
像真人顺手说的，不要分析，不要套话，不要写第二句。
`.trim();
}

function extractModelContent(data: unknown) {
  const root = data as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') return '';

  const outputText = pickString(root.output_text);
  if (outputText) return outputText;

  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  if (!firstChoice) return '';

  const directText = pickString(firstChoice.text);
  if (directText) return directText;

  const message = firstChoice.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== 'object') return '';

  const content = pickContent(message.content);
  if (content) return content;

  return '';
}

function pickContent(value: unknown): string {
  const text = pickString(value);
  if (text) return text;

  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      return pickString(record.text) || pickString(record.content);
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickBestGeneratedLine(value: unknown, fallback: string, payload: NormalizedPayload) {
  return sanitizeGeneratedLine(value, fallback, payload);
}

function sanitizeGeneratedLine(value: unknown, fallback: string, payload: NormalizedPayload) {
  if (typeof value !== 'string') return { boostLine: fallback, reason: 'invalid_model_output' };
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return { boostLine: fallback, reason: 'empty_model_output' };

  let line = firstLine
    .replace(/^["'“”‘’「」《》【】]+|["'“”‘’「」《》【】]+$/g, '')
    .replace(/^(马哥打气|打气短句|短句|文案)\s*[：:]\s*/u, '')
    .replace(/[#*_`]/g, '')
    .replace(/\s+/g, '')
    .trim();

  line = normalizeEnding(line);
  if (line.length > 26) line = `${line.slice(0, 24)}！`;

  const forbidden = /扫码|二维码|注册|关注|转发|点击|购买|用户提供|打卡内容|平台统计|分析用户|目标清晰|执行到位|长期主义|锚点|复利|向前推进|加把劲|势头|节奏|坚持就是胜利|今天没动|没做任务|明天.*再/u;
  if (line.length < 8) return { boostLine: fallback, reason: 'model_output_too_short' };
  if (forbidden.test(line)) return { boostLine: fallback, reason: 'model_output_forbidden_phrase' };
  if (/^(加油|你很棒|继续坚持|很不错|真不错|冲呀|继续冲呀)[。！!]*$/u.test(line)) {
    return { boostLine: fallback, reason: 'model_output_too_generic' };
  }
  if (/^.{0,8}(很稳|真不错|很顶|很棒|加油|继续搞)[。！!]*$/u.test(line)) {
    return { boostLine: fallback, reason: 'model_output_too_generic' };
  }
  if (hasUnsupportedSpecifics(line, payload)) {
    return { boostLine: fallback, reason: 'model_output_unsupported_specifics' };
  }
  return { boostLine: line, reason: undefined };
}

function normalizeEnding(line: string) {
  const trimmed = line.replace(/[，,;；:：\s]+$/u, '');
  if (!trimmed) return '';
  if (/[!！]+$/u.test(trimmed)) return trimmed.replace(/[!！]+$/u, '！');
  if (/[?？]+$/u.test(trimmed)) return trimmed.replace(/[?？]+$/u, '？');
  if (/[。]+$/u.test(trimmed)) return trimmed.replace(/[。]+$/u, '。');
  return `${trimmed}！`;
}

function hasUnsupportedSpecifics(line: string, payload: NormalizedPayload) {
  const sourceText = [
    payload.content,
    ...payload.achievements.flatMap((item) => [item.label, item.value]),
    String(payload.stats.totalCount),
    String(payload.stats.currentStreak),
    String(payload.stats.longestStreak),
    String(payload.stats.monthCount),
  ].join('\n').replace(/\s+/g, '');

  const riskySpecificPatterns = line.match(/\d+(?:\.\d+)?\s*(?:分钟|栋|楼|公里|km)/gi) || [];
  if (riskySpecificPatterns.some((item) => !sourceText.includes(item.replace(/\s+/g, '')))) {
    return true;
  }

  if (/连续(?:第)?[二两2]天/.test(line) && payload.stats.currentStreak !== 2) {
    return true;
  }

  const activityWords = ['跑', '训练', '深蹲', '卧推', '硬拉', '引体', '读书', '阅读', '单词', '练字'];
  if (activityWords.some((word) => line.includes(word) && !sourceText.includes(word))) {
    return true;
  }

  const riskyWords = ['楼下', '拐角', '读完'];
  return riskyWords.some((word) => line.includes(word) && !sourceText.includes(word));
}

function buildFallbackBoostLine(payload: NormalizedPayload) {
  return DEFAULT_FALLBACK_BOOST;
}

function buildBoostResponse(boostLine: string, source: BoostLineSource, reason?: string) {
  return jsonResponse({
    boostLine,
    source,
    ...(reason ? { reason } : {}),
  });
}
