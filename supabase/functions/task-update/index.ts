import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type TaskType = 'group_summary' | 'follow_up' | 'todo' | 'other'
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface TaskMutationPayload {
  action?: 'create' | 'update' | 'delete'
  id?: string
  title?: string | null
  summary?: string | null
  type?: string | null
  status?: string | null
  priority?: string | null
  source_group?: string | null
  source_session_id?: string | null
  source_from?: string | null
  source_to?: string | null
  owner?: string | null
  progress_note?: string | null
  is_public?: boolean | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-task-update-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const normalizeType = (value: unknown, fallback: TaskType = 'group_summary'): TaskType | null => {
  const candidate = asTrimmedString(value)
  if (!candidate) return fallback
  return allowedTypes.has(candidate as TaskType) ? (candidate as TaskType) : null
}

const normalizeStatus = (value: unknown, fallback: TaskStatus = 'pending'): TaskStatus | null => {
  const candidate = asTrimmedString(value)
  if (!candidate) return fallback
  return allowedStatuses.has(candidate as TaskStatus) ? (candidate as TaskStatus) : null
}

const normalizePriority = (value: unknown, fallback: TaskPriority = 'medium'): TaskPriority | null => {
  const candidate = asTrimmedString(value)
  if (!candidate) return fallback
  return allowedPriorities.has(candidate as TaskPriority) ? (candidate as TaskPriority) : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const expectedToken = Deno.env.get('TASK_UPDATE_TOKEN')?.trim()
  if (!expectedToken) {
    return jsonResponse({ error: 'Missing TASK_UPDATE_TOKEN environment variable' }, 500)
  }

  const providedToken = req.headers.get('x-task-update-token')?.trim() ?? ''
  if (!providedToken) {
    return jsonResponse({ error: 'Missing x-task-update-token header' }, 401)
  }

  if (providedToken !== expectedToken) {
    return jsonResponse({ error: 'Invalid task update token' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase environment variables' }, 500)
  }

  try {
    const body = (await req.json()) as TaskMutationPayload
    const action = body?.action ?? 'update'
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (action === 'create') {
      const title = asTrimmedString(body.title)
      const sourceGroup = asTrimmedString(body.source_group) ?? 'manual'
      if (!title) {
        return jsonResponse({ error: 'Title is required when creating a task' }, 400)
      }

      const type = normalizeType(body.type)
      if (!type) return jsonResponse({ error: 'Invalid task type' }, 400)
      const status = normalizeStatus(body.status)
      if (!status) return jsonResponse({ error: 'Invalid task status' }, 400)
      const priority = normalizePriority(body.priority)
      if (!priority) return jsonResponse({ error: 'Invalid task priority' }, 400)
      if (body.is_public !== undefined && typeof body.is_public !== 'boolean') {
        return jsonResponse({ error: 'is_public must be a boolean' }, 400)
      }

      const insertPayload = {
        title,
        summary: asTrimmedString(body.summary),
        type,
        status,
        priority,
        source_group: sourceGroup,
        source_session_id: asTrimmedString(body.source_session_id),
        source_from: asTrimmedString(body.source_from),
        source_to: asTrimmedString(body.source_to),
        owner: asTrimmedString(body.owner),
        progress_note: asTrimmedString(body.progress_note),
        is_public: typeof body.is_public === 'boolean' ? body.is_public : true,
        created_by: null,
      }

      const { data, error } = await supabase
        .from('feedback_tasks')
        .insert(insertPayload)
        .select('*')
        .single()

      if (error) throw error

      return jsonResponse({ success: true, action: 'create', task: data })
    }

    const id = asTrimmedString(body?.id)
    if (!id) {
      return jsonResponse({ error: 'Missing task id' }, 400)
    }

    if (action === 'delete') {
      const { data, error } = await supabase
        .from('feedback_tasks')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) return jsonResponse({ error: 'Task not found' }, 404)

      return jsonResponse({ success: true, action: 'delete', id })
    }

    const titleCandidate = typeof body.title === 'string' ? body.title.trim() : null
    if (body.title !== undefined && !titleCandidate) {
      return jsonResponse({ error: 'Title cannot be empty when provided' }, 400)
    }

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = titleCandidate
    if (body.summary !== undefined) updates.summary = asTrimmedString(body.summary)
    if (body.type !== undefined) {
      const type = normalizeType(body.type)
      if (!type) return jsonResponse({ error: 'Invalid task type' }, 400)
      updates.type = type
    }
    if (body.status !== undefined) {
      const status = normalizeStatus(body.status)
      if (!status) return jsonResponse({ error: 'Invalid task status' }, 400)
      updates.status = status
    }
    if (body.priority !== undefined) {
      const priority = normalizePriority(body.priority)
      if (!priority) return jsonResponse({ error: 'Invalid task priority' }, 400)
      updates.priority = priority
    }
    if (body.owner !== undefined) updates.owner = asTrimmedString(body.owner)
    if (body.progress_note !== undefined) updates.progress_note = asTrimmedString(body.progress_note)
    if (body.is_public !== undefined) {
      if (typeof body.is_public !== 'boolean') {
        return jsonResponse({ error: 'is_public must be a boolean' }, 400)
      }
      updates.is_public = body.is_public
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: 'No editable fields provided' }, 400)
    }

    const { data, error } = await supabase
      .from('feedback_tasks')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return jsonResponse({ error: 'Task not found' }, 404)

    return jsonResponse({ success: true, action: 'update', task: data })
  } catch (error) {
    console.error('task-update error', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})
