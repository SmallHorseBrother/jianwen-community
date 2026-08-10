export type AIStyleAxis = 'explore' | 'create' | 'reason' | 'partner';
export type AIStylePole = 'first' | 'second';
export type AIStyleResponse = { item_id: string; value: number | string };

type ScoredItem = {
  id: string;
  kind: 'likert';
  axis: AIStyleAxis;
  pole: AIStylePole;
  statement: string;
};

type ExperimentalItem = {
  id: string;
  kind: 'forced_choice';
  axis: AIStyleAxis;
  prompt: string;
  options: Array<{ id: 'first' | 'second'; text: string }>;
};

export const AI_STYLE_INSTRUMENT = {
  id: 'ai-usage-style-v1-beta',
  frameworkVersion: 'ai-usage-style-v1',
  itemBankVersion: 'ai-style-item-bank-1.0.0',
  scoringVersion: 'ai-style-scoring-1.0.0',
  title: 'AI 使用风格画像 Beta',
  itemCount: 28,
  scoredItemCount: 24,
  evidenceGrade: 'profile' as const,
};

export const AI_STYLE_AXES: Record<AIStyleAxis, {
  first: { code: string; label: string; english: string; description: string };
  second: { code: string; label: string; english: string; description: string };
}> = {
  explore: {
    first: { code: 'E', label: '探索', english: 'Explore', description: '通过尝试新模型、新方法和新可能来学习。' },
    second: { code: 'S', label: '系统化', english: 'Systematize', description: '把有效方法沉淀为稳定、可复用的实践。' },
  },
  create: {
    first: { code: 'C', label: '创造', english: 'Create', description: '倾向用 AI 创造新的内容、产品和体验。' },
    second: { code: 'O', label: '优化', english: 'Optimize', description: '倾向用 AI 改进既有工作、效率和可靠性。' },
  },
  reason: {
    first: { code: 'R', label: '理解', english: 'Reason', description: '偏好先理解机制、原因、边界和失败模式。' },
    second: { code: 'A', label: '行动', english: 'Act', description: '偏好先动手尝试，再从反馈中快速学习。' },
  },
  partner: {
    first: { code: 'P', label: '共创', english: 'Partner', description: '偏好保持参与，通过多轮协作共同完成任务。' },
    second: { code: 'D', label: '委托', english: 'Delegate', description: '偏好设定边界，让 AI 在范围内自主完成更多步骤。' },
  },
};

export const AI_STYLE_PROFILES: Record<string, {
  name: string;
  englishName: string;
  tagline: string;
  likelyBlindSpot: string;
}> = {
  ECRP: { name: 'AI好奇发明家', englishName: 'Curious Inventor', tagline: '探索新可能，理解它，并与 AI 一起把想法做出来。', likelyBlindSpot: '可能不断开始新实验，却较少沉淀稳定方法。' },
  ECRD: { name: 'AI实验导演', englishName: 'Experimental Director', tagline: '理解新能力后设定方向，再让 AI 扩大执行范围。', likelyBlindSpot: '可能在规则尚未成熟时过早扩大委托。' },
  ECAP: { name: 'AI创意冲刺者', englishName: 'Creative Sprinter', tagline: '通过快速尝试，把新想法迅速变成可见成果。', likelyBlindSpot: '可能忽略记录、核验和方法复用。' },
  ECAD: { name: 'AI原型启动者', englishName: 'Prototype Launcher', tagline: '敢于探索，并让 AI 快速推动新原型落地。', likelyBlindSpot: '可能在验证不足时过早发布或扩大范围。' },
  EORP: { name: 'AI流程侦察员', englishName: 'Workflow Scout', tagline: '不断寻找更好的效率方法，同时保持人在回路。', likelyBlindSpot: '可能频繁切换工具，难以形成稳定流程。' },
  EORD: { name: 'AI自动化开拓者', englishName: 'Automation Pathfinder', tagline: '探索自动化可能，理解后再设计委托方式。', likelyBlindSpot: '可能为并不复杂的问题设计过重的自动化。' },
  EOAP: { name: 'AI效率实验家', englishName: 'Efficiency Experimenter', tagline: '用快速实验发现马上能够节省时间的新方法。', likelyBlindSpot: '可能只解决局部效率，没有形成整体方法。' },
  EOAD: { name: 'AI运营探索者', englishName: 'Ops Explorer', tagline: '快速尝试工具，并把合适的重复工作交给系统。', likelyBlindSpot: '可能出现工具堆积、权限分散和维护负担。' },
  SCRP: { name: 'AI深度匠人', englishName: 'Deep Craftsperson', tagline: '深入掌握方法，在持续共创中打磨高质量成果。', likelyBlindSpot: '可能因追求深入和品质而较慢采用新路径。' },
  SCRD: { name: 'AI产品架构师', englishName: 'Product Architect', tagline: '先理解和设计，再让 AI 稳定推进创造过程。', likelyBlindSpot: '可能在分析和设计阶段停留过久。' },
  SCAP: { name: 'AI实用创作者', englishName: 'Practical Maker', tagline: '用熟悉的方法快速做出真实、可用的新成果。', likelyBlindSpot: '可能错过更适合的新工具和新可能。' },
  SCAD: { name: 'AI生产构建者', englishName: 'Production Builder', tagline: '把创造方法沉淀成可重复运行的生产系统。', likelyBlindSpot: '可能让稳定流程逐渐变得僵化。' },
  SORP: { name: 'AI流程分析师', englishName: 'Process Analyst', tagline: '细致理解现有工作，并与 AI 共同持续改善。', likelyBlindSpot: '可能因过度分析而延迟小规模尝试。' },
  SORD: { name: 'AI系统规划师', englishName: 'Systems Planner', tagline: '设计清晰、稳定、可解释的 AI 优化流程。', likelyBlindSpot: '可能降低探索速度，对新方法观察过久。' },
  SOAP: { name: 'AI稳健优化师', englishName: 'Steady Optimizer', tagline: '用务实协作稳步改善每天正在发生的工作。', likelyBlindSpot: '可能只做渐进改良，忽略重新设计的机会。' },
  SOAD: { name: 'AI运营编排者', englishName: 'Operations Orchestrator', tagline: '把成熟方法变成边界清楚、可持续运行的委托系统。', likelyBlindSpot: '可能在系统稳定后降低必要的抽查与反思。' },
};

const scoredItems: ScoredItem[] = [
  { id: 'ES01', kind: 'likert', axis: 'explore', pole: 'first', statement: '当新的 AI 模型或功能出现时，我通常想先亲自试用，再决定是否纳入日常方法。' },
  { id: 'ES02', kind: 'likert', axis: 'explore', pole: 'second', statement: '与其不断尝试新工具，我更愿意深入掌握少数几种已经验证过的工具。' },
  { id: 'ES03', kind: 'likert', axis: 'explore', pole: 'first', statement: '即使当前 AI 方法已经能用，我也会尝试其他方案，看看是否存在更好的可能。' },
  { id: 'ES04', kind: 'likert', axis: 'explore', pole: 'second', statement: '选择 AI 工具时，一致性和可重复性通常比新鲜感更重要。' },
  { id: 'ES05', kind: 'likert', axis: 'explore', pole: 'first', statement: '我喜欢用同一个真实任务比较多个模型、工具或方法。' },
  { id: 'ES06', kind: 'likert', axis: 'explore', pole: 'second', statement: '找到可靠的 AI 流程后，我更愿意持续优化它，而不是经常换一套。' },
  { id: 'CO01', kind: 'likert', axis: 'create', pole: 'first', statement: '当 AI 帮我做出以前不存在的新东西时，我最有投入感。' },
  { id: 'CO02', kind: 'likert', axis: 'create', pole: 'second', statement: '对我来说，AI 最重要的价值是让已有工作更快、更省力或更可靠。' },
  { id: 'CO03', kind: 'likert', axis: 'create', pole: 'first', statement: '我经常想用 AI 原型化新的内容、产品、服务或体验。' },
  { id: 'CO04', kind: 'likert', axis: 'create', pole: 'second', statement: '相比生成全新的东西，我更容易被减少重复工作和流程浪费的项目吸引。' },
  { id: 'CO05', kind: 'likert', axis: 'create', pole: 'first', statement: '如果只能选一个 AI 项目，我通常会选创造一种新体验，而不是优化已有流程。' },
  { id: 'CO06', kind: 'likert', axis: 'create', pole: 'second', statement: '我主要根据 AI 给现有工作带来的可衡量改善来判断它是否有价值。' },
  { id: 'RA01', kind: 'likert', axis: 'reason', pole: 'first', statement: '在依赖一种新的 AI 能力前，我希望大致理解它为什么有效、又可能怎样失败。' },
  { id: 'RA02', kind: 'likert', axis: 'reason', pole: 'second', statement: '我更喜欢先用真实任务学习 AI 工具，具体原理可以在需要时再补。' },
  { id: 'RA03', kind: 'likert', axis: 'reason', pole: 'first', statement: 'AI 给出意外结果时，我通常会先研究原因，再继续调整。' },
  { id: 'RA04', kind: 'likert', axis: 'reason', pole: 'second', statement: '相比长时间阅读说明，我更愿意先跑几次快速实验，从结果中学习。' },
  { id: 'RA05', kind: 'likert', axis: 'reason', pole: 'first', statement: '即使任务已经成功，我也喜欢弄清楚这套方法为什么奏效。' },
  { id: 'RA06', kind: 'likert', axis: 'reason', pole: 'second', statement: '面对不熟悉的 AI 任务，我的第一反应通常是先动手试一次，再根据输出迭代。' },
  { id: 'PD01', kind: 'likert', axis: 'partner', pole: 'first', statement: '处理重要任务时，我偏好设置多个检查点，随时查看并修正 AI 的工作。' },
  { id: 'PD02', kind: 'likert', axis: 'partner', pole: 'second', statement: '目标和边界明确后，我更希望 AI 连续完成多个步骤，再回来让我检查。' },
  { id: 'PD03', kind: 'likert', axis: 'partner', pole: 'first', statement: '我享受通过多轮来回讨论，与 AI 一起逐步完善成果。' },
  { id: 'PD04', kind: 'likert', axis: 'partner', pole: 'second', statement: '相比每次逐步协作，我更愿意配置一个可复用的 Agent 或自动流程来执行任务。' },
  { id: 'PD05', kind: 'likert', axis: 'partner', pole: 'first', statement: '即使任务容易撤销，我通常也愿意保持参与，而不是让 AI 独立行动。' },
  { id: 'PD06', kind: 'likert', axis: 'partner', pole: 'second', statement: '对于低风险、可撤销的任务，我愿意让 AI 在预设范围内自主采取行动。' },
];

const experimentalItems: ExperimentalItem[] = [
  { id: 'FX01', kind: 'forced_choice', axis: 'explore', prompt: '你有两小时改进自己的 AI 工作方式，更愿意怎样使用？', options: [{ id: 'first', text: '测试三种不熟悉的方法，寻找新的可能' }, { id: 'second', text: '深入优化目前已经在用的流程' }] },
  { id: 'FX02', kind: 'forced_choice', axis: 'create', prompt: '你获得一个能力很强的新 AI 系统，最想先做哪个项目？', options: [{ id: 'first', text: '创造一个过去很难完成的新作品或体验' }, { id: 'second', text: '消除一项昂贵或重复的现有流程' }] },
  { id: 'FX03', kind: 'forced_choice', axis: 'reason', prompt: '一个新 AI 功能给出了意外优秀的结果，你更想先做什么？', options: [{ id: 'first', text: '调查它为什么有效以及可能在哪些情况下失败' }, { id: 'second', text: '马上把它用于几个真实任务并观察表现' }] },
  { id: 'FX04', kind: 'forced_choice', axis: 'partner', prompt: '一个 Agent 可以安全执行每周一次、容易撤销的任务，你更偏好？', options: [{ id: 'first', text: '设置若干中间检查点，与它共同推进' }, { id: 'second', text: '设好规则，让它完成后再统一查看' }] },
];

const scoredDeliveryOrder = Array.from({ length: 6 }, (_, itemIndex) =>
  (['explore', 'create', 'reason', 'partner'] as AIStyleAxis[]).map((axis) =>
    scoredItems.filter((item) => item.axis === axis)[itemIndex]
  )
).flat();

const round = (value: number) => Math.round(value * 100) / 100;

function confidence(score: number) {
  const distance = Math.abs(score - 50);
  if (distance <= 5) return 'balanced';
  if (distance <= 12) return 'slight';
  if (distance <= 22) return 'moderate';
  return 'clear';
}

export function publicAIStyleForm() {
  return {
    instrument: {
      id: AI_STYLE_INSTRUMENT.id,
      framework_version: AI_STYLE_INSTRUMENT.frameworkVersion,
      title: AI_STYLE_INSTRUMENT.title,
      item_count: AI_STYLE_INSTRUMENT.itemCount,
      scored_item_count: AI_STYLE_INSTRUMENT.scoredItemCount,
      scale: {
        min: 1, max: 7,
        labels: ['非常不同意', '不同意', '比较不同意', '看情况/不确定', '比较同意', '同意', '非常同意'],
      },
      axes: AI_STYLE_AXES,
    },
    items: [
      ...scoredDeliveryOrder.map(({ pole: _pole, ...publicItem }) => publicItem),
      ...experimentalItems,
    ],
  };
}

export function scoreAIStyle(value: unknown) {
  const allItems = [...scoredItems, ...experimentalItems];
  if (!Array.isArray(value) || value.length !== allItems.length) {
    throw new Error(`AI 使用风格测评必须包含 ${allItems.length} 个答案`);
  }
  const responseMap = new Map<string, number | string>();
  for (const response of value as AIStyleResponse[]) {
    if (!response || typeof response.item_id !== 'string' || !('value' in response)) {
      throw new Error('AI 使用风格答案格式无效');
    }
    if (responseMap.has(response.item_id)) throw new Error('AI 使用风格答案存在重复题目');
    responseMap.set(response.item_id, response.value);
  }

  const itemScores = scoredItems.map((styleItem) => {
    const response = Number(responseMap.get(styleItem.id));
    if (!Number.isInteger(response) || response < 1 || response > 7) {
      throw new Error(`AI 使用风格答案缺失或无效：${styleItem.id}`);
    }
    const centeredScore = styleItem.pole === 'first' ? response - 4 : 4 - response;
    return { itemId: styleItem.id, axis: styleItem.axis, response, centeredScore };
  });
  const experiments = experimentalItems.map((styleItem) => {
    const response = responseMap.get(styleItem.id);
    if (response !== 'first' && response !== 'second') {
      throw new Error(`AI 使用风格答案缺失或无效：${styleItem.id}`);
    }
    return { itemId: styleItem.id, axis: styleItem.axis, response };
  });

  const axes = Object.fromEntries((Object.keys(AI_STYLE_AXES) as AIStyleAxis[]).map((axis) => {
    const axisItems = itemScores.filter((item) => item.axis === axis);
    const sum = axisItems.reduce((total, current) => total + current.centeredScore, 0);
    return [axis, round(50 + 50 * (sum / (3 * axisItems.length)))];
  })) as Record<AIStyleAxis, number>;
  const axisConfidence = Object.fromEntries((Object.keys(axes) as AIStyleAxis[]).map((axis) => [axis, confidence(axes[axis])])) as Record<AIStyleAxis, 'balanced' | 'slight' | 'moderate' | 'clear'>;
  const code = (Object.keys(AI_STYLE_AXES) as AIStyleAxis[]).map((axis) => axes[axis] >= 50
    ? AI_STYLE_AXES[axis].first.code
    : AI_STYLE_AXES[axis].second.code).join('');
  const profile = AI_STYLE_PROFILES[code];

  return {
    code,
    name: profile.name,
    englishName: profile.englishName,
    tagline: profile.tagline,
    likelyBlindSpot: profile.likelyBlindSpot,
    axes,
    axisConfidence,
    itemScores,
    experiments,
  };
}
