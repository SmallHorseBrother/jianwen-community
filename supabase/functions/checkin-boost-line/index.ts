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

请生成多句简单、有劲、活泼的鼓励话。
语气像朋友在群里顺手打气，要自然、明亮、让人看了想继续干。
不需要提到用户记录里的具体事情，鼓励感最重要。
不要像在分析用户记录，也不要复述打卡内容。

硬性规则：
1. 输出 8 句候选，每行一句，不要编号。
2. 每句 12 到 34 个中文字符左右。
3. 可以很直接地鼓励，可以有一点兴奋感，但不要像客服。
4. 不要写累计次数、连续天数。
5. 不要写“长期主义、本质、核心、系统、复利、锚点、目标清晰、执行到位”这类硬词。
6. 不要冷冰冰评价，不要阴阳怪气。
7. 不要编造训练重量、页数、成绩、身份或经历。
8. 不要主动写具体运动、读书、训练、产品等记录细节，除非非常自然。
9. 不要写营销引导，不要提扫码、二维码、注册、关注、转发。
10. 不要使用 emoji、话题标签、引号、解释。

候选可以像这样：
可以，今天先赢这一小局。
别小看这一点，劲就是这么攒起来的。
很好，继续把这股劲接住。
今天已经动起来了，这就很可以。
状态在回来了，别急，继续来。
这一下挺提气的，往前走。
稳住，今天已经比昨天多了一点。
可以可以，今天没有空过。
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

不需要复述上面的内容，也不需要提具体数字。
重点是写一句让人看了更有劲的话。
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

function pickBestGeneratedLine(value: unknown, fallback: string, payload: NormalizedPayload) {
  const candidates = extractGeneratedCandidates(value);
  const accepted = candidates
    .map((candidate) => sanitizeGeneratedLine(candidate, fallback, payload))
    .filter((item) => item.boostLine !== fallback);

  if (accepted.length > 0) {
    const index = Math.floor(Math.random() * accepted.length);
    return accepted[index];
  }

  return {
    boostLine: pickLocalEncouragement(),
    reason: candidates.length ? 'all_model_candidates_rejected' : 'empty_model_output',
  };
}

function extractGeneratedCandidates(value: unknown) {
  if (typeof value !== 'string') return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => line.split(/[；;]/).map((item) => item.trim()))
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.、)]|[一二三四五六七八][.、)])\s*/u, ''))
    .filter(Boolean)
    .slice(0, 12);
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

  line = line.replace(/[，,。.!！?？;；:：]+$/u, '。');
  if (line.length > 42) line = `${line.slice(0, 40)}。`;

  const forbidden = /坚持就是胜利|扫码|二维码|注册|关注|转发|点击|购买|我们被要求|用户提供|打卡内容|平台统计|分析用户|没看懂|没看明白|目标清晰|执行到位|长期主义|锚点|复利|不是糊弄自己|不是随便|不是摆拍|今天很有精神|继续往前走|这条不错|今天没动|没做任务|停一停|明天.*接上|明天.*再/u;
  if (line.length < 10) return { boostLine: fallback, reason: 'model_output_too_short' };
  if (forbidden.test(line)) return { boostLine: fallback, reason: 'model_output_forbidden_phrase' };
  if (/^(加油|你很棒|继续坚持|很不错|真不错)[。！!]*$/u.test(line)) {
    return { boostLine: fallback, reason: 'model_output_too_generic' };
  }
  if (/^.{0,8}(很稳|真不错|很顶|很棒|加油|继续搞)[。！!]*$/u.test(line)) {
    return { boostLine: fallback, reason: 'model_output_too_generic' };
  }
  if (hasUnsupportedSpecifics(line, payload)) {
    return { boostLine: fallback, reason: 'model_output_unsupported_specifics' };
  }
  if (overusesStatsWhenContentExists(line, payload)) {
    return { boostLine: fallback, reason: 'model_output_overuses_stats' };
  }
  return { boostLine: line, reason: undefined };
}

function pickLocalEncouragement() {
  const general = [
    '可以，今天算赢了一小局。',
    '别小看这一点，劲就是这么攒起来的。',
    '很好，继续把这股劲接住。',
    '今天已经动起来了，这就很可以。',
    '状态在回来了，别急，继续来。',
    '今天这一下挺提气的。',
    '稳住，今天已经比昨天多了一点。',
    '可以可以，今天没有空过。',
    '这口气别松，继续来。',
    '慢慢来，但别停。',
    '今天先把这一小步拿下。',
    '有一点进展就值得继续。',
    '保持这个劲，后面会更顺。',
    '今天已经开始发光了。',
    '往前一点点，也算赢。',
    '这一下不错，继续接上。',
    '今天没有空过，这就很好。',
  ];
  return general[Math.floor(Math.random() * general.length)];
}

function overusesStatsWhenContentExists(line: string, payload: NormalizedPayload) {
  const text = getPayloadText(payload).trim();
  if (!text) return false;
  const statWordCount = ['累计', '连续', '本月', '打卡'].filter((word) => line.includes(word)).length;
  const hasVisibleContentWord = extractVisibleContentWords(payload)
    .some((part) => line.includes(part));
  return statWordCount >= 2 && !hasVisibleContentWord;
}

function extractVisibleContentWords(payload: NormalizedPayload) {
  const directWords = [
    '生日', '蛋糕', '产品', '宣传', '项目', '复盘', '思考',
    '跑步', '公里', '读书', '阅读', '静静的顿河', '单词', '练字',
    '深蹲', '卧推', '硬拉', '引体', '训练', '睡眠', '饮水', '冥想',
  ].filter((word) => getPayloadText(payload).includes(word));

  const splitWords = [
    payload.content,
    ...payload.achievements.flatMap((item) => [item.label, item.value]),
  ]
    .flatMap((part) => part.split(/[：:，,。\s、-]+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !/^\d+$/.test(part));

  return Array.from(new Set([...directWords, ...splitWords]));
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

  const activityWords = ['跑', '训练', '深蹲', '卧推', '硬拉', '引体', '读书', '阅读', '单词', '练字'];
  if (activityWords.some((word) => line.includes(word) && !sourceText.includes(word))) {
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
    return `${doneText || streakText}生日还记得打卡，可以，这一天过得不空。`;
  }
  if (/产品|宣传|项目|创业|方案|复盘/.test(text)) {
    return `${doneText || streakText}产品宣传开始动起来了，可以，这事儿往前走了。`;
  }
  if (/静静的顿河|读书|阅读|书/.test(text)) {
    return `${doneText || streakText}阅读又往前推进了，继续啃，已经可以了。`;
  }
  if (/单词|英语|背词|anki/i.test(text)) {
    return `${doneText || streakText}单词完成了，可以，这块今天没落下。`;
  }
  if (/练字|写字|字帖/.test(text)) {
    return `${doneText || streakText}练字也交上来了，可以，手感慢慢养起来。`;
  }
  if (/深蹲|卧推|硬拉|引体|训练|力量|有氧|公里|跑/.test(text)) {
    return `${doneText || streakText}训练完成了，可以，今天这身体没白动。`;
  }
  if (/饮食|睡眠|早睡|冥想|情绪|饮水/.test(text)) {
    return `${doneText || streakText}这些小事能记下来就挺好，状态会慢慢回来。`;
  }
  if (payload.themeLabel === '学习成长') {
    return `${doneText || streakText}学习这条完成了，可以，今天没空过去。`;
  }
  if (payload.themeLabel === '健身成长') {
    return `${doneText || streakText}训练这条完成了，可以，今天身体没白动。`;
  }
  return `${doneText || streakText}这条可以，今天没空过去。`;
}

function buildBoostResponse(boostLine: string, source: BoostLineSource, reason?: string) {
  return jsonResponse({
    boostLine,
    source,
    ...(reason ? { reason } : {}),
  });
}
