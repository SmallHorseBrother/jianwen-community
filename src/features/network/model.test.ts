import { describe, expect, it } from 'vitest';
import { exportPeopleCsv, filterPeople } from './model';
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
});
