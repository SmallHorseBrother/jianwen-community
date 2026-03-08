-- 手动执行说明:
-- 1. 请先确保已经执行过 202603090001_create_personal_brand_system.sql
-- 2. 这份脚本会:
--    - 根据手机号 13915850621 找到你的账号
--    - upsert 个人主页基础信息
--    - 清空并重建 personal_entries 内容条目
-- 3. 这份脚本不会上传本地文件到 Storage
--    - 附件文件本体仍建议在 /about/admin 里上传
--    - 上传后再把摘要贴进去，或后续我再给你一份附件 metadata SQL

begin;

do $$
declare
  target_user_id uuid;
  target_profile_id uuid;
begin
  select id
  into target_user_id
  from public.profiles
  where phone = '13915850621'
  limit 1;

  if target_user_id is null then
    raise exception '未找到手机号 13915850621 对应的用户，请先确认该账号已注册。';
  end if;

  insert into public.personal_profiles (
    owner_id,
    slug,
    display_name,
    headline,
    intro,
    long_bio,
    location,
    email_public,
    wechat_public,
    social_links,
    expertise,
    ai_enabled,
    ai_welcome_message,
    ai_system_prompt,
    is_public
  )
  values (
    target_user_id,
    'my-about',
    '马健文',
    '北大直博生 / AI for Science 研究者 / AI 健康创业者 / 健身内容创作者',
    '我目前是北京大学前沿交叉学科研究院 2023 级直博生，研究方向聚焦于 AI 和基础学科的交叉问题，同时也在持续推进 AI + 健康管理方向的创业实践。我长期做健身、学习和个人成长相关内容输出，希望把科研、技术、自媒体与创业结合起来，打造真正能解决现实问题的产品。',
    '我出生于江苏溧阳，本科毕业于南京航空航天大学工科试验班，之后进入北京大学继续攻读博士，主要研究 AI for Science 相关问题。在学术上，我持续关注多组学、科学智能、图聚类、扩散模型等方向，相关成果发表于 ACL 和《中国科学：数学》等平台。'||E'\n\n'||
    '在科研之外，我长期深度投入健身训练、自媒体内容创作和创业实践。过去几年里，我一边做学术研究，一边围绕健康管理、运动学习和 AI 原生工具搭建自己的产品体系。目前核心在推进 Healthy Max 和 CoachLink 两个方向，尝试用 AI 提升大众健康管理效率，以及提升教练服务的数字化程度。'||E'\n\n'||
    '我对“超级个体”这个概念一直很有兴趣。对我来说，它不是简单的高产，而是把热爱、能力、输出、产品和影响力结合起来，让科研、创业、训练和表达彼此增强。',
    '北京',
    'jianwen_ma@stu.pku.edu.cn',
    'HLG53589',
    jsonb_build_object(
      'github', 'https://github.com/SmallHorseBrother'
    ),
    array[
      'AI for Science',
      '多组学与生物信息学',
      '科学智能',
      '健康管理',
      '健身训练',
      '创业与产品设计',
      '自媒体内容创作',
      '学习方法'
    ]::text[],
    true,
    '你好，我是马健文的数字分身。你可以直接问我关于研究、论文、创业项目、健身经历和个人成长的问题。',
    '你是网站主人的数字分身。请基于提供的公开资料回答，优先准确、具体、诚实。如果资料里没有明确依据，请直接说明不知道，不要编造。回答时优先引用具体经历、论文、项目和公开成果。涉及隐私信息时保持克制，不主动暴露手机号、住址、证件号、私人链接等敏感信息。',
    true
  )
  on conflict (owner_id) do update
  set
    slug = excluded.slug,
    display_name = excluded.display_name,
    headline = excluded.headline,
    intro = excluded.intro,
    long_bio = excluded.long_bio,
    location = excluded.location,
    email_public = excluded.email_public,
    wechat_public = excluded.wechat_public,
    social_links = coalesce(public.personal_profiles.social_links, '{}'::jsonb) || excluded.social_links,
    expertise = excluded.expertise,
    ai_enabled = excluded.ai_enabled,
    ai_welcome_message = excluded.ai_welcome_message,
    ai_system_prompt = excluded.ai_system_prompt,
    is_public = excluded.is_public,
    updated_at = timezone('utc', now())
  returning id into target_profile_id;

  if target_profile_id is null then
    select id
    into target_profile_id
    from public.personal_profiles
    where owner_id = target_user_id
    limit 1;
  end if;

  delete from public.personal_entries
  where profile_id = target_profile_id;

  insert into public.personal_entries (
    profile_id,
    entry_type,
    title,
    subtitle,
    organization,
    start_date,
    end_date,
    is_ongoing,
    summary,
    content,
    highlights,
    links,
    sort_order,
    is_public
  )
  values
  (
    target_profile_id,
    'resume',
    '北京大学前沿交叉学科研究院直博生',
    'AI for Science / 定量生物学 / 整合生命科学（物理）',
    '北京大学',
    '2023-09',
    null,
    true,
    '在北京大学从事 AI 与基础学科交叉研究，关注科学智能、多组学、生物信息学与相关计算框架。',
    '目前主要围绕 AI for Science、图聚类、扩散模型、生物信息学及相关计算问题开展研究，并持续尝试把科研中的 AI 方法论迁移到真实产品和创业场景中。',
    array[
      'ACL 论文作者',
      '《中国科学：数学》作者',
      '世界科学智能大赛生命科学赛道成绩靠前',
      '持续推进 AI for Science 与实际产品结合'
    ]::text[],
    '[]'::jsonb,
    1,
    true
  ),
  (
    target_profile_id,
    'resume',
    '南京航空航天大学工科试验班（长空创新班）',
    '自动化专业',
    '南京航空航天大学',
    '2019-09',
    '2023-06',
    false,
    '本科阶段在学业、竞赛、科创项目、学生工作和体育训练等多个维度保持高强度投入与高水平产出。',
    '本科期间专业排名 1/202，工科试验班排名 1/58，GPA 4.6，并获得国家奖学金、江苏省优秀毕业生、南航十大杰出青年等荣誉，同时在物理实验竞赛、数学竞赛、互联网+、电子设计竞赛等项目中持续取得成绩。',
    array[
      '专业排名 1/202',
      '工科试验班排名 1/58',
      'GPA 4.6',
      '国家奖学金',
      '互联网+ 国赛金奖核心成员',
      '全国大学生物理实验竞赛一等奖（队长）'
    ]::text[],
    '[]'::jsonb,
    2,
    true
  ),
  (
    target_profile_id,
    'resume',
    '健身与学习领域内容创作者',
    '全网粉丝 4W+，播放量超千万',
    '多平台',
    null,
    null,
    true,
    '长期在健身、学习、成长和个人表达领域进行内容输出，持续积累个人影响力和真实用户反馈。',
    '我把自媒体当成输出与迭代自己的方式。一方面，它帮助我沉淀方法论和表达能力；另一方面，它也直接连接真实用户需求，为我的健康类产品与数字人系统提供场景反馈。',
    array[
      '全网粉丝 4W+',
      '播放量超 1000W',
      '个人 IP 与创业产品形成联动'
    ]::text[],
    '[]'::jsonb,
    3,
    true
  ),
  (
    target_profile_id,
    'paper',
    'MARK: Multi-agent Collaboration with Ranking Guidance for Text-attributed Graph Clustering',
    'ACL',
    'ACL',
    '2025-05',
    null,
    false,
    '2025 年发表于人工智能顶级会议 ACL 的论文成果。',
    '这项工作体现了我在 AI 模型设计、协作式智能体和结构化数据问题上的研究兴趣，也是我在科研路径中较有代表性的成果之一。',
    array[
      'ACL',
      '图聚类',
      '多智能体协作'
    ]::text[],
    '[]'::jsonb,
    4,
    true
  ),
  (
    target_profile_id,
    'paper',
    '扩散模型及其在生物信息学中的应用',
    '中国科学：数学',
    '中国科学：数学',
    '2025-05',
    null,
    false,
    '2025 年发表于国内权威数学期刊《中国科学：数学》的论文成果。',
    '这篇工作体现了我把 AI 模型方法与生物信息学问题结合起来的研究路径，也对应了我在 AI 与基础学科交叉方向上的持续投入。',
    array[
      '中国科学：数学',
      '扩散模型',
      '生物信息学'
    ]::text[],
    '[]'::jsonb,
    5,
    true
  ),
  (
    target_profile_id,
    'paper',
    '通过三代测序解码储存在甲基化中的信息',
    '学习与研究参与',
    '钱珑实验室',
    '2024-03',
    '2024-06',
    false,
    '参与相关学习和研究，项目成果已被 Nature 正刊录用。',
    '在这个阶段，我进一步进入更前沿的生命科学与智能计算交叉场景，强化了自己在科研协作、快速学习和跨学科理解上的能力。',
    array[
      'Nature 正刊录用相关项目',
      '跨学科研究',
      '生命科学'
    ]::text[],
    '[]'::jsonb,
    6,
    true
  ),
  (
    target_profile_id,
    'venture',
    'Healthy Max',
    'AI 健康管理平台',
    '智健启能（北京）科技有限公司',
    '2025-01',
    null,
    true,
    '一个以 AI 为核心的一站式健康管理平台，尝试解决健康管理中计划死板、数据割裂、饮食记录精度低、缺少个性化指导等问题。',
    'Healthy Max 的核心方向包括 AI 私人教练、智能健康数据中枢、可执行数据洞察，以及软硬件结合的健康生态。当前阶段我们重点聚焦高精度 AI 食物定量识别，希望把拍照识别热量这个看似简单但实际门槛极高的功能做成真正可用的行业能力。在创业实践中，这个项目也让我从“大而全”的平台思路逐渐收敛到“先把一个核心能力做到极致”的路线。',
    array[
      'AI 拍照食物定量识别',
      '多模态大模型能力',
      '健康管理数据中枢',
      '已完成路演与内测'
    ]::text[],
    '[]'::jsonb,
    7,
    true
  ),
  (
    target_profile_id,
    'venture',
    'CoachLink',
    '面向教练和学员的线上教学平台',
    '智健启能（北京）科技有限公司',
    '2025-01',
    null,
    true,
    '一个帮助线上健身教练提升效率、规范学员管理、沉淀训练数据和反馈流程的教学平台。',
    'CoachLink 的核心目标是替代微信等低效教学工作流，为教练与学员建立专业、高效、可持续复用的数字化协作环境。平台围绕计划模板化、学员管理可视化、视频点评精准化和训练任务清晰化展开，未来会继续叠加 AI 制定计划与知识库能力。',
    array[
      '教练端效率工具',
      '学员数据与任务可视化',
      'AI 计划生成潜力',
      '线上教学工作流重构'
    ]::text[],
    '[]'::jsonb,
    8,
    true
  ),
  (
    target_profile_id,
    'venture',
    '食探',
    'AI 饮食分析与校园食堂定量化探索',
    '智健启能（北京）科技有限公司',
    '2025-01',
    null,
    true,
    '围绕饮食拍照识别、高精度定量分析、学校食堂与外卖数据库共建等方向展开的饮食数据产品探索。',
    '这个方向希望把“健康饮食”从复杂、抽象的建议，变成对真实食堂和外卖场景的可执行支持，让增肌减脂不必总是依赖复杂备餐，而是直接连接用户的日常生活决策。',
    array[
      '高精度饮食识别',
      '校园与外卖场景',
      '饮食数据库共建'
    ]::text[],
    '[]'::jsonb,
    9,
    true
  ),
  (
    target_profile_id,
    'project',
    'AI 动作识别开源项目',
    'GitHub 开源',
    '个人项目',
    null,
    null,
    false,
    '将 AI 与动作识别、运动训练场景结合的开源探索项目。',
    '这是我把技术能力、训练经验和真实场景理解结合起来的一个代表性实践，也体现了我一贯偏好的“从具体问题切入，再把它系统化”的做事方式。',
    array[
      '动作识别',
      '开源项目',
      '训练场景'
    ]::text[],
    '[]'::jsonb,
    10,
    true
  ),
  (
    target_profile_id,
    'project',
    '个人知识库与数字分身系统',
    '内容资产 + 问答接口',
    '个人品牌工程',
    '2026-03',
    null,
    true,
    '将公开经历、论文、创业项目、训练理念和内容输出整合成可检索、可问答、可持续更新的个人数字分身。',
    '这个系统的目标不是做一个简单的个人主页，而是把履历、项目、论文、附件、内容输出与 AI 问答连接起来，让个人信息从“静态展示”升级为“可对话、可调用、可持续维护的数字资产”。',
    array[
      '个人知识库',
      'AI 问答',
      '数字分身',
      '长期内容资产'
    ]::text[],
    '[]'::jsonb,
    11,
    true
  ),
  (
    target_profile_id,
    'custom',
    '北大AI博士招募自媒体合伙人，共创「学习 x 健身」顶流IP',
    '内容合伙人招募',
    '枭马葛团队',
    '2026-03',
    null,
    true,
    '面向北京在校生优先，深度参与选题策划、拍摄剪辑、账号运营增长，共建学习与健身融合的内容矩阵和产品生态。',
    '这是合伙人性质岗位，以高额收益分成为主，也可按情况提供少量基础薪资。长期合作、贡献卓越者可获得股权/期权激励。投递方式：简历+作品集发送 jianwen_ma@stu.pku.edu.cn，邮件标题“内容合伙人-你的姓名”。',
    array[
      '内容策划',
      '拍摄剪辑',
      '运营增长',
      '合伙人激励',
      '长期股权机会'
    ]::text[],
    jsonb_build_array(
      jsonb_build_object('label', '查看招聘详情', 'url', 'https://www.wolai.com/kHD63uJ2BxtdVcXTTXiqx7')
    ),
    12,
    true
  ),
  (
    target_profile_id,
    'custom',
    '个人助理（兼创业支持 & 自媒体运营）岗位说明',
    '助理岗位招募',
    '枭马葛团队',
    '2026-03',
    null,
    true,
    '岗位覆盖会议总结、社群运营、待办提醒、材料处理、视频剪辑与信息调研，目标是成为长期可信赖的创业与内容协作伙伴。',
    '该岗位强调执行力、保密意识、学习能力与沟通能力。你将深度参与我的创业事务、自媒体运营和日常关键协作，帮助项目和个人IP更高效推进。',
    array[
      '创业支持',
      '社群运营',
      '会议纪要',
      '视频剪辑',
      '时间管理'
    ]::text[],
    jsonb_build_array(
      jsonb_build_object('label', '查看岗位详情', 'url', 'https://www.wolai.com/3McxtZTTow99yns9Q8AbH9')
    ),
    13,
    true
  ),
  (
    target_profile_id,
    'custom',
    '技术合伙人招募（小程序 / 网页 / App）',
    '技术岗位招募',
    '枭马葛团队',
    '2026-03',
    null,
    true,
    '欢迎有创业想法、愿意长期投入、执行力强的技术伙伴加入，深度参与学习 x 健身方向的产品研发和技术路线共建。',
    '希望你有较多可投入时间，具备扎实开发基础（小程序 / Web / App 至少一到两端有实战），并且学习能力强。需要熟悉当前 AI 进展，积极使用最新 AI 工具，懂得使用 AI Agent（如 OpenClaw 等）提高研发效率。加分项：在北京，95后或00后（00后优先）。',
    array[
      '创业心态',
      '时间投入',
      '小程序开发',
      'Web开发',
      'App开发',
      'AI Agent',
      'OpenClaw',
      '快速学习能力'
    ]::text[],
    '[]'::jsonb,
    14,
    true
  );

  raise notice '个人主页内容已写入，profile_id = %', target_profile_id;
end $$;

commit;
