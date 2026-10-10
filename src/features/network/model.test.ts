import { describe, expect, it } from 'vitest';
import { exportPeopleCsv, filterPeople, graphPeople, graphEdges } from './model';
import type { NetworkPerson } from './types';

const base:NetworkPerson={id:'a',name:'甲',nickname:'原名',groupNickname:'甲',avatar:'',joinedAt:null,lastActiveAt:null,messageCount:1,topic:'hardware',topics:['hardware','ai'],tags:['机器人'],summary:'机器人硬件开发',offers:['提供电路开发'],needs:['寻找算法伙伴'],stage:'正在实践',introductions:[]};
describe('network directory',()=>{
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
});
