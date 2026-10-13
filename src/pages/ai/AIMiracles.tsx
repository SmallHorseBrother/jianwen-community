import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, BookOpen, ExternalLink, Search } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import AILayout from './AILayout';
import {
  formatMiracleDate, miracleDomains, MIRACLES_DATA_URL, MIRACLES_REVISION,
  MIRACLES_SOURCE, selectMiracles, type MiracleEvent, type MiracleLanguage,
} from '../../features/aiMiracles/catalog';
import '../../features/aiMiracles/miracles.css';

const sourceKinds: Record<string, { zh: string; en: string }> = {
  paper: { zh: '论文', en: 'Paper' }, official: { zh: '官方', en: 'Official' },
  news: { zh: '报道', en: 'News' }, reference: { zh: '资料', en: 'Reference' },
};

const AIMiracles = () => {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const [events, setEvents] = useState<MiracleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const scrolledHash = useRef('');
  const language: MiracleLanguage = params.get('lang') === 'en' ? 'en' : 'zh';
  const domainParam = params.get('domain') || 'all';
  const domain = Object.prototype.hasOwnProperty.call(miracleDomains, domainParam) ? domainParam : 'all';
  const query = params.get('q') || '';
  const view = params.get('view') === 'featured' ? 'featured' : 'all';
  const oldest = params.get('sort') === 'oldest';
  const chinese = language === 'zh';

  const update = (key: string, value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void fetch(MIRACLES_DATA_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load the catalog');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid catalog');
        setEvents(data as MiracleEvent[]);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = chinese ? 'AI 创造的奇迹 · 健文社区' : 'Miracles Made by AI · Jianwen Community';
    return () => { document.title = previousTitle; };
  }, [chinese]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const event of events) result[event.domain] = (result[event.domain] || 0) + 1;
    return result;
  }, [events]);
  const visibleEvents = useMemo(() => selectMiracles(events, { domain, query, view, oldest }),
    [events, domain, query, view, oldest]);

  useEffect(() => {
    if (!hash || loading || scrolledHash.current === hash) return;
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target) { target.scrollIntoView({ block: 'start' }); scrolledHash.current = hash; }
  }, [hash, loading, visibleEvents]);

  return <AILayout>
    <div className="miracles-page" lang={chinese ? 'zh-CN' : 'en'}>
      <header className="miracles-heading">
        <div><span className="miracles-kicker"><BookOpen size={19} aria-hidden="true" />{chinese ? '从真实问题认识 AI' : 'Understand AI through real problems'}</span>
          <h1>{chinese ? 'AI 创造的奇迹' : 'Miracles Made by AI'}</h1>
          <p>{chinese ? '从寻找一道题的证明，到参与解决人类尚未解决的问题。' : 'From searching for a proof, to helping solve problems no human had solved.'}</p>
        </div>
        <div className="miracles-language" role="group" aria-label="内容语言 / Content language">
          <button type="button" aria-pressed={chinese} onClick={() => update('lang', '')}>中文</button>
          <button type="button" aria-pressed={!chinese} onClick={() => update('lang', 'en')}>English</button>
        </div>
      </header>

      <div className="miracles-intro">
        <p>{chinese ? '按时间收录 AI 实际解决或推进的具体问题。每条附原始来源，并保留研究边界；内容按来源说法整理，未经本站独立核验。' : 'A chronological record of concrete problems AI has solved or advanced. Each entry links to its sources and preserves research limits; this site does not independently verify claims.'}</p>
        <a href={MIRACLES_SOURCE} target="_blank" rel="noopener noreferrer">{chinese ? '开源共创项目' : 'Open-source project'}<ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>

      <section className="miracles-controls" aria-label={chinese ? '筛选案例' : 'Filter entries'}>
        <div className="miracles-search-row">
          <label className="miracles-search"><Search size={22} aria-hidden="true" />
            <span className="sr-only">{chinese ? '搜索案例' : 'Search entries'}</span>
            <input type="search" value={query} placeholder={chinese ? '搜索问题、系统或关键词…' : 'Search problems, systems, keywords…'} onChange={(event) => update('q', event.target.value)} />
          </label>
          <button type="button" className="miracles-sort" onClick={() => update('sort', oldest ? '' : 'oldest')}><ArrowDownUp size={18} aria-hidden="true" />{chinese ? (oldest ? '最早优先' : '最新优先') : (oldest ? 'Oldest first' : 'Newest first')}</button>
        </div>
        <div className="miracles-browse-row">
          <div className="miracles-views" role="group" aria-label={chinese ? '阅读方式' : 'Reading mode'}>
            <button type="button" aria-pressed={view === 'all'} onClick={() => update('view', '')}>{chinese ? '完整时间线' : 'Full timeline'}</button>
            <button type="button" aria-pressed={view === 'featured'} onClick={() => update('view', 'featured')}>{chinese ? '入门精选' : 'Reading picks'}</button>
          </div>
          <span className="miracles-count" role="status" aria-live="polite">{!loading && !error && (chinese ? `显示 ${visibleEvents.length} / ${events.length} 条` : `${visibleEvents.length} / ${events.length} entries`)}</span>
        </div>
        <div className="miracles-domains" role="group" aria-label={chinese ? '领域分类' : 'Fields'}>
          <button type="button" aria-pressed={domain === 'all'} onClick={() => update('domain', '')}>{chinese ? '全部领域' : 'All fields'}<span>{events.length}</span></button>
          {Object.entries(miracleDomains).filter(([key]) => counts[key]).map(([key, label]) => <button type="button" key={key} aria-pressed={domain === key} onClick={() => update('domain', key)}>{label[language]}<span>{counts[key]}</span></button>)}
        </div>
      </section>

      {loading ? <div className="miracles-message" role="status">{chinese ? '正在读取案例…' : 'Loading entries…'}</div> : error ? <div className="miracles-message" role="alert"><p>{chinese ? '案例暂时无法加载，请重试。' : 'Could not load entries. Please try again.'}</p><button type="button" className="jw-action secondary" onClick={() => setRetry((value) => value + 1)}>{chinese ? '重新加载' : 'Retry'}</button></div> : !visibleEvents.length ? <div className="miracles-message"><h2>{chinese ? '没有符合条件的案例' : 'No matching entries'}</h2><p>{chinese ? '试试其他关键词，或清除筛选。' : 'Try another keyword or clear the filters.'}</p><button type="button" className="jw-action secondary" onClick={() => setParams(language === 'en' ? { lang: 'en' } : {}, { replace: true })}>{chinese ? '查看全部案例' : 'Show all entries'}</button></div> : <ol className="miracles-timeline">
        {visibleEvents.map((event, index) => {
          const year = event.date.slice(0, 4);
          const startsYear = index === 0 || visibleEvents[index - 1].date.slice(0, 4) !== year;
          return <li key={event.id} id={event.id} className={`miracles-event${startsYear ? ' starts-year' : ''}`}>
            <div className="miracles-date"><span className="miracles-year">{startsYear ? year : ''}</span><time dateTime={event.date}>{formatMiracleDate(event, language)}</time></div>
            <article className="miracles-event-content">
              <span className="miracles-domain-label">{miracleDomains[event.domain]?.[language] || event.domain}</span>
              <h2><a href={`#${event.id}`} aria-label={chinese ? `${event.title.zh}，案例链接` : `${event.title.en}, entry link`}>{event.title[language]}</a></h2>
              <p className="miracles-summary">{event.summary[language]}</p>
              {event.caveat?.[language] && <p className="miracles-caveat"><strong>{chinese ? '研究边界' : 'Research limits'}</strong>{event.caveat[language]}</p>}
              {event.system && <p className="miracles-system">{event.system}</p>}
              <div className="miracles-sources">{event.links.filter((link) => /^https?:\/\//.test(link.url)).map((link, linkIndex) => <a key={`${link.url}-${linkIndex}`} href={link.url} target="_blank" rel="noopener noreferrer"><span>{sourceKinds[link.kind || 'reference']?.[language] || (chinese ? '来源' : 'Source')}</span>{link.label || new URL(link.url).hostname}<ExternalLink size={14} aria-hidden="true" /></a>)}</div>
            </article>
          </li>;
        })}
      </ol>}

      <footer className="miracles-attribution">
        <p>{chinese ? '内容来源：' : 'Content: '}<a href={MIRACLES_SOURCE} target="_blank" rel="noopener noreferrer">AI创造的奇迹 · tzhu40816-ai</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
        <p>{chinese ? '保留原始案例数据，健文社区适配页面与导航，并添加阅读精选。' : 'Original event data preserved; Jianwen Community adapted the presentation and added reading picks.'}{' '}<a href={`${MIRACLES_SOURCE}/tree/${MIRACLES_REVISION}`} target="_blank" rel="noopener noreferrer">{chinese ? '来源版本' : 'Source version'}</a>{' · '}<a href={`${MIRACLES_SOURCE}/issues/new`} target="_blank" rel="noopener noreferrer">{chinese ? '提交线索或纠错' : 'Suggest an entry or correction'}</a></p>
      </footer>
    </div>
  </AILayout>;
};

export default AIMiracles;
