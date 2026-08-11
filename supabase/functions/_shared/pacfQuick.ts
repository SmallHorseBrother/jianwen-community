export type PACFDimension = "M" | "F" | "T" | "V" | "C" | "S";
export type PACFOptionId = "A" | "B" | "C" | "D";

export type PACFQuickItem = {
  id: string;
  competencyId: string;
  dimension: PACFDimension;
  type: "objective" | "scenario";
  stem: string;
  options: Array<{ id: PACFOptionId; text: string; score: 0 | 1 | 2 | 3 }>;
};

export type PACFQuickResponse = { item_id: string; option_id: string };

const optionIds: PACFOptionId[] = ["A", "B", "C", "D"];

function rotateOptions<T>(competencyId: string, values: T[]): T[] {
  const rotation = (Number(competencyId.slice(1)) - 1) % values.length;
  return [...values.slice(rotation), ...values.slice(0, rotation)];
}

function objective(
  competencyId: string,
  dimension: PACFDimension,
  stem: string,
  choices: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
): PACFQuickItem {
  const scored = choices.map((text, index) => ({
    text,
    score: (index === correctIndex ? 3 : 0) as 0 | 3,
  }));
  return {
    id: `PACF-${competencyId}-O1`, competencyId, dimension, type: "objective", stem,
    options: rotateOptions(competencyId, scored).map((choice, index) => ({ id: optionIds[index], ...choice })),
  };
}

function scenario(
  competencyId: string,
  dimension: PACFDimension,
  stem: string,
  choicesFromWeakToStrong: [string, string, string, string],
): PACFQuickItem {
  const scored = choicesFromWeakToStrong.map((text, index) => ({
    text,
    score: index as 0 | 1 | 2 | 3,
  }));
  return {
    id: `PACF-${competencyId}-S1`, competencyId, dimension, type: "scenario", stem,
    options: rotateOptions(competencyId, scored).map((choice, index) => ({ id: optionIds[index], ...choice })),
  };
}

export const PACF_QUICK_INSTRUMENT = {
  id: "pacf-quick-v1.1-random",
  frameworkVersion: "pacf-1.0.0",
  itemBankVersion: "pacf-item-bank-1.1.0",
  scoringVersion: "pacf-scoring-1.1.0",
  title: "个人 AI 能力随机筛查 v1.1",
  evidenceGrade: "screening" as const,
};

export const PACF_DIMENSIONS: Record<PACFDimension, { label: string; description: string }> = {
  M: { label: "AI心智模型", description: "理解模型、产品、上下文、边界和人机责任。" },
  F: { label: "任务定义与沟通", description: "把模糊需求变成可执行、可验收的任务。" },
  T: { label: "工具与信息素养", description: "选择和组织工具、数据、检索与信息来源。" },
  V: { label: "核验、安全与责任", description: "核验事实和质量，控制隐私、权限与风险。" },
  C: { label: "创造与执行", description: "把 AI 输出变成真实、可用、可复用的成果。" },
  S: { label: "工作流与系统思维", description: "把单次成功升级为可靠流程和系统。" },
};

export const PACF_LEVELS = [
  ["AI观察者", "正在建立对 AI 的基本认识和安全边界。"],
  ["AI辅助使用者", "可以在指导下完成低风险的简单任务。"],
  ["AI独立操作者", "能够独立完成常见真实任务并检查结果。"],
  ["AI协作者", "能够拆解复杂任务，与 AI 多轮协作并保留判断。"],
  ["AI系统构建者", "具备工作流、Agent、评测和可靠性意识。"],
  ["AI变革推动者", "具备推动团队 AI 化的系统视角；仍需应用实验室认证。"],
] as const;

export const PACF_QUICK_ITEMS: PACFQuickItem[] = [
  objective("M01", "M", "下面哪一项最准确地描述了“大语言模型”和“聊天产品”的关系？",
    ["二者完全相同，只是叫法不同", "聊天产品通常把模型、界面、账户、工具和安全策略组合在一起", "大语言模型是聊天产品中的长期记忆数据库", "聊天产品一定只使用一个固定模型"], 1),
  scenario("M02", "M", "AI 对同一道业务题前后给出两个不同数字，你最合适的处理方式是？",
    ["选语气更肯定的一个", "多问几遍，用出现次数最多的答案", "把温度调低后直接采用", "检查数据来源、计算过程和口径，必要时用确定性工具复算"]),
  objective("M03", "M", "下面哪项最准确地区分“当前上下文”和“长期记忆”？",
    ["上下文是当前任务可用的信息，长期记忆是跨会话保存并可再次取用的信息", "上下文永久保存，长期记忆只在一次回答中有效", "二者都等于模型训练数据", "只要上传文件，模型就永久记住全文"], 0),
  scenario("M04", "M", "每月只处理 20 份格式固定的表格，人工核对很快。有人建议搭多 Agent 系统。最佳决策是？",
    ["因为 Agent 更先进，立即搭建", "先购买最贵模型保证效果", "先比较模板、脚本或单次模型方案的成本和错误率", "根据实测选择最小可靠方案，并保留不自动化的可能"]),
  objective("M05", "M", "AI 生成的内容造成业务错误时，下面哪项最准确？",
    ["模型承担全部责任", "只要披露用了 AI，人就没有责任", "最终采用和发布的人或组织仍需承担相应责任", "使用付费模型即可转移责任"], 2),
  scenario("M01", "M", "团队说要“做一个 Agent 自动整理客户反馈”。你首先应该做什么？",
    ["直接选择一个多 Agent 平台", "先写一个人格提示词让它扮演客服", "先确认任务是否只需固定步骤的 Workflow", "画出模型、数据、工具、状态、权限和人工接管，再选择最小架构"]),
  objective("M02", "M", "为什么模型给出的论文标题和链接看起来很真实，仍然需要核验？",
    ["模型可能按语言模式生成并不存在的细节", "链接只在手机上才会失效", "只有免费模型才会编造", "只要要求“不要编造”就不需要核验"], 0),

  scenario("F01", "F", "老板说“用 AI 提升一下运营效率”。第一步应做什么？",
    ["立刻列 50 个 AI 工具", "购买企业版聊天产品", "让 AI 生成完整方案", "澄清目标指标、受影响流程、用户和当前基线"]),
  objective("F02", "F", "复杂任务拆解时，最有用的原则是什么？",
    ["每一步字数相同", "按可验证的中间产物和依赖关系拆分", "尽量让 AI 一次完成所有步骤", "每一步都换一个模型"], 1),
  scenario("F03", "F", "AI 写出的品牌文案很通用。最有效的改进是？",
    ["要求它更高级、更有网感", "把语气调得更热情", "提供真实受众和品牌信息", "提供受众、品牌主张、真实素材、禁用表达及正反例"]),
  objective("F04", "F", "AI 首次回答偏离需求时，最好的反馈通常是什么？",
    ["重发同一句话", "说“这不对，重写”", "指出具体偏差、补充缺失信息并重申验收标准", "换一种角色称呼"], 2),
  scenario("F05", "F", "你要让 AI 写一份给投资人的一页项目说明，哪个验收标准最有效？",
    ["看起来专业", "语言有感染力", "内容尽量详细完整", "控制在一页并覆盖问题、方案、证据、商业模式和下一步，关键数字有来源"]),
  objective("F01", "F", "下面哪个请求最接近“定义了结果”，而不只是描述动作？",
    ["帮我写一下", "把这份材料处理好", "为第一次了解产品的用户写一页说明，使其能独立完成注册，包含步骤和常见错误", "你是世界级文案大师，请认真思考"], 2),
  scenario("F02", "F", "要做一份带数据和引用的市场报告，哪种分工最稳妥？",
    ["让 AI 一次生成整份报告并直接提交", "先生成结论，再寻找支持结论的资料", "分成问题定义、资料检索、数据核对、分析、写作和独立审校", "让多个模型同时写，选最长的一份"]),

  objective("T01", "T", "环境变量最常见的用途是什么？",
    ["把密钥安全地从公开代码中分离", "让网页字体更大", "永久保存模型回答", "替代数据库备份"], 0),
  scenario("T02", "T", "你要处理含隐私的内部会议记录，哪种选型方法最好？",
    ["使用网友最推荐的免费工具", "先上传试试效果", "只比较摘要质量", "先确认组织许可、数据处理方式和权限，再比较质量与成本"]),
  objective("T03", "T", "“AI 回答里带了引用”最合理的下一步是什么？",
    ["引用一定真实，可以直接使用", "只检查链接能不能打开", "打开原始来源，核对作者、日期、原文和主张是否一致", "让 AI 把引用格式改成 APA"], 2),
  scenario("T04", "T", "任务包含 30 份访谈、图片和表格。最稳妥的工作区组织方式是？",
    ["全部一次性上传，不做说明", "按文件大小排序", "随机分批，让 AI 自己记住", "建立清单、命名与版本规则、材料类型和处理状态，再分批处理"]),
  objective("T05", "T", "API Key 最安全的处理方式是哪项？",
    ["写进前端代码方便调用", "发到群里让同事共用", "放在服务端密钥或环境变量中并按最小权限管理", "写进公开文档但用星号遮住一半"], 2),
  scenario("T01", "T", "教程要求上传 CSV，但你手里是 Excel 文件。最合适的做法是？",
    ["把扩展名直接改成 .csv", "截图后上传", "先确认工作表和编码，再导出 CSV 并检查内容", "把整个电脑文件夹上传"]),
  objective("T02", "T", "需要核对今天刚发布的政策原文，最重要的工具能力是什么？",
    ["角色扮演", "联网检索并能打开原始来源", "生成更长文本", "图片美化"], 1),

  scenario("V01", "V", "AI 给出一篇很像真的论文，但 DOI 无法解析。最佳处理是？",
    ["把 DOI 删掉继续引用", "让 AI 换一个 DOI", "搜索标题，找到相似论文就算同一篇", "在出版社或数据库核对作者、题名和 DOI；找不到就视为未证实并删除"]),
  objective("V02", "V", "一份 AI 报告事实都正确，仍可能不合格的原因是什么？",
    ["事实正确就一定合格", "可能存在逻辑跳跃、遗漏、偏差或不适用于目标受众", "只可能是排版问题", "只有字数太短才会不合格"], 1),
  scenario("V03", "V", "你想让 AI 帮忙润色未发表论文，其中含受试者信息。最佳做法是？",
    ["使用共享账号上传全文", "删掉姓名后直接上传全部数据", "只问 AI 是否会保密", "按机构政策和同意范围判断，最小化或脱敏材料，必要时使用获批环境或不上传"]),
  objective("V04", "V", "决定 AI 任务需要多强人工监督，最重要的组合是什么？",
    ["模型价格和回答速度", "影响大小、错误可逆性、数据敏感性和可检测性", "使用人数和界面颜色", "提示词长度和模型参数"], 1),
  scenario("V05", "V", "一个 Agent 可读邮件并发起付款。怎样降低被恶意邮件诱导付款的风险？",
    ["在提示词中写“请小心”", "让 Agent 自己判断邮件是否可信", "只使用更大模型", "隔离不可信内容、限制工具权限、付款前强制人工确认并记录操作"]),
  objective("V01", "V", "核验 AI 给出的统计数字时，哪项最关键？",
    ["数字是否有很多小数", "回到原始来源核对口径、时间范围、样本和计算方法", "让另一个模型重复数字", "只要图表看起来合理即可"], 1),
  scenario("V02", "V", "AI 根据十条用户反馈断言“所有用户都需要这个功能”。你应怎样评审？",
    ["直接按 AI 结论排期", "只把“所有”改成“多数”", "要求 AI 写得更有说服力", "检查样本来源、数量、代表性和反例，再决定结论强度"]),

  objective("C01", "C", "让 AI 产出有个人风格内容，最有效的输入通常是什么？",
    ["只说“写得像真人”", "提供自己的观点、真实素材、受众和正反例，并人工重构", "选择最长的提示词", "直接使用第一次生成"], 1),
  scenario("C02", "C", "AI 做出的研究摘要写得很好，但你无法解释其中关键概念。应该怎么做？",
    ["直接提交，因为摘要通顺", "背下摘要应付提问", "继续让 AI 写得更简单", "回到原文和领域知识，确认理解后重写并标注不确定性"]),
  objective("C03", "C", "判断一个 AI 原型“可用”，最低需要什么？",
    ["有一张界面截图", "生成了一段代码", "关键用户路径可以运行并通过基本测试", "使用了最新模型"], 2),
  scenario("C04", "C", "你有一段每次都要手工修改很多的提示词，应该怎样改造成资产？",
    ["继续加更多固定文本", "把它设为只读", "只保存最好的一次结果", "拆分变量、输入要求、样例、验收和异常说明，并做复用测试"]),
  objective("C05", "C", "评估 AI 提效时，哪项做法最合理？",
    ["只问用户感觉是否更快", "只统计生成时间", "比较 AI 前后质量、总耗时、返工、成本和风险", "以使用次数作为价值"], 2),
  scenario("C01", "C", "AI 写了一篇结构完整但没有独特观点的文章，你应怎样处理？",
    ["直接发布，结构已经完整", "让 AI 添加更多形容词", "让另一个模型改写", "补充自己的主张和经历，重构论证，再做事实与版权检查"]),
  objective("C02", "C", "判断 AI 是否真正帮助完成领域任务，最可靠的证据是什么？",
    ["生成字数增加", "工具使用次数增加", "成果通过真实领域标准和用户验收", "提示词更复杂"], 2),

  scenario("S01", "S", "团队每月花很多时间人工汇总反馈，但反馈格式混乱。第一步是？",
    ["直接买 Agent 平台", "要求 AI 自动处理所有历史数据", "先画当前流程并统计主要问题", "画出现状、统计量和失败类型，再定义标准输入与价值基线"]),
  objective("S02", "S", "可靠 Workflow 除了正常步骤，还必须明确什么？",
    ["界面颜色", "异常、重试、状态、人工交接和重复执行处理", "模型人格名称", "输出字数越多越好"], 1),
  scenario("S03", "S", "任务规则稳定、分支已知、错误代价高。应优先选择？",
    ["多 Agent 自由协商", "完全自主 Agent", "让模型每次重新规划", "固定 Workflow，并只在必要节点使用模型判断和人工审批"]),
  objective("S04", "S", "一次 Demo 成功为什么不能证明 AI 系统可靠？",
    ["Demo 时间太短", "系统可能在不同输入、模型版本和异常条件下失败，需要代表性评测与运行监控", "必须录制更多视频", "只要换更贵模型就可靠"], 1),
  scenario("S05", "S", "组织有 20 个 AI 用例提案，但资源只能支持 5 个。最佳做法是？",
    ["全部小规模启动", "优先领导最喜欢的", "优先技术最复杂的", "按价值、风险、准备度、可扩展性和学习价值排序，并设置停止条件"]),
  objective("S01", "S", "最适合优先探索 AI 改造的流程通常具有什么特征？",
    ["最炫、最受关注", "高频、耗时、输入输出相对清楚且错误可控制", "完全没有规则且后果严重", "只发生一次的临时任务"], 1),
  scenario("S02", "S", "支付回调可能重复到达，工作流怎样避免重复发放权益？",
    ["相信支付平台不会重复", "每次都重新生成权益", "用更聪明模型判断", "使用唯一订单与幂等处理，锁定状态并让重复回调返回同一结果"]),
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function levelFromScore(score: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (score < 25) return 0;
  if (score < 40) return 1;
  if (score < 55) return 2;
  if (score < 70) return 3;
  if (score < 85) return 4;
  return 5;
}

export function publicPACFQuickForm(items: PACFQuickItem[] = PACF_QUICK_ITEMS) {
  return {
    instrument: {
      id: PACF_QUICK_INSTRUMENT.id,
      framework_version: PACF_QUICK_INSTRUMENT.frameworkVersion,
      title: PACF_QUICK_INSTRUMENT.title,
      evidence_grade: PACF_QUICK_INSTRUMENT.evidenceGrade,
      item_count: items.length,
      dimensions: PACF_DIMENSIONS,
    },
    items: items.map((item) => ({
      id: item.id,
      competency_id: item.competencyId,
      dimension: item.dimension,
      type: item.type,
      stem: item.stem,
      options: item.options.map(({ id, text }) => ({ id, text })),
    })),
  };
}

export function scorePACFQuick(value: unknown, items: PACFQuickItem[] = PACF_QUICK_ITEMS) {
  if (!Array.isArray(value) || value.length !== items.length) {
    throw new Error(`PACF 快测必须包含 ${items.length} 个答案`);
  }

  const responses = value as PACFQuickResponse[];
  const responseMap = new Map<string, string>();
  for (const response of responses) {
    if (!response || typeof response.item_id !== "string" || typeof response.option_id !== "string") {
      throw new Error("PACF 快测答案格式无效");
    }
    if (responseMap.has(response.item_id)) throw new Error("PACF 快测存在重复题目");
    responseMap.set(response.item_id, response.option_id);
  }

  const itemScores = items.map((item) => {
    const optionId = responseMap.get(item.id);
    const option = item.options.find((candidate) => candidate.id === optionId);
    if (!option) throw new Error(`PACF 快测缺少或包含无效答案：${item.id}`);
    return {
      itemId: item.id,
      competencyId: item.competencyId,
      dimension: item.dimension,
      optionId: option.id,
      rawScore: option.score,
      normalizedScore: round((option.score / 3) * 100),
    };
  });

  const dimensionScores = Object.fromEntries(
    (Object.keys(PACF_DIMENSIONS) as PACFDimension[]).map((dimension) => {
      const values = itemScores.filter((item) => item.dimension === dimension).map((item) => item.normalizedScore);
      return [dimension, round(values.reduce((sum, score) => sum + score, 0) / values.length)];
    }),
  ) as Record<PACFDimension, number>;
  const competencyScores = Object.fromEntries(
    [...new Set(itemScores.map((item) => item.competencyId))].map((competencyId) => {
      const values = itemScores
        .filter((item) => item.competencyId === competencyId)
        .map((item) => item.normalizedScore);
      return [competencyId, round(values.reduce((sum, score) => sum + score, 0) / values.length)];
    }),
  );
  const totalScore = round(Object.values(dimensionScores).reduce((sum, score) => sum + score, 0) / 6);
  const estimatedLevel = levelFromScore(totalScore);
  let level = estimatedLevel;

  const allDimensionsAtLeastL1 = Object.values(dimensionScores).every((score) => score >= 25);
  if (level >= 2 && !allDimensionsAtLeastL1) level = 1;
  const verificationGate = dimensionScores.V >= 40;
  if (level >= 3 && !verificationGate) level = 2;

  const strongest = (Object.keys(dimensionScores) as PACFDimension[])
    .sort((a, b) => dimensionScores[b] - dimensionScores[a])[0];
  const growthArea = (Object.keys(dimensionScores) as PACFDimension[])
    .sort((a, b) => dimensionScores[a] - dimensionScores[b])[0];
  const routeLevel: "starter" | "application" | "practice" = level <= 1
    ? "starter"
    : level <= 3
    ? "application"
    : "practice";

  return {
    totalScore,
    estimatedLevel,
    level,
    levelTitle: PACF_LEVELS[level][0],
    levelSummary: PACF_LEVELS[level][1],
    routeLevel,
    dimensionScores,
    competencyScores,
    strongest,
    growthArea,
    itemScores,
    gates: {
      all_dimensions_l1: allDimensionsAtLeastL1,
      verification_l2_for_l3: verificationGate,
      screening_only: true,
      l4_l5_require_diagnostic: level >= 4,
    },
  };
}
