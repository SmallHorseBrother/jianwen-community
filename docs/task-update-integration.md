# Task Update Integration

## What changed

`/tasks` no longer writes directly to `feedback_tasks` from the browser.
It now calls a dedicated Supabase Edge Function:

- `task-update`

This avoids browser-side updates being blocked by `feedback_tasks` RLS.

## Required env / secrets

### Supabase Edge Function secret

Set on Supabase:

```bash
supabase secrets set TASK_UPDATE_TOKEN=your-strong-update-token
```

### Frontend env

Set in your frontend `.env`:

```bash
VITE_TASK_UPDATE_TOKEN=your-strong-update-token
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
```

> Note: because this token is sent from the browser, it is only a lightweight gate, not a strong secret boundary.

## Deploy

```bash
supabase functions deploy task-update
```

## Request format

POST to:

```text
https://<your-project-ref>.supabase.co/functions/v1/task-update
```

Headers:

```text
Content-Type: application/json
x-task-update-token: <TOKEN>
```

Body example:

```json
{
  "id": "98408090-7c5e-482e-9558-7b5809fc5013",
  "title": "测试任务：验证自动写入链路",
  "summary": "这是一条手动测试写入的数据",
  "type": "group_summary",
  "status": "in_progress",
  "priority": "high",
  "owner": "枭马葛",
  "progress_note": "已在网页端手动更新",
  "is_public": true
}
```

## Editable fields

`task-update` only accepts these editable business fields:

- `title`
- `summary`
- `type`
- `status`
- `priority`
- `owner`
- `progress_note`
- `is_public`

It does **not** allow browser edits to source-trace fields like:

- `source_group`
- `source_session_id`
- `source_from`
- `source_to`
- `created_at`
- `created_by`
