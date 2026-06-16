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

你的声音像社群里的马哥：看到成员认真打卡后，直接回一句有劲、开朗、真诚的鼓励。
整体感觉要像真人在群里夸人，不像宣传标语，也不像管理学金句。

语气要求：
- 活泼、明亮、亲切，有“今天这条我看到了”的回应感。
- 可以说“这波可以”“很顶”“稳住”“真不错”“继续搞”“给你记一功”这类自然口语。
- 要抓住打卡里的具体内容，比如生日、蛋糕、产品宣传、读书进度、训练动作、睡眠饮水。
- 可以轻微幽默，但不要油腻，不要爹味说教。
- 如果正文有点乱，也不要说“没看懂/没看明白”，直接抓一个看得见的细节鼓励。

硬性规则：
1. 只输出一句中文短句，20 到 46 个中文字符左右，不换行。
2. 必须基于用户真实打卡内容生成，优先提到一个具体细节。
3. 如果原始正文或完成项不为空，必须围绕正文/完成项写，不要只写累计次数、连续天数。
4. 统计只能辅助，不能成为句子的主角，除非正文完全没有信息。
5. 可以鼓励，可以热一点；但不要只写“加油”“你很棒”这种空话。
6. 少用“长期主义、本质、核心、系统、复利、刻度、锚点、目标清晰、执行到位”这类硬词。
7. 不要编造未提供的训练重量、页数、成绩、身份或经历。
8. 如果主题是学习、阅读或生活习惯，不要使用训练、动作、恢复、加码等健身词。
9. 不要写营销引导，不要提扫码、二维码、注册、关注、转发。
10. 不要使用 emoji、话题标签、引号、编号或多句解释。

好例子：
- 农历生日还在认真复盘产品，这波状态真的很顶。
- 蛋糕和思考都安排上了，今天这条很有生命力。
- 静静的顿河推进到457页，稳，阅读手感已经起来了。
- 80kg深蹲5x5拿下，今天这条训练记录很硬。
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
        temperature: 0.48,
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
    const sanitized = sanitizeGeneratedLine(answer, fallback, payload);
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
  const factHints = buildFactHints(payload);

  return `
请为这条社区打卡生成一句「马哥打气」短句。

用户昵称：${payload.nickname}
社区身份：${payload.groupName}
主题判断：${payload.themeLabel}
今日完成项数量：${payload.completedCount}
平台统计：累计 ${payload.stats.totalCount} 次，当前连续 ${payload.stats.currentStreak} 天，最长连续 ${payload.stats.longestStreak} 天，本月 ${payload.stats.monthCount} 天

事实白名单：
${factHints}

结构化完成项：
${achievementText}

原始打卡正文：
${content}

只能使用事实白名单、结构化完成项、原始正文里出现的信息。
不要补充任何没有出现过的时间、地点、动作、页数、分钟数、楼栋、场景。
只要有结构化完成项或正文，就不要只围绕“累计/连续/本月”写。
只输出一句短句。
`.trim();
}

function buildFactHints(payload: NormalizedPayload) {
  const facts = [
    `累计 ${payload.stats.totalCount} 次`,
    `当前连续 ${payload.stats.currentStreak} 天`,
    `最长连续 ${payload.stats.longestStreak} 天`,
    `本月 ${payload.stats.monthCount} 天`,
    ...payload.achievements.map((item) => `${item.label}: ${item.value}`),
  ];
  const contentFacts = payload.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  return [...facts, ...contentFacts].map((fact) => `- ${fact}`).join('\n');
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

function sanitizeGeneratedLine(value: unknown, fallback: string, payload: NormalizedPayload) {
  const preferredFallback = buildPreferredFallbackLine(payload, fallback);
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
  if (line.length > 62) line = `${line.slice(0, 60)}。`;

  const forbidden = /坚持就是胜利|扫码|二维码|注册|关注|转发|点击|购买|我们被要求|用户提供|打卡内容|平台统计|分析用户|没看懂|没看明白|目标清晰|执行到位|长期主义|锚点/u;
  if (line.length < 10) return { boostLine: fallback, reason: 'model_output_too_short' };
  if (forbidden.test(line)) return { boostLine: fallback, reason: 'model_output_forbidden_phrase' };
  if (/^(加油|你很棒|继续坚持|很不错|真不错)[。！!]*$/u.test(line)) {
    return { boostLine: preferredFallback, reason: 'model_output_too_generic' };
  }
  if (/^.{0,8}(很稳|真不错|很顶|很棒|加油|继续搞)[。！!]*$/u.test(line)) {
    return { boostLine: preferredFallback, reason: 'model_output_too_generic' };
  }
  if (hasUnsupportedSpecifics(line, payload)) {
    return { boostLine: preferredFallback, reason: 'model_output_unsupported_specifics' };
  }
  if (missesRequiredVisibleDetail(line, payload)) {
    return { boostLine: preferredFallback, reason: 'model_output_missing_visible_detail' };
  }
  if (overusesStatsWhenContentExists(line, payload)) {
    return { boostLine: preferredFallback, reason: 'model_output_overuses_stats' };
  }
  return { boostLine: line, reason: undefined };
}

function buildPreferredFallbackLine(payload: NormalizedPayload, fallback: string) {
  const text = getPayloadText(payload);
  if (/生日|蛋糕|农历/.test(text) && /产品|宣传|项目|创业|方案|复盘|思考/.test(text)) {
    return '农历生日还在认真想产品宣传，这波状态真的很顶。';
  }
  if (/生日|蛋糕|农历/.test(text)) {
    return '生日也认真打卡，这份状态很亮，今天值得记一功。';
  }
  if (/产品|宣传|项目|创业|方案|复盘|思考/.test(text)) {
    return '产品宣传这块开始加速了，很好，节奏正在起来。';
  }
  return fallback;
}

function missesRequiredVisibleDetail(line: string, payload: NormalizedPayload) {
  const text = getPayloadText(payload);
  if (/生日|蛋糕|农历/.test(text) && !/生日|蛋糕|农历/.test(line)) return true;
  if (/产品|宣传|项目|创业|方案|复盘|思考/.test(text) && !/产品|宣传|项目|创业|方案|复盘|思考/.test(line)) return true;
  return false;
}

function overusesStatsWhenContentExists(line: string, payload: NormalizedPayload) {
  const text = getPayloadText(payload).trim();
  if (!text) return false;
  const statWordCount = ['累计', '连续', '本月', '打卡'].filter((word) => line.includes(word)).length;
  const hasVisibleContentWord = payload.achievements.some((item) => {
    const candidates = [item.label, item.value]
      .flatMap((part) => part.split(/[：:，,。\s、-]+/))
      .map((part) => part.trim())
      .filter((part) => part.length >= 2 && !/^\d+$/.test(part));
    return candidates.some((part) => line.includes(part));
  });
  return statWordCount >= 2 && !hasVisibleContentWord;
}

function getPayloadText(payload: NormalizedPayload) {
  return [
    payload.content,
    ...payload.achievements.flatMap((item) => [item.label, item.value]),
  ].join('\n');
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

  const riskyWords = ['楼下', '拐角', '读完'];
  return riskyWords.some((word) => line.includes(word) && !sourceText.includes(word));
}

function buildFallbackBoostLine(payload: NormalizedPayload) {
  const text = `${payload.content}\n${payload.achievements.map((item) => `${item.label}:${item.value}`).join('\n')}`;
  const doneText = payload.completedCount > 0 ? `今天完成 ${payload.completedCount} 项，` : '';
  const streakText = payload.stats.currentStreak > 1 ? `连续 ${payload.stats.currentStreak} 天，` : '';

  if (/生日|蛋糕|农历/.test(text)) {
    return `${doneText || streakText}生日也认真打卡，这份状态很亮，继续搞。`;
  }
  if (/产品|宣传|项目|创业|方案|复盘/.test(text)) {
    return `${doneText || streakText}产品宣传这块开始动脑了，很好，节奏正在起来。`;
  }
  if (/静静的顿河|读书|阅读|书/.test(text)) {
    return `${doneText || streakText}这页数是实打实推进，阅读手感已经慢慢起来了。`;
  }
  if (/单词|英语|背词|anki/i.test(text)) {
    return `${doneText || streakText}单词又拿下一轮，稳住，这种小推进最扎实。`;
  }
  if (/练字|写字|字帖/.test(text)) {
    return `${doneText || streakText}练字这事很吃耐心，今天这笔算是稳稳落下了。`;
  }
  if (/深蹲|卧推|硬拉|引体|训练|力量|有氧|公里|跑/.test(text)) {
    return `${doneText || streakText}训练记录很硬，今天这波执行力可以给自己记一功。`;
  }
  if (/饮食|睡眠|早睡|冥想|情绪|饮水/.test(text)) {
    return `${doneText || streakText}把生活小事记下来就很厉害，状态就是这样养起来的。`;
  }
  if (payload.themeLabel === '学习成长') {
    return `${doneText || streakText}学习这条很稳，今天的自己没有糊弄过去。`;
  }
  if (payload.themeLabel === '健身成长') {
    return `${doneText || streakText}训练能留下记录就很顶，下一次继续接上。`;
  }
  return `${doneText || streakText}这条打卡很实在，今天的状态已经被你接住了。`;
}

function buildBoostResponse(boostLine: string, source: BoostLineSource, reason?: string) {
  return jsonResponse({
    boostLine,
    source,
    ...(reason ? { reason } : {}),
  });
}
