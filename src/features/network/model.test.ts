import { describe, expect, it } from 'vitest';
import { exportPeopleCsv, filterPeople, graphPeople, graphEdges } from './model';
import type { NetworkPerson } from './types';

const base:NetworkPerson={id:'a',name:'甲',nickname:'原名',groupNickname:'甲',avatar:'',joinedAt:null,lastActiveAt:null,messageCount:1,topic:'hardware',topics:['hardware','ai'],tags:['机器人'],summary:'机器人硬件开发',offers:['提供电路开发'],needs:['寻找算法伙伴'],stage:'正在实践',introductions:[]};
describe('network directory',()=>{
  it('filters and exports domain goals without leaking project stages into learning',()=>{
    const learner={...base,goals:['考研 / 保研','学习搭子']};
    expect(filterPeople([learner,base],'','',false,'','学习搭子')).toEqual([learner]);
    expect(filterPeople([learner,base],'','',false,'','待补充')).toEqual([base]);
    expect(filterPeople([learner],'学习搭子','',false,'')).toEqual([learner]);
    const csv=exportPeopleCsv([learner],'学习目标');
    expect(csv).toContain('学习目标');expect(csv).toContain('考研 / 保研');expect(csv).not.toContain('正在实践');
  });
  it('combines name/resource search, secondary topics, needs and stage',()=>{
    expect(filterPeople([base],'电路 算法','ai',true,'正在实践')).toHaveLength(1);
    expect(filterPeople([base],'不存在','',false,'')).toHaveLength(0);
    expect(filterPeople([{...base,needs:[]}],'','',true,'')).toHaveLength(0);
  });
  it('escapes CSV delimiters and formula injection without exporting account IDs',()=>{
    const csv=exportPeopleCsv([{...base,name:'=HYPERLINK("test")'}]);
    expect(csv).toContain('"\'=HYPERLINK(""test"")"');expect(csv).toContain('\uFEFF');expect(csv).not.toContain('wxid_');
  });
  it('bounds large graphs but preserves selection and does not mutate the full directory',()=>{
    const people=Array.from({length:348},(_,i)=>({...base,id:String(i),messageCount:i}));
    const edges=[{id:'0:1',source:'0',target:'1',kind:'interaction' as const,reason:'引用',evidence:[]}];
    const visible=graphPeople(people,edges,'0');
    expect(visible).toHaveLength(140);expect(visible[0].id).toBe('0');expect(visible[1].id).toBe('1');
    expect(people).toHaveLength(348);expect(people[0].id).toBe('0');
    expect(filterPeople(people,'','',false,'')).toHaveLength(348);
    expect(graphPeople(people.slice(0,5),[],'0')).toHaveLength(5);
  });
  it('prioritizes selected-member connections when bounding graph lines',()=>{
    const edges=Array.from({length:500},(_,i)=>({id:String(i),source:String(i),target:'end',kind:'interaction' as const,count:i,reason:'引用',evidence:[]}));
    const visible=graphEdges(edges,'0');expect(visible).toHaveLength(350);expect(visible[0].source).toBe('0');expect(edges[0].source).toBe('0');
  });
  it('searches concrete portrait details and exports their attribution without old keyword guesses',()=>{
    const p:NetworkPerson={...base,summary:'负重引体训练',offers:[],needs:[],goals:[],portrait:{version:2,status:'specific',summary:'负重引体训练',sections:[{kind:'practice',title:'具体安排',text:'海豹划船作为辅助动作',confidence:'self_reported',references:[{messageId:'test:1',at:'2026-10-01T00:00:00Z'}]}],badges:[],topicIds:[],goals:[],sourceEnd:'2026-10-10T00:00:00Z',coverage:{messageCount:1,textCount:1,meaningfulTextCount:1,sampledMessages:1,imageCount:0,stickerCount:0,voiceCount:0,otherCount:0}},speech:{version:1,summary:'增肌减脂',topics:[],goals:[],analyzedMessages:1,firstAt:'',lastAt:''}};
    expect(filterPeople([p],'海豹划船','',false,'')).toEqual([p]);
    expect(filterPeople([p],'增肌减脂','',false,'')).toEqual([]);
    const csv=exportPeopleCsv([p]);expect(csv).toContain('具体安排（本人表达）');expect(csv).not.toContain('增肌减脂');
  });
});
