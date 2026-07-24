import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  FileCode2,
  GitBranch,
  Image,
  Loader2,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Search,
  Send,
  TerminalSquare,
  TestTube2,
  Video,
} from 'lucide-react';
import './styles.css';

type LocalSummary = {
  hasLog: boolean;
  sessionId: string;
  worktree: string;
  branch: string;
  updatedAt: string;
  logPath?: string;
  logTail?: string;
  activeResume?: {
    startedAt: string;
    output: string;
  } | null;
};

type TaskSummary = {
  id: string;
  title: string;
  description: string;
  acceptance: string;
  plannedAt: string;
  aiEnabled: boolean;
  executionStatus: string;
  status: string;
  priority: string;
  complexity: string;
  projectKey: string;
  projectPath: string;
  executionLog: string;
  validation: string;
  branchCommit: string;
  testResult: string;
  attachments: Array<{ name: string; size: number; type: string }>;
  local: LocalSummary;
};

type ConversationEvent = {
  role: 'user' | 'assistant';
  content: string;
  status: string;
  timestamp: string;
};

type Artifact = {
  name: string;
  type: string;
  size: number;
  url: string;
};

type TaskDetail = TaskSummary & {
  local: LocalSummary;
  git: {
    available: boolean;
    status: string;
    stat: string;
    diff: string;
    recentCommits: string;
  };
  artifacts: Artifact[];
  conversation: ConversationEvent[];
};

type Tab = 'activity' | 'diff' | 'validation';

const statusTone: Record<string, string> = {
  执行中: 'running',
  待执行: 'queued',
  已完成: 'done',
  失败: 'failed',
  未开始: 'idle',
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`);
  return payload;
}

function formatTime(value: string) {
  if (!value) return '未设置';
  const normalized = value.includes('T') ? new Date(value) : new Date(value.replace(' ', 'T'));
  if (Number.isNaN(normalized.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(normalized);
}

function formatSize(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] || 'idle';
  return (
    <span className={`status-badge ${tone}`}>
      {tone === 'running' ? <Loader2 size={14} className="spin" /> : null}
      {tone === 'done' ? <CheckCircle2 size={14} /> : null}
      {tone === 'failed' ? <AlertCircle size={14} /> : null}
      {tone === 'queued' ? <Clock3 size={14} /> : null}
      {tone === 'idle' ? <CircleDot size={14} /> : null}
      {status}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function TaskList({
  tasks,
  selectedId,
  onSelect,
  collapsed,
}: {
  tasks: TaskSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.projectKey} ${task.executionStatus}`.toLowerCase().includes(keyword),
    );
  }, [query, tasks]);

  if (collapsed) return null;
  return (
    <aside className="task-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">飞书任务</span>
          <strong>{tasks.length} 条 AI 任务</strong>
        </div>
      </div>
      <label className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索任务"
        />
      </label>
      <div className="task-list">
        {visible.map((task) => (
          <button
            className={`task-row ${selectedId === task.id ? 'selected' : ''}`}
            key={task.id}
            onClick={() => onSelect(task.id)}
          >
            <span className={`task-state-dot ${statusTone[task.executionStatus] || 'idle'}`} />
            <span className="task-row-content">
              <strong>{task.title}</strong>
              <span>
                {task.projectKey} · {formatTime(task.plannedAt)}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </aside>
  );
}

function Overview({ task }: { task: TaskDetail }) {
  return (
    <section className="task-overview">
      <div className="task-title-line">
        <div>
          <div className="title-meta">
            <span>{task.projectKey}</span>
            <span>{task.id}</span>
          </div>
          <h1>{task.title}</h1>
        </div>
        <StatusBadge status={task.executionStatus} />
      </div>
      <div className="overview-grid">
        <div>
          <span>计划时间</span>
          <strong>{formatTime(task.plannedAt)}</strong>
        </div>
        <div>
          <span>业务状态</span>
          <strong>{task.status}</strong>
        </div>
        <div>
          <span>优先级 / 复杂度</span>
          <strong>
            {task.priority} / {task.complexity}
          </strong>
        </div>
        <div>
          <span>Codex 会话</span>
          <strong>{task.local.sessionId ? task.local.sessionId.slice(0, 13) : '尚未创建'}</strong>
        </div>
      </div>
    </section>
  );
}

function ActivityPanel({ task }: { task: TaskDetail }) {
  const phases = [
    { label: '飞书审批', done: task.aiEnabled },
    { label: '按时接管', done: Boolean(task.local.hasLog) },
    { label: '代码实现', done: ['执行中', '已完成'].includes(task.executionStatus) },
    { label: '测试验收', done: task.executionStatus === '已完成' },
  ];
  const liveOutput = task.local.activeResume?.output;
  return (
    <div className="panel-stack">
      <div className="phase-strip">
        {phases.map((phase, index) => (
          <React.Fragment key={phase.label}>
            <div className={`phase ${phase.done ? 'done' : ''}`}>
              {phase.done ? <CheckCircle2 size={17} /> : <CircleDot size={17} />}
              <span>{phase.label}</span>
            </div>
            {index < phases.length - 1 ? <span className="phase-line" /> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="detail-columns">
        <section className="info-section">
          <h2>需求与验收</h2>
          <dl>
            <div>
              <dt>需求描述</dt>
              <dd>{task.description || '当前只填写了需求名称。'}</dd>
            </div>
            <div>
              <dt>验收标准</dt>
              <dd>{task.acceptance || 'Codex 会在执行时补充最小可验证标准。'}</dd>
            </div>
          </dl>
        </section>
        <section className="info-section">
          <h2>执行上下文</h2>
          <dl className="compact-dl">
            <div>
              <dt>分支</dt>
              <dd>{task.local.branch || task.branchCommit || '尚未创建'}</dd>
            </div>
            <div>
              <dt>工作目录</dt>
              <dd className="path-value">{task.local.worktree || '尚未创建'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="terminal-panel">
        <header>
          <span>
            <TerminalSquare size={16} />
            实时执行日志
          </span>
          <small>{task.local.updatedAt ? formatTime(task.local.updatedAt) : '等待日志'}</small>
        </header>
        <pre>{liveOutput || task.local.logTail || '等待 Codex 开始执行…'}</pre>
      </section>
    </div>
  );
}

function DiffPanel({ task }: { task: TaskDetail }) {
  if (!task.git.available) {
    return (
      <EmptyState
        icon={<FileCode2 size={24} />}
        title="还没有代码工作区"
        description="任务被 Codex 接管后，这里会出现文件改动和提交记录。"
      />
    );
  }
  return (
    <div className="panel-stack">
      <div className="diff-summary">
        <div>
          <GitBranch size={18} />
          <span>
            <small>当前分支</small>
            <strong>{task.local.branch || '未知分支'}</strong>
          </span>
        </div>
        <pre>{task.git.stat || task.git.status || '当前还没有未提交改动。'}</pre>
      </div>
      <section className="code-panel">
        <header>
          <span>
            <Code2 size={16} />
            Git diff
          </span>
        </header>
        <pre>{task.git.diff || '当前改动已提交，或尚未产生代码差异。'}</pre>
      </section>
      <section className="commit-panel">
        <h2>最近提交</h2>
        <pre>{task.git.recentCommits || '暂无提交记录。'}</pre>
      </section>
    </div>
  );
}

function ValidationPanel({ task }: { task: TaskDetail }) {
  return (
    <div className="panel-stack">
      <div className="detail-columns">
        <section className="info-section">
          <h2>
            <TestTube2 size={17} />
            验证结果
          </h2>
          <p className="long-copy">
            {task.validation || task.testResult || '任务完成后会在这里显示测试命令和结果。'}
          </p>
        </section>
        <section className="info-section">
          <h2>
            <Image size={17} />
            飞书原始附件
          </h2>
          {task.attachments.length ? (
            <ul className="file-list compact">
              {task.attachments.map((file) => (
                <li key={file.name}>
                  <span>{file.name}</span>
                  <small>{formatSize(file.size)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">这条任务没有原始附件。</p>
          )}
        </section>
      </div>
      <section className="artifact-section">
        <h2>Codex 产出的截图与报告</h2>
        {task.artifacts.length ? (
          <div className="artifact-grid">
            {task.artifacts.map((artifact) => (
              <a href={artifact.url} target="_blank" rel="noreferrer" key={artifact.url}>
                <div className="artifact-preview">
                  {['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(artifact.type) ? (
                    <img src={artifact.url} alt={artifact.name} />
                  ) : artifact.type === 'mp4' || artifact.type === 'webm' ? (
                    <Video size={26} />
                  ) : (
                    <FileCode2 size={26} />
                  )}
                </div>
                <span>{artifact.name}</span>
                <small>{formatSize(artifact.size)}</small>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Image size={24} />}
            title="还没有截图或报告"
            description="涉及界面的任务完成验证后，产物会自动出现在这里。"
          />
        )}
      </section>
    </div>
  );
}

function ConversationPanel({
  task,
  onSent,
}: {
  task: TaskDetail;
  onSent: () => void;
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const canSend =
    Boolean(task.local.sessionId) &&
    task.executionStatus !== '执行中' &&
    !task.local.activeResume &&
    !submitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !canSend) return;
    setSubmitting(true);
    setNotice('');
    try {
      await requestJson(`/api/tasks/${encodeURIComponent(task.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });
      setMessage('');
      setNotice('后续修改已发送，Codex 正在沿用原会话继续处理。');
      onSent();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="conversation-panel">
      <header>
        <span>
          <MessageSquareText size={17} />
          继续对话
        </span>
        <small>{task.local.sessionId ? '沿用原 Codex 会话' : '等待首次执行'}</small>
      </header>
      <div className="conversation-stream">
        <article className="message assistant">
          <span>Codex</span>
          <p>
            当前任务：{task.title}
            <br />
            {task.executionStatus === '执行中'
              ? '我正在执行首次修改，结束后你可以继续提出调整。'
              : '你可以继续描述要改的地方，我会保留前面的代码与上下文。'}
          </p>
        </article>
        {task.conversation.map((event, index) => (
          <article className={`message ${event.role}`} key={`${event.timestamp}-${index}`}>
            <span>{event.role === 'user' ? '你' : 'Codex'}</span>
            <p>{event.content}</p>
          </article>
        ))}
        {task.local.activeResume ? (
          <article className="message assistant live">
            <span>Codex</span>
            <p>正在继续修改，实时输出可在“执行动态”中查看。</p>
          </article>
        ) : null}
      </div>
      <form onSubmit={submit} className="chat-form">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            task.executionStatus === '执行中'
              ? '当前执行完成后即可继续对话'
              : '例如：心情选项改成 5 个，并在记录卡片上显示…'
          }
          disabled={!canSend}
          rows={3}
        />
        <div className="chat-actions">
          <small>
            {!task.local.sessionId
              ? '这条任务还没有 Codex 会话'
              : task.executionStatus === '执行中'
                ? '正在执行，暂不可重复发送'
                : '发送后会继续同一 worktree'}
          </small>
          <button type="submit" disabled={!canSend || !message.trim()} title="发送后续修改">
            {submitting ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
            发送
          </button>
        </div>
        {notice ? <p className="chat-notice">{notice}</p> : null}
      </form>
    </aside>
  );
}

function App() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [tab, setTab] = useState<Tab>('activity');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadTasks = useCallback(async (fresh = false) => {
    if (fresh) setRefreshing(true);
    try {
      const payload = await requestJson<{ tasks: TaskSummary[] }>(
        `/api/tasks${fresh ? '?fresh=1' : ''}`,
      );
      setTasks(payload.tasks);
      setError('');
      setSelectedId((current) => {
        if (current && payload.tasks.some((task) => task.id === current)) return current;
        return payload.tasks.find((task) => task.executionStatus === '执行中')?.id || payload.tasks[0]?.id || '';
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDetail = useCallback(async (recordId: string) => {
    if (!recordId) return;
    try {
      const payload = await requestJson<{ task: TaskDetail }>(
        `/api/tasks/${encodeURIComponent(recordId)}`,
      );
      setDetail(payload.task);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    }
  }, []);

  useEffect(() => {
    loadTasks(true);
    const timer = window.setInterval(() => loadTasks(false), 15000);
    return () => window.clearInterval(timer);
  }, [loadTasks]);

  useEffect(() => {
    setDetail(null);
    if (!selectedId) return undefined;
    loadDetail(selectedId);
    const timer = window.setInterval(() => loadDetail(selectedId), 5000);
    return () => window.clearInterval(timer);
  }, [loadDetail, selectedId]);

  const activeCount = tasks.filter((task) => task.executionStatus === '执行中').length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <button
            className="icon-button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? '展开任务列表' : '收起任务列表'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div className="brand-mark">
            <Code2 size={18} />
          </div>
          <div>
            <strong>Codex 任务台</strong>
            <span>飞书需求 · 代码实现 · 验证续改</span>
          </div>
        </div>
        <div className="header-status">
          <span className={`runner-indicator ${activeCount ? 'active' : ''}`}>
            {activeCount ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
            {activeCount ? `${activeCount} 个任务执行中` : '后台监听正常'}
          </span>
          <button
            className="icon-button"
            onClick={() => {
              loadTasks(true);
              if (selectedId) loadDetail(selectedId);
            }}
            title="刷新"
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          <AlertCircle size={17} />
          {error}
        </div>
      ) : null}

      <div className={`workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <TaskList
          tasks={tasks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          collapsed={sidebarCollapsed}
        />

        <main className="task-main">
          {loading ? (
            <div className="center-loader">
              <Loader2 size={25} className="spin" />
              正在读取飞书任务
            </div>
          ) : detail ? (
            <>
              <Overview task={detail} />
              <nav className="tab-bar" aria-label="任务详情视图">
                <button
                  className={tab === 'activity' ? 'active' : ''}
                  onClick={() => setTab('activity')}
                >
                  <Play size={16} />
                  执行动态
                </button>
                <button
                  className={tab === 'diff' ? 'active' : ''}
                  onClick={() => setTab('diff')}
                >
                  <FileCode2 size={16} />
                  代码改动
                </button>
                <button
                  className={tab === 'validation' ? 'active' : ''}
                  onClick={() => setTab('validation')}
                >
                  <TestTube2 size={16} />
                  验证与附件
                </button>
              </nav>
              <div className="tab-content">
                {tab === 'activity' ? <ActivityPanel task={detail} /> : null}
                {tab === 'diff' ? <DiffPanel task={detail} /> : null}
                {tab === 'validation' ? <ValidationPanel task={detail} /> : null}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<CircleDot size={25} />}
              title="还没有可查看的 AI 任务"
              description="在飞书中把“是否 AI 自动修改”设为“是”后，任务会出现在这里。"
            />
          )}
        </main>

        {detail ? <ConversationPanel task={detail} onSent={() => loadDetail(detail.id)} /> : null}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
