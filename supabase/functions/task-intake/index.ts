import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-task-intake-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TaskType = 'group_summary' | 'follow_up' | 'todo' | 'other'
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface TaskPayload {
  title?: string
  summary?: string | null
  type?: string | null
  status?: string | null
  priority?: string | null
  source_group?: string | null
  source_session_id?: string | null
  source_from?: string | null
  source_to?: string | null
  evidence_json?: Json
  tags_json?: Json
  owner?: string | null
  progress_note?: string | null
  is_public?: boolean | null
}

interface TaskRecord {
  title: string
  summary: string | null
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  source_group: string
  source_session_id: string | null
  source_from: string | null
  source_to: string | null
  evidence_json: Json
  tags_json: Json
  owner: string | null
  progress_note: string | null
  is_public: boolean
}

const allowedTypes = new Set<TaskType>(['group_summary', 'follow_up', 'todo', 'other'])
const allowedStatuses = new Set<TaskStatus>(['pending', 'in_progress', 'completed', 'cancelled'])
const allowedPriorities = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeType = (value: unknown): TaskType => {
  const candidate = asTrimmedString(value)
  return candidate && allowedTypes.has(candidate as TaskType)
    ? (candidate as TaskType)
    : 'group_summary'
}

const normalizeStatus = (value: unknown): TaskStatus => {
  const candidate = asTrimmedString(value)
  return candidate && allowedStatuses.has(candidate as TaskStatus)
    ? (candidate as TaskStatus)
    : 'pending'
}

const normalizePriority = (value: unknown): TaskPriority => {
  const candidate = asTrimmedString(value)
  return candidate && allowedPriorities.has(candidate as TaskPriority)
    ? (candidate as TaskPriority)
    : 'medium'
}

const normalizeJson = (value: unknown, fallback: Json): Json => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null)
  ) {
    return value as Json
  }

  return fallback
}

const buildTaskRecord = (payload: TaskPayload): TaskRecord | null => {
  const title = asTrimmedString(payload.title)
  const sourceGroup = asTrimmedString(payload.source_group)

  if (!title || !sourceGroup) {
    return null
  }

  const status = normalizeStatus(payload.status)
  const summary = asTrimmedString(payload.summary)

  return {
    title,
    summary,
    type: normalizeType(payload.type),
    status,
    priority: normalizePriority(payload.priority),
    source_group: sourceGroup,
    source_session_id: asTrimmedString(payload.source_session_id),
    source_from: asTrimmedString(payload.source_from),
    source_to: asTrimmedString(payload.source_to),
    evidence_json: normalizeJson(payload.evidence_json, []),
    tags_json: normalizeJson(payload.tags_json, []),
    owner: asTrimmedString(payload.owner),
    progress_note: asTrimmedString(payload.progress_note),
    is_public: typeof payload.is_public === 'boolean' ? payload.is_public : true,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const expectedToken = Deno.env.get('TASK_INTAKE_TOKEN')?.trim()
  if (!expectedToken) {
    return jsonResponse({ error: 'Missing TASK_INTAKE_TOKEN environment variable' }, 500)
  }

  const providedToken = req.headers.get('x-task-intake-token')?.trim() ?? ''
  if (!providedToken) {
    return jsonResponse({ error: 'Missing x-task-intake-token header' }, 401)
  }

  if (providedToken !== expectedToken) {
    return jsonResponse({ error: 'Invalid task intake token' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase environment variables' }, 500)
  }

  try {
    const body = await req.json()
    const rawTasks: TaskPayload[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.tasks)
        ? body.tasks
        : []

    if (rawTasks.length === 0) {
      return jsonResponse({ error: 'Request body must include a non-empty tasks array' }, 400)
    }

    const mergedTasks = new Map<string, TaskRecord>()
    let invalid = 0
    let dedupedInBatch = 0

    for (const rawTask of rawTasks) {
      const task = buildTaskRecord(rawTask)

      if (!task) {
        invalid += 1
        continue
      }

      const dedupeKey = `${task.source_group}::${task.title}`
      if (mergedTasks.has(dedupeKey)) {
        dedupedInBatch += 1
      }

      mergedTasks.set(dedupeKey, task)
    }

    const tasks = Array.from(mergedTasks.values())
    if (tasks.length === 0) {
      return jsonResponse({ error: 'No valid tasks to write', stats: { received: rawTasks.length, invalid, deduped_in_batch: dedupedInBatch } }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const sourceGroups = Array.from(new Set(tasks.map((task) => task.source_group)))
    const titles = Array.from(new Set(tasks.map((task) => task.title)))

    const { data: existingRows, error: existingError } = await supabase
      .from('feedback_tasks')
      .select('source_group, title')
      .in('source_group', sourceGroups)
      .in('title', titles)

    if (existingError) {
      throw existingError
    }

    const existingKeys = new Set(
      (existingRows ?? []).map((row) => `${row.source_group}::${row.title}`),
    )

    const updated = tasks.filter((task) => existingKeys.has(`${task.source_group}::${task.title}`)).length
    const inserted = tasks.length - updated

    const { data, error } = await supabase
      .from('feedback_tasks')
      .upsert(tasks.map(task => ({ ...task, created_by: null })), { onConflict: 'source_group,title' })
      .select('id, title, source_group, updated_at')

    if (error) {
      throw error
    }

    return jsonResponse({
      success: true,
      stats: {
        received: rawTasks.length,
        accepted: tasks.length,
        inserted,
        updated,
        invalid,
        deduped_in_batch: dedupedInBatch,
      },
      tasks: data ?? [],
    })
  } catch (error) {
    console.error('task-intake error', error)

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      500,
    )
  }
})
