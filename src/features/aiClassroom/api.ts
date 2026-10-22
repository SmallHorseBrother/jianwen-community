import { supabase } from '../../lib/supabase';

export type Tool = 'chat' | 'image' | 'video';
export type Kind = 'chat' | 'vision' | 't2i' | 'i2i' | 't2v' | 'i2v';
export type Work = {
  id: string; tool: Tool; kind: Kind; by: string; prompt: string; status: string; message: string | null;
  text: string | null; type: 'text' | 'image' | 'video' | null; file: string | null; input: string | null;
  cost: number; refunded: boolean; created_at: string; seconds: number | null; hidden?: boolean; can_resume?: boolean;
};
export type ToolState = { open: boolean; until: string | null; quota: number; round: number; task: string; remainingMs: number | null };
export type SharedImage = { id: string; url: string };
export type Price = { kind: Kind; credits: number; label: string };
export type CreatePayload = { kind: Kind; prompt: string; image?: string; ref?: string };

export type StudentState = {
  classroom: { title: string }; name: string; now: string; shared: SharedImage[]; works: Work[];
  tools: Record<Tool, { open: boolean; remainingMs: number | null; quota: number; quotaLeft: number; task: string }>;
};
export type TeacherState = {
  classroom: { id: string; title: string; join_code: string; spend_limit: number | null };
  tools: Record<Tool, ToolState>;
  students: Array<{ id: string; name: string; online: boolean; count: number }>;
  works: Work[]; shared: SharedImage[]; spent: number; balance: number; configured: boolean; now: string;
};
export type Me = { balance: number; prices: Price[]; is_admin: boolean; classrooms: Array<{ id: string; title: string; join_code: string; created_at: string }> };

export const TOOL_NAMES: Record<Tool, string> = { chat: '问 AI', image: '画图', video: '做视频' };
export const KIND_NAMES: Record<Kind, string> = { chat: '问 AI', vision: '看图问 AI', t2i: '文字画图', i2i: '照片改图', t2v: '文字做视频', i2v: '图片变视频' };

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-classroom`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const TOKEN_KEY = 'jw_class_token';

export const studentToken = {
  get(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v: string) { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* 隐私模式 */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* 隐私模式 */ } },
};

export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }

async function call<T>(action: string, body: Record<string, unknown>, asStudent: boolean): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: ANON };
  if (asStudent) {
    headers.Authorization = `Bearer ${ANON}`;
    const t = studentToken.get(); if (t) headers['x-class-token'] = t;
  } else {
    const { data } = await supabase.auth.getSession();
    headers.Authorization = `Bearer ${data.session?.access_token || ANON}`;
  }
  let res: Response;
  try { res = await fetch(FN_URL, { method: 'POST', headers, body: JSON.stringify({ action, ...body }) }); }
  catch { throw new ApiError(0, '网络连不上，请检查网络后再试。'); }
  let json: any = {};
  try { json = await res.json(); } catch { /* 空响应 */ }
  if (!res.ok) throw new ApiError(res.status, json.error || `出错了（${res.status}）`);
  return json as T;
}

export const classroomApi = {
  // 学生
  join: (code: string, name: string) => call<{ token: string; name: string; classroom: { title: string } }>('join', { code, name }, true),
  studentState: () => call<StudentState>('student-state', {}, true),
  studentCreate: (p: CreatePayload) => call<{ work: Work }>('student-create', p, true),
  studentRename: (name: string) => call<{ ok: true; name: string }>('student-rename', { name }, true),
  // 老师 / 自学
  me: () => call<Me>('me', {}, false),
  createClassroom: (title: string) => call<{ classroom: { id: string; title: string; join_code: string } }>('class-create', { title }, false),
  classState: (classroom_id: string) => call<TeacherState>('class-state', { classroom_id }, false),
  updateClass: (classroom_id: string, patch: Record<string, unknown>) => call<{ ok: true; join_code: string }>('class-update', { classroom_id, ...patch }, false),
  workAction: (work_id: string, act: 'hide' | 'show' | 'share' | 'resume') => call<{ ok: true }>('work-action', { work_id, act }, false),
  sharedAdd: (classroom_id: string, image: string) => call<{ ok: true }>('shared-add', { classroom_id, image }, false),
  sharedRemove: (classroom_id: string, shared_id: string) => call<{ ok: true }>('shared-remove', { classroom_id, shared_id }, false),
  create: (p: CreatePayload & { classroom_id?: string }) => call<{ work: Work; balance: number }>('create', p, false),
  myWorks: () => call<{ works: Work[]; balance: number; prices: Price[] }>('my-works', {}, false),
  selftest: () => call<{ ok: boolean; message: string }>('selftest', {}, false),
  grant: (amount: number, user_id?: string) => call<{ ok: true; balance: number }>('admin-grant', { amount, user_id }, false),
};

// 读图片并缩小到最长边 1600 像素，减少上传时间
export function readImage(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { reject(new Error('请选择 PNG、JPG 或 WebP 图片。')); return; }
    const src = window.URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      window.URL.revokeObjectURL(src);
      resolve({ dataUrl: c.toDataURL('image/jpeg', 0.88), w, h });
    };
    img.onerror = () => { window.URL.revokeObjectURL(src); reject(new Error('这张图片打不开。')); };
    img.src = src;
  });
}

export const mmss = (ms: number | null) => {
  if (ms == null) return '';
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
