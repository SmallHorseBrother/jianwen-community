import { createHash } from 'node:crypto';
import { TAXONOMIES } from './network-taxonomies.mjs';

export const TOPICS = [
  { id: 'ai', name: 'AI 应用与企业服务', color: '#68ddc3', words: ['AI', '人工智能', '大模型', 'agent', 'FDE', '软件', '前端', '开发', '编程', '自动化'] },
  { id: 'hardware', name: '具身、硬件与产业', color: '#8db3ff', words: ['具身', '硬件', '机器人', '无人机', '电路', '传感器', '制造', '电力', '变电站', '家电', 'VLA', '世界模型'] },
  { id: 'health', name: '健康、运动与医疗', color: '#f1a1bc', words: ['健身', '健康', '医疗', '运动', '康复', '生物', '医药', '口腔', '力量训练', '兽医', '街健', '引体', '力量举', '卧推', '跑步', '马拉松', '瑜伽', '游泳', '羽毛球', '篮球', '足球', '普拉提', '武术'] },
  { id: 'data', name: '数据、量化与财税', color: '#b6ce91', words: ['数据', '量化', '财税', '会计', '金融', '经济', '算法', '财务'] },
  { id: 'education', name: '教育、科研与求职', color: '#e8c27a', words: ['教育', '科研', '教培', '求职', '考研', '保研', '教学', '论文', '课程', '培训', '硕士', '博士', '研究生', '学习', '考公'] },
  { id: 'content', name: '内容、品牌与增长', color: '#b6a0ef', words: ['自媒体', '品牌', '内容', '运营', '短剧', '短视频', '个人IP', '营销', '知识付费', '私域', '社群'] },
  { id: 'commerce', name: '跨境、电商与零售', color: '#75cbdc', words: ['跨境', '电商', '零售', '出海', '物流', '亚马逊', '门店', '俄罗斯', '贸易', '货运'] },
  { id: 'other', name: '其他与待补充', color: '#929dac', words: [] },
];

export const publicId = (username) => createHash('sha256').update(`jianwen-network:${username}`).digest('hex').slice(0, 16);
export const unxml = (value = '') => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
export const xmlField = (xml, key) => unxml(xml.match(new RegExp(`<${key}(?:\\s[^>]*)?>([\\s\\S]*?)</${key}>`))?.[1] || '');
export const redact = (text) => text.replace(/\b(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, '［联系方式已隐藏］').replace(/\bwxid_[a-z\d]+\b/gi, '［微信账号］').replace(/(?:微信号|手机号|电话|微信同号)\s*[:：]\s*[\w+@.\-]{5,}/g, '联系方式：请在群内联系').trim();
export const sentences = (text) => text.split(/(?:[。！？；\n]+|(?<=\S)\s*•\s*)/u).map(s => s.trim()).filter(Boolean);
export function classify(text, professionalContext = '', taxonomy = TAXONOMIES.entrepreneurship) {
  const input = text.toLowerCase(), priority = professionalContext.toLowerCase();
  const scored = (taxonomy.topics || TOPICS).filter(t => t.id !== 'other').map(t => ({ ...t, score: t.words.filter(w => hasWord(input,w)).reduce((sum,w)=>sum+(['AI','开发','自动化'].includes(w)?.4:1)*(hasWord(priority,w)?3:1),0) })).filter(t => t.score).sort((a,b) => b.score-a.score);
  return { topic: scored[0]?.id || 'other', tags: [...new Set(scored.flatMap(t => t.words.filter(w => hasWord(input,w))))].slice(0, 9), topics: scored.map(t => t.id) };
}
const hasWord = (text, word) => /^[a-z]+$/i.test(word)
  ? new RegExp(`(?<![a-z])${word}(?![a-z])`, 'i').test(text)
  : text.includes(word.toLowerCase());
export function profileDetails(introductions, groupNickname, taxonomy = TAXONOMIES.entrepreneurship) {
  const full = introductions.map(i => i.text).join('\n');
  const parts = sentences(full);
  const professionalContext = `${groupNickname}\n${(introductions[0]?.text || '').split(/兴趣爱好|热爱|平常|爱好是/)[0]}`;
  return {
    ...classify(`${groupNickname}\n${full}`, professionalContext, taxonomy),
    goals: taxonomy.goals.filter(g => g.words.some(w => hasWord(full.toLowerCase(),w))).map(g => g.name),
    summary: full ? (parts.slice(0, 2).join('。').replace(/^个人介绍示例[：:]/,'').slice(0, 180) + (parts.length > 2 ? '…' : '')) : '还没有整理到自我介绍，欢迎在群里补充正在做的事。',
    offers: parts.filter(s => (taxonomy.kind==='entrepreneurship' ? /提供|擅长|负责|主营|专注|已落地|已经落地|目前.{0,20}(?:做|开发|搭建|运营)|在做|资源/ : taxonomy.kind==='learning' ? /专业|研究|学习|擅长|分享|就读|在读|自学/ : /训练|练习|运动|健身|擅长|分享|跑步|游泳|街健/).test(s) && !/正在寻找|希望|想要|市场数据/.test(s)).slice(0, 4),
    needs: parts.filter(s => /正在寻找|招募|希望.{0,25}(?:交流|合作|探索|学习|提高|提升)|想做|想探索|想通过|感兴趣|目标|搭子|备考|考研|考博|减脂|增肌/.test(s)).slice(0, 4),
    stage: taxonomy.kind!=='entrepreneurship' ? '待补充' : /正在寻找|招募|商业计划书|创业团队|公司.*签.*合同/.test(full) ? '项目推进' : /目前|在做|已经|开发|运营/.test(full) ? '正在实践' : full ? '探索交流' : '待补充',
  };
}
export function inferredEdges(people, existingEdges, taxonomy = TAXONOMIES.entrepreneurship) {
  const result = [], occupied = new Set(existingEdges.map(e => [e.source,e.target].sort().join(':'))), counts = new Map();
  const add = (a,b,kind,reason) => { const key=[a.id,b.id].sort().join(':'); if(occupied.has(key)||(counts.get(a.id)||0)>=3||(counts.get(b.id)||0)>=3)return; occupied.add(key); counts.set(a.id,(counts.get(a.id)||0)+1); counts.set(b.id,(counts.get(b.id)||0)+1); result.push({id: key,source:a.id,target:b.id,kind,reason,evidence:[]}); };
  for(const a of taxonomy.kind==='entrepreneurship'?people:[]) for(const b of people) {
    if(a.id===b.id || !a.offers.length || !b.needs.length) continue;
    const supply=classify(a.offers.join(' ')).tags, demand=classify(b.needs.join(' ')).tags;
    const common=supply.filter(t=>demand.includes(t)&&!['AI','开发','数据','运营'].includes(t));
    if(common.length) add(a,b,'match',`${a.name}的自述资源与${b.name}的兴趣或需求涉及「${common.slice(0,2).join('、')}」，可进一步了解。`);
  }
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++) {
    const a=people[i],b=people[j],shared=a.tags.filter(t=>b.tags.includes(t)&&!['AI','开发'].includes(t));
    if(shared.length>=2)add(a,b,'shared',`群昵称、自我介绍或发言归纳共同涉及「${shared.slice(0,3).join('、')}」，${a.speech||b.speech?'包含发言推测标签，':''}${taxonomy.kind==='entrepreneurship'?'尚无合作确认':'仅为共同兴趣线索，不代表已结伴'}。`);
  }
  return result;
}
