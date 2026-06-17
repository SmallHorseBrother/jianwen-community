# WeChat Message Bridge

This bridge sends raw CipherTalk text messages to the feedback bot ingest API.

It is intentionally thinner than `scripts/wechat-feedback-intake.mjs`:

- CipherTalk exports WeChat messages.
- This script normalizes text messages and posts them to `/api/messages/ingest`.
- The feedback bot remains responsible for batching, AI classification, Feishu group notifications, and Base writes.

## Dry run

```bash
node scripts/wechat-message-bridge.mjs --dry-run --from 1d --source food-seed --limit 20
```

The dry run writes `tmp/wechat-message-bridge-YYYY-MM-DD/bridge-report.json` and does not call the bot.

Replay an existing CipherTalk export:

```bash
node scripts/wechat-message-bridge.mjs --dry-run --source food-seed --input C:/path/to/export.json --limit 20
```

## Send once

Set the token outside source control:

```powershell
$env:FEEDBACK_BOT_TOKEN="..."
node scripts/wechat-message-bridge.mjs --from 1d --source food-seed
```

Optional endpoint override:

```powershell
$env:FEEDBACK_BOT_INGEST_URL="https://feedback-bot.healthymax.cn/api/messages/ingest"
```

## Polling mode

Before the first live run, prime the local state so the bridge starts from new messages instead of replaying the whole lookback window:

```powershell
node scripts/wechat-message-bridge.mjs --prime-state --from 1d
```

`--prime-state` exports configured sources and records current message IDs in the local state file without calling the bot.

```powershell
$env:FEEDBACK_BOT_TOKEN="..."
node scripts/wechat-message-bridge.mjs --watch --from 1d --interval 120
```

`--interval` is seconds. The default is 120 seconds. The script exports each enabled CipherTalk source every interval and only sends messages that are not already in the local state file. For quieter production polling, use `--interval 300`.

## State and dedupe

Local state defaults to:

```text
tmp/wechat-message-bridge-state.json
```

The bot still dedupes by `message_id`. The local state only avoids unnecessary repeat POSTs.

`message_id` is:

- CipherTalk `message.id` when present.
- Otherwise `sha256(source_id + sender_id + timestamp + content)`.

## Confirmation field

The current ingest API only accepts `message_type: "text"`, so this bridge sends text messages only. It includes this metadata in `raw` so the bot can map it into the Feishu Base:

```json
{
  "raw": {
    "review": {
      "initial_confirmation": "pending",
      "needs_human_confirmation": true
    }
  }
}
```

Recommended Base field mapping for `foodAI-需求以及bug管理`:

- `状态`: write new AI-created items as `待处理` or `待讨论`, then let a human move them through `待启动` / `开发中` / `验收中` / `已完成`.
- `分组`: source group or AI-generated issue group
- `分类`: bug / feedback / requirement / question / noise
- `原始群聊消息`: original message window or condensed evidence

The copied Base already has a usable `状态` field, so a separate `确认` field is optional rather than required.

## Source config

Sources come from:

```text
scripts/wechat-feedback-sources.example.json
```

Use a stable `sessionId` as `source_id`; the same WeChat group must always resolve to the same value.
