import type { NetworkEdge, NetworkPerson } from './types';

export function filterPeople(people: NetworkPerson[], query: string, topic: string, needsOnly: boolean, stage: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return people.filter(person => {
    const searchable = [person.name, person.nickname, person.summary, ...person.tags, ...person.offers, ...person.needs].join(' ').toLocaleLowerCase();
    return (!topic || person.topics.includes(topic) || person.topic === topic)
      && (!needsOnly || person.needs.length > 0)
      && (!stage || person.stage === stage)
      && words.every(word => searchable.includes(word));
  });
}

export function exportPeopleCsv(people: NetworkPerson[]) {
  const cell = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
  return '\uFEFF' + [
    ['群昵称 / 名称', '微信昵称', '方向', '阶段', '简介', '资源与实践', '兴趣与需求', '入群时间', '消息数'],
    ...people.map(p => [p.name,p.nickname,p.tags.join('、'),p.stage,p.summary,p.offers.join('；'),p.needs.join('；'),p.joinedAt || '',p.messageCount]),
  ].map(row => row.map(cell).join(',')).join('\r\n');
}

// Bound DOM/WebGL work without dropping anyone from search, the directory, or exports.
export function graphPeople(people: NetworkPerson[], edges: NetworkEdge[], selectedId: string | null, limit = 140) {
  if (people.length <= limit) return people;
  const neighbors = new Set(edges.filter(e => e.source === selectedId || e.target === selectedId).flatMap(e => [e.source,e.target]));
  return [...people].sort((a,b) => Number(b.id === selectedId)-Number(a.id === selectedId)
    || Number(neighbors.has(b.id))-Number(neighbors.has(a.id))
    || Number(b.introductions.length>0)-Number(a.introductions.length>0)
    || b.messageCount-a.messageCount || a.id.localeCompare(b.id)).slice(0,limit);
}

export function graphEdges(edges: NetworkEdge[], selectedId: string | null, limit = 350) {
  return [...edges].sort((a,b) => Number(b.source===selectedId||b.target===selectedId)-Number(a.source===selectedId||a.target===selectedId)
    || Number(b.kind==='collaboration')-Number(a.kind==='collaboration') || (b.count||0)-(a.count||0) || a.id.localeCompare(b.id)).slice(0,limit);
}
