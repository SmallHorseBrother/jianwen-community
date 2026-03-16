import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ListTodo, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database, TaskPriority, TaskStatus, TaskType } from '../lib/database.types';

type TaskRow = Database['public']['Tables']['feedback_tasks']['Row'];

type EditableTaskFields = Pick<
  TaskRow,
  'title' | 'summary' | 'type' | 'status' | 'priority' | 'owner' | 'progress_note' | 'is_public'
>;

const statusOptions: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const typeOptions: TaskType[] = ['group_summary', 'follow_up', 'todo', 'other'];

const statusClassMap: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

const priorityClassMap: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-indigo-100 text-indigo-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeOptionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildDraftFromTask = (task: TaskRow): EditableTaskFields => ({
  title: task.title,
  summary: task.summary,
  type: task.type,
  status: task.status,
  priority: task.priority,
  owner: task.owner,
  progress_note: task.progress_note,
  is_public: task.is_public,
});

const taskUpdateEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/task-update`;
const taskUpdateToken = import.meta.env.VITE_TASK_UPDATE_TOKEN as string | undefined;

const sortTasks = (rows: TaskRow[]) =>
  [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableTaskFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const loadTasks = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('feedback_tasks')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (queryError) {
      setError(queryError.message);
      setTasks([]);
      setLoading(false);
      return;
    }

    const rows = (data as TaskRow[]) ?? [];
    setTasks(rows);

    if (rows.length > 0) {
      const stillExists = selectedTaskId && rows.some((task) => task.id === selectedTaskId);
      const nextSelected = stillExists ? selectedTaskId : rows[0].id;
      const nextTask = rows.find((task) => task.id === nextSelected) ?? rows[0];
      setSelectedTaskId(nextTask.id);
      setDraft(buildDraftFromTask(nextTask));
    } else {
      setSelectedTaskId(null);
      setDraft(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      setDraft(buildDraftFromTask(selectedTask));
      setSaveMessage(null);
    }
  }, [selectedTask]);

  const selectTask = (task: TaskRow) => {
    setSelectedTaskId(task.id);
    setDraft(buildDraftFromTask(task));
    setSaveMessage(null);
  };

  const updateDraft = <K extends keyof EditableTaskFields>(key: K, value: EditableTaskFields[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const hasChanges = useMemo(() => {
    if (!selectedTask || !draft) return false;

    return (
      draft.title !== selectedTask.title ||
      (draft.summary ?? null) !== (selectedTask.summary ?? null) ||
      draft.type !== selectedTask.type ||
      draft.status !== selectedTask.status ||
      draft.priority !== selectedTask.priority ||
      (draft.owner ?? null) !== (selectedTask.owner ?? null) ||
      (draft.progress_note ?? null) !== (selectedTask.progress_note ?? null) ||
      draft.is_public !== selectedTask.is_public
    );
  }, [draft, selectedTask]);

  const callTaskUpdateApi = async (payload: Record<string, unknown>) => {
    if (!taskUpdateEndpoint || !taskUpdateToken) {
      throw new Error('缺少 VITE_SUPABASE_URL 或 VITE_TASK_UPDATE_TOKEN 配置');
    }

    const response = await fetch(taskUpdateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-task-update-token': taskUpdateToken,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error ?? `HTTP ${response.status}`);
    }

    return result;
  };

  const handleSave = async () => {
    if (!selectedTask || !draft || !hasChanges) return;

    setSaving(true);
    setSaveMessage(null);

    const payload = {
      action: 'update',
      id: selectedTask.id,
      title: draft.title.trim() || selectedTask.title,
      summary: normalizeOptionalText(draft.summary ?? ''),
      type: draft.type,
      status: draft.status,
      priority: draft.priority,
      owner: normalizeOptionalText(draft.owner ?? ''),
      progress_note: normalizeOptionalText(draft.progress_note ?? ''),
      is_public: draft.is_public,
    };

    try {
      const result = await callTaskUpdateApi(payload);
      const updatedTask = result?.task as TaskRow | undefined;
      if (!updatedTask) {
        throw new Error('接口未返回更新后的任务');
      }

      setTasks((current) => sortTasks(current.map((task) => (task.id === updatedTask.id ? updatedTask : task))));
      setSelectedTaskId(updatedTask.id);
      setDraft(buildDraftFromTask(updatedTask));
      setSaveMessage('已保存');
    } catch (error) {
      setSaveMessage(`保存失败：${error instanceof Error ? error.message : '请求异常'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const result = await callTaskUpdateApi({
        action: 'create',
        title: '新任务',
        summary: '',
        type: 'todo',
        status: 'pending',
        priority: 'medium',
        source_group: 'manual',
        owner: '',
        progress_note: '',
        is_public: true,
      });

      const createdTask = result?.task as TaskRow | undefined;
      if (!createdTask) {
        throw new Error('接口未返回新建后的任务');
      }

      setTasks((current) => sortTasks([createdTask, ...current]));
      setSelectedTaskId(createdTask.id);
      setDraft(buildDraftFromTask(createdTask));
      setSaveMessage('已新建任务');
    } catch (error) {
      setSaveMessage(`新建失败：${error instanceof Error ? error.message : '请求异常'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    const confirmed = window.confirm(`确认删除任务「${selectedTask.title}」吗？`);
    if (!confirmed) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      await callTaskUpdateApi({
        action: 'delete',
        id: selectedTask.id,
      });

      const remainingTasks = tasks.filter((task) => task.id !== selectedTask.id);
      setTasks(sortTasks(remainingTasks));

      if (remainingTasks.length > 0) {
        const nextTask = remainingTasks[0];
        setSelectedTaskId(nextTask.id);
        setDraft(buildDraftFromTask(nextTask));
      } else {
        setSelectedTaskId(null);
        setDraft(null);
      }

      setSaveMessage('已删除任务');
    } catch (error) {
      setSaveMessage(`删除失败：${error instanceof Error ? error.message : '请求异常'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!selectedTask) return;
    setDraft(buildDraftFromTask(selectedTask));
    setSaveMessage(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-600 font-semibold mb-2">
              <ListTodo className="w-5 h-5" />
              <span>Task Panel</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Group Summary Tasks</h1>
            <p className="text-gray-600 mt-2">
              可在此页查看、编辑、手动新建和删除任务；来源追踪字段保持只读。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void handleCreate();
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              新建任务
            </button>
            <button
              onClick={() => {
                void loadTasks();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="py-20 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            ) : error ? (
              <div className="p-6 flex items-start gap-3 text-red-700 bg-red-50 border-l-4 border-red-400">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <p className="font-medium">Failed to load tasks</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-20 text-center text-gray-500">
                No tasks yet. Click <span className="font-medium">新建任务</span> or wait for <code>task-intake</code> to write records.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {tasks.map((task) => {
                  const active = task.id === selectedTaskId;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => selectTask(task)}
                      className={`w-full text-left px-5 py-4 transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900 break-all">{task.title || 'Untitled task'}</h3>
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusClassMap[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                              {task.status}
                            </span>
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${priorityClassMap[task.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                              {task.priority}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            <span>类型：{task.type}</span>
                            <span>负责人：{task.owner ?? '-'}</span>
                            <span>群：{task.source_group ?? '-'}</span>
                            <span>{task.is_public ? '公开' : '私有'}</span>
                          </div>

                          <p className="text-sm text-gray-600 mt-3 line-clamp-2 whitespace-pre-wrap break-words">
                            {task.summary ?? task.progress_note ?? '暂无摘要或进展备注'}
                          </p>
                        </div>

                        <div className="shrink-0 text-xs text-gray-500 text-right">
                          <div>更新于</div>
                          <div className="mt-1">{formatDateTime(task.updated_at)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {!selectedTask || !draft ? (
              <div className="text-sm text-gray-500">Select a task to view and edit details.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">任务详情</h2>
                    <p className="text-sm text-gray-500 mt-1">可编辑业务字段；来源字段保持只读。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={!hasChanges || saving}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <X className="w-4 h-4" />
                      重置
                    </button>
                    <button
                      onClick={() => {
                        void handleSave();
                      }}
                      disabled={!hasChanges || saving}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>

                {saveMessage ? (
                  <div className={`rounded-lg px-4 py-3 text-sm ${saveMessage.includes('失败') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    {saveMessage}
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft('title', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">摘要</label>
                    <textarea
                      value={draft.summary ?? ''}
                      onChange={(e) => updateDraft('summary', e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
                      <select
                        value={draft.type}
                        onChange={(e) => updateDraft('type', e.target.value as TaskType)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ fontSize: '16px' }}
                      >
                        {typeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">负责人</label>
                      <input
                        type="text"
                        value={draft.owner ?? ''}
                        onChange={(e) => updateDraft('owner', e.target.value)}
                        placeholder="例如：枭马葛"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft('status', e.target.value as TaskStatus)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ fontSize: '16px' }}
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">优先级</label>
                      <select
                        value={draft.priority}
                        onChange={(e) => updateDraft('priority', e.target.value as TaskPriority)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ fontSize: '16px' }}
                      >
                        {priorityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">进展备注</label>
                    <textarea
                      value={draft.progress_note ?? ''}
                      onChange={(e) => updateDraft('progress_note', e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <label className="inline-flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.is_public}
                      onChange={(e) => updateDraft('is_public', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    对外公开显示
                  </label>
                </div>

                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">来源信息（只读）</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500">Source Group</dt>
                      <dd className="text-gray-900 mt-1 break-all">{selectedTask.source_group}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Source Session ID</dt>
                      <dd className="text-gray-900 mt-1 break-all">{selectedTask.source_session_id ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Source From</dt>
                      <dd className="text-gray-900 mt-1">{formatDateTime(selectedTask.source_from)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Source To</dt>
                      <dd className="text-gray-900 mt-1">{formatDateTime(selectedTask.source_to)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Created At</dt>
                      <dd className="text-gray-900 mt-1">{formatDateTime(selectedTask.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Updated At</dt>
                      <dd className="text-gray-900 mt-1">{formatDateTime(selectedTask.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
