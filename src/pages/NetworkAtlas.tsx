import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Download, GitBranch, Grid2X2, ListFilter, Search, Share2, Users, X } from 'lucide-react';
import NetworkGraph from '../features/network/NetworkGraph';
import Avatar from '../features/network/Avatar';
import { exportPeopleCsv, filterPeople, graphPeople, graphEdges } from '../features/network/model';
import type { EdgeKind, NetworkCatalog, NetworkData, NetworkGroup, NetworkPerson } from '../features/network/types';
import '../features/network/network.css';

const date = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '记录未包含';

export default function NetworkAtlas() {
  const [catalog,setCatalog]=useState<NetworkCatalog|null>(null),[error,setError]=useState('');
  const [params]=useSearchParams();
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/data/network-groups.json',{signal:controller.signal,cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('群列表暂时无法加载');return r.json();}).then((value:NetworkCatalog)=>{
      if(value.schemaVersion!==1||!value.groups?.length)throw new Error('群列表格式不正确');setCatalog(value);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[]);
  if(error)return <div className="network-page"><div className="network-error" role="alert"><p>{error}</p><button className="network-button" onClick={()=>window.location.reload()}>重新加载</button><Link to="/">返回社区</Link></div></div>;
  if(!catalog)return <div className="network-page"><div className="network-empty" role="status">正在加载群列表…</div></div>;
  const group=catalog.groups.find(g=>g.id===(params.get('group')||catalog.defaultGroup));
  if(!group)return <div className="network-page"><div className="network-error" role="alert"><p>没有找到这个群的星图。</p><Link className="network-button" to="/network">返回群列表</Link></div></div>;
  return <AtlasGroup key={group.id} group={group} groups={catalog.groups}/>;
}

function AtlasGroup({group,groups}:{group:NetworkGroup;groups:NetworkGroup[]}) {
  const [data,setData]=useState<NetworkData|null>(null),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[topic,setTopic]=useState(''),[needsOnly,setNeedsOnly]=useState(false),[stage,setStage]=useState('');
  const [activity,setActivity]=useState('');
  const [goal,setGoal]=useState('');
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:760px)').matches);
  const [view,setView]=useState<'graph'|'directory'>('graph'),[autoRotate,setAutoRotate]=useState(false),[showShared,setShowShared]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
  const [tab,setTab]=useState<'profile'|'connections'|'sources'>('profile'),[copied,setCopied]=useState(false),[shareError,setShareError]=useState('');
  const [params,setParams]=useSearchParams(),selectedId=params.get('person');
  const searchRef=useRef<HTMLInputElement>(null),closeRef=useRef<HTMLButtonElement>(null),copyTimer=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>{const media=window.matchMedia('(max-width:760px)'),update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{
    const controller=new AbortController(),previousTitle=document.title;document.title='人脉星图 · 健文社区';
    fetch(group.path,{signal:controller.signal,cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('成员资料暂时无法加载');return r.json();}).then((value:NetworkData)=>{
      if(value.schemaVersion!==1||!Array.isArray(value.people)||!Array.isArray(value.edges))throw new Error('成员数据格式不正确');setData(value);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>{controller.abort();document.title=previousTitle;if(copyTimer.current)clearTimeout(copyTimer.current);};
  },[group.path]);
  useEffect(()=>{const shortcut=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(target.tagName)){e.preventDefault();searchRef.current?.focus();}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[]);
  const select=(id:string|null)=>{const next=new URLSearchParams(params);if(id)next.set('person',id);else next.delete('person');setParams(next,{replace:true});setCopied(false);setShareError('');};
  useEffect(()=>{if(selectedId)closeRef.current?.focus();},[selectedId]);
  useEffect(()=>{if(!selectedId)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){const next=new URLSearchParams(params);next.delete('person');setParams(next,{replace:true});}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[selectedId,params,setParams]);
  const people=useMemo(()=>data?filterPeople(data.people,query,topic,needsOnly,stage,goal).filter(p=>!activity||(activity==='introduced'?p.introductions.length>0:activity==='spoken'?p.messageCount>0:p.messageCount===0)):[],[data,query,topic,needsOnly,stage,goal,activity]);
  const plottedPeople=useMemo(()=>graphPeople(people,data?.edges||[],selectedId,compact?70:140),[people,data,selectedId,compact]);
  const visibleEdges=useMemo(()=>{const ids=new Set(plottedPeople.map(p=>p.id));return graphEdges(data?.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&(showShared||e.kind!=='shared'))||[],selectedId,compact?180:350);},[plottedPeople,data,showShared,selectedId,compact]);
  const selected=data?.people.find(p=>p.id===selectedId);
  const related=data?.edges.filter(e=>e.source===selectedId||e.target===selectedId)||[];
  const classification=data?.classification;
  const entrepreneurship=classification?.kind==='entrepreneurship';
  const relationLabels: Record<EdgeKind,string> = {collaboration:'合作自述',interaction:'群内互动',match:classification?.matchLabel||'潜在供需匹配',shared:classification?.sharedLabel||'共同方向'};
  const goalText=(person:NetworkPerson)=>entrepreneurship?person.stage:person.goals?.join('、')||'目标待补充';
  const clearFilters=()=>{setQuery('');setTopic('');setNeedsOnly(false);setStage('');setGoal('');setActivity('');};
  const hasFilters=!!(query||topic||needsOnly||stage||goal||activity);
  const exportDirectory=()=>{const blob=new Blob([exportPeopleCsv(people,classification?.goalLabel)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${group.title}-当前名录.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const share=async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);copyTimer.current=setTimeout(()=>setCopied(false),2200);}catch{setShareError('可复制浏览器地址栏中的名片链接。');}};

  return <div className="network-page">
    <header className="network-header">
      <Link to="/" className="network-back" aria-label="返回健文社区"><ArrowLeft size={18}/><span>健文社区</span></Link>
      <div className="network-brand"><GitBranch size={24}/><div><strong>人脉星图</strong><span>PEOPLE & POSSIBILITIES</span></div></div>
      <button className="network-button network-export" onClick={exportDirectory} disabled={!data}><Download size={16}/><span>导出当前名录</span></button>
    </header>
    <div className="network-group-bar"><label htmlFor="network-group">切换群聊</label><select id="network-group" aria-label="切换群聊" value={group.id} onChange={e=>setParams({group:e.target.value})}>{([['learning','学习交流'],['fitness','健身交流'],['entrepreneurship','创业交流']] as const).map(([kind,label])=><optgroup key={kind} label={label}>{groups.filter(g=>g.kind===kind).map(g=><option key={g.id} value={g.id}>{g.title} · {g.members}人</option>)}</optgroup>)}</select><span>{groups.length} 个群 · 资料按群独立整理</span></div>
    {error ? <div className="network-error" role="alert"><h1>暂时没有连上星图</h1><p>{error}</p><button className="network-button" onClick={()=>window.location.reload()}>重新加载</button></div> : !data ? <div className="network-empty" role="status">正在整理星图中的伙伴…</div> : <div className="network-workspace">
      <aside className={`network-sidebar ${filtersOpen?'is-open':''}`} aria-label="筛选成员">
        <div className="network-sidebar-title"><span>探索圈层</span><button aria-label="关闭筛选" onClick={()=>setFiltersOpen(false)}><X size={18}/></button></div>
        <label className="network-search"><Search size={17}/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="姓名、方向、资源…" aria-label="搜索成员"/><span>/</span></label>
        <p className="network-section-label">{classification?.topicLabel}</p>
        <div className="network-topics">
          <button className={!topic?'is-active':''} onClick={()=>setTopic('')}><span className="network-dot" style={{background:'#68ddc3'}}/>全部主题<span>{data.people.length}</span></button>
          {data.topics.map(t=><button key={t.id} className={topic===t.id?'is-active':''} onClick={()=>setTopic(topic===t.id?'':t.id)} aria-pressed={topic===t.id}><span className="network-dot" style={{background:t.color}}/>{t.name}<span>{data.people.filter(p=>p.topics.includes(t.id)||p.topic===t.id).length}</span></button>)}
        </div>
        <div className="network-filters">
          <label><input type="checkbox" checked={needsOnly} onChange={e=>setNeedsOnly(e.target.checked)}/>只看有兴趣 / 需求的成员</label>
          {entrepreneurship?<select value={stage} onChange={e=>setStage(e.target.value)} aria-label="项目阶段"><option value="">全部项目阶段</option>{['项目推进','正在实践','探索交流','待补充'].map(s=><option key={s}>{s}</option>)}</select>:<select value={goal} onChange={e=>setGoal(e.target.value)} aria-label={classification?.goalLabel}><option value="">全部{classification?.goalLabel}</option>{[...(classification?.goals||[]),'待补充'].map(s=><option key={s}>{s}</option>)}</select>}
          <select value={activity} onChange={e=>setActivity(e.target.value)} aria-label="成员资料"><option value="">全部成员资料</option><option value="introduced">有自我介绍</option><option value="spoken">有可见发言</option><option value="silent">暂无可见发言</option></select>
          {hasFilters&&<button className="network-text-button" onClick={clearFilters}>清除全部筛选</button>}
        </div>
        <div className="network-legend"><p className="network-section-label">连线意味着什么</p><span><i/>{entrepreneurship?'合作自述 / 群内互动':'群内互动'}</span>{entrepreneurship&&<span><i className="is-match"/>{relationLabels.match}</span>}<span><i className="is-shared"/>{relationLabels.shared} · 有待了解</span><p>分类依据群昵称与核对后的自我介绍；目标仅取自自我介绍。共同兴趣不代表已结伴。</p></div>
        <div className="network-snapshot">资料更新 {date(data.generatedAt)}<br/>{data.messageTotal?.toLocaleString('zh-CN')} 条可见消息<br/>{date(data.firstMessageAt||null)} 至 {date(data.lastMessageAt)}<br/>仅代表本机可见记录，不是完整群历史。</div>
      </aside>
      <main className="network-main">
        <section className="network-heading"><div><p className="network-eyebrow">{classification?.label} · {classification?.eyebrow}</p><h1>{data.title}</h1><p className="network-heading-description">{classification?.description}</p></div>
          <div className="network-view-switch" aria-label="显示方式"><button aria-pressed={view==='graph'} onClick={()=>setView('graph')}><GitBranch size={16}/>星图</button><button aria-pressed={view==='directory'} onClick={()=>setView('directory')}><Grid2X2 size={16}/>名录</button></div>
        </section>
        <div className="network-toolbar"><div className="network-count"><Users size={15}/><strong>{people.length}</strong>位伙伴<span>·</span>{data.people.filter(p=>p.introductions.length).length}份自我介绍</div>
          <div className="network-toolbar-actions"><button className="network-button network-mobile-filter" onClick={()=>setFiltersOpen(!filtersOpen)}><ListFilter size={15}/>筛选{hasFilters?' · 已启用':''}</button>{view==='graph'&&<><label><input type="checkbox" checked={autoRotate} onChange={e=>setAutoRotate(e.target.checked)}/>自动旋转</label><label><input type="checkbox" checked={showShared} onChange={e=>setShowShared(e.target.checked)}/>共同方向</label></>}</div>
        </div>
        {view==='graph'&&people.length>plottedPeople.length&&<div className="network-graph-limit">当前呈现 {plottedPeople.length} / {people.length} 位，优先展示已选成员、关联成员及有介绍或发言的伙伴。<button onClick={()=>setView('directory')}>查看完整名录</button></div>}
        {view==='graph' ? <NetworkGraph people={plottedPeople} edges={visibleEdges} topics={data.topics} selectedId={selectedId} onSelect={select} autoRotate={autoRotate}/> : <div className="network-directory">
          {people.map(person=><button className="network-person-card" key={person.id} onClick={()=>select(person.id)}>
            <div className="network-card-top"><Avatar person={person}/><div><h2>{person.name}</h2><span>{data.topics.find(t=>t.id===person.topic)?.name}</span></div><ArrowUpRight size={18}/></div>
            <p>{person.summary}</p><div className="network-tags">{person.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</div><span className="network-card-footer">{goalText(person)}{person.needs.length>0?' · 有交流需求':''}</span>
          </button>)}
          {!people.length&&<div className="network-empty"><p>没有找到匹配的伙伴</p><button className="network-button" onClick={clearFilters}>清除筛选</button></div>}
        </div>}
        {selected&&<aside className="network-detail" role="dialog" aria-modal="false" aria-labelledby="network-person-title">
          <div className="network-detail-top"><span>成员名片</span><button ref={closeRef} aria-label="关闭名片" onClick={()=>select(null)}><X size={21}/></button></div>
          <div className="network-detail-scroll"><div className="network-person-hero"><Avatar key={selected.id} person={selected} size={76}/><h2 id="network-person-title">{selected.name}</h2><p>{data.topics.find(t=>t.id===selected.topic)?.name}</p><div className="network-tags">{selected.tags.map(t=><span key={t}>{t}</span>)}</div></div>
            <div className="network-detail-tabs" role="tablist" aria-label="名片内容">{([['profile','介绍'],['connections',`关联 ${related.length}`],['sources','自我介绍']] as const).map(([key,title])=><button role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}>{title}</button>)}</div>
            <div className="network-detail-body" role="tabpanel">
              {tab==='profile'&&<>
                <h3>背景与当前方向</h3><p className="network-bio">{selected.summary}</p>
                <dl className="network-facts"><dt>所在群</dt><dd>{group.title}</dd><dt>{classification?.goalLabel}</dt><dd>{goalText(selected)}</dd><dt>群昵称</dt><dd>{selected.groupNickname||'未设置'}</dd><dt>微信昵称</dt><dd>{selected.nickname}</dd><dt>入群记录</dt><dd>{date(selected.joinedAt)}</dd><dt>可见发言</dt><dd>{selected.messageCount.toLocaleString('zh-CN')} 条</dd><dt>最近发言</dt><dd>{date(selected.lastActiveAt)}</dd></dl>
                <ProfileSection title={classification?.offersLabel||'正在做 / 能提供'} lines={selected.offers} empty="自述中暂未明确列出，可在群内进一步了解。"/>
                <ProfileSection title={classification?.needsLabel||'兴趣 / 正在寻找'} lines={selected.needs} empty="还没有整理到具体需求。"/>
                <p className="network-source-note">根据群昵称与成员自述辅助归类，不代表认证的专业或训练水平，以本人最新介绍为准。</p>
              </>}
              {tab==='connections'&&<>{related.length?related.map(edge=>{const other=data.people.find(p=>p.id===(edge.source===selected.id?edge.target:edge.source)) as NetworkPerson;return <article className={`network-relation is-${edge.kind}`} key={edge.id}>
                <button onClick={()=>select(other.id)}><Avatar person={other} size={32}/><strong>{other.name}</strong><ArrowUpRight size={15}/></button><span className="network-relation-kind">{relationLabels[edge.kind]}</span><p>{edge.reason}</p>
                {edge.evidence.length>0&&<details><summary>查看互动依据{edge.count?` · ${edge.count}次`:''}</summary>{edge.evidence.map((source,i)=><blockquote key={`${source.messageId}-${i}`}><span>{source.speaker} · {date(source.at)}</span>{source.text}</blockquote>)}</details>}
                {!edge.evidence.length&&edge.kind==='interaction'&&<p className="network-source-note">{edge.count} 次引用 / 提及 · 最近 {date(edge.lastAt||null)}<br/>为保护群聊隐私，不展示聊天正文。</p>}
              </article>}):<p className="network-source-note">暂时没有整理到关联记录，欢迎通过群聊互相认识。</p>}</>}
              {tab==='sources'&&<><p className="network-source-note">以下为已核对的成员原话；涉及联系方式的部分已隐藏。</p>{selected.introductions.length?selected.introductions.map(intro=><article className="network-intro" key={intro.messageId}><time>{date(intro.at)}</time><p>{intro.text}</p></article>):<p>目前没有整理到自我介绍。</p>}</>}
            </div>
          </div>
          <div className="network-detail-footer"><span>通过原微信群联系本人</span><button className="network-button" onClick={()=>void share()}>{copied?<Check size={15}/>:<Share2 size={15}/>} {copied?'已复制':'复制名片链接'}</button>{shareError&&<p role="status">{shareError}</p>}</div>
        </aside>}
        {selectedId&&!selected&&data&&<div className="network-invalid-link" role="status">这位成员不在当前名录中。<button onClick={()=>select(null)}>返回星图</button></div>}
      </main>
    </div>}
  </div>;
}

function ProfileSection({title,lines,empty}:{title:string;lines:string[];empty:string}) {
  return <section className="network-profile-section"><h3>{title}</h3>{lines.length?<ul>{lines.map((line,i)=><li key={i}>{line}</li>)}</ul>:<p className="network-source-note">{empty}</p>}</section>;
}
