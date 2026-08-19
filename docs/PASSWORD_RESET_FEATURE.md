# 忘记密码与短信验证码

健文社区的自助找回流程使用注册手机号接收一次性验证码：

```
输入手机号 → 完成滑块验证 → 获取短信验证码 → 输入新密码 → 重置成功
```

前端不会读取 `profiles.phone`，也不会直接调用数据库函数修改密码。所有敏感操作都由
`password-reset` Supabase Edge Function 完成：它使用服务端密钥查询用户、发送验证码、
校验验证码，并调用 Supabase Auth Admin API 修改密码。

## 已复用的 Coachlink 能力

- 腾讯云 SMS `SendSms` API（2021-01-11）；
- 6 位随机验证码；
- 验证码 10 分钟有效；
- 同一手机号 60 秒内只能发送一次；
- 最多允许 5 次验证码校验失败，之后必须重新获取；
- 验证成功或过期后，验证码立即删除。

验证码只以 HMAC 哈希形式储存于 `password_reset_otps`，浏览器角色没有该表的任何读取或
写入权限。未注册手机号和已注册手机号返回相同的发送提示，避免泄露账号是否存在。

## 网页控制台部署

在健文社区的 Supabase 项目中，依次执行：

1. 打开 **Database → SQL Editor**，执行
   [`202608200002_add_password_reset_otps.sql`](../supabase/migrations/202608200002_add_password_reset_otps.sql)。
2. 打开 **Edge Functions → Deploy a new function → Via Editor**，函数名填写 `password-reset`。
3. 将 [`supabase/functions/password-reset/index.ts`](../supabase/functions/password-reset/index.ts)
   的完整内容粘贴到编辑器。
4. 在部署界面关闭 **Verify JWT**（找回密码时用户尚未登录；函数会自行校验短信验证码）。
5. 点击 **Deploy function**。
6. 部署前端，让 `/forgot-password` 使用新函数。

Dashboard 编辑器的改动没有版本历史或回滚能力；请保留仓库中的函数源文件作为唯一可追溯版本。

## Edge Function Secrets

请从 Coachlink 的现有配置中复制对应的**值**到健文社区的
**Edge Functions → Secrets**；不要写入 `.env`、前端代码或 Git。

| Secret | 用途 |
| --- | --- |
| `TENCENTCLOUD_SECRET_ID` | 腾讯云 API 密钥 ID |
| `TENCENTCLOUD_SECRET_KEY` | 腾讯云 API 密钥 |
| `TENCENTCLOUD_REGION` | 腾讯云地域；沿用 Coachlink 的值，通常为 `ap-guangzhou` |
| `TENCENTCLOUD_SMS_SDK_APP_ID` | 腾讯云短信应用 ID |
| `TENCENTCLOUD_SMS_SIGN_NAME` | 已审核通过的短信签名 |
| `TENCENTCLOUD_SMS_VERIFICATION_TEMPLATE_ID` | 已审核通过的验证码模板 ID；模板需有两个参数：验证码、有效分钟数 |
| `PASSWORD_RESET_CODE_PEPPER` | 新生成的至少 32 字符随机字符串，用于不可逆地哈希验证码 |

Supabase 托管的 Edge Function 默认已有 `SUPABASE_URL` 和服务端密钥，无需额外添加。
设置或修改 Secret 后立即对函数生效，无需再次部署。

腾讯云的 `SendSms` 接口使用 `sms.tencentcloudapi.com`、API 版本 `2021-01-11`，短信签名和
模板必须先在腾讯云短信控制台审核通过。[腾讯云 SendSms 文档](https://cloud.tencent.com/document/product/382/55981)

## 不要恢复旧方案

旧的 `reset_user_password(phone, password)` RPC 已删除。它只校验手机号而不验证号码归属，
任何知道他人手机号的人都可能重置其密码；不得重新授予匿名或已登录用户执行权限。
