import { profileDetails, TOPICS } from './network-atlas-lib.mjs';

const sectionKinds = new Set(['practice','background','interests','needs','contribution']);
const clean = value => typeof value==='string'?value.trim():'';
const privateIdentifier=/wxid_[a-z\d]+|\d+@chatroom|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b/i;
export function normalizePortrait(result, evidence, taxonomy, sourceEnd) {
  const allowedTopics=new Set((taxonomy.topics||TOPICS).map(t=>t.id));
  const sources=new Map([...(evidence.messages||[]),...(evidence.introductions||[])].map(m=>[m.messageId,{at:m.at}]));
  const status=result?.status||'insufficient';
  if(!['specific','limited','insufficient'].includes(status))throw new Error(`Invalid portrait status: ${evidence.id}`);
  const sections=(result?.sections||[]).map(section=>{
    if(!sectionKinds.has(section.kind)||!['self_reported','inferred'].includes(section.confidence))throw new Error(`Invalid section: ${evidence.id}`);
    const references=section.references.map(ref=>{
      const source=sources.get(ref.messageId);
      if(!source||ref.at!==source.at||!Number.isFinite(Date.parse(ref.at))||Date.parse(ref.at)>Date.parse(sourceEnd))throw new Error(`Portrait references another member or unread message: ${evidence.id}/${ref.messageId}`);
      return {messageId:ref.messageId,at:ref.at};
    });
    if(!references.length||!clean(section.text)||!clean(section.title))throw new Error(`Unsubstantiated section: ${evidence.id}`);
    return {kind:section.kind,title:clean(section.title),text:clean(section.text),confidence:section.confidence,references};
  });
  // Insufficient analyses may carry review notes locally, never publish them as a bio.
  const summary=status==='insufficient'?'':clean(result?.summary);
  if(privateIdentifier.test([summary,...sections.flatMap(s=>[s.title,s.text]),...(result?.badges||[])].join(' ')))throw new Error(`Private identifier in portrait: ${evidence.id}`);
  if(status!=='insufficient'&&(!summary||!sections.length))throw new Error(`Empty specific portrait: ${evidence.id}`);
  if(status==='insufficient'&&sections.length)throw new Error(`Insufficient portrait must not invent a biography: ${evidence.id}`);
  const topicIds=[...new Set(result?.topicIds||[])];
  if(topicIds.some(id=>!allowedTopics.has(id)))throw new Error(`Invalid topic: ${evidence.id}`);
  const goals=[...new Set(result?.goals||[])];
  if(goals.some(name=>!taxonomy.goals.some(g=>g.name===name)))throw new Error(`Invalid goal: ${evidence.id}`);
  return {version:2,status,summary,sections,badges:[...new Set((result?.badges||[]).map(clean).filter(Boolean))].slice(0,12),topicIds,goals,coverage:evidence.coverage,sourceEnd};
}

export function applyPortrait(person,taxonomy) {
  const portrait=person.portrait;
  if(!portrait)return person;
  const curated=profileDetails(person.introductions,person.groupNickname,taxonomy);
  const c=portrait.coverage;
  const countText=`${c.messageCount.toLocaleString('zh-CN')} 条消息中，有 ${Math.max(0,c.textCount-(c.replyCount||0))} 条纯文字${c.replyCount?`、${c.replyCount} 条引用回复`:''}${c.imageCount?`、${c.imageCount} 张图片`:''}${c.stickerCount?`、${c.stickerCount} 条表情`:''}${c.voiceCount?`、${c.voiceCount} 条语音`:''}${c.videoCount?`、${c.videoCount} 条视频`:''}${c.linkCount?`、${c.linkCount} 条链接 / 文件`:''}${c.otherCount?`、${c.otherCount} 条其他消息`:''}。`;
  const fallback=c.messageCount?`${countText}${c.meaningfulTextCount?'可见文字以零散交流为主，尚不足以形成具体的实践或需求画像。':'可见记录缺少可归纳的本人文字内容。'}`:'当前可见记录没有本人发言，个人资料待补充。';
  const topics=[...new Set([...portrait.topicIds,...curated.topics])];
  const fromIntroduction=portrait.status==='insufficient'&&person.introductions.length>0;
  const enriched={...person,summary:portrait.status==='insufficient'?person.introductions.length?curated.summary:fallback:portrait.summary,
    profileSource:portrait.status==='insufficient'&&person.introductions.length?'introduction':'portrait',
    topics,topic:topics[0]||curated.topic,
    tags:[...new Set([...portrait.badges,...curated.tags])].slice(0,14),
    goals:fromIntroduction?curated.goals:portrait.goals,
    offers:fromIntroduction?curated.offers:portrait.sections.filter(s=>s.kind==='practice'||s.kind==='contribution').map(s=>s.text),
    needs:fromIntroduction?curated.needs:portrait.sections.filter(s=>s.kind==='needs').map(s=>s.text),
  };
  // Superseded keyword guesses must not remain in the public snapshot or CSV.
  delete enriched.speech;
  return enriched;
}
