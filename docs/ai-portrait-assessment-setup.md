# AI画像双测评上线配置

> 注意：本文件描述的是已上线的旧版能力测评。PACF v1 候选题库和旧数据迁移方案见
> [PACF 候选题库与旧数据迁移说明](./ai-capability-system/04-item-bank-and-legacy-migration.md)。
> 在新版题库、评分函数、Edge Function 和页面尚未成套发布前，不要把旧版 Level 直接改名为 PACF Level。

## 已实现的流程

- AI能力等级测评：每位用户作答30题，输出Level 0–5和六维雷达图。
- AI人格画像：28题，输出四维倾向、合法四字母编码和16种中文角色名。
- 用户无需注册或登录；浏览器后台静默创建Supabase匿名用户。
- 能力Level 0–1进入基础群、2–3进入应用群、4–5进入实战群。
- 微信/支付宝支付沿用现有通道，成功后只显示四位入群ID和对应群二维码。
- 大模型只解释结果，不参与等级或人格判定；调用失败时自动返回规则报告。

## 1. 执行数据库迁移

在Supabase网页控制台的 SQL Editor 中执行：

```text
supabase/migrations/20260806070652_add_ai_portrait_assessments.sql
```

该迁移会扩展现有 `ai_assessments`，并新增 `ai_assessment_attempts` 历史记录表。不会删除已有测评、订单、会员或支付数据。

## 2. 开启匿名登录

打开 Supabase Dashboard：

```text
Authentication → Providers → Anonymous Sign-Ins → Enable
```

匿名用户不会在网站上显示为已登录，只作为测评记录和支付订单的后台所有者。用户清除浏览器数据或更换设备后，未绑定账号的游客身份无法找回；当前产品以支付后保存四位ID为主要凭证。

正式大规模传播前，建议同时在 Authentication 的安全设置中启用 Cloudflare Turnstile 或其他 CAPTCHA，避免匿名注册被滥用。

## 3. 部署分析函数

在Supabase Edge Functions中新建或更新：

```text
ai-assessment-engine
```

入口代码：

```text
supabase/functions/ai-assessment-engine/index.ts
```

因为分享结果是公开读取，函数的 `Verify JWT` 应关闭。函数内部会对提交、历史和支付相关操作再次验证用户JWT；公开接口只返回结果摘要，不返回答案或用户ID。

## 4. 大模型配置

函数复用项目已有DeepSeek配置：

```text
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_ASSESSMENT_MODEL=deepseek-chat
```

只有 `DEEPSEEK_API_KEY` 必填；另外两个有默认值。没有配置或接口超时时，用户仍会立即得到稳定的规则报告。

## 5. 上线验证

1. 未登录状态打开 `/tools/ai-assessment`，页面不应要求登录。
2. 完成人格测评，确认得到中文称呼和四字母编码，并能打开分享链接。
3. 完成能力测评，确认得到Level 0–5和六维雷达图。
4. 点击微信或支付宝，确认金额正确；支付后显示四位ID和对应群二维码。
5. 重新测评，确认新结果会保存为历史记录，但已付款用户的入群ID保持不变。
