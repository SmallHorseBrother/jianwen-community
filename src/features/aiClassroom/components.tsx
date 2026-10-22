import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, MessageSquareText, Image as ImageIcon, Clapperboard, X } from 'lucide-react';
import { KIND_NAMES, readImage, type CreatePayload, type Kind, type SharedImage, type Tool, type Work } from './api';
import './classroom.css';

export const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  chat: <MessageSquareText aria-hidden="true" />, image: <ImageIcon aria-hidden="true" />, video: <Clapperboard aria-hidden="true" />,
};

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { if (ms == null) return; const id = window.setInterval(() => ref.current(), ms); return () => window.clearInterval(id); }, [ms]);
}

// 签名链接每次轮询都会变；同一个作品沿用第一次拿到的链接，避免图片和视频反复重新加载
export function useStableWorks(works: Work[] | undefined): Work[] {
  const cache = useRef(new Map<string, { file: string | null; input: string | null; at: number }>());
  if (!works) return [];
  const now = Date.now();
  return works.map((w) => {
    const c = cache.current.get(w.id);
    if (c && now - c.at < 45 * 60_000 && (c.file || !w.file) && (c.input || !w.input)) return { ...w, file: c.file ?? w.file, input: c.input ?? w.input };
    cache.current.set(w.id, { file: w.file, input: w.input, at: now });
    return w;
  });
}
export function useStableShared(list: SharedImage[] | undefined): SharedImage[] {
  const cache = useRef(new Map<string, string>());
  return (list || []).map((s) => { const u = cache.current.get(s.id) || s.url; cache.current.set(s.id, u); return { ...s, url: u }; });
}

const MODES: Record<Tool, Array<[Kind, string]>> = {
  chat: [['chat', '问 AI']],
  image: [['t2i', '用文字画一张'], ['i2i', '改一张照片']],
  video: [['t2v', '用文字做视频'], ['i2v', '让图片动起来']],
};
const PLACEHOLDER: Record<Kind, string> = {
  chat: '你想问 AI 什么？说清楚一点，比如：用三句话介绍一下机械臂。',
  vision: '',
  t2i: '把要求说清楚：画什么、什么样子、在做什么、什么风格。',
  i2i: '保留：照片里的……\n改成：……\n画面像：……',
  t2v: '描述一段 5 秒的画面：谁、在哪里、在做什么。',
  i2v: '这张图片里，什么东西怎样动起来？',
};

export type ToolPanelProps = {
  tool: Tool;
  onSubmit: (p: CreatePayload) => Promise<void>;
  shared?: SharedImage[];
  task?: string;
  info?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  priceOf?: (k: Kind) => number | undefined;
};

export const ToolPanel: React.FC<ToolPanelProps> = ({ tool, onSubmit, shared = [], task, info, disabled, disabledReason, priceOf }) => {
  const [kind, setKind] = useState<Kind>(MODES[tool][0][0]);
  const [prompt, setPrompt] = useState('');
  const [img, setImg] = useState<{ dataUrl: string } | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [withImg, setWithImg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const needImg = kind === 'i2i' || kind === 'i2v';
  const showPick = needImg || (tool === 'chat' && withImg);
  useEffect(() => { if (ref && !shared.some((s) => s.id === ref)) setRef(null); }, [shared, ref]);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    try { setImg(await readImage(f)); setRef(null); setMsg(null); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) { setMsg({ text: '先写下你的要求。', bad: true }); return; }
    if (needImg && !img && !ref) { setMsg({ text: '先选一张图片：点老师给的图片，或者上传一张。', bad: true }); return; }
    setBusy(true); setMsg({ text: tool === 'chat' ? 'AI 正在回答…' : '已交给 AI，结果会出现在下面。' });
    try {
      const useImg = showPick;
      await onSubmit({ kind, prompt: prompt.trim(), image: useImg && img ? img.dataUrl : undefined, ref: useImg && !img && ref ? ref : undefined });
      setMsg(tool === 'chat' ? null : { text: '已提交。等结果的时候想一想：怎样才算做得好？' });
    } catch (err) { setMsg({ text: (err as Error).message, bad: true }); }
    finally { setBusy(false); }
  };
  const price = priceOf?.(kind === 'chat' && withImg ? 'vision' : kind);

  return (
    <form className="cw-tool" onSubmit={submit}>
      {task && <div className="cw-task"><b>任务</b><span>{task}</span></div>}
      {MODES[tool].length > 1 && (
        <div className="cw-seg" role="tablist">
          {MODES[tool].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      )}
      <div className={`cw-tool-body ${showPick ? 'with-pick' : ''}`}>
        {showPick && (
          <div className="cw-pick">
            {shared.length > 0 && (
              <div className="cw-refs"><span>老师给的图片（点一张）</span>
                <div>{shared.map((s) => (
                  <button key={s.id} type="button" className={ref === s.id ? 'on' : ''} onClick={() => { setRef(ref === s.id ? null : s.id); setImg(null); }} aria-label="选这张图片"><img src={s.url} alt="" /></button>
                ))}</div>
              </div>
            )}
            <button type="button" className="cw-drop" onClick={() => fileRef.current?.click()}>
              {img ? <img src={img.dataUrl} alt="已选图片" /> : <><ImagePlus aria-hidden="true" /><b>上传一张图片</b><small>{tool === 'chat' ? '可以不选，只问文字' : 'PNG / JPG，不拍同学的脸'}</small></>}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={800} rows={4} placeholder={PLACEHOLDER[kind]} aria-label="写给 AI 的要求" />
      </div>
      <div className="cw-tool-foot">
        {tool === 'chat' && <button type="button" className="cw-ghost" onClick={() => { setWithImg(!withImg); if (withImg) { setImg(null); setRef(null); } }}>{withImg ? '－ 不加图片' : '＋ 加一张图片让 AI 看'}</button>}
        <span className="cw-foot-info">{info}{price != null && <span className="cw-price">{price} 积分</span>}</span>
        <button type="submit" className="jw-action" disabled={busy || disabled}>{busy ? <Loader2 className="cw-spin" aria-hidden="true" /> : null}{tool === 'chat' ? '发给 AI' : tool === 'image' ? '开始画' : '开始做视频'}</button>
      </div>
      {disabled && disabledReason && <p className="cw-msg">{disabledReason}</p>}
      {msg && <p className={`cw-msg ${msg.bad ? 'bad' : ''}`} role="status">{msg.text}</p>}
    </form>
  );
};

const STATUS: Record<string, [string, string]> = {
  queued: ['排队中', 'run'], running: ['生成中', 'run'], waiting: ['等太久了', 'warn'], done: ['完成', 'ok'], failed: ['没成功', 'bad'], unknown: ['不确定', 'warn'],
};

export const WorkCard: React.FC<{ work: Work; teacher?: boolean; onZoom?: () => void; onAction?: (act: 'hide' | 'show' | 'share' | 'resume') => void }> = ({ work: w, teacher, onZoom, onAction }) => {
  const [label, cls] = STATUS[w.status] || [w.status, 'run'];
  const pending = w.status === 'queued' || w.status === 'running';
  return (
    <article className={`cw-work ${w.hidden ? 'is-hidden' : ''}`}>
      <div className="cw-work-media" onClick={w.type !== 'video' ? onZoom : undefined} role={onZoom && w.type !== 'video' ? 'button' : undefined}>
        {w.status === 'done' && w.type === 'image' && w.file && <img src={w.file} alt="生成的图片" loading="lazy" />}
        {w.status === 'done' && w.type === 'video' && w.file && <video src={w.file} controls preload="metadata" playsInline />}
        {w.status === 'done' && w.type === 'text' && <div className="cw-work-text">{w.text}</div>}
        {pending && <div className="cw-work-pending"><Loader2 className="cw-spin" aria-hidden="true" /><span>{w.message || '请稍等…'}</span></div>}
        {!pending && w.status !== 'done' && <div className="cw-work-pending muted"><span>{w.message}</span></div>}
      </div>
      <div className="cw-work-meta">
        <div className="cw-row"><span className={`cw-pill ${cls}`}>{label}</span><span className="cw-kind">{KIND_NAMES[w.kind]}</span>{w.seconds ? <span className="cw-kind">{w.seconds} 秒</span> : null}{teacher && <span className="cw-by">{w.by}</span>}</div>
        <div className="cw-prompt">{w.input && <img src={w.input} alt="原图" />}<span>{w.prompt}</span></div>
        {teacher && onAction && (
          <div className="cw-row cw-actions">
            {onZoom && <button type="button" onClick={onZoom}>放大展示</button>}
            {((w.type === 'image' && w.status === 'done') || w.input) && <button type="button" onClick={() => onAction('share')}>共享给学生</button>}
            {w.can_resume && <button type="button" onClick={() => onAction('resume')}>继续查询</button>}
            <button type="button" onClick={() => onAction(w.hidden ? 'show' : 'hide')}>{w.hidden ? '取消隐藏' : '隐藏'}</button>
          </div>
        )}
      </div>
    </article>
  );
};

export const Lightbox: React.FC<{ works: Work[]; index: number; onIndex: (i: number) => void; onClose: () => void }> = ({ works, index, onIndex, onClose }) => {
  const w = works[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'ArrowRight' && index < works.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [index, works.length, onClose, onIndex]);
  if (!w) return null;
  return (
    <div className="cw-lightbox" role="dialog" aria-modal="true" aria-label="放大展示">
      <button type="button" className="cw-lb-close" onClick={onClose} aria-label="关闭"><X /></button>
      {index > 0 && <button type="button" className="cw-lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="上一个"><ChevronLeft /></button>}
      {index < works.length - 1 && <button type="button" className="cw-lb-nav next" onClick={() => onIndex(index + 1)} aria-label="下一个"><ChevronRight /></button>}
      <div className="cw-lb-media">
        {w.input && <figure><img src={w.input} alt="" /><figcaption>原图</figcaption></figure>}
        {w.status === 'done' && w.type === 'image' && w.file && <img src={w.file} alt="" />}
        {w.status === 'done' && w.type === 'video' && w.file && <video src={w.file} controls autoPlay loop playsInline />}
        {w.status === 'done' && w.type === 'text' && <div className="cw-lb-text">{w.text}</div>}
        {w.status !== 'done' && <div className="cw-lb-text muted">{w.message}</div>}
      </div>
      <div className="cw-lb-cap"><b>{w.by}</b><span>{KIND_NAMES[w.kind]}</span><p>{w.prompt}</p></div>
    </div>
  );
};
