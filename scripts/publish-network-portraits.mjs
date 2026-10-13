import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePortrait, applyPortrait } from './network-portraits.mjs';
import { inferredEdges } from './network-atlas-lib.mjs';
import { taxonomyForGroup } from './network-taxonomies.mjs';
import { publicId } from './network-atlas-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dirArg=process.argv.indexOf('--input'),input=dirArg>=0?process.argv[dirArg+1]:'D:/cache/agent-tests/jianwen-portraits-20261013';
const groupArg=process.argv.indexOf('--group'),groupId=groupArg>=0?process.argv[groupArg+1]:null;
const write=process.argv.includes('--write');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/data/network-groups.json'),'utf8'));
const prepared=[];
if(groupId&&!catalog.groups.some(g=>g.id===groupId))throw new Error(`Unknown group: ${groupId}`);
for(const group of catalog.groups.filter(g=>!groupId||g.id===groupId)) {
  const file=path.join(root,'public'+group.path),data=JSON.parse(fs.readFileSync(file,'utf8')),taxonomy=taxonomyForGroup(group.id);
  const packs=fs.readFileSync(path.join(input,'evidence',`${group.id}.jsonl`),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const evidence=new Map(packs.map(p=>[p.id,p]));
  if(evidence.size!==packs.length||packs.length!==data.people.length||data.people.some(p=>!evidence.has(p.id)))throw new Error(`Evidence membership drift: ${group.id}`);
  const extraPath=path.join(input,'evidence-extra',`${group.id}.json`);
  if(fs.existsSync(extraPath)){
    const extra=JSON.parse(fs.readFileSync(extraPath,'utf8'));
    const wanted=new Map();
    for(const [id,value] of Object.entries(extra)){
      if(!evidence.has(id))throw new Error(`Unknown extra evidence member: ${id}`);
      for(const message of value.messages||[]){
        if(wanted.has(message.messageId))throw new Error(`Duplicate extra evidence: ${message.messageId}`);
        wanted.set(message.messageId,{id,at:message.at});
      }
    }
    // Reread the actual group source; never trust a model-provided author or text.
    const {sourceDirectory,readMessages}=await import('./network-atlas-source.mjs');
    const {extractOwnEvidence,isMeaningful}=await import('./network-portrait-evidence.mjs');
    const config=JSON.parse(fs.readFileSync(path.join(root,'scripts/network-atlas.config.json'),'utf8'));
    const sourceGroup=config.groups.find(g=>g.id===group.id);
    for(const row of readMessages(sourceDirectory(),sourceGroup.groupId)){
      const requested=wanted.get(row.key);if(!requested)continue;
      const at=new Date(row.create_time*1000).toISOString();
      const own=extractOwnEvidence(row);
      if(publicId(row.user_name||'')!==requested.id||at!==requested.at||at>data.lastMessageAt||own.kind!=='text'||!isMeaningful(own.text))throw new Error(`Invalid extra evidence ownership/date: ${row.key}`);
      const pack=evidence.get(requested.id);
      if(!pack.messages.some(m=>m.messageId===row.key))pack.messages.push({messageId:row.key,at,text:own.text,provenance:own.provenance||'authored-text'});
      pack.coverage.sampledMessages=pack.messages.length;
      wanted.delete(row.key);if(!wanted.size)break;
    }
    if(wanted.size)throw new Error(`Missing extra source messages: ${wanted.size}`);
  }
  const output=JSON.parse(fs.readFileSync(path.join(input,'portraits',`${group.id}.json`),'utf8'));
  if(output.version!==2||output.groupId!==group.id)throw new Error(`Wrong analysis group: ${group.id}`);
  const profiles=new Map();
  for(const p of output.people){
    if(profiles.has(p.id)||!evidence.has(p.id)||!data.people.some(x=>x.id===p.id))throw new Error(`Duplicate/unknown portrait: ${group.id}/${p.id}`);
    profiles.set(p.id,p);
  }
  const missing=packs.filter(p=>p.coverage.sampledMessages>0&&!profiles.has(p.id));
  if(missing.length)throw new Error(`Unread evidence in ${group.id}: ${missing.length} members (${missing.slice(0,5).map(p=>p.id).join(',')})`);
  data.people=data.people.map(person=>{
    const pack=evidence.get(person.id);
    if(pack.coverage.messageCount!==person.messageCount)throw new Error(`Message count drift: ${group.id}/${person.id}`);
    const portrait=normalizePortrait(profiles.get(person.id),pack,taxonomy,data.lastMessageAt);
    return applyPortrait({...person,portrait},taxonomy);
  });
  const facts=data.edges.filter(e=>e.kind==='interaction'||e.kind==='collaboration');
  data.edges=[...facts,...inferredEdges(data.people,facts,taxonomy)];
  data.portraitUpdatedAt=new Date().toISOString();
  delete data.speechUpdatedAt;
  prepared.push({file,data});
  console.log(JSON.stringify({group:group.id,reviewed:profiles.size,specific:data.people.filter(p=>p.portrait.status==='specific').length,limited:data.people.filter(p=>p.portrait.status==='limited').length,insufficient:data.people.filter(p=>p.portrait.status==='insufficient').length,written:write}));
}
// Validate all selected groups before changing any public dataset.
if(write)for(const {file,data} of prepared)fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
