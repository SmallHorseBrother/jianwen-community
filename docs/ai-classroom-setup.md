# AI 课堂工作台 + AI 积分：上线说明

把原来在老师电脑上运行的“课堂工作台”搬进健文社区。老师在社区里开课堂、控制开关；学生用手机或电脑打开社区的 `/class` 页面，输入 6 位口令和名字就能用，**不再依赖教室局域网**。没有课的时候，登录用户可以在 `/ai/lab`（AI 实验室）用自己的积分做同样的实验。

## 包含什么

| 部分 | 文件 |
|---|---|
| 数据库：课堂、学生、作品、积分账户、积分流水、价格 | `supabase/migrations/202610220001_ai_classroom_and_credits.sql` |
| 数据库热修复：服务端函数只给 service_role | `supabase/migrations/202610280000_lock_server_only_functions.sql` |
| 数据库：积分风控、积分包商品和订单 | `supabase/migrations/202610280001_ai_credit_guard_and_shop.sql` |
| 服务端：Edge Function `ai-classroom` | `supabase/functions/ai-classroom/index.ts`、`core.ts` |
| 服务端：积分包下单和支付回调（加在已上线的入群支付函数里） | `supabase/functions/ai-group-payment/index.ts` |
| 老师控制台 | `/ai/classroom`、`/ai/classroom/:id`（`src/pages/ai/AIClassroom.tsx`） |
| 学生入口（不注册） | `/class`（`src/pages/ClassJoin.tsx`） |
| AI 实验室（自学） | `/ai/lab`（`src/pages/ai/AILab.tsx`） |
| 共用组件和样式（含买积分弹窗、积分明细） | `src/features/aiClassroom/` |

## 一、执行数据库迁移（约 2 分钟）

Supabase Dashboard → `SQL Editor` → `New query`，**按顺序**执行（每次粘贴一个文件的全部内容，点 `Run`）：

1. `supabase/migrations/202610220001_ai_classroom_and_credits.sql`：新建 8 张表、5 个服务端函数和一个**私有** Storage bucket `ai-classroom`。**线上已经执行过，不要再执行。**
2. `supabase/migrations/202610280000_lock_server_only_functions.sql`：**安全热修复，尽快执行。**Supabase 默认会给新建函数单独授予 `anon`、`authenticated` 执行权限，以前的迁移只 `revoke ... from public` 收不回来，登录用户可以在浏览器里直接调用 `complete_ai_group_order`（不付钱解锁入群）、`ai_credit_grant`（给自己加积分）等函数。这个脚本只收回这些函数的执行权限，不改数据，Edge Function 不受影响。执行后用文件末尾注释里的查询核对，`authenticated`、`anon` 两列都应该是 `false`。
3. `supabase/migrations/202610280001_ai_credit_guard_and_shop.sql`：给积分加风控（见下面“积分规则”），新建 `shop_products`、`shop_orders` 两张表、到账函数 `complete_shop_order` 和每日统计视图 `ai_credit_daily_usage`，放好三档积分包，并再收紧一次所有服务端函数的权限。

- 不会改动已有的测评、入群订单、会员数据。第 2、3 个可以重复执行。
- 第 3 个必须在第 1 个之后。**不要在第 3 个之后重新执行第 1 个**：那样会把旧版函数建回来（风控失效，还会多出一个对浏览器开放的旧函数）。万一误执行了，再执行一次第 3 个就能恢复。
- 第 3 个要在部署新版 `ai-classroom` **之前**执行：新版函数会调用带网络参数的建账号函数，数据库里没有它会报错。反过来，旧版函数在新数据库上能正常工作。

## 二、部署 Edge Function（约 3 分钟）

**网页部署**：`Edge Functions` → `Deploy a new function` → `Via Editor`，名称填 `ai-classroom`。

1. 把 `index.ts` 的内容粘贴到默认文件里。
2. 在编辑器左侧新建一个文件，命名为 `core.ts`，粘贴 `core.ts` 的内容。
3. 点 `Deploy function`。
4. 部署后进入这个 Function 的设置，**关闭 `Verify JWT with legacy secret`**。学生不登录，靠课堂口令换来的令牌访问；老师身份由函数内部校验。以后每次更新都要确认这个开关还是关闭的。

**或者用命令行**：`supabase functions deploy ai-classroom --no-verify-jwt`

**再更新 `ai-group-payment`**（积分包的下单、查单和支付回调都在这里，和入群权益共用已经配好的微信/支付宝商户和回调地址）：

1. `Edge Functions` → `ai-group-payment` → 编辑代码，用 `supabase/functions/ai-group-payment/index.ts` 的全部内容覆盖，点 `Deploy`。
2. 部署后确认 `Verify JWT with legacy secret` **仍然是关闭的**（支付平台的回调不带登录令牌）。
3. 不需要新增 Secret。支付宝付完会回到 `AI_GROUP_PAYMENT_RETURN_URL` 所在域名的 `/ai/lab`。

入群权益的下单和回调逻辑没有改。积分包订单号以 `SP` 开头，入群订单以 `AI` 开头，回调按前缀分别处理。

## 三、配置 Secret

`Edge Function Secrets Management` 里添加：

| Key | Value |
|---|---|
| `WANJIE_API_KEY` | 万界数据的 API 密钥（和原来课堂工作台用的是同一个） |

可选：`AI_CLASSROOM_CHAT_MODEL`（默认 `qwen-flash`）、`AI_CLASSROOM_VISION_MODEL`（默认 `qwen3-vl-flash`）、`WANJIE_API_BASE`（默认 `https://maas-openapi.wanjiedata.com/api`）。

画图和视频固定用即梦：`jimeng_t2i_v40`、`jimeng_t2v_v30`、`jimeng_i2v_first_v30`。这些是原工作台实测过的组合。

## 四、发布前端

按平时的方式发布网站即可（新增了 4 个路由，没有新的 npm 依赖）。

**顺序**：先执行迁移、部署两个函数，再发布前端。前端先上线的话，实验室和课堂会因为函数还没部署而报错。

## 五、上线后检查（管理员账号）

1. 登录 → 打开 `/ai/classroom` → 新建一个课堂。
2. 在控制台左下“积分”里点 **检查模型连接**，要显示“连接正常”。如果失败，先看 `WANJIE_API_KEY`；如果显示网络错误，可能是 Supabase 所在地区连不上万界数据，需要告诉我。同一条提示里会写“来源 IP 取自：……”：应该是 `cf-connecting-ip` 或 `x-real-ip`；如果是 “x-forwarded-for 第一项” 或 “没有取到”，同一网络限领可能被绕过或不生效，需要告诉我。
3. 点 **给自己加 1000 积分**（只有管理员能看到这个按钮）。
4. 切到“老师演示”，各试一次：问 AI、文字画图、改一张照片。
5. 用手机打开 `你的社区域名/class`，输入口令和名字。老师开放“画图 3 分钟”，手机上应该立刻出现画图功能。
6. 打开 `/ai/lab` → 点 **买积分** → 选“尝鲜包” → 微信扫码付 ¥9.9。几秒后弹窗显示“已到账 100 积分”，余额和“积分明细”里都能看到。再用支付宝试一次，付完应该自动回到实验室并显示到账。

## 积分规则

- **新用户自动送 30 积分**（够画 3 张图或问 30 次）。数量在 `ai_credit_settings.welcome_credits` 里改。
- **同一网络限领**：按来源网络计（IPv4 按完整地址，IPv6 按前 64 位；库里只存哈希，不存原始 IP），同一网络 24 小时内最多 3 个新账号能拿到赠送，之后的新账号余额从 0 开始，实验室里会提示原因。在 `ai_credit_settings.welcome_per_ip_daily` 里改，设为 `null` 表示不限制。学校、公司和手机运营商常常共用出口 IP，同一网络的老师会互相占名额，太紧可以调到 5。只有登录、建课堂、提交这几个入口会建账号并发赠送；学生在课堂里提交不会给老师发赠送。
- **个人限流**：登录用户自己提交（实验室和老师演示）每人每分钟最多 6 次，超了提示“操作太快了”。在 `personal_rate_per_minute` 里改，`null` 表示不限。学生在课堂里的提交不受这条限制，由课堂的开关、次数和预算管。
- **全站熔断**：`global_daily_limit` 设一个积分数后，北京时间当天全站净消耗（扣费减退回）超过它，所有生成（包括课堂）暂停到第二天，提示“今天的 AI 生成量到上限了”。默认 `null`，不开。
- **价格**：问 AI 1、看图问 AI 2、画图/改图 10、做视频 60。在 `ai_credit_prices` 表里改。
- **扣费时机**：提交时先扣。平台拒绝、生成失败、模型报错都会**自动退回**，每个作品最多退一次。只有“提交时网络中断、不确定平台是否收到”的情况不自动退，作品显示“不确定”。
- **谁付钱**：课堂里学生的消耗记在**老师**账上。老师可以给每节课设预算上限（200～5000 积分），超了就停。
- 所有变动都写在 `ai_credit_ledger`。用户能看到自己的余额和流水，看不到别人的。

常用 SQL：

```sql
-- 给某个用户加积分（user_id 在 Authentication → Users 里找）
select public.ai_credit_grant('用户的 uuid', 5000, 'grant', '课堂额度');

-- 改价格
update public.ai_credit_prices set credits = 8 where kind in ('t2i', 'i2i');

-- 改新用户赠送
update public.ai_credit_settings set welcome_credits = 50;

-- 风控：同一网络每天可领赠送的新账号数 / 个人每分钟次数 / 全站每天上限（null = 不限）
update public.ai_credit_settings set welcome_per_ip_daily = 5;
update public.ai_credit_settings set personal_rate_per_minute = 10;
update public.ai_credit_settings set global_daily_limit = 20000;   -- 关掉：= null

-- 最近两周每天的消耗、退回、充值、赠送（北京时间）
select * from public.ai_credit_daily_usage limit 14;
```

## 积分包

在 `/ai/lab` 和 `/ai/classroom` 的余额旁点 **买积分**。

| 积分包 | 价格 | 积分 |
|---|---|---|
| 尝鲜包 | ¥9.9 | 100 |
| 常用包 | ¥29.9 | 330（多送约 10%） |
| 课堂包 | ¥99 | 1200（多送 20%） |

- 微信：弹窗里显示二维码，扫码付款后自动到账（页面每 3 秒查一次，最多查 10 分钟，之后可以点“我已支付，刷新”）。
- 支付宝：跳转到支付宝收银台，付完回到 `/ai/lab` 自动确认到账。
- 只有正式账号能买；匿名的游客身份不能买。
- 弹窗里写明的购买说明：**积分不过期；已购积分不退现金；生成失败会自动退回积分。**
- 到账靠支付平台的回调和页面主动查单，两边同时到达也只会入账一次（订单行锁 + 流水唯一索引）。回调里的金额、渠道和订单对不上会被拒绝。

常用 SQL：

```sql
-- 改价格或积分数（已经下了的单按下单时的积分数发，不受影响）
update public.shop_products set price_cents = 1990, credits = 220 where code = 'credits-330';

-- 下架 / 上架一个积分包
update public.shop_products set active = false where code = 'credits-1200';

-- 最近的积分包订单
select order_no, status, provider, amount_cents, credits, created_at, paid_at
from public.shop_orders order by created_at desc limit 20;
```

## 课堂怎么用

| 想做什么 | 怎么点 |
|---|---|
| 让学生进来 | 点“投屏口令”，大屏显示网址、6 位口令和二维码 |
| 开放一个功能 | 功能卡片上点“开放 3/5/10 分钟”，到时间自动关闭 |
| 布置任务 | 开放前在卡片里写任务，学生页最上面会显示 |
| 限次数 | “每人每轮”选 1/2/3/5/10 次，每开放一次算新的一轮；失败的不算次数 |
| 马上收回 | “关闭”或“全部关闭” |
| 点评 | 作品墙点“放大展示”，改图时左边是原图、右边是结果；左右键切换，Esc 退出 |
| 让全班改同一张图 | 作品上点“共享给学生”，或左侧上传图片 |
| 下课 | “结束这节课”：学生令牌失效，作品保留 |

## 数据和隐私

- 学生只留下自己填的名字（12 个字以内）和提交的作品，不需要手机号。
- 图片、视频存在私有 bucket，页面只拿到 1 小时有效的签名链接。
- 提醒学生不要上传人脸和个人信息。即梦平台本身也会做内容审核，没通过的会提示并退积分。

## 已知限制

- 手机上在微信里打开时，微信付款是扫码方式（Native），一般要用另一台设备扫；同一台手机里长按识别能不能付需要实测。要在微信里直接付，需要另接 JSAPI 支付（公众号 openid）或 H5 支付。现在的入群付款也是同样的限制。
- 支付宝用的是电脑网站支付（`alipay.trade.page.pay`），手机浏览器也能打开，但体验不如手机网站支付（`alipay.trade.wap.pay`）。
- 赠送积分只按网络限领，没有短信验证手机号。想更严，可以改成“短信验证后才发赠送”（找回密码已经接了腾讯云短信，可以复用）。
- 图片和视频的进度靠页面轮询推进：老师控制台每 3 秒、学生页每 4 秒查询一次。所有页面都关掉时，任务会停在“生成中”，下次打开页面会接着查询。
- Supabase 免费额度：Storage 1GB，视频每段约 2–8MB。课多了以后需要定期清理旧作品，或者升级套餐。

## 本地测试

需要一个空的本地 Postgres（不要连 Supabase）。先依次执行 Supabase 替身（含和 Supabase 一样的默认授权）和三个迁移，再跑测试：

```bash
psql -h localhost -p 5499 -U postgres -d jw -f supabase/functions/ai-classroom/test-stubs.sql
psql -h localhost -p 5499 -U postgres -d jw -f supabase/migrations/202610220001_ai_classroom_and_credits.sql
psql -h localhost -p 5499 -U postgres -d jw -f supabase/migrations/202610280000_lock_server_only_functions.sql
psql -h localhost -p 5499 -U postgres -d jw -f supabase/migrations/202610280001_ai_credit_guard_and_shop.sql
PGTEST="-h localhost -p 5499 -U postgres -d jw" node --experimental-strip-types supabase/functions/ai-classroom/core.test.mjs
```

测试用真实 Postgres 执行迁移和 RPC，配合模拟的模型平台和内存存储。覆盖了：开关、限次、失败不占次数、自动关闭、预算、扣费和退费、共享图、视频保存、令牌失效、自学扣费、同一网络限领赠送（含“先建课堂再让学生提交”的绕过）、个人限流（老师演示也计入）、全站熔断、积分包到账（金额或渠道不符拒绝、缺金额拒绝、重复回调只入账一次）、服务端函数和积分表对 anon / authenticated 不开放、流水与余额一致。Windows 上也能跑（SQL 走标准输入，避免中文被转码）。

买积分弹窗的前端测试：`npx vitest run src/features/aiClassroom`。
