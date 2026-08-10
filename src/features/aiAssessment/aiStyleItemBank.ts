export type UsageStyleAxis = 'explore' | 'create' | 'reason' | 'partner';
export type UsageStylePole = 'first' | 'second';

export type UsageStyleCandidateItem = {
  id: string;
  axis: UsageStyleAxis;
  pole: UsageStylePole;
  statement: string;
  selectedForBeta: boolean;
};

const item = (
  id: string,
  axis: UsageStyleAxis,
  pole: UsageStylePole,
  statement: string,
  selectedForBeta = false,
): UsageStyleCandidateItem => ({ id, axis, pole, statement, selectedForBeta });

// 56-item candidate pool: 14 per axis, seven items written toward each pole.
// The first eight items of every axis form the 32-item scored Beta extended form.
export const usageStyleCandidateItems: UsageStyleCandidateItem[] = [
  item('ES01', 'explore', 'first', '当新的 AI 模型或功能出现时，我通常想先亲自试用，再决定是否纳入日常方法。', true),
  item('ES02', 'explore', 'second', '与其不断尝试新工具，我更愿意深入掌握少数几种已经验证过的工具。', true),
  item('ES03', 'explore', 'first', '即使当前 AI 方法已经能用，我也会尝试其他方案，看看是否存在更好的可能。', true),
  item('ES04', 'explore', 'second', '选择 AI 工具时，一致性和可重复性通常比新鲜感更重要。', true),
  item('ES05', 'explore', 'first', '我喜欢用同一个真实任务比较多个模型、工具或方法。', true),
  item('ES06', 'explore', 'second', '找到可靠的 AI 流程后，我更愿意持续优化它，而不是经常换一套。', true),
  item('ES07', 'explore', 'first', '我愿意固定留出时间，专门探索还没有明确用途的 AI 新能力。', true),
  item('ES08', 'explore', 'second', '只有看到新方法在真实任务中明显更好，我才会调整现有工具组合。', true),
  item('ES09', 'explore', 'first', '测试 AI 能力边界本身就会让我感到有趣，即使实验未必立刻有结果。'),
  item('ES10', 'explore', 'second', '一次 AI 实践成功后，我会优先把它整理成稳定方法，再探索下一种玩法。'),
  item('ES11', 'explore', 'first', '一个新 AI 功能即使价值还不确定，我也愿意先做一个低成本小实验。'),
  item('ES12', 'explore', 'second', '只要现有 AI 工具仍稳定满足需求，我通常不会因为潮流而更换它。'),
  item('ES13', 'explore', 'first', '面对陌生 AI 任务时，我更自然地同时试几条路线，再决定深入哪一条。'),
  item('ES14', 'explore', 'second', '我更喜欢沿着一套清晰的方法长期积累，而不是频繁横向切换。'),

  item('CO01', 'create', 'first', '当 AI 帮我做出以前不存在的新东西时，我最有投入感。', true),
  item('CO02', 'create', 'second', '对我来说，AI 最重要的价值是让已有工作更快、更省力或更可靠。', true),
  item('CO03', 'create', 'first', '我经常想用 AI 原型化新的内容、产品、服务或体验。', true),
  item('CO04', 'create', 'second', '相比生成全新的东西，我更容易被减少重复工作和流程浪费的项目吸引。', true),
  item('CO05', 'create', 'first', '如果只能选一个 AI 项目，我通常会选创造一种新体验，而不是优化已有流程。', true),
  item('CO06', 'create', 'second', '我主要根据 AI 给现有工作带来的可衡量改善来判断它是否有价值。', true),
  item('CO07', 'create', 'first', '面对一张白纸构思 AI 可以创造什么，通常比修补现有流程更吸引我。', true),
  item('CO08', 'create', 'second', '减少错误、等待和交接成本，会比做出一个新概念更让我有成就感。', true),
  item('CO09', 'create', 'first', '我使用 AI 时，常常先问它还能打开哪些新的表达或产品可能。'),
  item('CO10', 'create', 'second', '看到一项工作时，我往往先寻找其中可以标准化、压缩或自动完成的部分。'),
  item('CO11', 'create', 'first', '一个可以展示、发布或继续发展的新作品，是我判断 AI 项目成功的重要信号。'),
  item('CO12', 'create', 'second', '时间、质量、成本或稳定性的改善，是我判断 AI 项目成功的重要信号。'),
  item('CO13', 'create', 'first', '我更喜欢让 AI 扩展想法空间，而不是只把原有做法执行得更快。'),
  item('CO14', 'create', 'second', '我更喜欢让 AI 把已有产出变得稳定可复制，而不是持续追求不同的新形式。'),

  item('RA01', 'reason', 'first', '在依赖一种新的 AI 能力前，我希望大致理解它为什么有效、又可能怎样失败。', true),
  item('RA02', 'reason', 'second', '我更喜欢先用真实任务学习 AI 工具，具体原理可以在需要时再补。', true),
  item('RA03', 'reason', 'first', 'AI 给出意外结果时，我通常会先研究原因，再继续调整。', true),
  item('RA04', 'reason', 'second', '相比长时间阅读说明，我更愿意先跑几次快速实验，从结果中学习。', true),
  item('RA05', 'reason', 'first', '即使任务已经成功，我也喜欢弄清楚这套方法为什么奏效。', true),
  item('RA06', 'reason', 'second', '面对不熟悉的 AI 任务，我的第一反应通常是先动手试一次，再根据输出迭代。', true),
  item('RA07', 'reason', 'first', '采用一种 AI 方法前，我更愿意先理解它依赖的假设和适用边界。', true),
  item('RA08', 'reason', 'second', '我通常先做出一个能运行的版本，再逐步建立对背后方法的理解。', true),
  item('RA09', 'reason', 'first', '比较两种 AI 方案时，我会关注它们为何产生不同结果。'),
  item('RA10', 'reason', 'second', '比较两种 AI 方案时，我更关心哪一种能让我更快推进当前任务。'),
  item('RA11', 'reason', 'first', 'AI 方法失效时，我倾向先形成一个原因假设，再有针对性地验证。'),
  item('RA12', 'reason', 'second', 'AI 方法失效时，我倾向快速改变输入或步骤，直到找到可用路径。'),
  item('RA13', 'reason', 'first', '理解机制和失败模式，会明显增加我使用 AI 时的踏实感。'),
  item('RA14', 'reason', 'second', '连续几次亲自尝试带来的反馈，通常比完整的原理说明更能帮助我学习。'),

  item('PD01', 'partner', 'first', '处理重要任务时，我偏好设置多个检查点，随时查看并修正 AI 的工作。', true),
  item('PD02', 'partner', 'second', '目标和边界明确后，我更希望 AI 连续完成多个步骤，再回来让我检查。', true),
  item('PD03', 'partner', 'first', '我享受通过多轮来回讨论，与 AI 一起逐步完善成果。', true),
  item('PD04', 'partner', 'second', '相比每次逐步协作，我更愿意配置一个可复用的 Agent 或自动流程来执行任务。', true),
  item('PD05', 'partner', 'first', '即使任务容易撤销，我通常也愿意保持参与，而不是让 AI 独立行动。', true),
  item('PD06', 'partner', 'second', '对于低风险、可撤销的任务，我愿意让 AI 在预设范围内自主采取行动。', true),
  item('PD07', 'partner', 'first', '我更喜欢和 AI 一起查看中间产物，边做边共同决定下一步。', true),
  item('PD08', 'partner', 'second', '规则成熟后，我更喜欢只看最终结果、日志和异常，而不是每一步都参与。', true),
  item('PD09', 'partner', 'first', '我更自然地把 AI 当作共同思考和共同创作的搭档。'),
  item('PD10', 'partner', 'second', '我更自然地把 AI 当作可以接收目标并调度工具的执行系统。'),
  item('PD11', 'partner', 'first', '任务进行中，我习惯频繁补充判断和反馈，以保持方向一致。'),
  item('PD12', 'partner', 'second', '只要权限和停止条件清楚，我更愿意定期检查，而不是持续指导。'),
  item('PD13', 'partner', 'first', '我希望关键表达和决策始终由人参与形成，而不是只在最后批准。'),
  item('PD14', 'partner', 'second', '我愿意把可规则化的中间决策交给 AI，只保留例外和高影响决策。'),
];

export const usageStyleBetaItemIds = usageStyleCandidateItems
  .filter((candidate) => candidate.selectedForBeta)
  .map((candidate) => candidate.id);

export const usageStyleExperimentalItems = [
  {
    id: 'FX01', axis: 'explore' as const,
    prompt: '你有两小时改进自己的 AI 工作方式，更愿意怎样使用？',
    first: '测试三种不熟悉的方法，寻找新的可能',
    second: '深入优化目前已经在用的流程',
  },
  {
    id: 'FX02', axis: 'create' as const,
    prompt: '你获得一个能力很强的新 AI 系统，最想先做哪个项目？',
    first: '创造一个过去很难完成的新作品或体验',
    second: '消除一项昂贵或重复的现有流程',
  },
  {
    id: 'FX03', axis: 'reason' as const,
    prompt: '一个新 AI 功能给出了意外优秀的结果，你更想先做什么？',
    first: '调查它为什么有效以及可能在哪些情况下失败',
    second: '马上把它用于几个真实任务并观察表现',
  },
  {
    id: 'FX04', axis: 'partner' as const,
    prompt: '一个 Agent 可以安全执行每周一次、容易撤销的任务，你更偏好？',
    first: '设置若干中间检查点，与它共同推进',
    second: '设好规则，让它完成后再统一查看',
  },
];
