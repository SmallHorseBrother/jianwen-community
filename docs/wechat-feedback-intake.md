# WeChat Feedback Intake

This workflow turns CipherTalk WeChat exports into `feedback_tasks` candidates.

## Dry run

```bash
npm run wechat:intake:dry -- --from 7d --output tmp/wechat-feedback-intake-test
```

Dry run writes:

- `candidate-tasks.json`
- `analysis.json`
- `report.md`
- raw CipherTalk exports under `exports/`

It does not write Supabase.

## Write to `/tasks`

Set either `TASK_INTAKE_ENDPOINT` or `VITE_SUPABASE_URL`, plus `TASK_INTAKE_TOKEN`.

```bash
$env:VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
$env:TASK_INTAKE_TOKEN="<token>"
npm run wechat:intake -- --from 7d
```

Auto-code candidates are written with `execution_status=not_ready`. They will not run until a human marks them `ready` in `/tasks`.

## Source config

Edit:

```text
scripts/wechat-feedback-sources.example.json
```

Known sources are mapped to:

- `food_link`
- `coachlink-wechat-app`
- `coachlink`
- `jianwen-community`

Groups without a known CipherTalk `sessionId` are disabled until the id is filled in.
