# OpenClaw -> `task-intake`

This is the smallest working integration guide.

## 1. Set the function secret

Configure a fixed intake token for the Supabase Edge Function:

```bash
supabase secrets set TASK_INTAKE_TOKEN=your-strong-token
```

The function checks the request header as:

```text
x-task-intake-token: <TOKEN>
```

Do not put this token in the `Authorization` header, because Supabase may treat that header as a JWT and reject the request before your function code runs.

## 2. Function URL

After deployment, the URL is usually:

```text
https://<your-project-ref>.supabase.co/functions/v1/task-intake
```

## 3. Request body

You can POST either a raw array or an object with `tasks`.

Required fields for each task:

- `title`
- `source_group`

Deduplication / upsert uses `source_group + title`, and records are written into the `feedback_tasks` table.

Example:

```json
{
  "tasks": [
    {
      "title": "Summarize this week's FAQ",
      "summary": "Turn repeated chat questions into one reusable answer",
      "type": "group_summary",
      "status": "pending",
      "priority": "high",
      "source_group": "fat-loss-group-3",
      "source_session_id": "2026-03-13-am",
      "source_from": "2026-03-13T08:00:00+08:00",
      "source_to": "2026-03-13T11:00:00+08:00",
      "evidence_json": [
        {
          "message_id": "wx-1001",
          "speaker": "Alice"
        }
      ],
      "tags_json": ["faq", "fat-loss"],
      "owner": "OpenClaw",
      "progress_note": "Created from morning chat summary",
      "is_public": true
    }
  ]
}
```

## 4. `curl` example

```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/task-intake" \
  -H "Content-Type: application/json" \
  -H "x-task-intake-token: your-strong-token" \
  -d '{
    "tasks": [
      {
        "title": "Summarize this week's FAQ",
        "summary": "Turn repeated chat questions into one reusable answer",
        "source_group": "fat-loss-group-3",
        "priority": "high",
        "is_public": true
      }
    ]
  }'
```

## 5. Response shape

The function returns summary stats, for example:

```json
{
  "success": true,
  "stats": {
    "received": 2,
    "accepted": 2,
    "inserted": 1,
    "updated": 1,
    "invalid": 0,
    "deduped_in_batch": 0
  }
}
```

For the smallest OpenClaw integration, start with:

- `title`
- `summary`
- `source_group`
- `priority`
- `is_public`
