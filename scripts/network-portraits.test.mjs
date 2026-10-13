import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePortrait,applyPortrait} from './network-portraits.mjs';
import {applySpeechProfile} from './network-speech.mjs';
import {extractOwnEvidence} from './network-portrait-evidence.mjs';
import {taxonomyForGroup} from './network-taxonomies.mjs';

const taxonomy=taxonomyForGroup('fitness');
const at='2026-10-01T10:00:00.000Z';
const evidence={id:'a',messages:[{messageId:'message_0.db:10',at,text:'我的负重引体卡在后半程'}],introductions:[],coverage:{messageCount:68,textCount:59,replyCount:7,sampledMessages:1,meaningfulTextCount:1,imageCount:0,stickerCount:9,voiceCount:0}};
const result={status:'specific',summary:'想解决负重引体后半程卡点。',sections:[{kind:'needs',title:'引体后半程问题',text:'询问负重引体下巴过杠的练习。',confidence:'self_reported',references:[{messageId:'message_0.db:10',at}]}],badges:['引体后半程'],topicIds:['calisthenics'],goals:[]};
const person={id:'a',groupNickname:'',introductions:[],summary:'待补充',speech:{summary:'我想增肌',topics:[{id:'strength',keywords:['卧推']}],goals:[{name:'增肌'}]}};

test('portrait references must belong to the actual member evidence and exact date',()=>{
 assert.equal(normalizePortrait(result,evidence,taxonomy,at).sections.length,1);
 const copy=structuredClone(result);copy.sections[0].references[0].messageId='message_0.db:11';
 assert.throws(()=>normalizePortrait(copy,evidence,taxonomy,at),/another member or unread/);
 copy.sections[0].references[0]={messageId:'message_0.db:10',at:'2026-10-02T10:00:00.000Z'};
 assert.throws(()=>normalizePortrait(copy,evidence,taxonomy,at),/another member or unread/);
 assert.throws(()=>normalizePortrait({...result,goals:['考研 / 保研']},evidence,taxonomy,at),/Invalid goal/);
 assert.throws(()=>normalizePortrait({...result,sections:[]},evidence,taxonomy,at),/Empty specific/);
});
test('semantic goals and detailed biography replace keyword guesses and survive reclassification',()=>{
 const portrait=normalizePortrait(result,evidence,taxonomy,at);
 const enriched=applyPortrait({...person,portrait},taxonomy);
 assert.equal(enriched.summary,result.summary);assert.deepEqual(enriched.goals,[]);
 assert.equal(enriched.needs[0],result.sections[0].text);
 const refreshed=applySpeechProfile(enriched,taxonomy);
 assert.equal(refreshed.summary,result.summary);assert.deepEqual(refreshed.goals,[]);
});
test('insufficient evidence reports actual message composition, without double counting quote replies',()=>{
 const portrait=normalizePortrait(null,evidence,taxonomy,at);
 const p=applyPortrait({...person,portrait},taxonomy);
 assert.match(p.summary,/68 条消息.*52 条纯文字、7 条引用回复、9 条表情/);
 assert.ok(!p.summary.includes('增肌'));assert.deepEqual(p.offers,[]);assert.deepEqual(p.needs,[]);
});
test('quote reply uses the author title, not someone else’s introduction',()=>{
 const row={local_type:49,raw:'<appmsg><title>这个后半程怎么练？</title><type>57</type><refermsg><type>1</type><chatusr>another_user</chatusr><content>我负重40kg能拉两个</content></refermsg></appmsg>'};
 const own=extractOwnEvidence(row);
 assert.equal(own.text,'这个后半程怎么练？');assert.equal(own.provenance,'authored-reply');
 assert.equal(own.context.text,'我负重40kg能拉两个');
 assert.ok(!own.text.includes('40kg'));
});
test('an insufficient portrait preserves reviewed introduction resources and goals',()=>{
 const learning=taxonomyForGroup('learning');
 const p=applyPortrait({...person,introductions:[{text:'准备考研，寻找学习搭子，提供学习资料'}],portrait:normalizePortrait(null,evidence,learning,at)},learning);
 assert.ok(p.goals.includes('考研 / 保研'));assert.ok(p.goals.includes('学习搭子'));
 assert.equal(p.profileSource,'introduction');assert.ok(!Object.hasOwn(p,'speech'));
});
