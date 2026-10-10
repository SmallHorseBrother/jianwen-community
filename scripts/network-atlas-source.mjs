import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { xmlField } from './network-atlas-lib.mjs';

const require = createRequire(import.meta.url);
const { decompress } = require(path.join(process.env.CIPHERTALK_ROOT || 'D:/files/CipherTalk', 'node_modules/fzstd'));
export function sourceDirectory() {
  const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.ciphertalk/cli-config.json'), 'utf8'));
  const account = fs.readdirSync(cli.dataDir).find(n => n === cli.myWxid || n.startsWith(`${cli.myWxid}_`));
  if (!account) throw new Error('CipherTalk 数据目录中未找到当前账号');
  return path.join(cli.dataDir, account);
}
function decode(value) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  let buffer = Buffer.from(value);
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0xfd2fb528) buffer = Buffer.from(decompress(buffer));
  return buffer.toString('utf8');
}
function varint(b, i) {
  let value=0n,shift=0n;
  for (let k=0;k<10 && i<b.length;k++) { const x=b[i++];value|=BigInt(x&127)<<shift;if(!(x&128))return [value,i];shift+=7n; }
  throw new Error('Invalid group profile');
}
function fields(b) {
  const result=[];let i=0;
  while(i<b.length) {
    const [tag,j]=varint(b,i);i=j;const field=Number(tag>>3n),wire=Number(tag&7n);
    if(wire===0){[,i]=varint(b,i);}else if(wire===1)i+=8;else if(wire===5)i+=4;
    else if(wire===2){const [n,start]=varint(b,i);i=start+Number(n);if(i>b.length)throw new Error('Truncated group profile');result.push([field,Buffer.from(b.subarray(start,i))]);}
    else throw new Error('Invalid group profile wire');
  }
  return result;
}
export function readMembers(directory, groupId) {
  const db=new DatabaseSync(path.join(directory,'contact.db'),{readOnly:true});
  try {
    const members=db.prepare(`SELECT n.username,c.nick_name,c.small_head_url,c.big_head_url FROM chatroom_member m JOIN name2id n ON m.member_id=n.rowid LEFT JOIN contact c ON n.username=c.username WHERE m.room_id=(SELECT rowid FROM name2id WHERE username=?)`).all(groupId);
    const room=db.prepare('SELECT ext_buffer FROM chat_room WHERE username=?').get(groupId),nicknames=new Map();
    if(room?.ext_buffer)for(const [field,value] of fields(room.ext_buffer)){if(field!==1)continue;const f=fields(value),id=f.find(x=>x[0]===1)?.[1].toString('utf8'),name=f.find(x=>x[0]===2)?.[1].toString('utf8');if(id&&name)nicknames.set(id,name);}
    return members.map(m=>({...m,groupNickname:nicknames.get(m.username)||''}));
  } finally {db.close();}
}
// Iterate one row at a time: even the largest groups never accumulate raw history in memory.
export function* readMessages(directory, groupId) {
  const table=`Msg_${createHash('md5').update(groupId).digest('hex')}`;
  for(const file of fs.readdirSync(directory).filter(f=>/^message_\d+\.db$/.test(f)).sort()) {
    const db=new DatabaseSync(path.join(directory,file),{readOnly:true});
    try {
      if(!db.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table',table))continue;
      const query=db.prepare(`SELECT m.local_id,CAST(m.server_id AS TEXT) AS server_id,m.local_type,m.create_time,m.message_content,m.source,n.user_name FROM ${table} m LEFT JOIN Name2Id n ON m.real_sender_id=n.rowid WHERE m.local_id>? ORDER BY m.local_id LIMIT 1000`);
      let cursor=-1;
      while(true) {
        const batch=query.all(cursor);if(!batch.length)break;
        for(const r of batch) {
          const raw=decode(r.message_content),prefix=`${r.user_name}:\n`;
          yield {...r,key:`${file}:${r.local_id}`,source:decode(r.source),raw,text:raw.startsWith(prefix)?raw.slice(prefix.length):raw};
        }
        cursor=batch.at(-1).local_id;
      }
    } finally {db.close();}
  }
}
export function joinedMembers(raw) {
  const result=[];
  if(!raw.includes('加入')||!raw.includes('群聊'))return result;
  for(const link of raw.matchAll(/<link name="(?:adder|names)"[^>]*>([\s\S]*?)<\/link>/g))for(const member of link[1].matchAll(/<member>([\s\S]*?)<\/member>/g)){const id=xmlField(member[1],'username');if(id)result.push(id);}
  return result;
}
