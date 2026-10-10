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
test('all published groups have reviewed sources, cached avatars and group-local relationships',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('./network-atlas.config.json',import.meta.url),'utf8'));
  const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/network-groups.json',import.meta.url),'utf8'));
  assert.equal(catalog.groups.length,config.groups.length);
  assert.equal(new Set(catalog.groups.map(g=>g.id)).size,catalog.groups.length);
  assert.ok(catalog.groups.some(g=>g.id===catalog.defaultGroup));
  for(const group of catalog.groups){
    const raw=fs.readFileSync(new URL('../public'+group.path,import.meta.url),'utf8'),data=JSON.parse(raw);
    const reviewed=new Set(config.groups.find(g=>g.id===group.id).reviewedIntroductionIds.map(id=>typeof id==='number'?`message_2.db:${id}`:id));
    assert.ok(!/wxid_[a-z\d]+|\d+@chatroom/i.test(raw));
    assert.equal(data.groupId,group.id);assert.equal(data.title,group.title);
    assert.equal(data.people.length,group.members);assert.equal(data.messageTotal,group.messages);
    assert.equal(data.people.filter(p=>p.introductions.length).length,group.introductions);
    assert.ok(data.firstMessageAt<=data.lastMessageAt);
    const ids=new Set(data.people.map(p=>p.id));assert.equal(ids.size,data.people.length);
    const pairs=new Set();
    for(const p of data.people){
      assert.ok(p.name);assert.ok(!/^(?:\d+,){5}/.test(p.name));assert.ok(p.messageCount>=0);
      for(const intro of p.introductions){assert.ok(reviewed.has(intro.messageId),`${group.id}: unreviewed source ${intro.messageId}`);assert.ok(intro.text);}
      if(p.avatar){assert.equal(p.avatar,`/images/network/${p.id}.webp`);assert.ok(fs.existsSync(new URL('../public'+p.avatar,import.meta.url)));}
      if(!p.introductions.length){assert.deepEqual(p.offers,[]);assert.deepEqual(p.needs,[]);assert.equal(p.stage,'待补充');}
    }
    for(const e of data.edges){assert.ok(ids.has(e.source)&&ids.has(e.target));assert.notEqual(e.source,e.target);assert.ok(!pairs.has(e.id));pairs.add(e.id);
      if(e.kind==='interaction'){assert.ok(e.count>0);assert.ok(e.firstAt<=e.lastAt);if(group.id!==config.defaultGroup)assert.deepEqual(e.evidence,[]);}
    }
  }
});

test('review excludes forwarded rules, joke biographies and sensitive health disclosures',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('./network-atlas.config.json',import.meta.url),'utf8'));
  for(const [group,id] of [['learning','message_2.db:2692'],['fitness','message_2.db:6479'],['fitness','message_2.db:1465'],['academy-2','message_2.db:5140']]){
    assert.ok(!config.groups.find(g=>g.id===group).reviewedIntroductionIds.includes(id));
  }
});
