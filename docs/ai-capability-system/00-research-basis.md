# AI 能力体系研究底稿 v1.0

> 状态：研究基线（2026-08-09）  
> 用途：记录框架决策的证据、真实用户痛点与版本边界；它不是面向学员的课程正文。

## 1. 研究问题

本轮研究不是寻找“最流行的 AI 工具清单”，而是回答四个更稳定的问题：

1. 一个真正的小白，要跨过哪些可观察的能力门槛，才能独立完成真实任务？
2. 从聊天工具到工作流、Agent 和组织应用，哪些概念必须按依赖顺序学习？
3. 哪些错误会让“看起来会用 AI”的人仍然无法稳定交付？
4. 如何把能力、课程、测评证据和社群分流连接成同一套系统？

## 2. 证据分级

| 等级 | 来源类型 | 本体系中的用途 | 使用限制 |
|---|---|---|---|
| A | 法规、政府、国际组织正式框架 | 定义责任、风险、总体能力边界 | 不直接照搬面向青少年的措辞 |
| B | 同行评审论文、正式量表、系统综述 | 设计测量方法、纠正常见假设 | 注意样本、任务和文化适用范围 |
| C | 头部 AI 机构的工程指南 | 定义当前产品架构与实践能力 | 产品术语会变，不作为永久等级名称 |
| D | B 站、微信、知乎、论坛、Reddit 等用户材料 | 捕捉痛点语言、误解和学习阻力 | 只作定性信号，不用于估计人群比例 |

## 3. 核心证据及设计含义

### A. 国际能力与治理框架

| ID | 来源 | 关键信息 | 对本体系的影响 |
|---|---|---|---|
| S01 | [UNESCO AI Competency Framework for Students](https://www.unesco.org/en/articles/ai-competency-framework-students?hub=195885) | 人本、伦理、技术与应用、系统设计四类能力，并强调理解—应用—创造的进阶 | 能力不能只测工具使用；创造和系统设计应处于后段 |
| S02 | [EC–OECD AI Literacy Framework](https://education.ec.europa.eu/whats-new/news/new-ai-literacy-framework-helps-schools-prepare-learners-for-the-age-of-artificial-intelligence) | 以知识、技能、态度组织 19 项能力 | 行为标准要同时覆盖“知道、做到、负责任地做” |
| S03 | [DigComp 3.0](https://joint-research-centre.ec.europa.eu/projects-and-activities/education-and-training/digital-transformation-education/digital-competence-framework-digcomp/digcomp-30_en) | AI 融入全部 21 项数字能力，框架保持技术中立 | 小白层必须补文件、权限、搜索和数字安全；不能默认人人具备电脑基础 |
| S04 | [OECD PISA 2029 MAIL](https://www.oecd.org/en/about/projects/pisa-2029-media-and-artificial-intelligence-literacy.html) | 用模拟互联网、社交媒体和 AI 工具的情境任务采集证据 | 正式测评不能全是知识选择题，应加入真实情境与操作任务 |
| S05 | [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) | Govern、Map、Measure、Manage 构成持续风险管理循环 | L4–L5 必须考治理、测量、监控和处置，不只考“搭出来” |
| S06 | [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | 将生成式 AI 特有风险纳入识别、测量和治理 | 提示注入、内容溯源、隐私和人工监督进入安全能力单元 |
| S07 | [欧盟委员会 AI literacy Q&A](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers) | AI 素养应结合人员背景、使用场景和系统风险；单看说明书通常不足 | 课程与测评要按角色、场景、风险分层，不提供“一套课适合所有人”的承诺 |

### B. 测量与学习研究

| ID | 来源 | 关键信息 | 对本体系的影响 |
|---|---|---|---|
| S08 | [GLAT：Generative AI Literacy Assessment Test](https://arxiv.org/abs/2411.00283) | 客观表现测量比单纯自评更能预测生成式 AI 任务表现 | 自信度只作画像，不计入等级分数 |
| S09 | [AICOS](https://arxiv.org/abs/2503.12921) | 模块化、客观化评估 AI 能力 | 题库按能力 ID 和证据类型标注，允许短测与全测共用题库 |
| S10 | [AI literacy scales systematic review](https://www.nature.com/articles/s41539-024-00264-4.pdf) | 既有量表的维度、信效度和使用目的差异显著 | 对“单一总分”保持克制，同时报告维度与证据置信度 |
| S11 | [Self-report 与客观测量错位研究](https://doi.org/10.1145/3785022.3785088) | 自我感觉与客观能力并不等价 | 报告中分开呈现“能力”“使用风格”“自信” |
| S12 | [生成式 AI 对知识工作批判性思维的影响](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/) | 对 319 名知识工作者的研究发现：对 AI 越自信，批判性思维投入越少；思考重心转向核验、整合和任务监管 | 把核验、整合和任务监管设为核心能力与晋级门槛 |
| S13 | [AI misconceptions review](https://www.sciencedirect.com/science/article/pii/S2666920X2300022X) | 学习者普遍存在技术理解有限、拟人化等前概念与误解 | 先纠正心智模型，再教高级提示或 Agent |
| S14 | [Critical Thinking in AI Use Scale](https://arxiv.org/abs/2512.12413) | 更强的 AI 使用批判性思维与更多核验策略、更准确的真实性判断相关 | 核验不只问“会不会”，要观察策略选择和判断结果 |
| S15 | [学生视角下的 AI 幻觉研究](https://arxiv.org/abs/2602.17671) | 学生常把模型误解为“查不到就编造的数据库/搜索引擎” | 把“生成模型不是事实数据库”列为 L0→L1 必过概念 |

### C. 当前工程实践

| ID | 来源 | 关键信息 | 对本体系的影响 |
|---|---|---|---|
| S16 | [Anthropic AI Fluency](https://www.anthropic.com/ai-fluency/overview) | Delegation、Description、Discernment、Diligence 四类流利度 | 任务委派、描述、判断与尽责分布到六维框架中，而非另建重叠维度 |
| S17 | [OpenAI：A practical guide to building AI agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) | Agent 由模型、工具和指令构成，并代表用户管理工作流执行 | 明确区分模型、聊天产品、工具调用、工作流与 Agent |
| S18 | [Anthropic：Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Workflow 是预定义代码路径；Agent 由模型动态决定过程和工具使用；应从最简单方案开始 | “会堆多个 Agent”不是高级，能判断何时不该用 Agent 才是高级 |
| S19 | [Anthropic：Trustworthy agents](https://www.anthropic.com/research/trustworthy-agents) | Agent 在计划—行动—观察—调整循环中提高自主性，也放大监督与提示注入风险 | L4 加入权限最小化、停止条件、沙箱、人工接管与攻击面意识 |
| S20 | [Microsoft：何时使用 Copilot 或 Agent](https://support.microsoft.com/en-us/Microsoft-365-Copilot/decide-when-copilot-or-an-agent-is-the-right-tool-for-your-work) | 并非每个任务都应自动化，责任仍由人承担 | 课程中加入“不自动化清单”和责任边界判断 |

### D. 中国法律与本地语境

| ID | 来源 | 关键信息 | 对本体系的影响 |
|---|---|---|---|
| S21 | [《中华人民共和国个人信息保护法》](https://flk.npc.gov.cn/detail?fileId=&id=ff8081817b6472a3017b656cc2040044&title=%E4%B8%AD%E5%8D%8E%E4%BA%BA%E6%B0%91%E5%85%B1%E5%92%8C%E5%9B%BD%E4%B8%AA%E4%BA%BA%E4%BF%A1%E6%81%AF%E4%BF%9D%E6%8A%A4%E6%B3%95&type=) | 规范个人信息处理活动和个人信息权益保护 | 学员必须会识别个人信息、敏感信息和必要性边界 |
| S22 | [《生成式人工智能服务管理暂行办法》](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) | 定义生成式 AI 服务提供者/使用者，覆盖内容、投诉、安全与数据责任 | 中国场景的安全课要区分个人使用、组织部署和对公众提供服务 |

## 4. 社区痛点样本

以下材料用于捕捉用户语言，不代表人群统计比例。

| P-ID | 观察到的用户表达/行为 | 深层问题 | 框架处理方式 |
|---|---|---|---|
| P01 | “Agent 和智能体不是一个东西吗？”“工作流和多智能体是什么关系？” | 缺少系统构件的层级模型 | M01、S02、S03；第一阶段用同一任务做五种实现对比 |
| P02 | 能跟着教程用某个 AI 应用，离开教程就不会做 | 学会了界面路径，没有学会任务迁移 | F01–F05、C02；用陌生任务考迁移 |
| P03 | 把 ChatGPT/豆包/Claude 与“大模型”混为一谈 | 混淆模型、产品、功能、工具和服务 | M01；要求能画出产品架构图 |
| P04 | 用“三句提示词防止 AI 降智/幻觉” | 把可靠性问题简化为提示词魔法 | M02、V01、V04；对照核验与拒答机制 |
| P05 | “明确要求不能乱编，还是会胡说” | 不理解概率生成、知识边界和证据缺失 | M02、M03、V01 |
| P06 | 长对话越聊越乱，却只继续补充提示 | 缺少上下文、状态与交接意识 | M03、F04、S02；训练摘要、重开、状态文件和验收点 |
| P07 | 用共享账号处理论文、客户资料或内部文件 | 隐私、账户和数据分类意识不足 | T05、V03；上传前完成数据分级决策 |
| P08 | 把 AI 当成搜索引擎，直接引用答案中的链接/论文 | 混淆生成、检索和证据 | T03、V01；要求打开原始来源并做主张—证据对应 |
| P09 | 收藏大量工具和提示词，但没有稳定产出 | 工具导向而非任务/结果导向 | F01、T02、C02；以交付物和质量增益计分 |
| P10 | 认为 Agent 就是“自动化脚本 + LLM”或高级聊天机器人 | 未理解自主决策、工具、循环、状态与权限 | S02–S04；要求选择最小可行架构 |
| P11 | 非技术用户被 API Key、Token、环境变量、文件路径挡住 | 基础数字操作与技术语言门槛 | T01；设置“数字生存补给站”，不把它伪装成 AI 原理课 |
| P12 | 觉得不会代码就不能创造 AI 产品 | 把编程专长误当通用 AI 能力 | C03 允许代码/无代码双路径；产出与判断共用标准 |
| P13 | 输出很长、格式漂亮，就认为质量高 | 流畅性偏差，缺少验收标准 | F05、V02；先写标准再看答案 |
| P14 | 对 AI 越熟越少复核 | 自动化偏差和过度信任 | V01、V04；按风险提高核验强度，不按熟练度降低 |
| P15 | 一上来就想多 Agent、全自动 | 忽略流程稳定性、成本和失控半径 | S01–S04；先手工跑通、再固定工作流、最后才评估 Agent |

代表性社区材料：

- [一次说清楚 LLM、智能体、工作流、Agent 的区别](http://www.bilibili.com/video/av114398836296354)
- [用 ChatGPT 辅助科研，要学会保护自己的数据不泄露](http://www.bilibili.com/video/av872750838)
- [如何防止 AI 降智？只需三句提示词约束](http://www.bilibili.com/video/av116301909463145)
- [AI 提示词是什么？怎么写 AI 提示词？](http://www.bilibili.com/video/av116728419845900)
- [很多人叫 Agent 的其实只是工作流](https://developer.cloud.tencent.com/article/2694074)
- [AI Agent 到底是个啥？](https://www.cocoloop.cn/t/topic/2932)

## 5. 研究判断

### 5.1 小白的第一道门不是“高级提示词”

真正的前置能力包括：登录与账户边界、文件与格式、复制/上传/下载、搜索与打开原始来源、权限与隐私、知道什么时候新建对话。缺少这些能力时，教程会把操作步骤误判成 AI 能力问题。

### 5.2 提示词是任务表达的载体，不是独立段位

高质量交互来自目标、上下文、约束、样例、验收标准和迭代；其中只有一部分表现为“提示词写法”。框架不奖励咒语式模板记忆，奖励在新任务中的问题定义和纠偏能力。

### 5.3 熟练不等于可靠

使用频率、自信和输出速度都不能替代核验。所有 L3 以上等级设置 Verification 门槛；L4 以上还需要安全、监控和实际任务证据。

### 5.4 Agent 是架构选择，不是能力终点

高级能力不是“用了多少 Agent”，而是能否比较人工、单次模型、固定工作流与 Agent 的成本、风险和适用性，并选择最简单的可靠方案。

### 5.5 能力必须以迁移和作品证明

选择题适合测概念边界，情境题适合测决策，开放题适合测任务表达，实作题适合测交付与核验。一个等级只能由多种证据共同支持。

## 6. 当前边界与待验证假设

1. L0–L5 的切分点是产品假设，必须用首批真实答题数据校准。
2. 六个维度同权是 v1.0 起点；后续可按用途建立岗位画像，但不应随意改变通用总等级。
3. 30 个能力单元是课程与题库的共同索引，不等于正式测评要同时展示 30 个分数。
4. 社区痛点样本存在平台与内容创作者偏差，只用来补语言和情境。
5. 中国个人用户、组织内部使用和对公众提供 AI 服务的责任不同，课程只能做风险教育，不能替代具体法律意见。

## 7. 版本变更规则

- 每季度复核产品术语、Agent 能力、安全威胁和适用法规。
- 每半年检查题目曝光、区分度、群体差异与课程推荐效果。
- 能力 ID 尽量稳定；产品名、示例和工具操作作为可更新附属层。
- 任何等级规则变更必须同时更新框架、学习地图、课程矩阵和评分引擎版本号。
