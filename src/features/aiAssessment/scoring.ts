import {
  capabilityDimensions,
  capabilityLevels,
  getCapabilityQuestions,
  personalityAxes,
  personalityProfiles,
  personalityQuestions,
  type CapabilityDimension,
  type CapabilityTrack,
  type PersonalityAxis,
} from './catalog';

export type CapabilityResult = {
  total: number;
  percentage: number;
  level: number;
  routeLevel: 'starter' | 'application' | 'practice';
  levelTitle: string;
  levelSummary: string;
  dimensions: Record<CapabilityDimension, number>;
  strongest: CapabilityDimension;
  growthArea: CapabilityDimension;
};

export type PersonalityResult = {
  code: string;
  name: string;
  tagline: string;
  axes: Record<PersonalityAxis, number>;
};

const dimensionKeys = Object.keys(capabilityDimensions) as CapabilityDimension[];
const axisKeys = Object.keys(personalityAxes) as PersonalityAxis[];

export function scoreCapability(track: CapabilityTrack, answers: number[]): CapabilityResult {
  const questions = getCapabilityQuestions(track);
  if (answers.length !== questions.length || answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
    throw new Error('能力测评答案不完整');
  }

  const rawDimensions = Object.fromEntries(dimensionKeys.map((key) => [key, 0])) as Record<CapabilityDimension, number>;
  questions.forEach((question, index) => {
    rawDimensions[question.dimension] += answers[index];
  });

  const dimensions = Object.fromEntries(
    dimensionKeys.map((key) => [key, Math.round((rawDimensions[key] / 15) * 100)]),
  ) as Record<CapabilityDimension, number>;
  const total = answers.reduce((sum, answer) => sum + answer, 0);
  const percentage = Math.round((total / 90) * 100);

  let level = Math.min(5, Math.floor(total / 15));
  if (level >= 3 && (dimensions.creation < 40 || dimensions.verification < 35)) level = 2;
  if (level >= 4 && (dimensions.systems < 55 || dimensions.creation < 50)) level = 3;
  if (level >= 5 && (dimensions.systems < 75 || dimensions.creation < 70 || dimensions.verification < 65)) level = 4;

  const strongest = [...dimensionKeys].sort((a, b) => dimensions[b] - dimensions[a])[0];
  const growthArea = [...dimensionKeys].sort((a, b) => dimensions[a] - dimensions[b])[0];
  const levelInfo = capabilityLevels[level];

  return {
    total,
    percentage,
    level,
    routeLevel: level <= 1 ? 'starter' : level <= 3 ? 'application' : 'practice',
    levelTitle: levelInfo.title,
    levelSummary: levelInfo.summary,
    dimensions,
    strongest,
    growthArea,
  };
}

export function scorePersonality(answers: number[]): PersonalityResult {
  if (answers.length !== personalityQuestions.length || answers.some((answer) => ![-2, -1, 1, 2].includes(answer))) {
    throw new Error('人格测评答案不完整');
  }

  const axes = Object.fromEntries(axisKeys.map((axis) => [axis, 0])) as Record<PersonalityAxis, number>;
  const firstAnswerByAxis = {} as Record<PersonalityAxis, number>;
  personalityQuestions.forEach((question, index) => {
    axes[question.axis] += answers[index];
    if (firstAnswerByAxis[question.axis] === undefined) firstAnswerByAxis[question.axis] = answers[index];
  });

  const code = axisKeys.map((axis) => {
    const definition = personalityAxes[axis];
    const score = axes[axis];
    return score < 0 || (score === 0 && firstAnswerByAxis[axis] < 0)
      ? definition.leftCode
      : definition.rightCode;
  }).join('');
  const profile = personalityProfiles[code];

  return { code, name: profile.name, tagline: profile.tagline, axes };
}

export function buildCapabilityFallback(result: CapabilityResult) {
  return {
    headline: `你已经站在${result.levelTitle}的起点上`,
    overview: result.levelSummary,
    strengths: [`你的${capabilityDimensions[result.strongest].label}最突出，可以优先把它转化成真实成果。`],
    risks: [`当前最值得补齐的是${capabilityDimensions[result.growthArea].label}，它会限制你进入下一等级。`],
    nextSteps: [
      `用一个真实任务练习${capabilityDimensions[result.growthArea].label}`,
      '建立一份可复用的提示词或检查清单',
      '两周后用同类任务复盘一次效率和质量',
    ],
  };
}

export function buildPersonalityFallback(result: PersonalityResult) {
  return {
    headline: `你是${result.name}`,
    overview: result.tagline,
    strengths: ['你有一套自然的人机协作偏好，选对方法时会进入很舒服的高效状态。'],
    risks: ['人格不是能力高低；当任务变化时，也要主动练习相反一侧的工作方式。'],
    nextSteps: ['选择一个符合你偏好的AI项目开始实践', '邀请朋友测试并比较彼此的协作方式', '完成能力测评，找到与你的人格匹配的成长路线'],
  };
}
