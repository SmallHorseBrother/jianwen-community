const other = { id: 'other', name: '其他与待补充', color: '#929dac', words: [] };
const topic = (id, name, color, words) => ({ id, name, color, words: words.split('|') });
const goal = (name, words) => ({ name, words: words.split('|') });

export const GROUP_KINDS = {
  entrepreneurs: 'entrepreneurship', learning: 'learning', fitness: 'fitness',
  'academy-1': 'learning', 'academy-2': 'learning', 'academy-3': 'learning',
  'fitness-1': 'fitness', 'fitness-2': 'fitness', 'fitness-3': 'fitness',
};

export const TAXONOMIES = {
  entrepreneurship: {
    kind: 'entrepreneurship', label: '创业交流', topicLabel: '行业方向', goalLabel: '项目阶段',
    offersLabel: '正在做 / 能提供', needsLabel: '兴趣 / 正在寻找',
    eyebrow: '一次介绍，下一次合作', description: '了解项目方向，发现资源与合作的交点。',
    matchLabel: '潜在供需匹配', sharedLabel: '共同方向',
    goals: [],
  },
  learning: {
    kind: 'learning', label: '学习交流', topicLabel: '学科与技能', goalLabel: '学习目标',
    offersLabel: '学习方向 / 擅长分享', needsLabel: '学习目标 / 寻找同伴',
    eyebrow: '一起学习，彼此启发', description: '按学科、技能和学习目标，认识可以一起进步的人。',
    matchLabel: '学习互助线索', sharedLabel: '共同学习方向',
    topics: [
      topic('computing', '计算机与人工智能', '#68ddc3', '计算机|软件工程|编程|算法|人工智能|机器学习|深度学习|大模型|AI|Python|前端|后端|网络安全'),
      topic('science', '数学与自然科学', '#8db3ff', '数学|物理|化学|统计学|天文|地理|地质'),
      topic('engineering', '工程与技术', '#e8c27a', '机械|电子|电气|自动化|机器人|控制工程|通信|土木|建筑|材料|能源|光学'),
      topic('biomed', '生命科学与医学', '#f1a1bc', '生物|医学|医学生|医学院|临床|药学|护理|口腔|公共卫生|生命科学'),
      topic('humanities', '人文与社会科学', '#b6a0ef', '文学|历史|哲学|法学|心理学|社会学|政治学|教育学|新闻学'),
      topic('business', '经济与管理', '#b6ce91', '经济|金融|会计|财务|管理学|工商管理|市场营销'),
      topic('language', '语言与表达', '#75cbdc', '英语|日语|法语|德语|雅思|托福|外语|写作|翻译|演讲'),
      topic('design', '艺术与设计', '#eeab82', '设计|美术|绘画|摄影|音乐|动画|艺术'), other,
    ],
    goals: [
      goal('考研 / 保研', '考研|备研|保研|推免'), goal('考博', '考博|申请博士|申博'),
      goal('科研 / 论文', '科研|论文|课题|文献|实验室'), goal('考公 / 考编', '考公|考编|公务员|事业编'),
      goal('技能提升', '学习编程|学编程|学英语|技能提升|自学|学习AI|学习 AI'),
      goal('求职 / 职业发展', '求职|找工作|找实习|转行|职业发展'), goal('学习搭子', '学习搭子|研友|一起学习|共同学习|互相监督'),
    ],
  },
  fitness: {
    kind: 'fitness', label: '健身交流', topicLabel: '运动项目', goalLabel: '训练目标',
    offersLabel: '训练项目 / 经验分享', needsLabel: '训练目标 / 寻找搭子',
    eyebrow: '一起训练，共同进步', description: '从喜欢的运动和训练目标出发，认识同路的伙伴。',
    matchLabel: '训练交流线索', sharedLabel: '共同运动兴趣',
    topics: [
      topic('calisthenics', '街健与自重训练', '#68ddc3', '街健|街头健身|自重训练|引体|双力臂|俄挺|前水平|倒立|单杠|双杠'),
      topic('strength', '力量训练与力量举', '#8db3ff', '力量训练|力量举|卧推|深蹲|硬拉|举重|撸铁'),
      topic('bodybuilding', '健美与塑形', '#f1a1bc', '健美|健体|塑形|形体'),
      topic('running', '跑步与耐力运动', '#b6ce91', '跑步|马拉松|越野跑|长跑|慢跑|骑行|自行车|铁人三项'),
      topic('balls', '球类运动', '#e8c27a', '篮球|足球|羽毛球|乒乓球|网球|排球|壁球'),
      topic('swimming', '游泳与水上运动', '#75cbdc', '游泳|蛙泳|自由泳|蝶泳|仰泳|桨板|冲浪'),
      topic('mobility', '瑜伽与柔韧训练', '#b6a0ef', '瑜伽|普拉提|拉伸|柔韧|灵活性训练'),
      topic('outdoor', '户外与其他运动', '#eeab82', '徒步|登山|攀岩|滑雪|滑板|武术|拳击|搏击|舞蹈'), other,
    ],
    goals: [
      goal('增肌', '增肌|增重'), goal('减脂', '减脂|减重|减肥'),
      goal('力量提升', '提升力量|力量提升|提高力量|突破力量|突破PR|突破 PR'),
      goal('技能突破', '练双力臂|练俄挺|练前水平|练倒立|解锁|技能突破'),
      goal('耐力 / 运动表现', '提高耐力|提升耐力|提升配速|提高配速|备赛|运动表现'),
      goal('保持运动习惯', '坚持锻炼|坚持运动|保持运动|规律训练|养成习惯'),
      goal('寻找训练搭子', '健身搭子|训练搭子|跑友|球友|一起训练|一起锻炼'),
    ],
  },
};

export function taxonomyForGroup(id) {
  const kind = GROUP_KINDS[id];
  if (!kind) throw new Error(`未配置群分类：${id}`);
  return TAXONOMIES[kind];
}

export function publicTaxonomy(taxonomy) {
  const { topics, goals, ...labels } = taxonomy;
  return { ...labels, goals: goals.map(g => g.name) };
}
