# AI 学习群：纯网页端部署说明

测评免费；用户支付「入群权益」后，系统才会生成唯一群昵称，并给已支付用户签发对应微信群二维码的短期访问链接。

整个流程可以只使用 Supabase 网页后台，不需要在本地安装或运行 Supabase CLI。

## 1. 在网页 SQL Editor 创建数据库结构

1. 登录 Supabase Dashboard，进入社区对应的项目。
2. 左侧进入 `SQL Editor`，点击 `New query`。
3. 打开本项目的 `supabase/migrations/202608040001_add_ai_group_access.sql`。
4. 复制整个文件，粘贴进 SQL Editor。
5. 点击 `Run`，确认返回成功。

这段 SQL 会创建：测评记录、入群权益、支付订单、三档群路线、四位唯一 ID 生成逻辑、RLS 权限，以及私有 Storage bucket `ai-group-qr`。脚本已对策略使用 `drop policy if exists`，需要重试时可以重新执行。

注意：只复制 SQL 文件内容，不要把 Markdown 的代码围栏一起复制。

## 2. 在网页创建并部署 Function

1. 左侧进入 `Edge Functions`。
2. 点击 `Deploy a new function`。
3. 选择 `Via Editor`。
4. Function 名称填写：`ai-group-payment`。
5. 打开本项目的 `supabase/functions/ai-group-payment/index.ts`，复制全部内容，覆盖网页编辑器里的示例代码。
6. 点击 `Deploy function`。
7. 部署成功后进入这个 Function 的 `Details` 或 `Function configuration`。
8. 将 `Verify JWT with legacy secret` 关闭。

第 8 步必须执行。微信和支付宝的支付通知不会携带 Supabase JWT；如果此开关保持开启，支付平台回调会在进入代码前直接收到 401。函数内部已经分别验证微信和支付宝签名，并且浏览器发起的下单操作仍会自行验证用户登录状态。

以后每次在网页更新 Function 后，都重新确认这个开关仍然是关闭状态。

## 3. 在网页配置 Function Secrets

进入 Supabase Dashboard 的 `Edge Function Secrets Management` 页面，逐项添加下面的 Key 和 Value。不要把私钥直接写进 `index.ts`；Function 代码已经使用 `Deno.env.get(...)` 读取这些值。

### 公共配置

| Key | Value |
|---|---|
| `AI_GROUP_UNLOCK_PRICE_CENTS` | `1990` |
| `AI_GROUP_PAYMENT_RETURN_URL` | `https://你的正式域名/tools/ai-assessment` |

`AI_GROUP_UNLOCK_PRICE_CENTS` 不填写也会默认使用 1990 分，但建议在后台明确保存，方便以后改价。

### 微信支付

| Key | 填写内容 |
|---|---|
| `AI_GROUP_WECHAT_APP_ID` | 微信支付绑定的公众号或应用 AppID |
| `AI_GROUP_WECHAT_MCH_ID` | 微信支付商户号 |
| `AI_GROUP_WECHAT_MERCHANT_SERIAL_NO` | 商户 API 证书序列号 |
| `AI_GROUP_WECHAT_API_V3_KEY` | 32 字节 API v3 密钥 |
| `AI_GROUP_WECHAT_PRIVATE_KEY` | 商户 API 私钥，PKCS#8 PEM |
| `AI_GROUP_WECHAT_PLATFORM_PUBLIC_KEY` | 微信支付平台公钥，SPKI PEM |

私钥和公钥可以保留正常换行直接粘贴。如果网页输入框不方便输入多行，也可以写成：

```text
-----BEGIN PRIVATE KEY-----\n中间的Base64内容\n-----END PRIVATE KEY-----
```

代码会自动把 `\n` 还原成换行。不要在聊天、截图或前端环境变量中发送这些值。

### 支付宝

| Key | 填写内容 |
|---|---|
| `AI_GROUP_ALIPAY_APP_ID` | 支付宝开放平台应用 AppID |
| `AI_GROUP_ALIPAY_PRIVATE_KEY` | 应用私钥，PKCS#8 PEM |
| `AI_GROUP_ALIPAY_PUBLIC_KEY` | 支付宝公钥，SPKI PEM；不是应用公钥 |

支付宝网关默认是正式环境 `https://openapi.alipay.com/gateway.do`，通常无需额外设置。如需沙箱，再添加 `AI_GROUP_ALIPAY_GATEWAY`。

`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEYS` 和 `SUPABASE_SECRET_KEYS` 是托管 Function 自动拥有的内置变量，不要重复创建，也不要复制进代码。

Secrets 保存后会立即对 Function 生效，不需要重新部署。

## 4. 网页端检查 Function 是否配置正确

进入 `Edge Functions → ai-group-payment → Test`：

1. 方法选择 `POST`。
2. Header 设置 `Content-Type: application/json`。
3. Authorization 选择空值或 `None`，不要自动带 anon key。
4. Body 填写 `{"action":"status"}`。
5. 发送请求。

没有登录令牌时，正确结果应该是函数自己返回的 `{"error":"请先登录"}`。这表示请求已经进入代码。

如果看到平台返回 `Missing authorization header` 或 `Invalid JWT`，说明 `Verify JWT with legacy secret` 仍然开启，需要关闭后再测。

## 5. 上传正式群二维码

在 Supabase Storage 的私有 bucket `ai-group-qr` 上传二维码，例如：

- `starter.png`
- `application.png`
- `practice.png`

再执行下面的 SQL，把每个等级关联到对应文件。二维码不会被公开引用；Edge Function 只会在付款成功后创建 10 分钟有效的签名链接。

```sql
update public.ai_group_routes set qr_storage_path = 'starter.png' where level = 'starter';
update public.ai_group_routes set qr_storage_path = 'application.png' where level = 'application';
update public.ai_group_routes set qr_storage_path = 'practice.png' where level = 'practice';
```

函数会在下单时自动把以下回调地址传给支付平台：

- 微信支付：`.../functions/v1/ai-group-payment?action=wechat-notify`
- 支付宝：`.../functions/v1/ai-group-payment?action=alipay-notify`

支付宝的「授权回调地址」要填写前台域名；微信支付商户号需要已开通 Native 支付。支付成功时，函数会先验签、校验商户与金额，再以数据库事务将订单标记为已支付、生成唯一 ID 并解锁群二维码。即使支付平台重试通知，也不会生成第二个 ID。

## 6. 管理社群

用户看到的 ID 是不含标点的 4 位大写字母与数字，例如 `7K2M`。字符集排除了容易混淆的 `0/O/1/I`，共约 104 万种组合；数据库唯一约束会在极少数碰撞时自动重试。页面会要求成员进群后把微信群昵称改成该 ID，管理员只接受与已解锁记录一致的昵称；这能处理二维码被转发的情况。

二维码本身无法阻止已付款用户截图或转发，因此仍应开启微信群管理员确认，并在入群后核对昵称 ID。若要更严格，可定期更新三个二维码文件。

## 7. Apollo 能不能用

能用，但取决于支付后端部署在哪里。

TokenHub 的做法是：Go 后端启动时根据 `CONFIG_SOURCE=apollo` 从 Apollo Config Service 拉取 YAML，再由环境变量做最终覆盖。它适合长期运行、自建部署的后端服务。

本项目当前把支付接口放在 Supabase Edge Function。Edge Function 原生读取的是 Supabase Secrets，不会自动读取 TokenHub 的 Apollo。当前推荐分工是：

- 微信与支付宝私钥、API v3 Key：Supabase Dashboard 的 `Edge Function Secrets Management` 页面；也可以使用 `supabase secrets set NAME=VALUE`。Secrets 保存后立即对函数生效，不需要重新部署函数。
- 19.9 元价格：代码有默认值，也可用 `AI_GROUP_UNLOCK_PRICE_CENTS` 覆盖。
- 群名称、等级与二维码路径：Supabase 数据库和私有 Storage。

函数同时兼容 Supabase 当前的 `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`，以及旧项目中的 `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`。这些 Supabase 内置变量不需要手工重复配置。

如果一定要接 Apollo，也可以让 Edge Function 在冷启动时通过 Apollo OpenAPI 拉取支付配置并缓存。此时仍需在 Supabase Secrets 保存 `APOLLO_SERVER_URL`、`APOLLO_APP_ID`、namespace 以及 Apollo 访问凭证。还必须保证 Apollo 地址可以从 Supabase 公网访问，并使用 HTTPS；如果 Apollo 只在 TokenHub 的 Docker 内网中，Supabase 云函数无法访问。

因此现阶段不建议为了这一项单独暴露 Apollo。若以后将社区支付迁到与 TokenHub 同一台服务器上的 Go 服务，再统一接入 Apollo 会更自然。
