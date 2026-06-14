import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, Download, RefreshCw, Share2, X } from 'lucide-react';
import { generateCheckInBoostLine, type CheckInBoostLineSource } from '../../services/checkInBoostService';
import { getUserCheckInStats } from '../../services/checkInService';
import type { CheckIn, UserCheckInStats } from '../../services/checkInService';

interface CheckInShareModalProps {
  checkIn: CheckIn;
  onClose: () => void;
}

interface AchievementRow {
  label: string;
  value: string;
}

type PosterData = ReturnType<typeof buildPosterData>;

const POSTER_WIDTH = 900;
const POSTER_HEIGHT = 1440;
const SHARE_PATH = '/community';

const COLORS = {
  bg: '#07111f',
  bg2: '#0d1b2e',
  panel: '#13233b',
  panel2: '#172a45',
  text: '#f8fafc',
  muted: '#b7c5d8',
  dim: '#7c8ea7',
  cyan: '#22d3ee',
  cyanSoft: 'rgba(34, 211, 238, 0.18)',
  blue: '#3b82f6',
  fuchsia: '#d946ef',
  rose: '#fb7185',
  amber: '#fbbf24',
  green: '#34d399',
  border: 'rgba(148, 163, 184, 0.28)',
};

const CheckInShareModal: React.FC<CheckInShareModalProps> = ({ checkIn, onClose }) => {
  const [posterUrl, setPosterUrl] = useState('');
  const [isRendering, setIsRendering] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkInStats, setCheckInStats] = useState<UserCheckInStats | null>(null);
  const [boostLine, setBoostLine] = useState<string | null>(null);
  const [boostLineSource, setBoostLineSource] = useState<CheckInBoostLineSource | 'local'>('local');

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return SHARE_PATH;
    const url = new URL(SHARE_PATH, window.location.origin);
    url.searchParams.set('checkIn', checkIn.id);
    return url.toString();
  }, [checkIn.id]);

  const posterData = useMemo(() => buildPosterData(checkIn, checkInStats, boostLine), [checkIn, checkInStats, boostLine]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const renderPreview = async () => {
      setIsRendering(true);
      setPosterUrl('');
      setCheckInStats(null);
      setBoostLine(null);
      setBoostLineSource('local');

      const stats = await getUserCheckInStats(checkIn.user_id).catch((error) => {
        console.warn('打卡统计加载失败，将使用当前打卡生成分享图:', error);
        return null;
      });
      if (alive) setCheckInStats(stats);

      const generated = await requestCheckInBoostLine(checkIn, stats).catch((error) => {
        console.warn('AI 打气短句生成失败，将使用本地兜底文案:', error);
        return null;
      });
      if (alive) {
        setBoostLine(generated?.boostLine || null);
        setBoostLineSource(generated?.source || 'local');
      }

      const url = await renderPoster(checkIn, shareUrl, 'dataUrl', stats, generated?.boostLine || null);
      if (alive) setPosterUrl(url);
    };

    renderPreview()
      .catch((error) => {
        console.error('生成分享图预览失败:', error);
        if (alive) setPosterUrl('');
      })
      .finally(() => {
        if (alive) setIsRendering(false);
      });

    return () => {
      alive = false;
    };
  }, [checkIn, shareUrl]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const stats = checkInStats || (await getUserCheckInStats(checkIn.user_id).catch(() => null));
      let lineForPoster = boostLine;
      if (!lineForPoster) {
        const generated = await requestCheckInBoostLine(checkIn, stats).catch(() => null);
        lineForPoster = generated?.boostLine || null;
        if (generated) {
          setBoostLine(generated.boostLine);
          setBoostLineSource(generated.source);
        }
      }

      const blob = await renderPoster(checkIn, shareUrl, 'blob', stats, lineForPoster);
      downloadBlob(blob, createDownloadFileName(checkIn.created_at));
    } catch (error) {
      console.error('生成分享图失败:', error);
      alert('生成分享图失败，可能是图片跨域限制。请换一张图片或稍后重试。');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error('复制链接失败:', error);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/86 px-4 py-5 backdrop-blur-xl" onClick={onClose}>
      <div
        className="grid max-h-[94vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-cyan-200/10 bg-slate-950 pb-20 shadow-2xl shadow-black/60 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:pb-0"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 items-center justify-center overflow-y-auto border-b border-white/10 bg-slate-950 p-4 lg:border-b-0 lg:border-r sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.18),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.7),rgba(2,6,23,0.98))]" />

          <div className="relative w-full max-w-[390px]">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>真实 PNG 预览</span>
              <span>900 x 1440</span>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl shadow-cyan-950/30">
              <div className="relative aspect-[5/8]">
                {isRendering ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-200" />
                    <span className="text-sm">正在生成社区分享图...</span>
                  </div>
                ) : posterUrl ? (
                  <img src={posterUrl} alt="健文社区打卡分享图预览" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-950 px-8 text-center text-sm text-slate-400">
                    预览生成失败，请稍后重试
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto p-5 text-slate-100 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-cyan-200">健文社区 · 打卡分享图</p>
              <h2 className="mt-2 max-w-xl text-2xl font-black tracking-normal text-white">把今天的坚持做成一张有社区味道的战报</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                这张预览就是最终 PNG。内容会按纯文字、有图、多图、完成项自动重排，突出健身、学习和长期主义。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            <InfoRow label="社区识别" value="健文社区 / 马健文 / 枭马葛" />
            <InfoRow label="内容类型" value={posterData.images.length > 0 ? `${posterData.images.length} 张图文动态` : '纯文字动态'} />
            <InfoRow label="分享主题" value={posterData.themeLabel} />
            <InfoRow label="马哥打气" value={boostLineSource === 'deepseek' ? 'DeepSeek 实时生成' : isRendering && !boostLine ? '正在生成' : '固定句式兜底'} />
            <InfoRow label="正文处理" value={posterData.wasTrimmed ? '正文较长，已做海报级摘要' : '正文完整进入海报'} />
            <InfoRow label="平台累计" value={`${posterData.stats.totalCount} 次打卡 · 连续 ${posterData.stats.currentStreak} 天`} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="累计打卡" value={String(posterData.stats.totalCount)} />
            <MetricCard label="连续天数" value={String(posterData.stats.currentStreak)} />
            <MetricCard label="本月打卡" value={String(posterData.stats.monthCount)} />
          </div>

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isRendering || !posterUrl}
              aria-label="下载打卡分享图 PNG"
              className="neon-button inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? '生成中...' : '下载 PNG'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-slate-100 transition hover:bg-white/10"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? '已复制' : '复制打卡链接'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Share2 className="h-3.5 w-3.5" />
            <span>适合发微信群、朋友圈和小红书，二维码指向这条打卡。</span>
          </div>
        </aside>
      </div>

      <div
        className="fixed inset-x-4 bottom-4 z-[10000] rounded-2xl border border-cyan-200/20 bg-slate-950/92 p-2 shadow-2xl shadow-black/70 backdrop-blur-xl lg:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isRendering || !posterUrl}
            aria-label="下载打卡分享图 PNG"
            className="neon-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? '生成中...' : '下载 PNG'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="复制打卡链接"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-slate-500">{label}</span>
    <span className="text-right font-semibold text-slate-200">{value}</span>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-white">{value}</p>
  </div>
);

async function requestCheckInBoostLine(checkIn: CheckIn, stats: UserCheckInStats | null) {
  const seedData = buildPosterData(checkIn, stats);
  return generateCheckInBoostLine({
    content: checkIn.content?.trim() || '',
    achievements: seedData.achievements,
    themeLabel: seedData.themeLabel,
    completedCount: seedData.completedCount,
    stats: seedData.stats,
    nickname: seedData.nickname,
    groupName: seedData.groupName,
  });
}

function buildPosterData(checkIn: CheckIn, stats: UserCheckInStats | null = null, boostLineOverride?: string | null) {
  const content = checkIn.content?.trim() || '';
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const achievements = extractAchievements(lines);
  const narrativeRaw = content || lines.filter((line) => !isAchievementLine(line)).join('\n') || '今天也完成了一次认真打卡。';
  const hasImages = (checkIn.image_urls?.length || 0) > 0;
  const narrative = clampText(narrativeRaw, hasImages ? 520 : 680);
  const completedCount = achievements.filter((item) => /完成|已做|打卡|Done|done/i.test(item.value) && !/未完成|没完成/.test(item.value)).length;
  const themeLabel = inferTheme(content, achievements);
  const dateParts = formatPosterDateParts(checkIn.created_at);
  const heroMetric = completedCount > 0
    ? `${completedCount} 项完成`
    : achievements.length > 0
      ? `${achievements.length} 项记录`
      : hasImages
        ? '图文打卡'
        : '今日打卡';
  const fallbackBoostLine = buildBoostLine(content, achievements, themeLabel, completedCount);

  return {
    nickname: checkIn.profiles?.nickname || '社区伙伴',
    groupName: checkIn.profiles?.group_nickname || '健文社区成员',
    avatarUrl: checkIn.profiles?.avatar_url,
    dateText: formatDisplayDate(checkIn.created_at),
    dayText: dateParts.day,
    monthText: dateParts.month,
    timeText: dateParts.time,
    fileDate: formatFileDate(checkIn.created_at),
    images: checkIn.image_urls || [],
    achievements,
    narrative,
    boostLine: normalizePosterBoostLine(boostLineOverride) || fallbackBoostLine,
    heroMetric,
    completedCount,
    stats: stats || {
      totalCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      monthCount: 1,
    },
    themeLabel,
    wasTrimmed: narrativeRaw.length !== narrative.length,
  };
}

function extractAchievements(lines: string[]): AchievementRow[] {
  return lines
    .map((line) => {
      const match = line.match(/^(.{1,12}?)[：:]\s*(.+)$/);
      if (!match) return null;
      const label = match[1].replace(/\s+/g, '');
      const value = match[2].trim();
      if (!value) return null;
      return { label, value };
    })
    .filter((item): item is AchievementRow => Boolean(item))
    .slice(0, 6);
}

function isAchievementLine(line: string) {
  return /^.{1,12}?[：:]\s*.+$/.test(line);
}

function inferTheme(content: string, achievements: AchievementRow[]) {
  const text = `${content}\n${achievements.map((item) => `${item.label}${item.value}`).join('\n')}`.toLowerCase();
  if (/运动|训练|跑|腿|胸|背|肩|公里|健身|卧推|深蹲|引体|有氧|力量/.test(text)) return '健身成长';
  if (/单词|学习|读书|练字|英语|论文|课程|刷题|复习|背|写作/.test(text)) return '学习成长';
  if (/冥想|早睡|饮食|生活|情绪|习惯|自律/.test(text)) return '生活习惯';
  return '长期主义';
}

function buildBoostLine(content: string, achievements: AchievementRow[], themeLabel: string, completedCount: number) {
  const text = `${content}\n${achievements.map((item) => `${item.label}:${item.value}`).join('\n')}`;
  const doneText = completedCount > 0 ? `今天完成 ${completedCount} 项，` : '';

  if (/静静的顿河|读书|阅读|书/.test(text)) {
    return `${doneText}这不是鸡汤式坚持，是把阅读量变成可追踪的长期复利。`;
  }
  if (/单词|英语|背词|anki/i.test(text)) {
    return `${doneText}单词这种事别靠感觉，靠重复、反馈和下一次还能捡起来。`;
  }
  if (/练字|写字|字帖/.test(text)) {
    return `${doneText}练字的价值不在今天多漂亮，而在手感每天都被校准一次。`;
  }
  if (/深蹲|卧推|硬拉|引体|训练|力量|有氧|公里|跑/.test(text)) {
    return `${doneText}训练不要拼情绪，把动作、次数、恢复记录清楚，下次才知道怎么加码。`;
  }
  if (/饮食|睡眠|早睡|冥想|情绪|饮水/.test(text)) {
    return `${doneText}习惯不是喊口号，能被记录、复盘、调整，才会真的长在身上。`;
  }
  if (themeLabel === '学习成长') {
    return `${doneText}学习打卡的本质，是给明天的自己留一份可复用的反馈。`;
  }
  if (themeLabel === '健身成长') {
    return `${doneText}健身不是热血叙事，是训练量、恢复和执行力的长期校准。`;
  }
  return `${doneText}长期主义不是感动自己，是每天多交一份可以被验证的证据。`;
}

function normalizePosterBoostLine(value?: string | null) {
  if (!value) return '';
  return clampText(value.replace(/\s+/g, ' ').trim(), 72);
}

function clampText(text: string, maxLength: number) {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function formatPosterDateParts(dateStr: string) {
  const date = new Date(dateStr);
  const day = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    day: '2-digit',
  }).format(date);
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return { day, month, time };
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileDate(dateStr: string) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(dateStr));
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function createDownloadFileName(createdAt: string) {
  const checkInDate = formatFileDate(createdAt);
  const downloadedAt = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `jianwen-checkin-${checkInDate}-${downloadedAt}-${suffix}.png`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}

async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl', stats?: UserCheckInStats | null, boostLine?: string | null): Promise<string>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'blob', stats?: UserCheckInStats | null, boostLine?: string | null): Promise<Blob>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl' | 'blob', stats?: UserCheckInStats | null, boostLine?: string | null) {
  const data = buildPosterData(checkIn, stats || null, boostLine);
  const canvas = await renderPosterCanvas(data, shareUrl);

  if (output === 'dataUrl') return canvas.toDataURL('image/png');

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export poster.'));
    }, 'image/png', 0.95);
  });
}

async function renderPosterCanvas(data: PosterData, shareUrl: string) {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported.');

  const [avatarImage, qrUrl] = await Promise.all([
    data.avatarUrl ? loadImage(data.avatarUrl) : Promise.resolve(null),
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#111827', light: '#fffdf4' },
    }),
  ]);
  const [qrImage, ...images] = await Promise.all([
    loadImage(qrUrl),
    ...data.images.slice(0, 4).map(loadImage),
  ]);
  const validImages = images.filter((image): image is HTMLImageElement => Boolean(image));

  drawBackground(ctx, validImages[0] || null);
  drawBrandHeader(ctx, data);
  drawProfileStrip(ctx, data, avatarImage);

  const contentBottom = validImages.length > 0
    ? drawImageStory(ctx, data, validImages)
    : drawTextStory(ctx, data);

  drawStatsPanel(ctx, data, Math.min(contentBottom + 18, 1160));
  drawFooter(ctx, data, qrImage, shareUrl);

  return canvas;
}

function drawBackground(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null) {
  const gradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  gradient.addColorStop(0, '#0b1f2a');
  gradient.addColorStop(0.58, '#172033');
  gradient.addColorStop(1, '#221236');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  if (image) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.filter = 'blur(26px) saturate(1.18) brightness(0.72)';
    drawImageCover(ctx, image, -34, -34, POSTER_WIDTH + 68, POSTER_HEIGHT + 68);
    ctx.restore();

    const wash = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT);
    wash.addColorStop(0, 'rgba(2, 6, 23, 0.46)');
    wash.addColorStop(0.38, 'rgba(2, 6, 23, 0.18)');
    wash.addColorStop(0.74, 'rgba(2, 6, 23, 0.48)');
    wash.addColorStop(1, 'rgba(2, 6, 23, 0.82)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  }

  drawRadialGlow(ctx, 110, 92, 420, 'rgba(34, 211, 238, 0.18)');
  drawRadialGlow(ctx, 790, 160, 460, 'rgba(217, 70, 239, 0.18)');
  drawRadialGlow(ctx, 730, 1040, 520, 'rgba(59, 130, 246, 0.12)');

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 36; x < POSTER_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, POSTER_HEIGHT);
    ctx.stroke();
  }
  for (let y = 36; y < POSTER_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(POSTER_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(760, 260, 310, Math.PI * 0.86, Math.PI * 1.36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  const points = [
    [96, 214], [218, 78], [430, 138], [806, 392], [716, 564],
    [108, 808], [828, 822], [184, 1192], [682, 1274], [820, 1128],
  ];
  points.forEach(([x, y], index) => {
    ctx.globalAlpha = index % 3 === 0 ? 0.7 : 0.36;
    ctx.beginPath();
    ctx.arc(x, y, index % 3 === 0 ? 3.2 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRadialGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawBrandHeader(ctx: CanvasRenderingContext2D, data: PosterData) {
  ctx.fillStyle = COLORS.text;
  ctx.font = font(86, 500);
  ctx.fillText(data.dayText, 52, 132);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
  ctx.font = font(24, 500);
  ctx.fillText(data.monthText, 56, 174);

  ctx.fillStyle = COLORS.amber;
  ctx.font = font(15, 900);
  ctx.fillText('马哥打气', 52, 207);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
  ctx.font = font(28, 500);
  drawPosterTextLines(ctx, data.boostLine, 52, 238, 760, 38, 2);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
  ctx.font = font(22, 900);
  ctx.fillText('健文社区', 848, 76);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.56)';
  ctx.font = font(16, 800);
  ctx.fillText('SHOW UP, THEN ITERATE', 848, 106);
  ctx.restore();
}

function drawProfileStrip(ctx: CanvasRenderingContext2D, data: PosterData, avatarImage: HTMLImageElement | null) {
  const x = 52;
  const y = 282;
  const width = 796;
  const height = 74;
  drawRoundedRect(ctx, x, y, width, height, 22, 'rgba(15, 23, 42, 0.5)', 'rgba(248, 250, 252, 0.14)');
  drawCircleAvatar(ctx, avatarImage, data.nickname, x + 16, y + 13, 48);

  ctx.fillStyle = COLORS.text;
  ctx.font = font(24, 900);
  ctx.fillText(data.nickname, x + 78, y + 31);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(16, 700);
  ctx.fillText(`${data.groupName} · ${data.dateText} ${data.timeText}`, x + 78, y + 57);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.font = font(18, 900);
  ctx.fillText(data.themeLabel, x + width - 22, y + 32);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.5)';
  ctx.font = font(13, 700);
  ctx.fillText('今日主题', x + width - 22, y + 55);
  ctx.restore();
}

function drawImageStory(ctx: CanvasRenderingContext2D, data: PosterData, images: HTMLImageElement[]) {
  const x = 48;
  const y = 382;
  const width = 804;
  const mediaHeight = 500;
  const noteY = y + mediaHeight + 22;
  const noteHeight = 250;
  drawRoundedRect(ctx, x, y, width, mediaHeight, 28, 'rgba(2, 6, 23, 0.32)', 'rgba(248, 250, 252, 0.14)');

  ctx.save();
  roundedClip(ctx, x + 12, y + 12, width - 24, mediaHeight - 24, 22);
  drawAlbumBackdrop(ctx, x, y, width, mediaHeight);
  drawPhotoLayout(ctx, data, images, x + 20, y + 20, width - 40, mediaHeight - 40);
  ctx.restore();

  drawRoundedRect(ctx, x, noteY, width, noteHeight, 28, 'rgba(2, 6, 23, 0.56)', 'rgba(248, 250, 252, 0.16)');
  ctx.fillStyle = 'rgba(248, 250, 252, 0.56)';
  ctx.font = font(15, 900);
  ctx.fillText('TODAY RECORD', x + 30, noteY + 38);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(22, 800);
  drawPosterTextLines(ctx, data.narrative, x + 30, noteY + 74, width - 60, 28, 7);

  return noteY + noteHeight;
}

function drawTextStory(ctx: CanvasRenderingContext2D, data: PosterData) {
  const x = 48;
  const y = 382;
  const width = 804;
  const height = 738;
  drawRoundedRect(ctx, x, y, width, height, 34, 'rgba(15, 23, 42, 0.58)', 'rgba(248, 250, 252, 0.16)');

  ctx.fillStyle = 'rgba(248, 250, 252, 0.56)';
  ctx.font = font(16, 900);
  ctx.fillText('TODAY NOTE', x + 42, y + 60);

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.26)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 42, y + 86);
  ctx.lineTo(x + 42, y + height - 54);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = font(34, 800);
  drawPosterTextLines(ctx, data.narrative, x + 72, y + 126, width - 120, 48, 11);

  return y + height;
}

function drawPhotoLayout(
  ctx: CanvasRenderingContext2D,
  data: PosterData,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const count = Math.min(images.length, 4);
  if (count === 1) {
    drawSinglePhotoLayout(ctx, images[0], x, y, width, height);
    return;
  }
  if (count === 2) {
    drawTwoPhotoLayout(ctx, images.slice(0, 2), x, y, width, height);
    return;
  }
  if (count === 3) {
    drawThreePhotoLayout(ctx, images.slice(0, 3), x, y, width, height);
    return;
  }

  drawFourPhotoLayout(ctx, images.slice(0, 4), x, y, width, height);
  if (data.images.length > 4) {
    drawImageCountBadge(ctx, `+${data.images.length - 4}`, x + width - 158, y + height - 246);
  }
}

function drawSinglePhotoLayout(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const shape = getImageShape(image);
  if (shape === 'portrait') {
    drawAdaptivePhotoFrame(ctx, image, x + 170, y + 0, width - 340, height, 0, 28, true);
    return;
  }

  if (shape === 'wide') {
    drawAdaptivePhotoFrame(ctx, image, x + 0, y + 50, width, height - 100, 0, 28, true);
    return;
  }

  drawAdaptivePhotoFrame(ctx, image, x + 110, y + 0, width - 220, height, 0, 28, true);
}

function drawTwoPhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const shapes = images.map(getImageShape);
  const gap = 14;

  if (shapes.every((shape) => shape === 'wide')) {
    drawAdaptivePhotoFrame(ctx, images[0], x, y, width, (height - gap) / 2, 0, 22, true);
    drawAdaptivePhotoFrame(ctx, images[1], x, y + (height + gap) / 2, width, (height - gap) / 2, 0, 22, false);
    return;
  }

  if (shapes.every((shape) => shape === 'portrait')) {
    const tileWidth = (width - gap) / 2;
    drawAdaptivePhotoFrame(ctx, images[0], x, y, tileWidth, height, 0, 24, true);
    drawAdaptivePhotoFrame(ctx, images[1], x + tileWidth + gap, y, tileWidth, height, 0, 24, true);
    return;
  }

  const firstIsPortrait = shapes[0] === 'portrait';
  const mainWidth = firstIsPortrait ? Math.round(width * 0.42) : Math.round(width * 0.66);
  drawAdaptivePhotoFrame(ctx, images[0], x, y, mainWidth, height, 0, 26, true);
  drawAdaptivePhotoFrame(ctx, images[1], x + mainWidth + gap, y, width - mainWidth - gap, height, 0, 22, false);
}

function drawThreePhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const shapes = images.map(getImageShape);
  const gap = 14;

  if (shapes.every((shape) => shape === 'portrait')) {
    const tileWidth = (width - gap * 2) / 3;
    images.forEach((image, index) => {
      drawAdaptivePhotoFrame(ctx, image, x + index * (tileWidth + gap), y, tileWidth, height, 0, 22, index === 1);
    });
    return;
  }

  const hasPortrait = shapes.includes('portrait');
  const mainWidth = hasPortrait ? Math.round(width * 0.42) : Math.round(width * 0.62);
  const sideWidth = width - mainWidth - gap;
  const sideHeight = (height - gap) / 2;
  drawAdaptivePhotoFrame(ctx, images[0], x, y, mainWidth, height, 0, 26, true);
  drawAdaptivePhotoFrame(ctx, images[1], x + mainWidth + gap, y, sideWidth, sideHeight, 0, 20, false);
  drawAdaptivePhotoFrame(ctx, images[2], x + mainWidth + gap, y + sideHeight + gap, sideWidth, sideHeight, 0, 20, false);
}

function drawFourPhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const shapes = images.map(getImageShape);
  const gap = 14;
  const portraitIndexes = shapes
    .map((shape, index) => shape === 'portrait' ? index : -1)
    .filter((index) => index >= 0);

  if (portraitIndexes.length >= 2) {
    const portraitWidth = Math.round((width - gap * 3) * 0.26);
    const sideWidth = width - portraitWidth * 2 - gap * 3;
    const sideHeight = (height - gap) / 2;
    const ordered = [
      ...portraitIndexes.slice(0, 2),
      ...images.map((_, index) => index).filter((index) => !portraitIndexes.slice(0, 2).includes(index)),
    ].slice(0, 4);

    drawAdaptivePhotoFrame(ctx, images[ordered[0]], x, y, portraitWidth, height, 0, 20, false, false);
    drawAdaptivePhotoFrame(ctx, images[ordered[1]], x + portraitWidth + gap, y, portraitWidth, height, 0, 20, false, false);
    drawAdaptivePhotoFrame(ctx, images[ordered[2]], x + portraitWidth * 2 + gap * 2, y, sideWidth, sideHeight, 0, 20, false, false);
    drawAdaptivePhotoFrame(ctx, images[ordered[3]], x + portraitWidth * 2 + gap * 2, y + sideHeight + gap, sideWidth, sideHeight, 0, 20, false, false);
    return;
  }

  const tileWidth = (width - gap) / 2;
  const tileHeight = (height - gap) / 2;
  images.forEach((image, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawAdaptivePhotoFrame(ctx, image, x + col * (tileWidth + gap), y + row * (tileHeight + gap), tileWidth, tileHeight, 0, 20, false, false);
  });
}

function getImageShape(image: HTMLImageElement): 'portrait' | 'square' | 'wide' {
  const ratio = image.naturalWidth / image.naturalHeight;
  if (ratio < 0.78) return 'portrait';
  if (ratio > 1.45) return 'wide';
  return 'square';
}

function drawAdaptivePhotoFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  rotationDeg: number,
  radius: number,
  featured = false,
  frameFollowsImage = true,
) {
  const border = featured ? 10 : 8;
  if (!frameFollowsImage) {
    drawPhotoFrame(ctx, image, boxX, boxY, boxWidth, boxHeight, rotationDeg, radius, featured, true);
    return;
  }

  const imageRatio = Math.max(0.28, Math.min(3.6, image.naturalWidth / image.naturalHeight || 1));
  const maxImageWidth = Math.max(80, boxWidth - border * 2);
  const maxImageHeight = Math.max(80, boxHeight - border * 2);
  const boxRatio = maxImageWidth / maxImageHeight;

  let imageWidth = maxImageWidth;
  let imageHeight = imageWidth / imageRatio;
  if (imageRatio < boxRatio) {
    imageHeight = maxImageHeight;
    imageWidth = imageHeight * imageRatio;
  }

  const frameWidth = imageWidth + border * 2;
  const frameHeight = imageHeight + border * 2;
  const frameX = boxX + (boxWidth - frameWidth) / 2;
  const frameY = boxY + (boxHeight - frameHeight) / 2;
  drawPhotoFrame(ctx, image, frameX, frameY, frameWidth, frameHeight, rotationDeg, radius, featured, true);
}

function drawAlbumBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const albumGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  albumGradient.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
  albumGradient.addColorStop(0.5, 'rgba(17, 24, 39, 0.42)');
  albumGradient.addColorStop(1, 'rgba(8, 47, 73, 0.34)');
  drawRoundedRect(ctx, x + 16, y + 16, width - 32, height - 32, 26, albumGradient);

  ctx.save();
  roundedClip(ctx, x + 16, y + 16, width - 32, height - 32, 26);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.06)';
  ctx.lineWidth = 2;
  for (let lineY = y + 38; lineY < y + height - 26; lineY += 34) {
    ctx.beginPath();
    ctx.moveTo(x + 34, lineY);
    ctx.lineTo(x + width - 34, lineY + 26);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
  ctx.beginPath();
  ctx.arc(x + 804, y + 92, 112, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
  ctx.beginPath();
  ctx.arc(x + 198, y + 374, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

}

function drawPhotoFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  radius: number,
  featured = false,
  preserveFullImage = false,
) {
  const angle = rotationDeg * Math.PI / 180;
  const border = featured ? 10 : 8;
  const captionHeight = 0;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(angle);
  ctx.translate(-width / 2, -height / 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
  ctx.shadowBlur = featured ? 24 : 18;
  ctx.shadowOffsetY = featured ? 16 : 10;
  drawRoundedRect(ctx, 0, 0, width, height, radius, 'rgba(248, 250, 252, 0.9)');
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  drawRoundedRect(ctx, border, border, width - border * 2, height - border * 2 - captionHeight, Math.max(12, radius - 10), '#0f172a');

  ctx.save();
  roundedClip(ctx, border, border, width - border * 2, height - border * 2 - captionHeight, Math.max(12, radius - 10));
  if (preserveFullImage) {
    drawImageSoftContain(ctx, image, border, border, width - border * 2, height - border * 2 - captionHeight);
  } else {
    drawImageCover(ctx, image, border, border, width - border * 2, height - border * 2 - captionHeight);
  }
  drawPhotoVignette(ctx, border, border, width - border * 2, height - border * 2 - captionHeight);
  ctx.restore();

  ctx.restore();
}

function drawPhotoVignette(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, 'rgba(2, 6, 23, 0.06)');
  gradient.addColorStop(0.64, 'rgba(2, 6, 23, 0)');
  gradient.addColorStop(1, 'rgba(2, 6, 23, 0.34)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

function drawImageCountBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.36)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, x, y, 106, 64, 24, 'rgba(2, 6, 23, 0.78)', 'rgba(248, 250, 252, 0.2)');
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = COLORS.text;
  ctx.font = font(30, 900);
  ctx.textAlign = 'center';
  ctx.fillText(text, x + 53, y + 42);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawStatsPanel(ctx: CanvasRenderingContext2D, data: PosterData, y: number) {
  const x = 48;
  const width = 804;
  const height = 78;
  drawRoundedRect(ctx, x, y, width, height, 24, 'rgba(2, 6, 23, 0.5)', 'rgba(248, 250, 252, 0.14)');

  ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.font = font(22, 800);
  ctx.fillText(`我在「健文社区」累计打卡 ${data.stats.totalCount} 天`, x + 28, y + 34);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.font = font(18, 700);
  ctx.fillText(`当前连续 ${data.stats.currentStreak} 天 · 本月 ${data.stats.monthCount} 天 · 最长连续 ${data.stats.longestStreak} 天`, x + 28, y + 61);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.amber;
  ctx.font = font(21, 900);
  ctx.fillText(data.heroMetric, x + width - 28, y + 47);
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, data: PosterData, qrImage: HTMLImageElement | null, shareUrl: string) {
  const x = 36;
  const y = 1264;
  const width = 828;
  const height = 132;
  drawRoundedRect(ctx, x, y, width, height, 18, 'rgba(255, 252, 235, 0.92)', 'rgba(255, 255, 255, 0.28)');

  const iconGradient = ctx.createLinearGradient(x + 24, y + 28, x + 88, y + 92);
  iconGradient.addColorStop(0, '#34d399');
  iconGradient.addColorStop(1, '#22d3ee');
  drawRoundedRect(ctx, x + 24, y + 30, 64, 64, 13, iconGradient);
  ctx.save();
  ctx.translate(x + 56, y + 62);
  ctx.rotate(-0.22);
  drawRoundedRect(ctx, -10, -20, 20, 40, 4, '#fffdf4');
  ctx.restore();

  ctx.fillStyle = '#172033';
  ctx.font = font(30, 900);
  ctx.fillText('健文社区', x + 108, y + 55);
  ctx.fillStyle = 'rgba(23, 32, 51, 0.68)';
  ctx.font = font(16, 700);
  ctx.fillText('健身、学习和长期成长，都有人一起坚持', x + 108, y + 84);
  ctx.fillStyle = 'rgba(23, 32, 51, 0.46)';
  ctx.font = font(13, 700);
  ctx.fillText(`扫码进入社区广场 · ${data.fileDate}`, x + 108, y + 106);

  drawRoundedRect(ctx, x + width - 112, y + 20, 92, 92, 10, '#fffdf4', 'rgba(23, 32, 51, 0.08)');
  if (qrImage) {
    ctx.drawImage(qrImage, x + width - 104, y + 28, 76, 76);
  }

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.font = font(13, 700);
  ctx.fillText(clampCanvasText(ctx, shareUrl.replace(/^https?:\/\//, ''), 620), 852, y + height + 24);
  ctx.restore();
}

function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  avatarImage: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.clip();
  if (avatarImage) {
    drawImageCover(ctx, avatarImage, x, y, size, size);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, COLORS.cyan);
    gradient.addColorStop(1, COLORS.fuchsia);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(Math.round(size * 0.42), 900);
    ctx.textAlign = 'center';
    ctx.fillText(name.charAt(0).toUpperCase(), x + size / 2, y + size / 2 + size * 0.15);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageSoftContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.filter = 'blur(18px) saturate(1.08) brightness(0.82)';
  drawImageCover(ctx, image, x - 24, y - 24, width + 48, height + 48);
  ctx.restore();

  ctx.fillStyle = 'rgba(2, 6, 23, 0.26)';
  ctx.fillRect(x, y, width, height);

  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, drawX - 2, drawY - 2, drawWidth + 4, drawHeight + 4, 16, 'rgba(248, 250, 252, 0.08)');
  ctx.shadowColor = 'transparent';
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
}

function drawPosterTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const paragraphs = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lines: string[] = [];
  let overflow = false;

  for (const paragraph of paragraphs.length ? paragraphs : ['']) {
    let line = '';

    for (const char of Array.from(paragraph)) {
      const next = `${line}${char}`;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) {
          overflow = true;
          break;
        }
      } else {
        line = next;
      }
    }

    if (overflow) break;
    if (line) lines.push(line);
    if (lines.length >= maxLines) {
      overflow = paragraphs.indexOf(paragraph) < paragraphs.length - 1;
      break;
    }
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const suffix = index === maxLines - 1 && overflow ? '…' : '';
    ctx.fillText(clampCanvasText(ctx, `${line}${suffix}`, maxWidth), x, y + index * lineHeight);
  });
}

function clampCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}…`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function font(size: number, weight: number) {
  return `${weight} ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", Arial, sans-serif`;
}

export default CheckInShareModal;
