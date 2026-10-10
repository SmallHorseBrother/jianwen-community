import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TOPICS, publicId, xmlField, redact, inferredEdges } from './network-atlas-lib.mjs';
import { sourceDirectory, readMembers, readMessages, joinedMembers } from './network-atlas-source.mjs';
import { taxonomyForGroup, publicTaxonomy } from './network-taxonomies.mjs';
import { applySpeechProfile, createSpeechCollector } from './network-speech.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'scripts/network-atlas.config.json'),'utf8'));
const write=process.argv.includes('--write'),avatars=process.argv.includes('--avatars');
const groupArg=process.argv.indexOf('--group'),groupId=groupArg>=0?process.argv[groupArg+1]:null;
if(groupArg>=0&&!config.groups.some(g=>g.id===groupId))throw new Error('Unknown --group');
const groups=groupId?config.groups.filter(g=>g.id===groupId):config.groups;
// Enrich the existing membership snapshot using read-only chat history from its time window.
if(process.argv.includes('--summarize-speech')) {
  const directory=sourceDirectory();
  for(const group of groups) {
    const file=path.join(root,'public/data',group.id===config.defaultGroup?'network-atlas.json':`network/${group.id}.json`);
    const data=JSON.parse(fs.readFileSync(file,'utf8')),taxonomy=taxonomyForGroup(group.id);
    const collectors=new Map(data.people.map(p=>[p.id,createSpeechCollector(taxonomy)]));
    const seen=new Set(),cutoff=Date.parse(data.lastMessageAt)/1000;let scanned=0;
    for(const row of readMessages(directory,group.groupId)) {
      if(row.create_time>cutoff||row.local_type!==1)continue;
      const key=row.server_id&&row.server_id!=='0'?`server:${row.server_id}`:row.key;
      if(seen.has(key))continue;seen.add(key);scanned++;
      collectors.get(publicId(row.user_name||''))?.observe(row);
    }
    data.people=data.people.map(p=>applySpeechProfile({...p,speech:collectors.get(p.id).finish()},taxonomy));
    const facts=data.edges.filter(e=>e.kind==='interaction'||e.kind==='collaboration');
    data.edges=[...facts,...inferredEdges(data.people,facts,taxonomy)];
    data.speechUpdatedAt=new Date().toISOString();
    if(write)fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
    console.log(JSON.stringify({group:group.id,scanned,withSpeech:data.people.filter(p=>p.speech).length,newSummaries:data.people.filter(p=>p.profileSource==='speech').length,unclassified:data.people.filter(p=>p.topic==='other').length,written:write,bytes:Buffer.byteLength(JSON.stringify(data))}));
  }
  process.exit(0);
}
// Reclassify only reviewed public material; preserve source timestamps, avatars and facts.
if(process.argv.includes('--reclassify')) {
  for(const group of groups) {
    const file=path.join(root,'public/data',group.id===config.defaultGroup?'network-atlas.json':`network/${group.id}.json`);
    const data=JSON.parse(fs.readFileSync(file,'utf8')),taxonomy=taxonomyForGroup(group.id);
    data.classification=publicTaxonomy(taxonomy);
    data.topics=(taxonomy.topics||TOPICS).map(({words,...t})=>t);
    data.people=data.people.map(person=>applySpeechProfile(person,taxonomy));
    const facts=data.edges.filter(e=>e.kind==='interaction'||e.kind==='collaboration');
    data.edges=[...facts,...inferredEdges(data.people,facts,taxonomy)];
    if(write)fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
    console.log(JSON.stringify({group:group.id,classification:taxonomy.kind,members:data.people.length,written:write}));
  }
  if(write) {
    const file=path.join(root,'public/data/network-groups.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
    catalog.groups=catalog.groups.map(g=>({...g,kind:taxonomyForGroup(g.id).kind}));
    fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
  }
  process.exit(0);
}
const directory=sourceDirectory(),avatarDir=path.join(root,'public/images/network');
const contactUpdated=fs.statSync(path.join(directory,'contact.db')).mtime.toISOString();
const iso=time=>time?new Date(time*1000).toISOString():null;
const datasetPath=group=>group.id===config.defaultGroup?'/data/network-atlas.json':`/data/network/${group.id}.json`;
const require=createRequire(import.meta.url);
const sharp=write&&avatars?require('sharp'):null;
const attemptedAvatars=new Set();
const publicCatalog=path.join(root,'public/data/network-groups.json');
let entries=fs.existsSync(publicCatalog)?JSON.parse(fs.readFileSync(publicCatalog,'utf8')).groups:[];

for(const group of groups) {
  const taxonomy=taxonomyForGroup(group.id);
  const members=readMembers(directory,group.groupId);
  if(!members.length)throw new Error(`${group.title}: 群成员为空，停止导出`);
  const ids=new Set(members.map(m=>m.username)),stats=new Map(),joins=new Map(),edges=new Map(),reviewedRows=new Map();
  const reviewed=new Set(group.reviewedIntroductionIds||[]),seen=new Set();
  let messages=0,first=Infinity,last=0,duplicates=0;
  const nameById=new Map(members.map(m=>[publicId(m.username),redact(m.groupNickname||m.nick_name||'未命名成员')]));
  function addInteraction(from,to,r,kind='interaction',reason='群内有引用回复或 @ 提及；互动次数不代表关系亲密度或合作。') {
    if(!ids.has(from)||!ids.has(to)||from===to)return;
    const source=publicId(from),target=publicId(to),id=[source,target].sort().join(':');
    const edge=edges.get(id)||{id,source,target,kind,reason,count:0,evidence:[],firstAt:iso(r.create_time),lastAt:iso(r.create_time)};
    edge.count++;edge.firstAt=edge.firstAt<iso(r.create_time)?edge.firstAt:iso(r.create_time);edge.lastAt=edge.lastAt>iso(r.create_time)?edge.lastAt:iso(r.create_time);
    if(kind==='collaboration'){edge.kind=kind;edge.reason=reason;}
    // Fan-group chats may contain health details or jokes. Publish counts, not chat bodies.
    if(group.id===config.defaultGroup&&edge.evidence.length<3)edge.evidence.push({at:iso(r.create_time),speaker:nameById.get(source),text:redact(r.raw.includes('<appmsg')?xmlField(r.raw,'title'):r.text).slice(0,230),messageId:r.key});
    edges.set(id,edge);
  }
  for(const r of readMessages(directory,group.groupId)) {
    // Server IDs span shards; local IDs alone are not unique.
    const key=r.server_id&&r.server_id!=='0'?`server:${r.server_id}`:r.key;
    if(seen.has(key)){duplicates++;continue;}seen.add(key);
    messages++;first=Math.min(first,r.create_time);last=Math.max(last,r.create_time);
    if(r.local_type===10000){for(const id of joinedMembers(r.raw))joins.set(id,Math.max(joins.get(id)||0,r.create_time));continue;}
    if(!ids.has(r.user_name))continue;
    const stat=stats.get(r.user_name)||{count:0,last:0,introductions:[],speech:createSpeechCollector(taxonomy)};
    stat.count++;stat.last=Math.max(stat.last,r.create_time);
    stat.speech.observe(r);
    if(r.local_type===1&&(reviewed.has(r.key)||(group.id===config.defaultGroup&&r.key.startsWith('message_2.db:')&&reviewed.has(r.local_id)))) {
      stat.introductions.push({messageId:r.key,at:iso(r.create_time),text:redact(r.text)});
      reviewedRows.set(r.local_id,r);
    }
    stats.set(r.user_name,stat);
    const targets=new Set(xmlField(r.source,'atuserlist').split(',').filter(Boolean));
    const reference=r.raw.match(/<refermsg>([\s\S]*?)<\/refermsg>/)?.[1];
    if(reference)targets.add(xmlField(reference,'chatusr'));
    for(const target of targets)addInteraction(r.user_name,target,r);
  }
  if(!messages)throw new Error(`${group.title}: 无可见消息，停止导出`);
  const people=members.map(m=>{
    const stat=stats.get(m.username)||{count:0,last:0,introductions:[]};
    const intro=stat.introductions.sort((a,b)=>a.at.localeCompare(b.at)),nickname=redact(m.nick_name||''),groupNickname=redact(m.groupNickname);
    return applySpeechProfile({id:publicId(m.username),name:groupNickname||nickname||'未命名成员',nickname,groupNickname,avatar:'',joinedAt:iso(joins.get(m.username)),messageCount:stat.count,lastActiveAt:iso(stat.last),introductions:intro,speech:stat.speech?.finish()||null},taxonomy);
  });
  for(const pair of group.collaborations||[]){const from=reviewedRows.get(pair.fromIntroductionId),to=reviewedRows.get(pair.toIntroductionId);if(from&&to)addInteraction(from.user_name,to.user_name,from,'collaboration',pair.reason);}
  const factualEdges=[...edges.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
  const relations=[...factualEdges,...inferredEdges(people,factualEdges,taxonomy)];
  const byId=new Map(people.map(p=>[p.id,p]));
  if(write)fs.mkdirSync(avatarDir,{recursive:true});
  let avatarSaved=0,avatarFailed=0;
  // Bounded concurrency and a shared cache keep disk use small across overlapping groups.
  for(let offset=0;offset<members.length;offset+=6)await Promise.all(members.slice(offset,offset+6).map(async member=>{
    const id=publicId(member.username),file=path.join(avatarDir,`${id}.webp`),person=byId.get(id);
    if(fs.existsSync(file)){person.avatar=`/images/network/${id}.webp`;avatarSaved++;return;}
    if(!sharp||attemptedAvatars.has(id)){avatarFailed++;return;}attemptedAvatars.add(id);
    try {
      const url=new URL(member.small_head_url||member.big_head_url);
      if(!['wx.qlogo.cn','mmhead.c2c.wechat.com','mmhead.hk.wechat.com'].includes(url.hostname))throw new Error('Unexpected avatar host');
      url.protocol='https:';
      const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
      if(!response.ok||Number(response.headers.get('content-length')||0)>2_000_000)throw new Error('Avatar unavailable');
      const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>2_000_000)throw new Error('Avatar too large');
      await sharp(buffer,{limitInputPixels:4_000_000}).resize(160,160,{fit:'cover',withoutEnlargement:true}).webp({quality:86}).toFile(file);
      person.avatar=`/images/network/${id}.webp`;avatarSaved++;
    }catch{avatarFailed++;}
  }));
  const dataset={schemaVersion:1,groupId:group.id,title:group.title,classification:publicTaxonomy(taxonomy),generatedAt:new Date().toISOString(),contactUpdatedAt:contactUpdated,firstMessageAt:iso(first),lastMessageAt:iso(last),messageTotal:messages,topics:(taxonomy.topics||TOPICS).map(({words,...t})=>t),people,edges:relations,notes:'仅统计本机可见记录，不代表完整群历史。群昵称与核对后的自我介绍用于资料整理；互动不代表合作，未发言不代表从未发言。'};
  const entry={id:group.id,kind:taxonomy.kind,title:group.title,path:datasetPath(group),members:people.length,introductions:people.filter(p=>p.introductions.length).length,messages,generatedAt:dataset.generatedAt};
  if(write){const out=path.join(root,'public',datasetPath(group));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(dataset,null,2)+'\n');entries=entries.filter(e=>e.id!==entry.id);entries.push(entry);}
  console.log(JSON.stringify({...entry,written:write,duplicates,groupNicknames:people.filter(p=>p.groupNickname).length,edges:relations.length,avatarSaved,avatarFailed,bytes:Buffer.byteLength(JSON.stringify(dataset))}));
}
if(write){const ordered=config.groups.map(g=>entries.find(e=>e.id===g.id)).filter(Boolean);fs.writeFileSync(publicCatalog,JSON.stringify({schemaVersion:1,defaultGroup:config.defaultGroup,groups:ordered},null,2)+'\n');}
