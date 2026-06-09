import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, Download, RefreshCw, Share2, X } from 'lucide-react';
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

const POSTER_WIDTH = 1080;
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

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return SHARE_PATH;
    const url = new URL(SHARE_PATH, window.location.origin);
    url.searchParams.set('checkIn', checkIn.id);
    return url.toString();
  }, [checkIn.id]);

  const posterData = useMemo(() => buildPosterData(checkIn, checkInStats), [checkIn, checkInStats]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    setIsRendering(true);
    getUserCheckInStats(checkIn.user_id)
      .catch((error) => {
        console.warn('打卡统计加载失败，将使用当前打卡生成分享图:', error);
        return null;
      })
      .then((stats) => {
        if (alive) setCheckInStats(stats);
        return renderPoster(checkIn, shareUrl, 'dataUrl', stats);
      })
      .then((url) => {
        if (alive) setPosterUrl(url);
      })
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
      const stats = checkInStats || await getUserCheckInStats(checkIn.user_id).catch(() => null);
      const blob = await renderPoster(checkIn, shareUrl, 'blob', stats);
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
              <span>1080 x 1440</span>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl shadow-cyan-950/30">
              <div className="relative aspect-[3/4]">
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

function buildPosterData(checkIn: CheckIn, stats: UserCheckInStats | null = null) {
  const content = checkIn.content?.trim() || '';
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const achievements = extractAchievements(lines);
  const narrativeRaw = content || lines.filter((line) => !isAchievementLine(line)).join('\n') || '今天也完成了一次认真打卡。';
  const hasImages = (checkIn.image_urls?.length || 0) > 0;
  const narrative = clampText(narrativeRaw, hasImages ? 220 : 220);
  const completedCount = achievements.filter((item) => /完成|已做|打卡|Done|done/i.test(item.value) && !/未完成|没完成/.test(item.value)).length;
  const themeLabel = inferTheme(content, achievements);
  const heroMetric = completedCount > 0
    ? `${completedCount} 项完成`
    : achievements.length > 0
      ? `${achievements.length} 项记录`
      : hasImages
        ? '图文打卡'
        : '今日打卡';

  return {
    nickname: checkIn.profiles?.nickname || '社区伙伴',
    groupName: checkIn.profiles?.group_nickname || '健文社区成员',
    avatarUrl: checkIn.profiles?.avatar_url,
    dateText: formatDisplayDate(checkIn.created_at),
    fileDate: formatFileDate(checkIn.created_at),
    images: checkIn.image_urls || [],
    achievements,
    narrative,
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

function clampText(text: string, maxLength: number) {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileDate(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
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

async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl', stats?: UserCheckInStats | null): Promise<string>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'blob', stats?: UserCheckInStats | null): Promise<Blob>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl' | 'blob', stats?: UserCheckInStats | null) {
  const data = buildPosterData(checkIn, stats || null);
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
      width: 260,
      margin: 1,
      color: { dark: COLORS.bg, light: '#f8fafc' },
    }),
  ]);
  const [qrImage, ...images] = await Promise.all([
    loadImage(qrUrl),
    ...data.images.slice(0, 4).map(loadImage),
  ]);
  const validImages = images.filter((image): image is HTMLImageElement => Boolean(image));

  drawBackground(ctx);
  drawBrandHeader(ctx);
  drawProfileStrip(ctx, data, avatarImage);

  const contentBottom = validImages.length > 0
    ? drawImageStory(ctx, data, validImages)
    : drawTextStory(ctx, data);

  drawStatsPanel(ctx, data, contentBottom + 34);
  drawFooter(ctx, data, qrImage, shareUrl);

  return canvas;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  gradient.addColorStop(0, COLORS.bg);
  gradient.addColorStop(0.56, COLORS.bg2);
  gradient.addColorStop(1, '#150b2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  drawRadialGlow(ctx, 128, 90, 520, 'rgba(34, 211, 238, 0.26)');
  drawRadialGlow(ctx, 940, 140, 540, 'rgba(217, 70, 239, 0.24)');
  drawRadialGlow(ctx, 820, 980, 620, 'rgba(59, 130, 246, 0.18)');

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 44; x < POSTER_WIDTH; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, POSTER_HEIGHT);
    ctx.stroke();
  }
  for (let y = 44; y < POSTER_HEIGHT; y += 52) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(POSTER_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(900, 260, 360, Math.PI * 0.86, Math.PI * 1.36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  const points = [
    [118, 244], [236, 78], [478, 138], [968, 392], [782, 564],
    [126, 808], [996, 822], [204, 1192], [756, 1274], [948, 1128],
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

function drawBrandHeader(ctx: CanvasRenderingContext2D) {
  drawPill(ctx, 64, 54, 244, 58, '健文社区', COLORS.cyan);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(42, 900);
  ctx.fillText('社区打卡战报', 64, 172);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(22, 700);
  ctx.fillText('马健文 / 枭马葛 · 健身、学习、成长的长期主义社区', 64, 212);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.36)';
  ctx.font = font(22, 900);
  ctx.fillText('JIANWEN OS', 1016, 92);
  ctx.font = font(18, 800);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText('KEEP SHOWING UP', 1016, 124);
  ctx.restore();
}

function drawProfileStrip(ctx: CanvasRenderingContext2D, data: PosterData, avatarImage: HTMLImageElement | null) {
  const x = 64;
  const y = 246;
  const width = 952;
  const height = 118;
  drawRoundedRect(ctx, x, y, width, height, 30, 'rgba(15, 23, 42, 0.78)', 'rgba(125, 211, 252, 0.18)');
  drawCircleAvatar(ctx, avatarImage, data.nickname, x + 26, y + 22, 74);

  ctx.fillStyle = COLORS.text;
  ctx.font = font(30, 900);
  ctx.fillText(data.nickname, x + 116, y + 52);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(21, 700);
  ctx.fillText(`${data.groupName} · ${data.dateText}`, x + 116, y + 86);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.amber;
  ctx.font = font(22, 900);
  ctx.fillText(data.themeLabel, x + width - 30, y + 52);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(18, 700);
  ctx.fillText('今日主题', x + width - 30, y + 84);
  ctx.restore();
}

function drawImageStory(ctx: CanvasRenderingContext2D, data: PosterData, images: HTMLImageElement[]) {
  const x = 64;
  const y = 396;
  const width = 952;
  const height = 508;
  drawRoundedRect(ctx, x, y, width, height, 34, 'rgba(2, 6, 23, 0.76)', 'rgba(148, 163, 184, 0.18)');
  drawAlbumBackdrop(ctx, x, y, width, height);

  ctx.save();
  roundedClip(ctx, x + 16, y + 16, width - 32, height - 32, 26);
  drawPhotoLayout(ctx, data, images, x, y, width, height);

  drawRoundedRect(ctx, x + 34, y + height - 166, width - 68, 142, 24, 'rgba(2, 6, 23, 0.84)', 'rgba(248, 250, 252, 0.16)');
  ctx.fillStyle = COLORS.text;
  ctx.font = font(24, 900);
  drawPreservedLineExcerpt(ctx, data.narrative, x + 60, y + height - 132, width - 120, 32, 4);
  ctx.restore();

  return y + height;
}

function drawTextStory(ctx: CanvasRenderingContext2D, data: PosterData) {
  const x = 64;
  const y = 404;
  const width = 952;
  const height = 432;
  drawRoundedRect(ctx, x, y, width, height, 34, 'rgba(15, 23, 42, 0.84)', 'rgba(125, 211, 252, 0.22)');

  ctx.fillStyle = COLORS.cyan;
  ctx.font = font(24, 900);
  ctx.fillText('TODAY NOTE', x + 48, y + 68);

  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 48, y + 104);
  ctx.lineTo(x + 48, y + 346);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = font(52, 900);
  wrapText(ctx, data.narrative, x + 84, y + 138, width - 138, 70, 4);

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
    drawAdaptivePhotoFrame(ctx, image, x + 248, y + 24, 456, height - 188, -1.8, 28, true);
    drawTape(ctx, x + 444, y + 18, -7);
    return;
  }

  if (shape === 'wide') {
    drawAdaptivePhotoFrame(ctx, image, x + 72, y + 42, width - 144, height - 220, 1.4, 28, true);
    drawTape(ctx, x + 222, y + 42, -5);
    drawTape(ctx, x + width - 238, y + 42, 6);
    return;
  }

  drawAdaptivePhotoFrame(ctx, image, x + 218, y + 28, 516, height - 210, -2.4, 28, true);
  drawTape(ctx, x + 324, y + 28, -7);
}

function drawTwoPhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const shapes = images.map(getImageShape);

  if (shapes.every((shape) => shape === 'wide')) {
    drawAdaptivePhotoFrame(ctx, images[0], x + 76, y + 34, width - 152, 144, -1.2, 22, true);
    drawAdaptivePhotoFrame(ctx, images[1], x + 112, y + 180, width - 224, 144, 1.5, 22, false);
    drawTape(ctx, x + 212, y + 28, -5);
    drawTape(ctx, x + width - 260, y + 180, 6);
    return;
  }

  if (shapes.every((shape) => shape === 'portrait')) {
    drawAdaptivePhotoFrame(ctx, images[0], x + 92, y + 26, 380, height - 188, -3.4, 24, true);
    drawAdaptivePhotoFrame(ctx, images[1], x + 480, y + 28, 380, height - 188, 3.2, 24, true);
    drawTape(ctx, x + 212, y + 28, -7);
    drawTape(ctx, x + 618, y + 30, 7);
    return;
  }

  drawAdaptivePhotoFrame(ctx, images[0], x + 54, y + 38, 552, height - 210, -3.2, 26, true);
  drawAdaptivePhotoFrame(ctx, images[1], x + 612, y + 42, 314, height - 206, 3.8, 22, false);
  drawTape(ctx, x + 166, y + 36, -7);
  drawTape(ctx, x + 726, y + 44, 8);
}

function drawThreePhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const shapes = images.map(getImageShape);

  if (shapes.every((shape) => shape === 'portrait')) {
    drawAdaptivePhotoFrame(ctx, images[0], x + 54, y + 30, 280, height - 196, -4.2, 22, false);
    drawAdaptivePhotoFrame(ctx, images[1], x + 336, y + 24, 280, height - 184, 1.5, 22, true);
    drawAdaptivePhotoFrame(ctx, images[2], x + 618, y + 30, 280, height - 196, 4.2, 22, false);
    drawTape(ctx, x + 142, y + 30, -8);
    drawTape(ctx, x + 434, y + 24, 5);
    drawTape(ctx, x + 702, y + 30, 8);
    return;
  }

  drawAdaptivePhotoFrame(ctx, images[0], x + 44, y + 36, 526, height - 206, -3.6, 26, true);
  drawAdaptivePhotoFrame(ctx, images[1], x + 592, y + 32, 316, 148, 3.4, 20, false);
  drawAdaptivePhotoFrame(ctx, images[2], x + 620, y + 190, 292, 148, -2.8, 20, false);
  drawTape(ctx, x + 146, y + 40, -7);
  drawTape(ctx, x + 706, y + 28, 8);
  drawTape(ctx, x + 730, y + 192, -6);
}

function drawFourPhotoLayout(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], x: number, y: number, width: number, height: number) {
  const tileWidth = 382;
  const tileHeight = 148;
  const left = x + 78;
  const right = x + width - 78 - tileWidth;
  const top = y + 42;
  const bottom = y + height - 326;

  drawAdaptivePhotoFrame(ctx, images[0], left, top - 8, tileWidth, tileHeight + 40, -2.2, 18, false);
  drawAdaptivePhotoFrame(ctx, images[1], right, top, tileWidth, tileHeight + 36, 2.4, 18, false);
  drawAdaptivePhotoFrame(ctx, images[2], left + 20, bottom, tileWidth, tileHeight + 30, 2.1, 18, false);
  drawAdaptivePhotoFrame(ctx, images[3], right - 18, bottom - 8, tileWidth, tileHeight + 34, -2.8, 18, false);
  drawTape(ctx, left + 92, top - 12, -7);
  drawTape(ctx, right + 194, top - 4, 7);
  drawTape(ctx, left + 144, bottom - 12, 6);
  drawTape(ctx, right + 152, bottom - 20, -6);
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
) {
  const border = featured ? 18 : 13;
  const captionHeight = featured ? 34 : 24;
  const imageRatio = Math.max(0.3, Math.min(3.2, image.naturalWidth / image.naturalHeight || 1));
  const maxImageWidth = Math.max(80, boxWidth - border * 2);
  const maxImageHeight = Math.max(80, boxHeight - border * 2 - captionHeight);
  const boxRatio = maxImageWidth / maxImageHeight;

  let imageWidth = maxImageWidth;
  let imageHeight = imageWidth / imageRatio;
  if (imageRatio < boxRatio) {
    imageHeight = maxImageHeight;
    imageWidth = imageHeight * imageRatio;
  }

  const frameWidth = imageWidth + border * 2;
  const frameHeight = imageHeight + border * 2 + captionHeight;
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

  ctx.save();
  ctx.fillStyle = 'rgba(248, 250, 252, 0.34)';
  ctx.font = font(18, 900);
  ctx.fillText('ALBUM', x + 48, y + 56);
  ctx.fillStyle = 'rgba(159, 176, 200, 0.54)';
  ctx.font = font(15, 800);
  ctx.fillText('daily fragments', x + 126, y + 56);
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
  const border = featured ? 18 : 13;
  const captionHeight = featured ? 34 : 24;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(angle);
  ctx.translate(-width / 2, -height / 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = featured ? 34 : 24;
  ctx.shadowOffsetY = featured ? 22 : 15;
  drawRoundedRect(ctx, 0, 0, width, height, radius, 'rgba(248, 250, 252, 0.94)');
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

  const compactCaption = width < 280;
  ctx.fillStyle = '#172033';
  ctx.font = font(featured ? compactCaption ? 13 : 16 : compactCaption ? 12 : 13, 900);
  ctx.fillText(featured ? compactCaption ? 'MAIN' : 'TODAY / MAIN SHOT' : 'MOMENT', border, height - 17);
  if (!compactCaption) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
    ctx.font = font(featured ? 15 : 12, 800);
    ctx.textAlign = 'right';
    ctx.fillText(rotationDeg > 0 ? 'keep going' : 'shown up', width - border, height - 17);
    ctx.textAlign = 'left';
  }

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

function drawTape(ctx: CanvasRenderingContext2D, x: number, y: number, rotationDeg: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationDeg * Math.PI / 180);
  ctx.globalAlpha = 0.78;
  drawRoundedRect(ctx, -54, -13, 108, 26, 8, 'rgba(186, 230, 253, 0.7)', 'rgba(255, 255, 255, 0.18)');
  ctx.strokeStyle = 'rgba(8, 47, 73, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
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
  const x = 64;
  const width = 952;
  const height = 300;
  drawRoundedRect(ctx, x, y, width, height, 34, 'rgba(15, 23, 42, 0.86)', 'rgba(148, 163, 184, 0.18)');

  ctx.fillStyle = COLORS.dim;
  ctx.font = font(22, 900);
  ctx.fillText('COMMUNITY PROGRESS', x + 42, y + 58);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(68, 900);
  ctx.fillText(`${data.stats.totalCount} 次打卡`, x + 42, y + 136);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.amber;
  ctx.font = font(28, 900);
  ctx.fillText(data.heroMetric, x + width - 42, y + 96);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(18, 800);
  ctx.fillText('本条记录', x + width - 42, y + 126);
  ctx.restore();

  const statItems = [
    { label: '连续打卡', value: `${data.stats.currentStreak} 天`, color: COLORS.cyan },
    { label: '本月打卡', value: `${data.stats.monthCount} 天`, color: COLORS.green },
    { label: '最长连续', value: `${data.stats.longestStreak} 天`, color: COLORS.amber },
    { label: '本条完成', value: data.completedCount > 0 ? `${data.completedCount} 项` : data.themeLabel, color: COLORS.fuchsia },
  ];

  statItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const chipX = x + 42 + col * 456;
    const chipY = y + 166 + row * 68;
    drawRoundedRect(ctx, chipX, chipY, 412, 52, 18, 'rgba(30, 41, 59, 0.78)', 'rgba(125, 211, 252, 0.12)');
    ctx.fillStyle = item.color;
    ctx.font = font(18, 900);
    ctx.fillText(item.label, chipX + 20, chipY + 33);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(24, 900);
    ctx.fillText(clampCanvasText(ctx, item.value, 190), chipX + 154, chipY + 34);
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, data: PosterData, qrImage: HTMLImageElement | null, shareUrl: string) {
  const y = 1262;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, y);
  ctx.lineTo(1016, y);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = font(34, 900);
  ctx.fillText('健文社区', 64, y + 58);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(22, 700);
  ctx.fillText('马健文（枭马葛）粉丝社区 · 健身和学习都有人一起坚持', 64, y + 96);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(18, 700);
  ctx.fillText(`扫码进入社区广场 · ${data.fileDate}`, 64, y + 132);

  drawRoundedRect(ctx, 842, y + 28, 128, 128, 22, '#f8fafc', 'rgba(125, 211, 252, 0.28)');
  if (qrImage) {
    ctx.drawImage(qrImage, 854, y + 40, 104, 104);
  }

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(159, 176, 200, 0.72)';
  ctx.font = font(16, 700);
  ctx.fillText(shareUrl.replace(/^https?:\/\//, ''), 1016, y + 182);
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

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, text: string, color: string) {
  drawRoundedRect(ctx, x, y, width, height, height / 2, 'rgba(15, 23, 42, 0.78)', 'rgba(125, 211, 252, 0.28)');
  ctx.fillStyle = color;
  ctx.font = font(24, 900);
  ctx.fillText(text, x + 28, y + 38);
}

function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (const char of chars) {
    if (char === '\n') {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = '';
      lineCount += 1;
      if (lineCount >= maxLines) return;
      continue;
    }

    const testLine = `${line}${char}`;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      const suffix = lineCount === maxLines - 1 ? '…' : '';
      ctx.fillText(clampCanvasText(ctx, `${line}${suffix}`, maxWidth), x, y + lineCount * lineHeight);
      line = char;
      lineCount += 1;
      if (lineCount >= maxLines) return;
    } else {
      line = testLine;
    }
  }

  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

function drawPreservedLineExcerpt(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) {
    wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines);
    return;
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? '…' : '';
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
