import { TOPICS, profileDetails } from './network-atlas-lib.mjs';
import { createHash } from 'node:crypto';
import { applyPortrait } from './network-portraits.mjs';

const weakWords = new Set(['AI','软件','开发','数据','算法','内容','品牌','学习','运动','健康','硬件','设计','经济','金融','数学','物理','化学']);
const matches = (text, word) => /^[a-z]+$/i.test(word)
  ? new RegExp(`(?<![a-z])${word}(?![a-z])`, 'i').test(text)
  : text.toLowerCase().includes(word.toLowerCase());
const day = time => new Date(time * 1000 + 8 * 3600_000).toISOString().slice(0,10);
const iso = time => new Date(time * 1000).toISOString();
const ownIntent = /(?:我|本人|自己).{0,18}(?:想|希望|打算|准备|计划|目标|寻找|喜欢|感兴趣|正在|最近|目前|练|学|考)|^(?:求|寻找|找.{0,8}搭子|准备|打算|目标|计划|想学|想练|想考|想减|想增|备考)/;
const excluded = /个人介绍示例|自我介绍模板|复制粘贴|群规|群公告|通过扫描|邀请.*加入群聊|撤回了一条消息|转发.{0,6}(?:文章|消息|群|通知)|(?:诊断|患有|确诊|感染|抑郁症|焦虑症|艾滋|HIV|癌症|病史|用药|性取向|政治立场)|https?:\/\/|wxid_|\b1[3-9]\d{9}\b/i;

// Only compact counters and source IDs survive; chat text is never stored in the profile.
export function createSpeechCollector(taxonomy) {
  const topics = (taxonomy.topics || TOPICS).filter(t => t.id !== 'other');
  const state = { count:0, first:Infinity, last:0, topics:new Map(), goals:new Map(), seen:new Set() };
  const add = (map, id, row, keywords, explicit) => {
    const signal=map.get(id)||{count:0,days:new Set(),keywords:new Set(),explicit:0,first:Infinity,last:0};
    signal.count++;signal.days.add(day(row.create_time));signal.first=Math.min(signal.first,row.create_time);signal.last=Math.max(signal.last,row.create_time);
    for(const word of keywords)signal.keywords.add(word);
    if(explicit)signal.explicit++;
    map.set(id,signal);
  };
  return {
    observe(row) {
      if(row.local_type!==1||!row.text)return;
      const text=row.text.replace(/^\s*[>＞].*$/gm,'').replace(/\[[^\]]{1,8}\]/g,'').replace(/\s+/g,' ').trim();
      if(text.length<6||text.length>800||excluded.test(text)||/^<|<refermsg|<appmsg/.test(text))return;
      // Repeated/copied identical messages from one member count only once.
      const hash=createHash('sha256').update(text).digest('hex').slice(0,20);
      if(state.seen.has(hash))return;
      state.seen.add(hash);
      state.count++;state.first=Math.min(state.first,row.create_time);state.last=Math.max(state.last,row.create_time);
      const mentionedTopics=new Set(),mentionedGoals=new Set();
      for(const clause of text.split(/[。！？!?；;\n]/).filter(Boolean)) {
        const negative = word => {
          const index=clause.toLowerCase().indexOf(word.toLowerCase());
          return index>=0&&/(?:不|没|别|放弃|停止|取消|不再).{0,5}$/.test(clause.slice(Math.max(0,index-10),index));
        };
        const explicit=ownIntent.test(clause)&&!/(?:你|他|她|别人|朋友).{0,8}(?:想|准备|正在|喜欢)/.test(clause);
        for(const topic of topics) {
          const words=topic.words.filter(w=>matches(clause,w)&&!negative(w));
          if(!words.length||words.every(w=>weakWords.has(w))&&words.length<2&&!explicit)continue;
          // Count a topic once per message even if several clauses mention it.
          if(mentionedTopics.has(topic.id))continue;
          mentionedTopics.add(topic.id);
          add(state.topics,topic.id,row,words,explicit);
        }
        if(explicit)for(const goal of taxonomy.goals) {
          const words=goal.words.filter(w=>matches(clause,w)&&!negative(w));
          if(!words.length||mentionedGoals.has(goal.name))continue;
          mentionedGoals.add(goal.name);add(state.goals,goal.name,row,words,true);
        }
      }
    },
    finish() {
      const evidence = signal => ({messageCount:signal.count,dayCount:signal.days.size,firstAt:iso(signal.first),lastAt:iso(signal.last)});
      const accepted = [...state.topics].filter(([,s])=>s.explicit>0||s.count>=3&&s.days.size>=2||s.count>=5)
        .sort((a,b)=>b[1].count-a[1].count||b[1].days.size-a[1].days.size||a[0].localeCompare(b[0])).slice(0,4)
        .map(([id,s])=>({id,name:topics.find(t=>t.id===id).name,keywords:[...s.keywords].slice(0,5),confidence:s.count>=5&&s.days.size>=3?'多次讨论':'有限线索',...evidence(s)}));
      const goals=[...state.goals].sort((a,b)=>b[1].last-a[1].last).slice(0,4).map(([name,s])=>({name,...evidence(s)}));
      if(!accepted.length&&!goals.length)return null;
      const directions=accepted.map(t=>t.name).slice(0,3).join('、');
      const summary=[directions?`可能关注${directions}；这是根据群内讨论归纳的兴趣线索。`:'',goals.length?`发言中曾表达过${goals.map(g=>g.name).join('、')}相关意向。`:''].filter(Boolean).join('');
      return {version:1,summary,analyzedMessages:state.count,firstAt:iso(state.first),lastAt:iso(state.last),topics:accepted,goals};
    },
  };
}

export function applySpeechProfile(person, taxonomy) {
  const details=profileDetails(person.introductions,person.groupNickname,taxonomy),speech=person.speech;
  const topics=[...new Set([...details.topics,...(speech?.topics.map(t=>t.id)||[])])];
  const tags=[...new Set([...details.tags,...(speech?.topics.flatMap(t=>t.keywords)||[])])].slice(0,12);
  const goals=[...new Set([...details.goals,...(speech?.goals.map(g=>g.name)||[])])];
  const source=person.introductions.length?'introduction':speech?'speech':details.topic!=='other'?'nickname':'empty';
  return applyPortrait({...person,...details,topic:details.topic==='other'?speech?.topics[0]?.id||'other':details.topic,topics,tags,goals,
    summary:person.introductions.length?details.summary:speech?`根据发言推测：${speech.summary}`:person.messageCount?`本群可见记录中有 ${person.messageCount.toLocaleString('zh-CN')} 条发言，暂未整理到明确自我介绍。`:'本群可见记录中暂无发言，个人介绍待补充。',
    profileSource:source},taxonomy);
}
