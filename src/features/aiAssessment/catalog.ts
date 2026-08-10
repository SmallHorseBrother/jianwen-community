export type CapabilityDimension =
  | 'cognition'
  | 'usage'
  | 'communication'
  | 'verification'
  | 'creation'
  | 'systems';

export type CapabilityTrack = 'daily' | 'work';
export type LearningGoal = 'office' | 'content' | 'learning' | 'product' | 'programming';
export type PersonalityAxis = 'exploration' | 'goal' | 'thinking' | 'mode';

export type CapabilityQuestion = {
  id: string;
  dimension: CapabilityDimension;
  prompt: string;
  options: readonly [string, string, string, string];
  track?: CapabilityTrack;
};

export type PersonalityQuestion = {
  id: string;
  axis: PersonalityAxis;
  prompt: string;
  left: string;
  right: string;
};

export const capabilityDimensions: Record<CapabilityDimension, { label: string; description: string }> = {
  cognition: { label: 'AI认知', description: '理解AI的能力边界，并能为任务选择合适方法。' },
  usage: { label: 'AI使用', description: '把不同AI工具稳定用于日常和真实任务。' },
  communication: { label: 'AI沟通', description: '把目标、背景、限制和反馈准确交给AI。' },
  verification: { label: 'AI验证', description: '核验事实、质量、风险和隐私，而不是盲目信任。' },
  creation: { label: 'AI创造', description: '借助AI产出可发布、可交付、可使用的成果。' },
  systems: { label: 'AI系统', description: '把提示词、工具和自动化连接成可复用工作流。' },
};

export const capabilityLevels = [
  { level: 0, title: 'AI观察者', summary: '听说过AI，但还没有形成稳定的使用习惯。' },
  { level: 1, title: 'AI使用者', summary: '会向AI提问，也能完成一些简单的生成任务。' },
  { level: 2, title: 'AI协作者', summary: '能够与AI多轮协作，完成真实任务的一部分。' },
  { level: 3, title: 'AI生产者', summary: '能够持续产出内容、产品原型或工作成果。' },
  { level: 4, title: 'AI系统设计者', summary: '能够设计稳定的工作流、自动化和Agent。' },
  { level: 5, title: 'AI变革者', summary: '能够推动团队或组织形成新的AI工作方式。' },
] as const;

export const learningGoals: { value: LearningGoal; label: string; description: string }[] = [
  { value: 'office', label: '办公提效', description: '写作、表格、汇报和重复工作' },
  { value: 'content', label: '内容创作', description: '选题、文案、图片和个人表达' },
  { value: 'learning', label: '学习研究', description: '阅读、整理知识和学习计划' },
  { value: 'product', label: '产品与创业', description: '调研、方案、原型和业务实践' },
  { value: 'programming', label: '编程自动化', description: '代码、Agent和自动化工作流' },
];

const coreCapabilityQuestions: CapabilityQuestion[] = [
  {
    id: 'cog-1', dimension: 'cognition', prompt: '当AI给出一个很确定的答案时，你通常怎样理解它？',
    options: ['AI既然这样说，多半就是正确的', '我知道它偶尔会错，但一般还是直接采用', '我知道它是在生成可能的答案，重要内容需要核实', '我会根据任务风险判断可信度，并选择检索、引用或其他验证方式'],
  },
  {
    id: 'use-1', dimension: 'usage', prompt: '你目前使用AI工具的频率最接近哪一种？',
    options: ['还没用过，或只偶然试过一两次', '有明确需要时才会想起来使用', '每周都会使用，已经是常用工具之一', '几乎每天使用，并覆盖多个生活或工作场景'],
  },
  {
    id: 'com-1', dimension: 'communication', prompt: '让AI帮你完成任务时，你通常怎样描述需求？',
    options: ['想到什么就输入一句', '会补充自己想要的结果', '会说明目标、背景和输出形式', '会同时给出目标、背景、限制、示例和验收标准'],
  },
  {
    id: 'ver-1', dimension: 'verification', prompt: 'AI提供事实、数字或链接时，你通常会怎么做？',
    options: ['通常直接采用', '看起来不合理时才检查', '重要信息会找到其他来源交叉确认', '会回到原始来源核对时间、口径和上下文'],
  },
  {
    id: 'cre-1', dimension: 'creation', prompt: '你是否用AI完成过一个有明确交付物的真实任务？',
    options: ['还没有', '做过练习或零散的小成果', '完成过可直接使用的文档、内容或方案', '持续完成并发布、交付或投入使用多个成果'],
  },
  {
    id: 'sys-1', dimension: 'systems', prompt: '你是否保存并复用过提示词、模板或操作流程？',
    options: ['没有，每次都从零开始', '偶尔收藏一些好用的提问方式', '有自己反复使用的模板或资料库', '已经形成可重复执行、可持续优化的标准流程'],
  },
  {
    id: 'cog-2', dimension: 'cognition', prompt: '面对聊天、搜索、绘图、代码等不同AI工具，你会怎样选择？',
    options: ['基本只知道一个聊天工具', '哪个顺手就用哪个', '知道不同工具各有所长，会按任务选择', '会比较模型能力、数据时效、隐私和成本后组合使用'],
  },
  {
    id: 'use-2', dimension: 'usage', prompt: '除了文字对话，你使用图片、文件、语音或表格等能力的情况是？',
    options: ['没有使用过', '偶尔上传图片或文件试一下', '会根据任务主动选择合适的输入形式', '能熟练组合多种输入输出完成复杂任务'],
  },
  {
    id: 'com-2', dimension: 'communication', prompt: 'AI第一次回答不够好时，你通常会怎么做？',
    options: ['放弃，或者换回原来的做法', '重新问一遍，看看结果会不会变化', '指出具体问题并补充信息，让它继续修改', '按验收标准逐项反馈，多轮迭代直到可以使用'],
  },
  {
    id: 'ver-2', dimension: 'verification', prompt: '你如何判断一份AI生成内容是否“真的可用”？',
    options: ['读起来通顺就可以', '大致符合我的想法就可以', '会检查事实、逻辑、格式和目标是否一致', '会使用清单、测试、对照样例或真实反馈进行验收'],
  },
  {
    id: 'cre-2', dimension: 'creation', prompt: '使用AI创作时，你通常参与到什么程度？',
    options: ['主要直接使用AI第一次生成的内容', '会挑选其中可用的部分并简单修改', '会提供自己的观点、素材和结构，与AI共同完成', '会主导创作方向，让AI承担研究、制作、审校等不同角色'],
  },
  {
    id: 'sys-2', dimension: 'systems', prompt: '一个任务需要多个步骤时，你通常怎样使用AI？',
    options: ['只在其中某一步问一下AI', '把整个任务一次性交给AI', '会把任务拆成几个步骤，逐步完成', '会设计输入输出关系，让多个步骤稳定衔接并可重复运行'],
  },
  {
    id: 'cog-3', dimension: 'cognition', prompt: '你对“模型、提示词、知识库、Agent、工作流”这些概念的掌握程度是？',
    options: ['大部分没有听说过', '听说过，但分不清它们的作用', '理解主要区别，也知道各自适合什么任务', '能根据实际问题解释并设计它们之间的组合关系'],
  },
  {
    id: 'use-3', dimension: 'usage', prompt: '遇到一个从没做过的新任务时，你会怎样借助AI开始？',
    options: ['通常想不到使用AI', '先问AI能不能做', '让AI帮我了解方法、拆解步骤并开始尝试', '让AI协助调研、规划、执行和复盘，快速建立新能力'],
  },
  {
    id: 'com-3', dimension: 'communication', prompt: '当需求比较复杂时，你会不会给AI提供参考示例？',
    options: ['不会，我只描述想要什么', '偶尔会说“像某种风格”', '会提供一两个具体示例说明标准', '会同时提供正例、反例和判断依据，减少理解偏差'],
  },
  {
    id: 'ver-3', dimension: 'verification', prompt: '涉及隐私、商业资料或敏感信息时，你通常如何处理？',
    options: ['没有特别考虑过', '尽量少输入明显的敏感信息', '会先脱敏，并控制提供资料的范围', '会按信息等级选择工具、权限、保留策略和人工复核流程'],
  },
  {
    id: 'cre-3', dimension: 'creation', prompt: '你能否让AI把一个模糊想法逐步变成可以展示的成果？',
    options: ['目前还做不到', '能生成一些灵感或草稿', '能做出结构完整的初版成果', '能从调研、原型到打磨，完成可验证或可发布的作品'],
  },
  {
    id: 'sys-3', dimension: 'systems', prompt: '你是否连接过两个以上工具，让信息自动流转？',
    options: ['没有，也不太了解', '了解自动化，但还没有实际配置过', '用过现成自动化或简单连接', '能使用API、自动化平台或代码搭建稳定的数据流'],
  },
  {
    id: 'cog-4', dimension: 'cognition', prompt: '你如何看待AI回答受上下文和资料质量影响这件事？',
    options: ['没有特别注意过', '知道多说一点可能会更好', '会主动补充关键上下文和可靠资料', '会控制上下文结构、版本和来源，避免信息冲突或污染'],
  },
  {
    id: 'use-4', dimension: 'usage', prompt: '你会怎样管理自己常用的AI工具？',
    options: ['没有固定工具', '主要使用一个熟悉的工具', '有一组对应不同任务的常用工具', '会定期评估效果、成本和隐私，更新自己的工具组合'],
  },
  {
    id: 'com-4', dimension: 'communication', prompt: '你会不会要求AI先提问，再开始执行任务？',
    options: ['没有这样做过', '偶尔会让它问我还缺什么', '复杂任务会让它先澄清目标和信息', '会设计固定的澄清流程，让AI先确认再计划、执行和验收'],
  },
  {
    id: 'ver-4', dimension: 'verification', prompt: 'AI给出多个方案时，你如何做最终决定？',
    options: ['通常选第一个或看起来最好的', '凭个人感觉挑一个', '会按目标、成本和风险进行比较', '会建立评价标准，结合数据、测试和人的判断做决策'],
  },
  {
    id: 'cre-4', dimension: 'creation', prompt: '你是否把AI成果交给过真实用户、同事或客户使用？',
    options: ['没有', '只给熟悉的人看过', '有过真实使用或正式交付', '会持续收集反馈、衡量效果并迭代成果'],
  },
  {
    id: 'sys-4', dimension: 'systems', prompt: '别人能否按照你的方法，重复获得相近质量的AI结果？',
    options: ['目前没有形成方法', '我自己大致能重复，但别人比较难', '有说明或模板，别人基本可以复现', '有标准输入、步骤、质量检查和异常处理，团队可以稳定使用'],
  },
];

const trackCapabilityQuestions: CapabilityQuestion[] = [
  {
    id: 'cog-daily', track: 'daily', dimension: 'cognition', prompt: '在学习、旅行、消费或健康等日常问题上，你如何判断该不该用AI？',
    options: ['一般不会想到AI', '想起来时就问一句', '会判断AI适合提供灵感、整理还是查询', '会根据风险决定让AI建议、查证资料或转向专业人士'],
  },
  {
    id: 'use-daily', track: 'daily', dimension: 'usage', prompt: '你是否把AI用于过一个持续一周以上的个人目标？',
    options: ['没有', '偶尔问过相关问题', '用它做过计划并持续记录', '会让AI根据进展调整计划、提醒重点并帮助复盘'],
  },
  {
    id: 'com-daily', track: 'daily', dimension: 'communication', prompt: '让AI给生活建议时，你会提供多少个人情况？',
    options: ['只说一个笼统问题', '补充少量偏好', '会说明目标、现状、时间和限制', '会先脱敏，再提供结构化信息并要求它说明建议依据'],
  },
  {
    id: 'ver-daily', track: 'daily', dimension: 'verification', prompt: 'AI给出健康、法律或理财相关建议时，你会怎么处理？',
    options: ['如果说得有道理就照做', '再问AI确认一次', '查阅权威资料，不直接用于高风险决定', '把AI仅作为信息整理工具，并向合格专业人士确认'],
  },
  {
    id: 'cre-daily', track: 'daily', dimension: 'creation', prompt: '你是否用AI完成过一件属于自己的作品或项目？',
    options: ['还没有', '生成过头像、文案或小练习', '完成过可分享的文章、视频、计划或作品', '持续经营个人项目，并根据他人反馈不断改进'],
  },
  {
    id: 'sys-daily', track: 'daily', dimension: 'systems', prompt: '你是否建立过由AI辅助的个人固定流程？',
    options: ['没有', '偶尔重复使用相同问题', '在学习、记录或规划中有固定模板', '已有自动收集、整理、提醒和复盘的个人AI系统'],
  },
  {
    id: 'cog-work', track: 'work', dimension: 'cognition', prompt: '面对一项工作任务，你如何判断哪些部分适合交给AI？',
    options: ['通常不考虑用AI', '觉得能做就整个交给AI', '会区分可生成、需判断和必须由人负责的环节', '会结合价值、风险、数据权限和协作成本设计人机分工'],
  },
  {
    id: 'use-work', track: 'work', dimension: 'usage', prompt: '你使用AI完成工作交付物的稳定程度如何？',
    options: ['还没有用于正式工作', '偶尔能做出可用初稿', '能稳定完成某几类工作任务', '已覆盖调研、分析、制作、沟通等多个环节并明显提效'],
  },
  {
    id: 'com-work', track: 'work', dimension: 'communication', prompt: '让AI处理业务任务时，你会提供哪些信息？',
    options: ['只给任务名称', '会说清大致目标', '会提供业务背景、受众、限制和交付格式', '还会提供评价标准、已有材料、反例和利益相关方要求'],
  },
  {
    id: 'ver-work', track: 'work', dimension: 'verification', prompt: 'AI生成的工作成果在交付前通常经过什么检查？',
    options: ['没有固定检查', '我会通读一遍', '会核对数据、来源、逻辑和品牌要求', '有明确验收清单、责任人和高风险内容的人工审批'],
  },
  {
    id: 'cre-work', track: 'work', dimension: 'creation', prompt: '你是否用AI创造过新的产品、服务或内容形式？',
    options: ['还没有', '产生过一些想法或概念稿', '做出过原型、栏目或可交付方案', '已经上线或投入业务，并用真实反馈验证价值'],
  },
  {
    id: 'sys-work', track: 'work', dimension: 'systems', prompt: '你的团队或合作伙伴如何使用你建立的AI方法？',
    options: ['目前只有我偶尔使用', '我会口头分享一些技巧', '团队能使用共享模板或流程', '已有权限、数据、流程、质量和复盘机制，能够规模化运行'],
  },
];

export const getCapabilityQuestions = (track: CapabilityTrack) => [
  ...coreCapabilityQuestions,
  ...trackCapabilityQuestions.filter((question) => question.track === track),
];

export const personalityQuestions: PersonalityQuestion[] = [
  { id: 'exp-1', axis: 'exploration', prompt: '面对刚出现的AI工具，你更自然的反应是？', left: '先上手试试，看它能做出什么', right: '先观察一段时间，确认价值再深入' },
  { id: 'exp-2', axis: 'exploration', prompt: '学习AI时，哪种状态更让你兴奋？', left: '不断发现新工具和新玩法', right: '把一个工具研究得越来越透' },
  { id: 'exp-3', axis: 'exploration', prompt: '你的工具列表通常是什么样？', left: '经常新增，喜欢横向比较', right: '数量不多，但每个都有固定用法' },
  { id: 'exp-4', axis: 'exploration', prompt: '看到别人分享一个新AI案例时，你通常会？', left: '马上复制思路做个小实验', right: '先理解方法，再决定是否纳入体系' },
  { id: 'exp-5', axis: 'exploration', prompt: '如果一个新工具很强但还不稳定，你更倾向于？', left: '容忍问题，抢先体验能力边界', right: '等待稳定，避免打乱已有节奏' },
  { id: 'exp-6', axis: 'exploration', prompt: '你更喜欢怎样安排AI学习？', left: '短周期、多主题、边玩边学', right: '长周期、单主题、系统深挖' },
  { id: 'exp-7', axis: 'exploration', prompt: '遇到陌生任务时，你更可能？', left: '同时试几种路线快速找感觉', right: '选定一条路线持续打磨' },
  { id: 'goal-1', axis: 'goal', prompt: '你最希望AI带来的价值是？', left: '帮我做出原来不存在的新东西', right: '把已有事情做得更快更稳' },
  { id: 'goal-2', axis: 'goal', prompt: '看到一个重复任务时，你首先想到？', left: '能不能换一种更有创意的做法', right: '能不能把步骤压缩或自动完成' },
  { id: 'goal-3', axis: 'goal', prompt: '哪种成果更容易让你获得成就感？', left: '作品、产品、表达或新体验', right: '节省时间、减少错误或提升产能' },
  { id: 'goal-4', axis: 'goal', prompt: '你更愿意把时间花在？', left: '构思概念、风格和可能性', right: '梳理流程、标准和效率瓶颈' },
  { id: 'goal-5', axis: 'goal', prompt: '使用AI时，你更常追问？', left: '还能创造出什么新的方向', right: '怎样用更少步骤得到稳定结果' },
  { id: 'goal-6', axis: 'goal', prompt: '面对成熟流程，你通常会？', left: '加入新元素，重新设计体验', right: '找到浪费和卡点，持续优化' },
  { id: 'goal-7', axis: 'goal', prompt: '如果只能选一个AI项目，你会选？', left: '做一个能被别人看到的新作品', right: '做一个每天替自己省时间的系统' },
  { id: 'think-1', axis: 'thinking', prompt: '接触一个AI功能时，你更想先知道？', left: '它为什么有效、底层怎样工作', right: '它能帮我解决哪个具体问题' },
  { id: 'think-2', axis: 'thinking', prompt: '遇到效果不稳定时，你更倾向于？', left: '分析模型、参数和上下文原因', right: '调整操作方法，先得到可用结果' },
  { id: 'think-3', axis: 'thinking', prompt: '哪类教程更吸引你？', left: '原理拆解、技术比较和机制分析', right: '案例演示、模板步骤和直接实操' },
  { id: 'think-4', axis: 'thinking', prompt: '你判断一个AI方案好不好，首先看？', left: '逻辑是否清晰、架构是否合理', right: '问题是否解决、使用是否顺手' },
  { id: 'think-5', axis: 'thinking', prompt: '学习新概念时，你更舒服的顺序是？', left: '先建立完整框架，再进入案例', right: '先做出一个案例，再补充框架' },
  { id: 'think-6', axis: 'thinking', prompt: '和别人讨论AI时，你更常谈？', left: '模型差异、技术趋势和实现方式', right: '使用场景、实际收益和落地方法' },
  { id: 'think-7', axis: 'thinking', prompt: '如果现成工具已能完成任务，你还会研究原理吗？', left: '会，理解原理让我更有掌控感', right: '不一定，稳定解决问题更重要' },
  { id: 'mode-1', axis: 'mode', prompt: '在理想的人机协作中，你更希望？', left: '人持续判断方向，AI随时提供帮助', right: '设定规则后，让系统尽量自主运行' },
  { id: 'mode-2', axis: 'mode', prompt: '处理重要任务时，你更放心哪种方式？', left: '每一步都由我查看和确认', right: '关键节点检查，其余交给系统执行' },
  { id: 'mode-3', axis: 'mode', prompt: '你更喜欢哪类AI产品？', left: '能随时对话、共同思考的助手', right: '接收目标后自动完成多步工作的系统' },
  { id: 'mode-4', axis: 'mode', prompt: '当AI越来越能自主完成任务时，你更关注？', left: '怎样保持人的判断、风格和控制', right: '怎样设计权限、流程和异常处理' },
  { id: 'mode-5', axis: 'mode', prompt: '面对重复工作，你更倾向于？', left: '保留人工操作，让AI在旁边辅助', right: '把规则写清楚，尽可能自动运行' },
  { id: 'mode-6', axis: 'mode', prompt: '你理想中的个人AI更像？', left: '懂我的搭档和第二大脑', right: '替我调度工具和任务的操作系统' },
  { id: 'mode-7', axis: 'mode', prompt: '如果系统偶尔会犯错，你会怎样调整？', left: '增加人工确认，确保每次结果可控', right: '补上监控和纠错，让系统继续自动运行' },
];

export const personalityAxes: Record<PersonalityAxis, { left: string; right: string; leftCode: string; rightCode: string }> = {
  exploration: { left: '探索型', right: '深耕型', leftCode: 'E', rightCode: 'D' },
  goal: { left: '创造型', right: '优化型', leftCode: 'C', rightCode: 'O' },
  thinking: { left: '技术型', right: '应用型', leftCode: 'T', rightCode: 'A' },
  mode: { left: '人主导', right: '系统主导', leftCode: 'H', rightCode: 'S' },
};

export const personalityProfiles: Record<string, { name: string; tagline: string }> = {
  ECTH: { name: 'AI灵感探险家', tagline: '追逐前沿技术，也珍视亲手掌控创作方向。' },
  ECTS: { name: 'AI未来构建者', tagline: '喜欢把新技术快速搭成能够自主运行的新产品。' },
  ECAH: { name: 'AI创意玩伴', tagline: '善于在对话和实验中，让灵感变成有温度的作品。' },
  ECAS: { name: 'AI创作导演', tagline: '敢于尝新，并能调度AI持续生产新内容和体验。' },
  EOTH: { name: 'AI工具猎人', tagline: '热衷寻找新工具，再亲自把它们用进真实任务。' },
  EOTS: { name: 'AI自动化先锋', tagline: '总能发现更快的新路径，并把它变成自动系统。' },
  EOAH: { name: 'AI效率加速器', tagline: '快速试用新方法，帮助自己和身边人立即提效。' },
  EOAS: { name: 'AI智能运营官', tagline: '善于用新工具搭出灵活、高效的智能运营方式。' },
  DCTH: { name: 'AI深度创研者', tagline: '深入理解技术，用长期打磨创造独特成果。' },
  DCTS: { name: 'AI产品架构师', tagline: '把深度思考沉淀为能够持续演进的AI产品。' },
  DCAH: { name: 'AI匠心共创者', tagline: '重视方法与品质，在人机协作中精雕细琢。' },
  DCAS: { name: 'AI内容系统师', tagline: '把稳定方法变成持续产出高质量作品的系统。' },
  DOTH: { name: 'AI方法优化师', tagline: '深入研究一套有效方法，让每一步都更可靠。' },
  DOTS: { name: 'AI流程工程师', tagline: '擅长把复杂问题拆成稳定、自动的工作流程。' },
  DOAH: { name: 'AI效率管家', tagline: '务实、稳定，善于让AI成为可靠的日常助手。' },
  DOAS: { name: 'AI稳健运营师', tagline: '持续优化系统，让AI在规则内稳定创造价值。' },
};
