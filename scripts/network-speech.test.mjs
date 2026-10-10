import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechCollector, applySpeechProfile } from './network-speech.mjs';
import { taxonomyForGroup } from './network-taxonomies.mjs';

const baseTime=Date.parse('2026-10-01T08:00:00Z')/1000;
const row=(text,index=0)=>({local_type:1,text,key:`test:${index}`,create_time:baseTime+index*86400});
const summarize=(texts,kind='fitness')=>{const c=createSpeechCollector(taxonomyForGroup(kind));texts.forEach((text,i)=>c.observe(row(text,i)));return c.finish();};

test('repeated discussions become qualified interests with counts and dates, without raw quotes',()=>{
  const speech=summarize(['卧推的动作需要控制离心','卧推时杠铃落点怎么选择','深蹲和卧推安排在哪一天','卧推的训练量需要慢慢加','卧推热身应该循序渐进']);
  assert.equal(speech.topics[0].id,'strength');assert.equal(speech.topics[0].confidence,'多次讨论');
  assert.equal(speech.topics[0].messageCount,5);assert.equal(speech.topics[0].dayCount,5);
  assert.match(speech.summary,/可能关注/);assert.ok(!JSON.stringify(speech).includes('控制离心'));
});

test('a lone general mention or repeated copies do not invent a profile',()=>{
  assert.equal(summarize(['今天有人讨论卧推的动作']),null);
  assert.equal(summarize(Array(8).fill('卧推的动作应该怎样调整')),null);
  assert.equal(summarize(['数据很好看啊','这些数据真的不少','还有什么数据呢'],'learning'),null);
});

test('first-person intentions are included but negations and other people are excluded',()=>{
  const speech=summarize(['我准备考研，想寻找学习搭子一起复习'],'learning');
  assert.deepEqual(speech.goals.map(g=>g.name),['考研 / 保研','学习搭子']);
  assert.equal(summarize(['我不想考研，也不想找学习搭子'],'learning'),null);
  assert.equal(summarize(['他准备考研，你是不是也考研呀'],'learning'),null);
});

test('quoted, forwarded, attachment and sensitive personal messages do not enter summaries',()=>{
  const c=createSpeechCollector(taxonomyForGroup('fitness'));
  c.observe({...row('我喜欢卧推和深蹲'),local_type:49});
  c.observe(row('> 我喜欢卧推和深蹲',1));
  c.observe(row('转发消息：我喜欢卧推和深蹲',2));
  c.observe(row('我确诊了某种疾病，想通过跑步改善',3));
  c.observe(row('我想咨询卧推，电话13812345678',4));
  assert.equal(c.finish(),null);
});

test('independent members have independent counters even for the same message keys',()=>{
  const a=createSpeechCollector(taxonomyForGroup('fitness')),b=createSpeechCollector(taxonomyForGroup('fitness'));
  const r=row('我喜欢卧推和深蹲，最近正在练');a.observe(r);b.observe(r);
  assert.deepEqual(a.finish(),b.finish());
});

test('speech enriches empty bios but preserves reviewed introductions and provenance',()=>{
  const taxonomy=taxonomyForGroup('fitness'),speech=summarize(['我准备增肌，最近正在练卧推']);
  const person={groupNickname:'',introductions:[],summary:'待补充',speech};
  const enriched=applySpeechProfile(person,taxonomy);
  assert.equal(enriched.profileSource,'speech');assert.match(enriched.summary,/^根据发言推测：/);
  assert.ok(enriched.goals.includes('增肌'));assert.deepEqual(enriched.offers,[]);
  const introduced=applySpeechProfile({...person,introductions:[{text:'我是跑步爱好者，喜欢马拉松'}]},taxonomy);
  assert.equal(introduced.profileSource,'introduction');assert.match(introduced.summary,/跑步爱好者/);
  assert.ok(introduced.topics.includes('running'));assert.ok(introduced.topics.includes('strength'));
  assert.equal(introduced.speech,speech);
});
