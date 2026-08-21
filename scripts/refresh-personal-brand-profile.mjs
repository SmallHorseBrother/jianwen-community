import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: profile, error: profileReadError } = await supabase
  .from('personal_profiles')
  .select('id, slug')
  .eq('slug', 'my-about')
  .single();

if (profileReadError) throw profileReadError;

const profilePatch = {
  display_name: '马健文',
  headline: '北大 AI for Science 直博生 / 科学健身实践者 / AI 健康创业者',
  intro:
    '我从江苏溧阳的乡镇教育环境出发，高中曾获得北大自主招生 20 分优惠，却没有在高考进入北大。进入南京航空航天大学后，我重新设计自己的成长路径，做到自动化专业 1/202、工科试验班 1/58，随后进入北京大学直博。现在，我一边研究 AI 与生命科学的交叉问题，一边把学习、训练和创业中的经验做成可复用的产品与系统。',
  long_bio:
    '我来自江苏溧阳。高中阶段获得过北大自主招生 20 分优惠，但高考没有进入北大；这次失利反而让我开始认真思考，如何把成长从一次性的发挥变成可以持续迭代的系统。本科就读南京航空航天大学工科试验班，主修自动化，必修 GPA 4.6，自动化专业排名 1/202、工科试验班排名 1/58，之后进入北京大学前沿交叉学科研究院直博。\n\n目前我的研究聚焦于 AI for Science，以及人工智能与生命科学的交叉。公开成果包括 Findings of ACL 2025 论文《MARK: Multi-agent Collaboration with Ranking Guidance for Text-attributed Graph Clustering》，以及 2025 年发表于《中国科学：数学》的综述《扩散模型及其在生物信息学中的应用》。\n\n科研之外，我长期进行力量训练和街头健身实践。训练经历包括北京大学秋季运动会引体向上第一名并打破校纪录，以及世界力量举（WP）北大站 69 kg 级冠军。我更关心的不只是成绩本身，而是如何把动作标准、训练负荷、恢复与长期进步变成可以测量和复盘的系统。\n\n我创办智健启能（北京）科技有限公司，持续推进食探、教链 CoachLink、Pull-up Index 等 AI + 健康产品，也在搭建个人知识库、数字分身和 AI 原生内容生产系统。贯穿这些事情的主线始终相同：把依赖天赋、经验和意志力的复杂问题，转化为可理解、可测量、可训练、可复用和可规模化的系统；先拿自己做实验，再把方法做成工具帮助别人。',
  expertise: [
    'AI for Science',
    'AI × 生命科学',
    '多组学与生物信息学',
    '科学健身与训练量化',
    'AI 健康产品',
    '产品系统化',
    '个人知识管理',
  ],
  ai_welcome_message:
    '你好，我是马健文的数字分身。你可以问我从高考失利到北大直博的成长路径、AI for Science 研究、科学健身经历，以及食探、教链等创业项目。',
  ai_system_prompt:
    '你是马健文的数字分身。只基于系统提供的公开资料回答，优先使用可核验的具体经历、论文、项目与成绩。核心叙事是：用 AI 和工程思维，把学习、身体、工作和创业逐步系统化。对资料中没有明确依据、仍在申请、口径可能过时或涉及第三方的信息，必须说明不确定，不得编造或夸大。不要主动披露手机号、住址、证件号、私人链接、账号凭证、家庭隐私或未公开合作信息。',
};

const { error: profileUpdateError } = await supabase
  .from('personal_profiles')
  .update(profilePatch)
  .eq('id', profile.id);

if (profileUpdateError) throw profileUpdateError;

const entryPatches = [
  {
    matchTitle: '北京大学前沿交叉学科研究院直博生',
    entry_type: 'resume',
    title: '北京大学前沿交叉学科研究院直博生',
    subtitle: 'AI for Science / AI × 生命科学',
    organization: '北京大学',
    start_date: '2023-09',
    end_date: null,
    is_ongoing: true,
    summary: '2023 级直博生，围绕人工智能与生命科学交叉开展研究，并把科研方法迁移到真实产品与公共表达中。',
    content: '研究兴趣包括文本属性图聚类、扩散模型、生物信息学与多组学。公开成果包括 Findings of ACL 2025 论文 MARK，以及《中国科学：数学》2025 年综述《扩散模型及其在生物信息学中的应用》。',
    highlights: ['Findings of ACL 2025 作者', '《中国科学：数学》作者', 'AI × 生命科学', 'AI for Science'],
    links: [
      { label: 'ACL Anthology', url: 'https://aclanthology.org/2025.findings-acl.314/' },
      { label: '《中国科学：数学》论文', url: 'https://www.sciengine.com/parse/pdf/1674-7216/32C8460E38C74B3996F973CDACF09081.pdf' },
    ],
    sort_order: 1,
    is_public: true,
  },
  {
    matchTitle: '从溧阳到北大：一条重新设计的成长路径',
    entry_type: 'resume',
    title: '从溧阳到北大：一条重新设计的成长路径',
    subtitle: '高考失利后的持续迭代',
    organization: '溧阳 · 南京 · 北京',
    start_date: '2016-09',
    end_date: '2023-09',
    is_ongoing: false,
    summary: '从乡镇教育环境起步，高中获得北大自主招生 20 分优惠却未在高考进入北大；在南航重新出发，最终进入北大直博。',
    content: '这段经历让我意识到，一次考试可以影响起点，但不能替代长期成长。真正可迁移的能力，是在失利后重新认识自己、设计路径、建立反馈，并把一个阶段的结果变成下一个阶段的起点。',
    highlights: ['北大自主招生 20 分', '高考失利后重新出发', '南航专业第一', '进入北大直博'],
    links: [],
    sort_order: 2,
    is_public: true,
  },
  {
    matchTitle: '南京航空航天大学工科试验班（长空创新班）',
    entry_type: 'resume',
    title: '南京航空航天大学工科试验班（长空创新班）',
    subtitle: '自动化专业',
    organization: '南京航空航天大学',
    start_date: '2019-09',
    end_date: '2023-06',
    is_ongoing: false,
    summary: '本科期间必修 GPA 4.6，自动化专业排名 1/202、工科试验班排名 1/58，并在科创、学科竞赛、学生工作和体育训练中持续实践。',
    content: '曾获国家奖学金、江苏省优秀毕业生、江苏省三好学生、南航十大杰出青年；担任队长获得全国大学生物理实验竞赛一等奖，并作为核心成员参与中国“互联网+”大学生创新创业大赛全国金奖项目。',
    highlights: ['必修 GPA 4.6', '自动化专业 1/202', '工科试验班 1/58', '国家奖学金', '江苏省优秀毕业生', '南航十大杰出青年', '物理实验竞赛一等奖（队长）', '互联网+ 全国金奖核心成员'],
    links: [],
    sort_order: 3,
    is_public: true,
  },
  {
    matchTitle: '力量与街头健身长期实践',
    entry_type: 'resume',
    title: '力量与街头健身长期实践',
    subtitle: '训练者 / 内容创作者 / 训练量化实践',
    organization: '北京大学 · 多平台',
    start_date: null,
    end_date: null,
    is_ongoing: true,
    summary: '长期进行力量训练与街头健身，把动作标准、负荷、恢复和比赛表现沉淀为可以测量与复盘的方法。',
    content: '曾获北京大学秋季运动会引体向上第一名并打破校纪录、世界力量举（WP）北大站 69 kg 级冠军；也持续开发 Pull-up Index、动作分析脚本等训练量化工具。',
    highlights: ['北大秋季运动会引体第一', '打破北大校纪录', 'WP 北大站 69 kg 级冠军', 'Pull-up Index', '训练量化'],
    links: [{ label: 'Pull-up Index', url: 'https://pullupindex.top/' }],
    sort_order: 4,
    is_public: true,
  },
  {
    matchTitle: '健身与学习领域内容创作者',
    entry_type: 'resume',
    title: '健身与学习领域内容创作者',
    subtitle: '全网 6 万+粉丝 / 科学健身与学习方法',
    organization: '多平台',
    start_date: null,
    end_date: null,
    is_ongoing: true,
    summary: '长期围绕科学健身、学习成长、AI 实践和产品创业进行内容输出，用公开表达连接真实问题与用户反馈。',
    content: '自媒体对我而言不只是传播渠道，也是一套公开实验系统：把自己的训练、学习与产品实践拆成可验证的方法，再通过真实反馈继续迭代。',
    highlights: ['全网 6 万+粉丝', '科学健身', '学习方法', '公开实践', '产品反馈'],
    links: [{ label: 'B站主页', url: 'https://space.bilibili.com/495933903' }],
    sort_order: 5,
    is_public: true,
  },
  {
    matchTitle: 'MARK: Multi-agent Collaboration with Ranking Guidance for Text-attributed Graph Clustering',
    entry_type: 'paper',
    title: 'MARK: Multi-agent Collaboration with Ranking Guidance for Text-attributed Graph Clustering',
    subtitle: 'Findings of ACL 2025 · 论文作者',
    organization: 'Association for Computational Linguistics',
    start_date: '2025-07',
    end_date: null,
    is_ongoing: false,
    summary: '利用多个基于大语言模型的智能体协作，为文本属性图聚类生成可靠的排序指导信号。',
    content: '论文发表于 Findings of the Association for Computational Linguistics: ACL 2025，页码 6057–6072，DOI: 10.18653/v1/2025.findings-acl.314。',
    highlights: ['ACL 2025 Findings', '多智能体协作', '大语言模型', '文本属性图聚类'],
    links: [{ label: 'ACL Anthology 论文页', url: 'https://aclanthology.org/2025.findings-acl.314/' }],
    sort_order: 1,
    is_public: true,
  },
  {
    matchTitle: '扩散模型及其在生物信息学中的应用',
    entry_type: 'paper',
    title: '扩散模型及其在生物信息学中的应用',
    subtitle: '《中国科学：数学》2025 年第 55 卷第 7 期 · 论文作者',
    organization: '中国科学杂志社',
    start_date: '2025-05',
    end_date: null,
    is_ongoing: false,
    summary: '从概率与随机微分方程视角介绍扩散模型，并系统梳理其在转录组、蛋白质等生物信息学方向的应用。',
    content: '论文发表于《中国科学：数学》2025 年第 55 卷第 7 期，1505–1526 页。',
    highlights: ['扩散模型', '生物信息学', '综述', 'AI for Science'],
    links: [{ label: '查看论文 PDF', url: 'https://www.sciengine.com/parse/pdf/1674-7216/32C8460E38C74B3996F973CDACF09081.pdf' }],
    sort_order: 2,
    is_public: true,
  },
];

for (const entry of entryPatches) {
  const { matchTitle, ...payload } = entry;
  const { data: existingRows, error: readError } = await supabase
    .from('personal_entries')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('title', matchTitle)
    .limit(1);

  if (readError) throw readError;

  if (existingRows?.[0]?.id) {
    const { error: updateError } = await supabase
      .from('personal_entries')
      .update(payload)
      .eq('id', existingRows[0].id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('personal_entries')
      .insert({ ...payload, profile_id: profile.id });
    if (insertError) throw insertError;
  }
}

console.log(`Updated public profile and ${entryPatches.length} evidence-backed entries.`);
