import fs from 'node:fs';
import { sourceDirectory, readMembers, readMessages } from './network-atlas-source.mjs';
import { redact } from './network-atlas-lib.mjs';

const config=JSON.parse(fs.readFileSync(new URL('./network-atlas.config.json',import.meta.url),'utf8'));
const directory=sourceDirectory();
// Candidate discovery is read-only. It never automatically publishes a candidate.
const early=process.argv.includes('--early'),requested=process.argv.slice(2).filter(a=>!a.startsWith('--'));
for(const group of config.groups.filter(g=>g.id!=='entrepreneurs'&&(!requested.length||requested.includes(g.id)))) {
  const members=new Map(readMembers(directory,group.groupId).map(m=>[m.username,m]));
  const seen=new Set(),textCounts=new Map(),reviewed=new Set(group.reviewedIntroductionIds);let count=0,candidates=0;
  for(const r of readMessages(directory,group.groupId)) {
    count++;
    if(r.local_type!==1||!members.has(r.user_name))continue;
    textCounts.set(r.user_name,(textCounts.get(r.user_name)||0)+1);
    if(reviewed.has(r.key)||r.text.length<(early?30:45)||r.text.length>2800)continue;
    if(early){if(textCounts.get(r.user_name)>8||!/我(?:是|叫|目前|来自)|本人|专业|希望.{0,15}(?:交流|进步|学习)|主要练/.test(r.text))continue;}
    else if(!/自我介绍|个人介绍|大家好[，,！!\s\S]{0,40}我(?:是|叫|来自)|【姓名】|【职业】|姓名[：:]|昵称[：:].*(?:专业|职业)/.test(r.text))continue;
    if(seen.has(r.text))continue;seen.add(r.text);candidates++;
    const member=members.get(r.user_name);
    console.log(JSON.stringify({group:group.id,key:r.key,name:member.groupNickname||member.nick_name,at:new Date(r.create_time*1000).toISOString(),text:redact(r.text)}));
  }
  console.log(JSON.stringify({group:group.id,members:members.size,messages:count,candidates}));
}
