import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, Download, RefreshCw, Share2, X } from 'lucide-react';
import type { CheckIn } from '../../services/checkInService';

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
  bg: '#050816',
  bg2: '#09111f',
  panel: '#0f172a',
  panel2: '#111c33',
  text: '#f8fafc',
  muted: '#9fb0c8',
  dim: '#64748b',
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

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return SHARE_PATH;
    return new URL(SHARE_PATH, window.location.origin).toString();
  }, []);

  const posterData = useMemo(() => buildPosterData(checkIn), [checkIn]);

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
    renderPoster(checkIn, shareUrl, 'dataUrl')
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
      const blob = await renderPoster(checkIn, shareUrl, 'blob');
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
        className="grid max-h-[94vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-cyan-200/10 bg-slate-950 shadow-2xl shadow-black/60 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]"
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="完成项" value={String(posterData.completedCount)} />
            <MetricCard label="图片" value={String(posterData.images.length)} />
            <MetricCard label="成就块" value={String(posterData.achievements.length)} />
          </div>

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isRendering || !posterUrl}
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
              {copied ? '已复制' : '复制社区链接'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Share2 className="h-3.5 w-3.5" />
            <span>适合发微信群、朋友圈和小红书，二维码指向社区广场。</span>
          </div>
        </aside>
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

function buildPosterData(checkIn: CheckIn) {
  const content = checkIn.content?.trim() || '';
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const achievements = extractAchievements(lines);
  const narrativeRaw = lines.filter((line) => !isAchievementLine(line)).join('\n') || content || '今天也完成了一次认真打卡。';
  const hasImages = (checkIn.image_urls?.length || 0) > 0;
  const narrative = clampText(narrativeRaw, hasImages ? 92 : 150);
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

async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl'): Promise<string>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'blob'): Promise<Blob>;
async function renderPoster(checkIn: CheckIn, shareUrl: string, output: 'dataUrl' | 'blob') {
  const data = buildPosterData(checkIn);
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

  ctx.save();
  roundedClip(ctx, x + 16, y + 16, width - 32, height - 32, 24);

  if (images.length === 1) {
    drawImageCover(ctx, images[0], x + 16, y + 16, width - 32, height - 32);
  } else {
    const gap = 12;
    const leftWidth = 572;
    const rightWidth = width - 32 - leftWidth - gap;
    drawImageCover(ctx, images[0], x + 16, y + 16, leftWidth, height - 32);
    const cellHeight = (height - 32 - gap) / 2;
    drawImageCover(ctx, images[1], x + 16 + leftWidth + gap, y + 16, rightWidth, cellHeight);
    if (images[2]) {
      drawImageCover(ctx, images[2], x + 16 + leftWidth + gap, y + 16 + cellHeight + gap, rightWidth, cellHeight);
    } else {
      drawMiniQuote(ctx, data.heroMetric, x + 16 + leftWidth + gap, y + 16 + cellHeight + gap, rightWidth, cellHeight);
    }
    if (data.images.length > 3) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
      ctx.fillRect(x + 16 + leftWidth + gap, y + 16 + cellHeight + gap, rightWidth, cellHeight);
      ctx.fillStyle = COLORS.text;
      ctx.font = font(58, 900);
      ctx.textAlign = 'center';
      ctx.fillText(`+${data.images.length - 3}`, x + 16 + leftWidth + gap + rightWidth / 2, y + 16 + cellHeight + gap + cellHeight / 2 + 20);
      ctx.textAlign = 'left';
    }
  }

  const overlay = ctx.createLinearGradient(0, y + height - 210, 0, y + height - 16);
  overlay.addColorStop(0, 'rgba(2, 6, 23, 0)');
  overlay.addColorStop(1, 'rgba(2, 6, 23, 0.72)');
  ctx.fillStyle = overlay;
  ctx.fillRect(x + 16, y + height - 220, width - 32, 204);

  drawRoundedRect(ctx, x + 34, y + height - 142, width - 68, 104, 24, 'rgba(2, 6, 23, 0.68)', 'rgba(248, 250, 252, 0.16)');
  ctx.fillStyle = COLORS.text;
  ctx.font = font(27, 900);
  wrapText(ctx, data.narrative, x + 60, y + height - 100, width - 120, 34, 2);
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

function drawMiniQuote(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, 'rgba(34, 211, 238, 0.28)');
  gradient.addColorStop(1, 'rgba(217, 70, 239, 0.22)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(38, 900);
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + height / 2 + 14);
  ctx.textAlign = 'left';
}

function drawStatsPanel(ctx: CanvasRenderingContext2D, data: PosterData, y: number) {
  const x = 64;
  const width = 952;
  const height = 300;
  drawRoundedRect(ctx, x, y, width, height, 34, 'rgba(15, 23, 42, 0.86)', 'rgba(148, 163, 184, 0.18)');

  ctx.fillStyle = COLORS.dim;
  ctx.font = font(22, 900);
  ctx.fillText('TODAY PROGRESS', x + 42, y + 58);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(72, 900);
  ctx.fillText(data.heroMetric, x + 42, y + 136);

  const achievements = data.achievements.length > 0
    ? data.achievements.slice(0, 4)
    : [
      { label: '状态', value: data.themeLabel },
      { label: '记录', value: '完成打卡' },
    ];

  achievements.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const chipX = x + 42 + col * 456;
    const chipY = y + 166 + row * 68;
    drawRoundedRect(ctx, chipX, chipY, 412, 52, 18, 'rgba(30, 41, 59, 0.78)', 'rgba(125, 211, 252, 0.12)');
    ctx.fillStyle = index % 2 === 0 ? COLORS.cyan : COLORS.amber;
    ctx.font = font(18, 900);
    ctx.fillText(item.label, chipX + 20, chipY + 33);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(22, 900);
    ctx.fillText(clampCanvasText(ctx, item.value, 214), chipX + 132, chipY + 33);
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
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
