import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, inferredEdges, profileDetails, publicId, redact, xmlField } from './network-atlas-lib.mjs';
import { taxonomyForGroup } from './network-taxonomies.mjs';

test('group-specific categories separate learning, exercise and entrepreneurship',()=>{
  const learning=taxonomyForGroup('learning'),fitness=taxonomyForGroup('fitness');
  assert.equal(classify('计算机专业，学习编程', '', learning).topic,'computing');
  assert.equal(classify('力量举，卧推深蹲硬拉', '', fitness).topic,'strength');
  assert.equal(classify('街健，双力臂和前水平', '', fitness).topic,'calisthenics');
  assert.equal(classify('计算机博士', '', fitness).topic,'other');
  assert.equal(classify('mail', '', learning).topic,'other');
  assert.equal(taxonomyForGroup('academy-2').kind,'learning');
  assert.equal(taxonomyForGroup('fitness-3').kind,'fitness');
  assert.throws(()=>taxonomyForGroup('unknown'));
});

test('goals come from introductions, not degree or nickname guesses',()=>{
  const learning=taxonomyForGroup('learning'),fitness=taxonomyForGroup('fitness');
  assert.deepEqual(profileDetails([], '考研增肌', learning).goals,[]);
  assert.deepEqual(profileDetails([{text:'我是计算机博士'}], '', learning).goals,[]);
  assert.deepEqual(profileDetails([{text:'准备考研，寻找学习搭子'}], '', learning).goals,['考研 / 保研','学习搭子']);
  assert.deepEqual(profileDetails([{text:'目标是增肌，寻找训练搭子'}], '', fitness).goals,['增肌','寻找训练搭子']);
  const a={id:'a',name:'甲',offers:['分享卧推深蹲'],needs:[],tags:['卧推','深蹲']};
  const b={id:'b',name:'乙',offers:[],needs:['想交流卧推深蹲'],tags:['卧推','深蹲']};
  const edges=inferredEdges([a,b],[],fitness);
  assert.equal(edges[0].kind,'shared');assert.match(edges[0].reason,/不代表已结伴/);
});

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
    const taxonomy=taxonomyForGroup(group.id);
    assert.equal(data.classification.kind,taxonomy.kind);
    assert.deepEqual(data.classification.goals,taxonomy.goals.map(g=>g.name));
    if(taxonomy.topics)assert.deepEqual(data.topics.map(t=>t.id),taxonomy.topics.map(t=>t.id));
    assert.equal(data.people.length,group.members);assert.equal(data.messageTotal,group.messages);
    assert.equal(data.people.filter(p=>p.introductions.length).length,group.introductions);
    assert.ok(data.firstMessageAt<=data.lastMessageAt);
    const ids=new Set(data.people.map(p=>p.id));assert.equal(ids.size,data.people.length);
    const pairs=new Set();
    for(const p of data.people){
      assert.ok(p.name);assert.ok(!/^(?:\d+,){5}/.test(p.name));assert.ok(p.messageCount>=0);
      assert.ok(data.topics.some(t=>t.id===p.topic));
      assert.ok(p.goals.every(g=>data.classification.goals.includes(g)));
      if(p.speech){
        assert.equal(p.speech.version,1);assert.ok(p.speech.analyzedMessages>0&&p.speech.analyzedMessages<=p.messageCount);
        assert.ok(p.speech.firstAt<=p.speech.lastAt);assert.ok(p.speech.lastAt<=data.lastMessageAt);
        assert.ok(p.speech.topics.length||p.speech.goals.length);
        for(const t of p.speech.topics){assert.ok(data.topics.some(x=>x.id===t.id));assert.ok(t.messageCount>0&&t.messageCount<=p.speech.analyzedMessages);assert.ok(t.dayCount>0&&t.dayCount<=t.messageCount);}
        for(const g of p.speech.goals)assert.ok(data.classification.goals.includes(g.name));
        if(!p.introductions.length&&!p.portrait){assert.equal(p.profileSource,'speech');assert.match(p.summary,/^根据发言推测：/);}
      }
      for(const intro of p.introductions){assert.ok(reviewed.has(intro.messageId),`${group.id}: unreviewed source ${intro.messageId}`);assert.ok(intro.text);}
      if(p.avatar){assert.equal(p.avatar,`/images/network/${p.id}.webp`);assert.ok(fs.existsSync(new URL('../public'+p.avatar,import.meta.url)));}
      if(!p.introductions.length){if(!p.portrait){assert.deepEqual(p.offers,[]);assert.deepEqual(p.needs,[]);}assert.equal(p.stage,'待补充');}
      if(p.portrait){
        assert.equal(p.portrait.version,2);assert.ok(p.portrait.coverage.messageCount<=p.messageCount);
        if(p.portrait.sourceEnd===data.lastMessageAt)assert.equal(p.portrait.coverage.messageCount,p.messageCount);
        const c=p.portrait.coverage;assert.equal(c.textCount+c.imageCount+c.stickerCount+c.voiceCount+c.videoCount+c.linkCount+c.otherCount,c.messageCount);
        assert.ok((c.replyCount||0)<=c.textCount);assert.ok(p.portrait.sourceEnd<=data.lastMessageAt);
        assert.ok(p.portrait.sections.every(s=>s.references.length&&s.references.every(r=>r.at<=p.portrait.sourceEnd)));
        if(p.portrait.status!=='insufficient')assert.deepEqual(p.goals,p.portrait.goals);
        if(p.portrait.status!=='insufficient')assert.equal(p.summary,p.portrait.summary);
      }
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
