# AI画像双测评上线配置

> 当前体系由 [PACF 能力测评](./ai-capability-system/01-ai-capability-framework-v1.md) 与
> [AI 使用风格测评](./ai-style-system/00-ai-usage-style-framework-v1.md) 两套独立工具组成。
> 能力决定学习准备度；风格只描述偏好，不参与能力等级和入群路由。

## 已实现的流程

- PACF AI能力扩展筛查：每位用户作答42题（六维各7题），输出Level 0–5和六维雷达图。
- AI使用风格扩展画像：32道计分题加4道实验题，输出四条0–100连续轴、平衡提示、四字母编码和16种中文角色名。
- 用户无需注册或登录；浏览器后台静默创建Supabase匿名用户。
- 能力Level 0–1进入基础群、2–3进入应用群、4–5进入实战群。
- 微信/支付宝支付沿用现有通道，成功后只显示四位入群ID和对应群二维码。
- 大模型只解释结果，不参与等级、风格轴或四字母代码判定；调用失败时自动返回规则报告。

## 1. 执行数据库迁移

在Supabase网页控制台的 SQL Editor 中按顺序执行：

```text
supabase/migrations/20260806070652_add_ai_portrait_assessments.sql
supabase/migrations/20260808232543_pacf_assessment_versioning.sql
supabase/migrations/20260810090830_ai_usage_style_v1.sql
```

这些迁移会建立版本化测评记录、PACF逐题记录和AI使用风格逐题记录。不会删除已有测评、订单、会员或支付数据，也不会把旧人格分数换算为新版风格分数。

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
2. 完成AI使用风格测评，确认得到四条连续轴、平衡提示、中文称呼和四字母编码，并能打开分享链接。
3. 完成能力测评，确认得到Level 0–5和六维雷达图。
4. 点击微信或支付宝，确认金额正确；支付后显示四位ID和对应群二维码。
5. 重新测评，确认新结果会保存为历史记录，但已付款用户的入群ID保持不变。
