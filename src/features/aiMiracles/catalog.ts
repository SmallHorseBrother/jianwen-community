export type MiracleLanguage = 'zh' | 'en';
export type MiracleView = 'all' | 'featured';

export interface MiracleEvent {
  id: string;
  date: string;
  approx?: boolean;
  domain: string;
  system?: string;
  title: Record<MiracleLanguage, string>;
  summary: Record<MiracleLanguage, string>;
  caveat?: Partial<Record<MiracleLanguage, string>>;
  links: Array<{ url: string; label?: string; kind?: string }>;
}

export const MIRACLES_SOURCE = 'https://github.com/tzhu40816-ai/ai-miriacles';
export const MIRACLES_REVISION = '9ab401cd6e657a0a30026a7cdc43ec34e18d3a8b';
export const MIRACLES_DATA_URL = '/data/ai-miracles/events.json';

export const miracleDomains: Record<string, Record<MiracleLanguage, string>> = {
  math: { zh: '数学', en: 'Mathematics' },
  games: { zh: '博弈', en: 'Games' },
  biology: { zh: '生物', en: 'Biology' },
  language: { zh: '感知与语言', en: 'Perception & language' },
  computing: { zh: '算法与软件', en: 'Algorithms & software' },
  medicine: { zh: '医学', en: 'Medicine' },
  physics: { zh: '物理', en: 'Physics' },
  robotics: { zh: '机器人与自主系统', en: 'Robotics & autonomy' },
  earth: { zh: '地球与气候', en: 'Earth & climate' },
  chemistry: { zh: '化学', en: 'Chemistry' },
  materials: { zh: '材料', en: 'Materials' },
  astronomy: { zh: '天文', en: 'Astronomy' },
  other: { zh: '其他', en: 'Other' },
};

// Reading recommendations only; the upstream records are kept intact.
export const featuredMiracleIds = new Set([
  '1956-logic-theorist', '1997-deep-blue', '2016-alphago',
  '2017-alphago-zero', '2020-alphafold2', '2022-alphafold-db',
  '2022-alphacode', '2023-graphcast', '2024-alphageometry',
  '2024-alphafold3', '2024-alphaproof-imo-silver', '2024-nobel-chemistry',
]);

export function selectMiracles(
  events: MiracleEvent[],
  { domain, query, view, oldest }: { domain: string; query: string; view: MiracleView; oldest: boolean },
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return events.filter((event) => {
    if (domain !== 'all' && event.domain !== domain) return false;
    if (view === 'featured' && !featuredMiracleIds.has(event.id)) return false;
    if (!words.length) return true;
    const text = [event.date, event.system, miracleDomains[event.domain]?.zh,
      miracleDomains[event.domain]?.en, event.title.zh, event.title.en,
      event.summary.zh, event.summary.en, event.caveat?.zh, event.caveat?.en]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  }).sort((a, b) => oldest ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}

export function formatMiracleDate(event: MiracleEvent, language: MiracleLanguage) {
  const [year, month, day] = event.date.split('-');
  const date = language === 'zh'
    ? `${year}年${month ? `${Number(month)}月` : ''}${day ? `${Number(day)}日` : ''}`
    : new Intl.DateTimeFormat('en', {
      year: 'numeric', month: month ? 'short' : undefined,
      day: day ? 'numeric' : undefined, timeZone: 'UTC',
    }).format(new Date(Date.UTC(Number(year), Number(month || 1) - 1, Number(day || 1))));
  return `${event.approx ? (language === 'zh' ? '约 ' : 'c. ') : ''}${date}`;
}
