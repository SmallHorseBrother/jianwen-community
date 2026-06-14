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

const STYLE_PROMPT = `
你是健文社区分享海报里的「马哥打气」文案助手。

你的表达参考「枭马葛 / 马健文」的公开风格画像：
- 深度干货 + 实战权威 + 学术理性。
- 冷静、自信、直接，结论先行，逻辑链完整。
- 偏长期主义、训练记录、学习复盘、迁移性、可量化反馈。
- 去情绪化但有信念感，不讨好、不鸡汤、不喊口号。

你只负责输出海报顶部的一句短句。

硬性规则：
1. 只输出一句中文短句，24 到 52 个中文字符左右，不换行。
2. 必须基于用户真实打卡内容、完成项或统计信息生成，优先抓具体名词、动作、书名、数量、连续次数。
3. 可以使用「不是 A，而是 B」「核心是」「本质上」等句式，但不要机械重复。
4. 不要出现“加油”“你很棒”“坚持就是胜利”“燃起来”“冲鸭”等泛泛鼓励。
5. 不要编造未提供的训练重量、页数、成绩、身份或经历。
6. 如果主题是学习、阅读或生活习惯，不要使用训练、动作、恢复、加码等健身词。
7. 不要写营销引导，不要提扫码、二维码、注册、关注、转发。
8. 不要使用 emoji、话题标签、引号、编号或多句解释。
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
        temperature: 0.72,
        max_tokens: 512,
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
    const sanitized = sanitizeGeneratedLine(answer, fallback);
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

  return `
请为这条社区打卡生成一句「马哥打气」短句。

用户昵称：${payload.nickname}
社区身份：${payload.groupName}
主题判断：${payload.themeLabel}
今日完成项数量：${payload.completedCount}
平台统计：累计 ${payload.stats.totalCount} 次，当前连续 ${payload.stats.currentStreak} 天，最长连续 ${payload.stats.longestStreak} 天，本月 ${payload.stats.monthCount} 天

结构化完成项：
${achievementText}

原始打卡正文：
${content}

只输出一句短句。
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

function sanitizeGeneratedLine(value: unknown, fallback: string) {
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

  line = line.replace(/[，,。.!！?？;；:：]+$/u, '。');
  if (line.length > 58) line = `${line.slice(0, 56)}。`;

  const forbidden = /加油|你很棒|坚持就是胜利|燃起来|冲鸭|扫码|二维码|注册|关注|转发|点击|购买|我们被要求|用户提供|打卡内容|平台统计|分析用户/u;
  if (line.length < 10) return { boostLine: fallback, reason: 'model_output_too_short' };
  if (forbidden.test(line)) return { boostLine: fallback, reason: 'model_output_forbidden_phrase' };
  return { boostLine: line, reason: undefined };
}

function buildFallbackBoostLine(payload: NormalizedPayload) {
  const text = `${payload.content}\n${payload.achievements.map((item) => `${item.label}:${item.value}`).join('\n')}`;
  const doneText = payload.completedCount > 0 ? `今天完成 ${payload.completedCount} 项，` : '';
  const streakText = payload.stats.currentStreak > 1 ? `连续 ${payload.stats.currentStreak} 天，` : '';

  if (/静静的顿河|读书|阅读|书/.test(text)) {
    return `${doneText || streakText}这不是读了几页，而是把注意力训练成可累计资产。`;
  }
  if (/单词|英语|背词|anki/i.test(text)) {
    return `${doneText || streakText}单词别靠感觉，靠重复、反馈和下一次还能捡起来。`;
  }
  if (/练字|写字|字帖/.test(text)) {
    return `${doneText || streakText}练字的价值不在今天多漂亮，而在手感每天被校准。`;
  }
  if (/深蹲|卧推|硬拉|引体|训练|力量|有氧|公里|跑/.test(text)) {
    return `${doneText || streakText}训练别拼情绪，动作、次数和恢复能复盘才有加码依据。`;
  }
  if (/饮食|睡眠|早睡|冥想|情绪|饮水/.test(text)) {
    return `${doneText || streakText}习惯不是喊口号，能被记录、复盘、调整，才会长在身上。`;
  }
  if (payload.themeLabel === '学习成长') {
    return `${doneText || streakText}学习打卡的本质，是给明天的自己留一份可复用反馈。`;
  }
  if (payload.themeLabel === '健身成长') {
    return `${doneText || streakText}健身不是热血叙事，是训练量、恢复和执行力的长期校准。`;
  }
  return `${doneText || streakText}长期主义不是感动自己，是每天多交一份可验证证据。`;
}

function buildBoostResponse(boostLine: string, source: BoostLineSource, reason?: string) {
  return jsonResponse({
    boostLine,
    source,
    ...(reason ? { reason } : {}),
  });
}
