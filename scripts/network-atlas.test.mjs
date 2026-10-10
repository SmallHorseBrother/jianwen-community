import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, inferredEdges, profileDetails, publicId, redact, xmlField } from './network-atlas-lib.mjs';

test('member identifiers are stable without exposing WeChat accounts',()=>{
  assert.equal(publicId('wxid_test'),publicId('wxid_test'));
  assert.match(publicId('wxid_test'),/^[a-f0-9]{16}$/);
  assert.notEqual(publicId('wxid_test'),publicId('wxid_other'));
});
test('source text is decoded and contact details are redacted',()=>{
  assert.equal(xmlField('<title><![CDATA[你好 &amp; hello]]></title>','title'),'你好 & hello');
  const value=redact('微信号：private_name 电话：13812345678 wxid_private123');
  assert.ok(!value.includes('private_name')&&!value.includes('13812345678')&&!value.includes('wxid_'));
});
test('missing introductions do not invent professional claims',()=>{
  const profile=profileDetails([], '瑜-跨境电商');
  assert.equal(profile.topic,'commerce');assert.deepEqual(profile.offers,[]);assert.deepEqual(profile.needs,[]);assert.equal(profile.stage,'待补充');
  assert.equal(classify('硬件工程师，机器人传感器电路').topic,'hardware');
});
test('potential matches remain labeled as recommendations and do not duplicate facts',()=>{
  const a={id:'a',name:'甲',offers:['提供机器人硬件开发'],needs:[],tags:['机器人','硬件']};
  const b={id:'b',name:'乙',offers:[],needs:['正在寻找硬件工程师做机器人'],tags:['机器人','硬件']};
  const edges=inferredEdges([a,b],[]);assert.equal(edges.length,1);assert.equal(edges[0].kind,'match');assert.deepEqual(edges[0].evidence,[]);
  assert.deepEqual(inferredEdges([a,b],[{source:'a',target:'b'}]),[]);
});
test('published snapshot has real sources, valid avatars and no dangling relationships',()=>{
  const raw=fs.readFileSync(new URL('../public/data/network-atlas.json',import.meta.url),'utf8'),data=JSON.parse(raw);
  const reviewed=new Set(JSON.parse(fs.readFileSync(new URL('./network-atlas.config.json',import.meta.url),'utf8')).reviewedIntroductionIds);
  assert.ok(!/wxid_[a-z\d]+/i.test(raw));
  const ids=new Set(data.people.map(p=>p.id));assert.equal(ids.size,data.people.length);
  const pairs=new Set();
  for(const p of data.people){assert.ok(p.name);assert.ok(!/^(?:\d+,){5}/.test(p.name));for(const intro of p.introductions)assert.ok(reviewed.has(Number(intro.messageId)));if(p.avatar){assert.ok(p.avatar.startsWith('/images/network/'));assert.ok(fs.existsSync(new URL('../public'+p.avatar,import.meta.url)));}}
  for(const e of data.edges){assert.ok(ids.has(e.source)&&ids.has(e.target));assert.notEqual(e.source,e.target);assert.ok(!pairs.has(e.id));pairs.add(e.id);if(['interaction','collaboration'].includes(e.kind))assert.ok(e.evidence.length);}
});
