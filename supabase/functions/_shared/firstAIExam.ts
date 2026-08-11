export type ExamDimension = "M" | "F" | "T" | "V" | "C" | "S";
export type ExamSection = "basic" | "scenario" | "fill" | "technical" | "open";
export type ExamItemKind = "choice" | "fill" | "numeric" | "open" | "code";

export type ExamOption = {
  id: "A" | "B" | "C" | "D";
  text: string;
  score: 0 | 1 | 2 | 3;
};

export type ExamItem = {
  id: string;
  competencyId: string;
  dimension: ExamDimension;
  targetLevel: 1 | 2 | 3 | 4 | 5;
  section: ExamSection;
  kind: ExamItemKind;
  prompt: string;
  code?: string;
  options?: ExamOption[];
  acceptedAnswers?: string[];
  numericAnswer?: number;
  numericTolerance?: number;
  placeholder?: string;
  unscored?: boolean;
  rationale: string;
};

export type ExamResponse = { item_id: string; value: string | number };

const ids: ExamOption["id"][] = ["A", "B", "C", "D"];

function choice(
  id: string,
  competencyId: string,
  dimension: ExamDimension,
  targetLevel: 1 | 2 | 3 | 4 | 5,
  section: "basic" | "scenario" | "technical",
  prompt: string,
  texts: [string, string, string, string],
  scores: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3],
  rationale: string,
  code?: string,
): ExamItem {
  return {
    id, competencyId, dimension, targetLevel, section,
    kind: section === "technical" ? "code" : "choice",
    prompt, code, rationale,
    options: texts.map((text, index) => ({ id: ids[index], text, score: scores[index] })),
  };
}

function fill(
  id: string,
  competencyId: string,
  dimension: ExamDimension,
  targetLevel: 1 | 2 | 3 | 4 | 5,
  prompt: string,
  acceptedAnswers: string[],
  rationale: string,
): ExamItem {
  return {
    id, competencyId, dimension, targetLevel, section: "fill", kind: "fill",
    prompt, acceptedAnswers, placeholder: "请输入答案", rationale,
  };
}

function numeric(
  id: string,
  competencyId: string,
  dimension: ExamDimension,
  targetLevel: 1 | 2 | 3 | 4 | 5,
  prompt: string,
  numericAnswer: number,
  rationale: string,
  numericTolerance = 0,
): ExamItem {
  return {
    id, competencyId, dimension, targetLevel, section: "fill", kind: "numeric",
    prompt, numericAnswer, numericTolerance, placeholder: "请输入数字", rationale,
  };
}

function open(
  id: string,
  competencyId: string,
  dimension: ExamDimension,
  targetLevel: 1 | 2 | 3 | 4 | 5,
  prompt: string,
  rationale: string,
): ExamItem {
  return {
    id, competencyId, dimension, targetLevel, section: "open", kind: "open",
    prompt, placeholder: "请用 50–200 字作答", unscored: true, rationale,
  };
}

export const FIRST_AI_EXAM_INSTRUMENT = {
  id: "first-ai-capability-exam-2026-v1",
  frameworkVersion: "pacf-1.0.0",
  itemBankVersion: "first-ai-exam-bank-1.0.0",
  scoringVersion: "first-ai-exam-scoring-1.0.0",
  title: "第一届 AI 能力摸底考试（2026 试行卷）",
  evidenceGrade: "screening" as const,
  itemCount: 32,
  scoredItemCount: 30,
};

export const EXAM_DIMENSIONS: Record<ExamDimension, { label: string; description: string }> = {
  M: { label: "AI心智模型", description: "模型、产品、上下文、边界和人机责任。" },
  F: { label: "任务定义与沟通", description: "目标、拆解、上下文、迭代和验收标准。" },
  T: { label: "工具与信息素养", description: "文件、检索、数据、API、密钥和工具选择。" },
  V: { label: "核验、安全与责任", description: "事实核验、隐私、权限、风险和人工监督。" },
  C: { label: "创造与执行", description: "把 AI 输出变成可用成果、原型和复用资产。" },
  S: { label: "工作流与系统思维", description: "流程、异常、Agent、评测和可靠运行。" },
};

export const EXAM_SECTIONS: Record<ExamSection, { order: number; title: string; subtitle: string }> = {
  basic: { order: 1, title: "第一大题 · 基础选择", subtitle: "每题只有一个最佳答案" },
  scenario: { order: 2, title: "第二大题 · 情境判断", subtitle: "请选择真实工作中更合理的处理方式" },
  fill: { order: 3, title: "第三大题 · 填空与计算", subtitle: "填写术语或完成简单的 AI 场景计算" },
  technical: { order: 4, title: "第四大题 · 代码与流程阅读", subtitle: "不要求会编程，重点判断流程风险" },
  open: { order: 5, title: "第五大题 · 主观题", subtitle: "参与 AI 评语，本届试行卷暂不计入基础分" },
};

export const EXAM_LEVELS = [
  ["AI观察者", "正在建立对 AI 的基本认识和安全边界。"],
  ["AI辅助使用者", "可以在指导下完成低风险的简单任务。"],
  ["AI独立操作者", "能够独立完成常见真实任务并检查结果。"],
  ["AI协作者", "能够拆解复杂任务，与 AI 多轮协作并保留判断。"],
  ["AI系统构建者", "具备工作流、Agent、评测和可靠性意识。"],
  ["AI变革推动者", "具备推动团队 AI 化的系统视角；仍需应用实验室认证。"],
] as const;

export const FIRST_AI_EXAM_BANK: ExamItem[] = [
  // M — AI 心智模型
  choice("AIX-M01-B1", "M01", "M", 1, "basic", "下面哪项最准确地区分“大语言模型”和“聊天产品”？",
    ["模型负责生成，产品还组合界面、账户和工具", "模型保存账户，产品只负责展示生成的文字", "模型就是产品，二者只是不同公司的命名习惯", "模型负责联网，产品负责保存全部训练数据"],
    [3, 0, 0, 0], "产品是模型及外围能力的组合。"),
  choice("AIX-M02-B1", "M02", "M", 2, "basic", "为什么同一提示词前后可能得到不同答案？",
    ["产品会随机删除部分用户输入以节省服务器成本", "模型按概率生成，输入上下文和采样也会影响输出", "模型每次回答后都会立即重新训练自己的参数", "只要网络速度发生变化，模型知识也会同步变化"],
    [0, 3, 0, 0], "概率生成与上下文会造成输出波动。"),
  choice("AIX-M03-B1", "M03", "M", 2, "basic", "关于上下文与长期记忆，哪项说法更准确？",
    ["上传过的文件都会自动进入模型永久训练数据", "长期记忆只在当前消息生成期间临时起作用", "上下文服务当前任务，长期记忆需要另行保存和取用", "上下文和长期记忆都等同于模型原始训练知识"],
    [0, 0, 3, 0], "上下文、记忆和训练知识必须区分。"),
  choice("AIX-M04-S1", "M04", "M", 3, "scenario", "每月只处理20份固定格式表格，有人建议立刻搭多 Agent。你会先做什么？",
    ["比较模板、脚本、单次模型和 Agent 的成本与错误率", "先搭多 Agent 原型，再根据展示效果决定是否保留", "先购买能力最强的模型，再讨论具体流程如何调整", "先让多个模型互相投票，再把多数答案作为最终结果"],
    [3, 2, 0, 1], "高水平选型从最小可靠方案和实测开始。"),
  choice("AIX-M05-S1", "M05", "M", 2, "scenario", "AI 给出的建议造成业务损失，下面哪种责任理解更合适？",
    ["供应商应承担责任，因为模型生成了原始建议", "发布者仍负有责任，因为采用和执行决定由人作出", "用户无需负责，因为页面已经标注内容由 AI 生成", "责任取决于价格，付费模型应自动承担更多责任"],
    [1, 3, 0, 0], "AI 不会接管采用者的最终责任。"),
  fill("AIX-M03-F1", "M03", "M", 1, "当前任务中模型可直接使用的提示、历史消息和文件内容，通常统称为______。", ["上下文", "context", "当前上下文"], "检查最基础的上下文概念。"),
  fill("AIX-M01-F1", "M01", "M", 2, "由模型根据目标动态选择步骤并调用工具的系统，通常称为______。", ["agent", "智能体", "ai agent", "ai智能体"], "区分 Agent 与普通聊天或固定流程。"),
  choice("AIX-M05-T1", "M05", "M", 3, "technical", "阅读下面的工具权限配置，最需要优先调整什么？",
    ["把日志保留时间从30天调整为更短的7天", "把读取邮件权限改成只读取指定业务文件夹", "把模型名称从通用名称改为具体版本编号", "把执行结果的文字长度限制为一千字以内"],
    [1, 3, 2, 0], "最小权限优先于界面与输出细节。",
    `tools:\n  email.read: all_mailboxes\n  payment.create: false\nlogging:\n  retention_days: 30`),
  open("AIX-M01-O1", "M01", "M", 3, "请向完全不懂技术的人解释：模型、Workflow 和 Agent 有什么不同，并各举一个例子。", "观察概念能否被迁移和解释。"),

  // F — 任务定义与沟通
  choice("AIX-F01-B1", "F01", "F", 1, "basic", "哪个请求最清楚地定义了预期结果？",
    ["请认真帮我处理这份材料，尽量写得专业一些", "请扮演资深顾问，对材料进行全面深入的分析", "请根据附件，为新用户写一页可独立完成注册的说明", "请先自由发挥完成初稿，之后我再告诉你是否合适"],
    [0, 1, 3, 0], "结果定义需要受众、产物和成功条件。"),
  choice("AIX-F02-B1", "F02", "F", 2, "basic", "复杂任务拆解时，哪项原则最有帮助？",
    ["按照每一步文字数量相同的方式平均拆分任务", "按照可验证中间产物和前后依赖关系拆分任务", "按照可用模型数量拆分，让每个模型负责一个部分", "按照操作人员数量拆分，避免同一个人重复检查"],
    [0, 3, 1, 2], "拆解应围绕依赖与可验证产物。"),
  choice("AIX-F05-B1", "F05", "F", 2, "basic", "下面哪项最接近可执行的验收标准？",
    ["整体读起来足够高级，能给负责人留下深刻印象", "结构完整、语言顺畅，并尽量覆盖更多相关信息", "一页内覆盖问题、证据和下一步，数字均可追溯", "使用统一模板和品牌颜色，避免出现明显排版问题"],
    [0, 1, 3, 2], "验收标准应可明确判定且包含关键质量条件。"),
  choice("AIX-F03-S1", "F03", "F", 2, "scenario", "AI 写出的品牌文案很通用，下一轮最值得补充什么？",
    ["真实受众、品牌主张、素材、禁用表达和正反例", "更多角色称号、情绪词语、感叹号和流行表达", "更高随机性、更长输出长度和更多候选文案数量", "更多同行文章、热门标题和未经筛选的历史聊天"],
    [3, 0, 1, 2], "真实材料和边界比角色咒语更有效。"),
  choice("AIX-F04-S1", "F04", "F", 3, "scenario", "长对话已经多次偏离目标，最稳妥的处理方式是什么？",
    ["继续在原对话补充要求，保留模型已经生成的全部内容", "让模型自己回顾错误，再直接生成最终版本并立即提交", "整理目标、状态和未决问题，在新会话中用摘要重新开始", "把历史对话完整复制给另一个模型，让它判断谁更可靠"],
    [1, 2, 3, 0], "状态摘要和重启比无限追加更可靠。"),
  fill("AIX-F05-F1", "F05", "F", 1, "在生成前约定准确性、格式、受众和通过条件，这组要求叫作______。", ["验收标准", "验收条件", "acceptance criteria", "通过标准"], "检查验收概念。"),
  fill("AIX-F02-F1", "F02", "F", 1, "把复杂任务分成可执行、可检查的中间步骤，叫作任务______。", ["拆解", "分解", "task decomposition"], "检查任务拆解概念。"),
  choice("AIX-F03-T1", "F03", "F", 2, "technical", "下面的任务配置最明显缺少哪项信息？",
    ["目标读者以及他们完成阅读后应能做什么", "模型回答时允许使用的最大字符数量限制", "调用接口时使用同步还是异步请求方式", "最终文档存放在云端还是本地硬盘目录"],
    [3, 1, 0, 2], "受众与结果是任务契约核心。",
    `{\n  "task": "write onboarding guide",\n  "source": "product-notes.md",\n  "format": "one page"\n}`),
  open("AIX-F01-O1", "F01", "F", 3, "同事只写了“请帮我做好市场调研”。请把它改写成可执行任务，至少包含目标、材料、范围和验收标准。", "观察任务契约表达能力。"),

  // T — 工具与信息素养
  choice("AIX-T01-B1", "T01", "T", 1, "basic", "环境变量最常见的用途是什么？",
    ["把服务端密钥与公开代码分开保存并在运行时读取", "把网页样式与业务逻辑分开保存并在构建时合并", "把用户上传文件自动转成模型能够训练的数据格式", "把每次模型回答永久同步到所有访问设备的缓存"],
    [3, 1, 0, 0], "环境变量常用于运行配置与敏感值隔离。"),
  choice("AIX-T03-B1", "T03", "T", 1, "basic", "AI 回答里带有引用链接，下一步最合理的做法是什么？",
    ["先检查链接能否打开，再核对原文是否支持对应主张", "先让另一个模型评价链接，再决定是否打开原始页面", "先把引用格式改成统一样式，再检查作者姓名是否完整", "先统计引用数量是否足够，再决定这份回答能否采用"],
    [3, 1, 2, 0], "引用存在不等于引用已被核验。"),
  choice("AIX-T04-B1", "T04", "T", 2, "basic", "处理访谈、图片和表格时，怎样组织工作区更可靠？",
    ["按文件大小排序上传，让模型自行识别每份材料的作用", "建立清单、命名和版本规则，再按材料类型分批处理", "把所有材料压缩为一个文件，减少上传和下载操作次数", "先把图片转成截图，把表格转成文字后统一放进对话"],
    [1, 3, 0, 2], "结构化工作区降低遗漏和版本混乱。"),
  choice("AIX-T02-S1", "T02", "T", 2, "scenario", "需要处理含隐私的内部会议记录，选工具时先确认什么？",
    ["组织许可、数据处理方式、访问权限和删除机制", "模型排行榜、生成速度、上下文长度和界面体验", "同事使用人数、社区热度、模板数量和插件丰富度", "免费额度、折扣活动、分享功能和移动端适配情况"],
    [3, 2, 1, 0], "敏感任务应先通过合规与权限门槛。"),
  choice("AIX-T05-S1", "T05", "T", 3, "scenario", "教程要求使用 API Key，最安全的处理方式是什么？",
    ["写入前端配置文件，并通过缩短变量名称降低泄露风险", "存入服务端密钥管理，限制权限并设置轮换与撤销方式", "发送到团队群聊，确保需要接手的人都能随时复制使用", "写入公开示例代码，只保留密钥前后几位作为识别标记"],
    [1, 3, 0, 2], "密钥需要服务端保存、最小权限和生命周期管理。"),
  numeric("AIX-T05-F1", "T05", "T", 2, "某模型输入价格为每100万Token 20元。一次任务平均使用25,000 Token，运行60次，输入成本约为多少元？", 30, "1.5M Token × 20元/M = 30元。", 0.01),
  numeric("AIX-T02-F1", "T02", "T", 2, "某工具月费99元，每月预计节省6小时。若人工时间按每小时30元计算，每月净节省约多少元？", 81, "节省180元减去99元月费，净节省81元。", 0.01),
  choice("AIX-T05-T1", "T05", "T", 2, "technical", "下面哪一行最可能造成密钥泄露？",
    ["第1行：从运行环境读取密钥，不把值写入源代码", "第2行：在服务端请求中使用读取到的密钥", "第3行：把完整密钥写入浏览器控制台日志", "第4行：仅向调用者返回接口是否成功的状态"],
    [0, 1, 3, 0], "浏览器日志会把服务端秘密暴露给前端使用者。",
    `1  const key = Deno.env.get("MODEL_API_KEY");\n2  const result = await callModel(key, prompt);\n3  console.log("key:", key);\n4  return { ok: result.ok };`),
  open("AIX-T01-O1", "T01", "T", 2, "请用小白能理解的语言解释文件路径、文件格式和 API Key，并各举一个常见错误。", "观察数字基础能否被准确解释。"),

  // V — 核验、安全与责任
  choice("AIX-V01-B1", "V01", "V", 1, "basic", "核验 AI 给出的统计数字时，最重要的动作是什么？",
    ["比较多个模型是否给出相同数值和相似的解释过程", "回到原始来源核对口径、时期、样本和计算方法", "检查数字是否保留小数以及图表是否符合视觉规范", "要求模型提高置信度并使用更肯定的表达重新回答"],
    [1, 3, 2, 0], "核验必须回到可检查的原始证据。"),
  choice("AIX-V03-B1", "V03", "V", 1, "basic", "上传内部材料给 AI 前，最先应该判断什么？",
    ["材料是否足够完整，避免模型因为缺少背景产生误解", "材料是否涉及隐私、保密、版权以及组织使用许可", "材料是否适合转换成PDF，以保持不同设备排版一致", "材料是否已经有人使用过，避免重复支付模型调用费用"],
    [1, 3, 0, 2], "先判断数据和授权边界。"),
  choice("AIX-V04-B1", "V04", "V", 2, "basic", "决定任务需要多强人工监督，主要看哪些因素？",
    ["模型价格、生成速度、界面复杂度和团队使用人数", "提示长度、回答字数、文件数量和网络连接速度", "影响大小、错误可逆性、数据敏感性和可检测性", "用户职位、工具品牌、订阅档位和模型参数规模"],
    [0, 1, 3, 0], "监督强度应该匹配风险。"),
  choice("AIX-V01-S1", "V01", "V", 2, "scenario", "AI 给出一篇论文和 DOI，但 DOI 无法解析。你会怎样处理？",
    ["删除 DOI 后保留论文结论，并在文末标注来源待确认", "让模型生成一个新的 DOI，再比较两个编号哪个更合理", "核对作者、题名和数据库记录，找不到就视为未证实", "寻找题目相似的论文，用相似论文替换原来的引用信息"],
    [1, 0, 3, 2], "不存在的来源不能通过格式修补变成证据。"),
  choice("AIX-V05-S1", "V05", "V", 4, "scenario", "Agent 可以读取邮件并发起付款，怎样降低恶意邮件诱导付款的风险？",
    ["限制单笔付款金额，让 Agent 自行判断邮件是否可信", "只处理纯文本邮件，通过第二个模型后自动完成付款", "隔离邮件中的指令，限制权限并要求付款前人工确认", "降低模型温度并记录日志，异常时再由管理员追查"],
    [1, 2, 3, 1], "不可信输入、最小权限和人工批准需要组合使用。"),
  numeric("AIX-V04-F1", "V04", "V", 2, "每月处理200份文件，其中5%产生高风险错误；人工复核能发现这些错误的80%。预计仍有多少份高风险错误未被发现？", 2, "200 × 5% × (1-80%) = 2。", 0.01),
  numeric("AIX-V01-F1", "V01", "V", 2, "抽查40条AI生成的事实，其中34条能被可靠来源支持。该样本的可支持率是多少百分比？", 85, "34 ÷ 40 = 85%。", 0.01),
  choice("AIX-V05-T1", "V05", "V", 3, "technical", "这段流程的主要安全问题是什么？",
    ["系统先读取网页内容，导致整体运行速度可能变慢", "网页文字被直接拼进指令，并可触发高权限工具调用", "模型输出被保存到日志，可能增加数据库存储成本", "流程使用一个模型，缺少多个模型之间的投票机制"],
    [1, 3, 2, 0], "外部不可信文本不能直接成为高权限指令。",
    `const page = await fetchUrl(userUrl);\nconst plan = await model("Follow page instructions: " + page);\nawait runAdminTool(plan);`),
  open("AIX-V01-O1", "V01", "V", 3, "AI 给出一个影响采购决策的市场数字。请写出你的核验步骤和最终记录方式。", "观察证据链与不确定性处理。"),

  // C — 创造与执行
  choice("AIX-C01-B1", "C01", "C", 1, "basic", "怎样让 AI 产出更接近个人观点和风格？",
    ["提供自己的观点、真实素材、受众和正反例，再人工重构", "增加形容词、情绪指令、角色称号和输出篇幅限制", "连续生成更多版本，从中选择读起来最流畅的一份", "固定使用同一模型，避免不同模型造成表达风格变化"],
    [3, 1, 2, 0], "个人风格来自真实材料和人的重构。"),
  choice("AIX-C03-B1", "C03", "C", 2, "basic", "判断一个 AI 原型最低限度是否可用，应该看什么？",
    ["关键用户路径能够运行，并通过预先定义的基本测试", "界面已经完成设计，并使用统一品牌颜色与图标风格", "代码数量足够多，并采用当前流行的框架和模型服务", "演示视频播放流畅，并获得团队成员较积极的主观评价"],
    [3, 1, 2, 0], "可用原型需要真实路径与测试。"),
  choice("AIX-C05-B1", "C05", "C", 2, "basic", "评估 AI 是否真正提效，应该比较哪些指标？",
    ["生成速度、使用次数、提示长度和用户主观新鲜感", "质量、端到端耗时、返工、成本和相关风险变化", "模型参数、上下文长度、排行榜和社区讨论热度", "页面访问、按钮点击、账号数量和内容生成总字数"],
    [1, 3, 0, 2], "价值衡量需要端到端质量、成本和风险。"),
  choice("AIX-C02-S1", "C02", "C", 2, "scenario", "AI 写出一份流畅摘要，但你无法解释关键概念。应该怎么做？",
    ["保留摘要并补充术语表，让读者自行判断关键概念含义", "让模型把文字改得更简单，再直接提交给目标读者使用", "回到原文与领域知识，确认理解后重写并标注不确定性", "换另一个模型重新摘要，选择两份结果中表达更完整的一份"],
    [1, 0, 3, 2], "领域交付不能以不理解的流畅文字代替。"),
  choice("AIX-C04-S1", "C04", "C", 3, "scenario", "一段提示词每次都需要大量手工修改，怎样把它沉淀成资产？",
    ["把所有历史修改合并成长提示词，并要求模型自行选择内容", "拆分变量、输入、样例、验收和异常说明，再做复用测试", "固定第一次成功结果，以后只替换少量名词和数字字段", "交给多个模型分别改写，选择平均字数最接近的一套版本"],
    [1, 3, 2, 0], "复用资产需要结构化变量与测试。"),
  numeric("AIX-C05-F1", "C05", "C", 2, "原流程每次耗时50分钟，使用AI后生成15分钟、人工检查20分钟、返工5分钟。每次净节省多少分钟？", 10, "50-(15+20+5)=10分钟。", 0.01),
  numeric("AIX-C05-F2", "C05", "C", 2, "AI流程处理100项任务，第一次通过验收82项，返工后又通过12项。最终通过率是多少百分比？", 94, "(82+12)÷100=94%。", 0.01),
  choice("AIX-C03-T1", "C03", "C", 2, "technical", "这段代码为什么不能证明原型已经可用？",
    ["它只生成界面截图，没有验证关键用户路径能否完成", "它使用异步函数，因此无法保证图片一定能正确显示", "它没有指定字体和颜色，因此不能达到品牌交付标准", "它只调用一次模型，因此无法比较多个模型之间差异"],
    [3, 1, 2, 0], "产出截图不等于真实功能路径可运行。",
    `async function buildPrototype(prompt) {\n  const screenshot = await model.generateImage(prompt);\n  return screenshot;\n}`),
  open("AIX-C05-O1", "C05", "C", 3, "选择一个你常做的任务，写出使用AI前后的质量、耗时、返工和风险比较方法。", "观察价值是否能被测量而非凭感觉判断。"),

  // S — 工作流与系统思维
  choice("AIX-S01-B1", "S01", "S", 1, "basic", "哪类流程通常更适合优先尝试 AI 改造？",
    ["高频耗时、输入输出较清楚，并且错误影响可以控制", "受到关注、展示效果明显，但业务价值暂时无法测量", "规则很少、后果严重，并且发生错误后难以人工恢复", "只出现一次、范围不明，需要很多部门同时改变的任务"],
    [3, 1, 0, 2], "优先选择有价值且可控制的流程。"),
  choice("AIX-S02-B1", "S02", "S", 2, "basic", "可靠 Workflow 除了正常步骤，还必须定义什么？",
    ["异常、重试、状态、人工交接和重复执行处理", "角色语气、界面颜色、输出字数和模型人格名称", "团队口号、项目代号、演示脚本和宣传发布计划", "更多模型、更长提示、更大上下文和更高随机参数"],
    [3, 0, 1, 2], "可靠流程必须处理失败与交接。"),
  choice("AIX-S04-B1", "S04", "S", 3, "basic", "一次 Demo 成功为什么不能证明系统可靠？",
    ["演示环境通常网速更快，因此无法代表普通用户设备表现", "系统可能在不同输入、版本和异常条件下出现新的失败", "演示人员更熟悉操作，因此普通用户需要接受更多培训", "一次运行缺少宣传素材，因此无法证明产品具有市场价值"],
    [1, 3, 2, 0], "可靠性需要代表性测试和持续观测。"),
  choice("AIX-S03-S1", "S03", "S", 3, "scenario", "任务规则稳定、分支已知且错误代价高，应优先选择什么？",
    ["固定 Workflow，在必要节点加入模型判断和人工审批", "自主 Agent，让模型根据每次输入自由重新规划步骤", "多 Agent 协商，通过多数投票决定每一步如何执行", "单次聊天，把全部材料提交后要求模型一次完成任务"],
    [3, 2, 1, 0], "稳定高风险任务更适合受控工作流。"),
  choice("AIX-S05-S1", "S05", "S", 4, "scenario", "团队有20个AI用例提案但只能支持5个，应怎样选择？",
    ["按提交时间排序，优先支持最早提出并已准备演示的项目", "按价值、风险、准备度和学习价值排序，并设停止条件", "按技术复杂度排序，优先建设最能展示模型能力的项目", "按部门规模排序，优先满足使用人数最多部门的全部需求"],
    [1, 3, 0, 2], "组织采用需要组合管理和停止机制。"),
  fill("AIX-S02-F1", "S02", "S", 2, "支付回调可能重复到达。让相同请求重复执行仍只产生一次权益，这种设计叫作______。", ["幂等", "幂等性", "idempotency", "idempotent"], "检查工作流幂等概念。"),
  fill("AIX-S02-F2", "S02", "S", 2, "系统失败时回到安全、可人工处理状态的设计，通常称为______或降级。", ["回退", "fallback", "故障回退", "安全回退"], "检查失败恢复概念。"),
  choice("AIX-S02-T1", "S02", "S", 3, "technical", "这段订单处理流程最明显缺少什么？",
    ["支付成功页面的动画、颜色和完成提示文案", "订单唯一性与幂等检查，避免重复发放会员权益", "更多支付渠道之间的价格比较和自动推荐逻辑", "第二个模型对用户身份和支付意愿的独立判断"],
    [1, 3, 0, 2], "外部回调必须按唯一订单幂等处理。",
    `async function onPaid(order) {\n  await grantMembership(order.userId);\n  await sendWelcomeMessage(order.userId);\n}`),
  open("AIX-S02-O1", "S02", "S", 4, "请为“每周收集三个渠道的客户反馈并生成产品待办”设计流程，说明输入、步骤、人工检查、异常处理和效果指标。", "综合观察流程和可靠性设计。"),
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s，。；、,.!?！？：:（）()\-_]/g, "");
}

function round(value: number) {
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

export function publicExamForm(items: ExamItem[], sessionId: string) {
  return {
    session_id: sessionId,
    instrument: {
      id: FIRST_AI_EXAM_INSTRUMENT.id,
      framework_version: FIRST_AI_EXAM_INSTRUMENT.frameworkVersion,
      title: FIRST_AI_EXAM_INSTRUMENT.title,
      evidence_grade: FIRST_AI_EXAM_INSTRUMENT.evidenceGrade,
      item_count: items.length,
      scored_item_count: items.filter((item) => !item.unscored).length,
      estimated_minutes: 40,
      dimensions: EXAM_DIMENSIONS,
      sections: EXAM_SECTIONS,
    },
    items: items.map((item) => ({
      id: item.id,
      competency_id: item.competencyId,
      dimension: item.dimension,
      target_level: item.targetLevel,
      section: item.section,
      kind: item.kind,
      prompt: item.prompt,
      code: item.code,
      options: item.options?.map(({ id, text }) => ({ id, text })),
      placeholder: item.placeholder,
      unscored: Boolean(item.unscored),
    })),
  };
}

export function scoreFirstAIExam(value: unknown, items: ExamItem[]) {
  if (!Array.isArray(value) || value.length !== items.length) {
    throw new Error(`本届能力考试必须包含 ${items.length} 个答案`);
  }
  const responseMap = new Map<string, string | number>();
  for (const response of value as ExamResponse[]) {
    if (!response || typeof response.item_id !== "string" || !("value" in response)) {
      throw new Error("能力考试答案格式无效");
    }
    if (responseMap.has(response.item_id)) throw new Error("能力考试存在重复题目");
    responseMap.set(response.item_id, response.value);
  }

  const itemScores = items.map((item) => {
    const response = responseMap.get(item.id);
    if (response === undefined || response === null || String(response).trim() === "") {
      throw new Error(`能力考试缺少答案：${item.id}`);
    }
    if (item.unscored) {
      const text = String(response).trim();
      if (text.length < 10 || text.length > 1200) throw new Error(`主观题请填写 10–1200 字：${item.id}`);
      return { itemId: item.id, competencyId: item.competencyId, dimension: item.dimension, response: text, rawScore: null, normalizedScore: null, scored: false };
    }
    let rawScore: 0 | 1 | 2 | 3 = 0;
    if (item.options) {
      const option = item.options.find((candidate) => candidate.id === String(response));
      if (!option) throw new Error(`选择题答案无效：${item.id}`);
      rawScore = option.score;
    } else if (item.kind === "fill") {
      const normalized = normalizeText(response);
      rawScore = item.acceptedAnswers?.some((answer) => normalizeText(answer) === normalized) ? 3 : 0;
    } else if (item.kind === "numeric") {
      const numericResponse = Number(response);
      if (!Number.isFinite(numericResponse)) throw new Error(`计算题答案必须是数字：${item.id}`);
      rawScore = Math.abs(numericResponse - Number(item.numericAnswer)) <= Number(item.numericTolerance || 0) ? 3 : 0;
    }
    return {
      itemId: item.id,
      competencyId: item.competencyId,
      dimension: item.dimension,
      response,
      rawScore,
      normalizedScore: round((rawScore / 3) * 100),
      scored: true,
    };
  });

  const scoredItems = itemScores.filter((item) => item.scored);
  const dimensionScores = Object.fromEntries(
    (Object.keys(EXAM_DIMENSIONS) as ExamDimension[]).map((dimension) => {
      const values = scoredItems.filter((item) => item.dimension === dimension).map((item) => Number(item.normalizedScore));
      return [dimension, round(values.reduce((sum, score) => sum + score, 0) / values.length)];
    }),
  ) as Record<ExamDimension, number>;
  const competencyScores = Object.fromEntries(
    [...new Set(scoredItems.map((item) => item.competencyId))].map((competencyId) => {
      const values = scoredItems.filter((item) => item.competencyId === competencyId).map((item) => Number(item.normalizedScore));
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
  const strongest = (Object.keys(dimensionScores) as ExamDimension[]).sort((a, b) => dimensionScores[b] - dimensionScores[a])[0];
  const growthArea = (Object.keys(dimensionScores) as ExamDimension[]).sort((a, b) => dimensionScores[a] - dimensionScores[b])[0];
  const routeLevel: "starter" | "application" | "practice" = level <= 1 ? "starter" : level <= 3 ? "application" : "practice";

  return {
    totalScore, estimatedLevel, level,
    levelTitle: EXAM_LEVELS[level][0],
    levelSummary: EXAM_LEVELS[level][1],
    routeLevel, dimensionScores, competencyScores, strongest, growthArea, itemScores,
    openResponses: itemScores.filter((item) => !item.scored).map((item) => ({ itemId: item.itemId, response: item.response })),
    gates: {
      all_dimensions_l1: allDimensionsAtLeastL1,
      verification_l2_for_l3: verificationGate,
      screening_only: true,
      subjective_items_scored: false,
      l4_l5_require_diagnostic: level >= 4,
    },
  };
}

export function validateFirstAIExamBank() {
  const idsSeen = new Set<string>();
  for (const item of FIRST_AI_EXAM_BANK) {
    if (idsSeen.has(item.id)) throw new Error(`Duplicate first AI exam item: ${item.id}`);
    idsSeen.add(item.id);
    if (item.options) {
      if (item.options.length !== 4) throw new Error(`${item.id} must have four options`);
      if (item.options.filter((option) => option.score === 3).length !== 1) throw new Error(`${item.id} must have one best answer`);
    }
  }
  for (const dimension of Object.keys(EXAM_DIMENSIONS) as ExamDimension[]) {
    const items = FIRST_AI_EXAM_BANK.filter((item) => item.dimension === dimension);
    if (items.filter((item) => item.section === "basic").length !== 3) throw new Error(`${dimension} requires three basic items`);
    if (items.filter((item) => item.section === "scenario").length !== 2) throw new Error(`${dimension} requires two scenario items`);
    if (items.filter((item) => item.section === "fill").length !== 2) throw new Error(`${dimension} requires two fill/numeric items`);
    if (items.filter((item) => item.section === "technical").length !== 1) throw new Error(`${dimension} requires one technical item`);
    if (items.filter((item) => item.section === "open").length !== 1) throw new Error(`${dimension} requires one open item`);
  }
  return true;
}

validateFirstAIExamBank();
