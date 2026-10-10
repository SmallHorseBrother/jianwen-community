import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { TOPICS, publicId, xmlField, redact, profileDetails, inferredEdges } from './network-atlas-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Z = require(path.join(process.env.CIPHERTALK_ROOT || 'D:/files/CipherTalk', 'node_modules/fzstd'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/network-atlas.config.json'), 'utf8'));
const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.ciphertalk/cli-config.json'), 'utf8'));
const account = fs.readdirSync(cli.dataDir).find(n => n === cli.myWxid || n.startsWith(`${cli.myWxid}_`));
if (!account) throw new Error('CipherTalk 数据目录中未找到当前账号');
const directory = path.join(cli.dataDir, account);
const table = `Msg_${createHash('md5').update(config.groupId).digest('hex')}`;
const decode = (value) => {
  if (typeof value === 'string') return value;
  if (!value) return '';
  let buffer = Buffer.from(value);
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0xfd2fb528) buffer = Buffer.from(Z.decompress(buffer));
  return buffer.toString('utf8');
};
function varint(b, i) { let v=0n,s=0n; for(let k=0;k<10 && i<b.length;k++){const x=b[i++];v|=BigInt(x&127)<<s;if(!(x&128))return [v,i];s+=7n;} throw new Error('Invalid group profile'); }
function fields(b) { const out=[];let i=0;while(i<b.length){const [tag,j]=varint(b,i);i=j;const f=Number(tag>>3n),wire=Number(tag&7n);if(wire===0){[,i]=varint(b,i);}else if(wire===1)i+=8;else if(wire===5)i+=4;else if(wire===2){const [n,start]=varint(b,i);i=start+Number(n);if(i>b.length)throw new Error('Truncated group profile');out.push([f,Buffer.from(b.subarray(start,i))]);}else throw new Error('Invalid group profile wire');}return out; }
const contact = new DatabaseSync(path.join(directory,'contact.db'), {readOnly:true});
const members = contact.prepare(`SELECT n.username,c.nick_name,c.small_head_url,c.big_head_url FROM chatroom_member m JOIN name2id n ON m.member_id=n.rowid LEFT JOIN contact c ON n.username=c.username WHERE m.room_id=(SELECT rowid FROM name2id WHERE username=?)`).all(config.groupId);
const room = contact.prepare('SELECT ext_buffer,owner FROM chat_room WHERE username=?').get(config.groupId);
const nicknames = new Map();
for(const [field,value] of fields(room.ext_buffer)) { if(field!==1)continue;const f=fields(value),id=f.find(x=>x[0]===1)?.[1].toString('utf8'),name=f.find(x=>x[0]===2)?.[1].toString('utf8');if(id&&name)nicknames.set(id,name); }
const contactUpdated = fs.statSync(path.join(directory,'contact.db')).mtime.toISOString();
contact.close();
const rows=[], dbFiles=[];
for(const file of fs.readdirSync(directory).filter(f=>/^message_\d+\.db$/.test(f))) {
  const db=new DatabaseSync(path.join(directory,file),{readOnly:true});
  if(db.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table',table)) {
    const query=db.prepare(`SELECT m.local_id,m.local_type,m.create_time,m.message_content,m.source,n.user_name FROM ${table} m LEFT JOIN Name2Id n ON m.real_sender_id=n.rowid ORDER BY m.create_time,m.local_id`);
    for(const r of query.all()) {const raw=decode(r.message_content),prefix=`${r.user_name}:\n`;rows.push({...r,source:decode(r.source),raw,text:raw.startsWith(prefix)?raw.slice(prefix.length):raw});}
    dbFiles.push({file,mtime:fs.statSync(path.join(directory,file)).mtime.toISOString()});
  }
  db.close();
}
if(!rows.length||!members.length)throw new Error('群成员或消息为空，停止导出');
rows.sort((a,b)=>a.create_time-b.create_time||a.local_id-b.local_id);
const memberIds=new Set(members.map(m=>m.username)), joins=new Map(), introductions=new Set(config.reviewedIntroductionIds);
for(const r of rows.filter(r=>r.local_type===10000)) {
  if(!r.raw.includes('加入')||!r.raw.includes('群聊'))continue;
  for(const link of r.raw.matchAll(/<link name="(?:adder|names)"[^>]*>([\s\S]*?)<\/link>/g))for(const member of link[1].matchAll(/<member>([\s\S]*?)<\/member>/g)){const id=xmlField(member[1],'username');if(id)joins.set(id,r.create_time);}
}
const people=members.map(m=>{
  const messages=rows.filter(r=>r.user_name===m.username&&r.local_type!==10000);
  const intro=messages.filter(r=>introductions.has(r.local_id)&&r.local_type===1).map(r=>({messageId:String(r.local_id),at:new Date(r.create_time*1000).toISOString(),text:redact(r.text)}));
  const groupNickname=nicknames.get(m.username)||'',name=groupNickname||m.nick_name||'未命名成员';
  return {id:publicId(m.username),name,nickname:m.nick_name||'',groupNickname,avatar:'',joinedAt:joins.has(m.username)?new Date(joins.get(m.username)*1000).toISOString():null,messageCount:messages.length,lastActiveAt:messages.length?new Date(messages.at(-1).create_time*1000).toISOString():null,introductions:intro,...profileDetails(intro,groupNickname)};
});
const byId=new Map(people.map(p=>[p.id,p])),edges=new Map();
function addInteraction(from,to,kind,reason,r) {
  if(!memberIds.has(from)||!memberIds.has(to)||from===to)return;
  const source=publicId(from),target=publicId(to),id=[source,target].sort().join(':');
  const edge=edges.get(id)||{id,source,target,kind,reason,evidence:[],count:0};edge.count++;
  if(kind==='collaboration'){edge.kind=kind;edge.reason=reason;}
  if(edge.evidence.length<3){const title=r.raw.includes('<appmsg')?xmlField(r.raw,'title'):r.text;edge.evidence.push({at:new Date(r.create_time*1000).toISOString(),speaker:byId.get(source).name,text:redact(title).slice(0,230),messageId:String(r.local_id)});}
  edges.set(id,edge);
}
for(const r of rows.filter(r=>r.local_type!==10000&&memberIds.has(r.user_name))) {
  const reference=r.raw.match(/<refermsg>([\s\S]*?)<\/refermsg>/)?.[1];
  if(reference)addInteraction(r.user_name,xmlField(reference,'chatusr'),'interaction','群内有引用回复；互动不代表已建立合作。',r);
  for(const id of xmlField(r.source,'atuserlist').split(',').filter(Boolean))addInteraction(r.user_name,id,'interaction','群内有 @ 提及；互动不代表已建立合作。',r);
}
for(const pair of config.collaborations){const from=rows.find(r=>r.local_id===pair.fromIntroductionId),to=rows.find(r=>r.local_id===pair.toIntroductionId);if(from&&to)addInteraction(from.user_name,to.user_name,'collaboration',pair.reason,from);}
const relations=[...edges.values(),...inferredEdges(people,[...edges.values()])];
const out=path.join(root,'public/data/network-atlas.json'),avatarDir=path.join(root,'public/images/network');
const write=process.argv.includes('--write'),avatars=process.argv.includes('--avatars');
let avatarSaved=0,avatarFailed=0;
if(write){fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(avatarDir,{recursive:true});}
if(write&&avatars){
  const sharp=require('sharp');
  for(const member of members){
    const id=publicId(member.username),file=path.join(avatarDir,`${id}.webp`),person=byId.get(id);
    if(fs.existsSync(file)){person.avatar=`/images/network/${id}.webp`;avatarSaved++;continue;}
    try {
      const url=new URL(member.small_head_url||member.big_head_url);
      if(!['wx.qlogo.cn','mmhead.c2c.wechat.com'].includes(url.hostname))throw new Error('Unexpected avatar host');
      url.protocol='https:';
      const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      if(Number(response.headers.get('content-length')||0)>2_000_000)throw new Error('Avatar too large');
      const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>2_000_000)throw new Error('Avatar too large');
      await sharp(buffer,{limitInputPixels:4_000_000}).resize(160,160,{fit:'cover',withoutEnlargement:true}).webp({quality:86}).toFile(file);
      person.avatar=`/images/network/${id}.webp`;avatarSaved++;
    }catch{avatarFailed++;}
  }
}else for(const person of people){if(fs.existsSync(path.join(avatarDir,`${person.id}.webp`)))person.avatar=`/images/network/${person.id}.webp`;}
const dataset={schemaVersion:1,title:config.title,generatedAt:new Date().toISOString(),contactUpdatedAt:contactUpdated,lastMessageAt:new Date(Math.max(...rows.map(r=>r.create_time))*1000).toISOString(),topics:TOPICS.map(({words,...t})=>t),people,edges:relations,notes:'成员资料来自群昵称和人工核对的自我介绍。潜在匹配与共同方向为关键词推荐，不代表合作事实。'};
if(write)fs.writeFileSync(out,JSON.stringify(dataset,null,2)+'\n');
console.log(JSON.stringify({written:write,members:people.length,withIntroductions:people.filter(p=>p.introductions.length).length,groupNicknames:people.filter(p=>p.groupNickname).length,edges:relations.length,avatarSaved,avatarFailed,bytes:Buffer.byteLength(JSON.stringify(dataset)),withoutIntroductions:people.filter(p=>!p.introductions.length).map(p=>p.name)},null,2));
