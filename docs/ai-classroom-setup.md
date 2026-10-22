# AI 课堂工作台 + AI 积分：上线说明

把原来在老师电脑上运行的“课堂工作台”搬进健文社区。老师在社区里开课堂、控制开关；学生用手机或电脑打开社区的 `/class` 页面，输入 6 位口令和名字就能用，**不再依赖教室局域网**。没有课的时候，登录用户可以在 `/ai/lab`（AI 实验室）用自己的积分做同样的实验。

## 包含什么

| 部分 | 文件 |
|---|---|
| 数据库：课堂、学生、作品、积分账户、积分流水、价格 | `supabase/migrations/202610220001_ai_classroom_and_credits.sql` |
| 服务端：Edge Function `ai-classroom` | `supabase/functions/ai-classroom/index.ts`、`core.ts` |
| 老师控制台 | `/ai/classroom`、`/ai/classroom/:id`（`src/pages/ai/AIClassroom.tsx`） |
| 学生入口（不注册） | `/class`（`src/pages/ClassJoin.tsx`） |
| AI 实验室（自学） | `/ai/lab`（`src/pages/ai/AILab.tsx`） |
| 共用组件和样式 | `src/features/aiClassroom/` |

## 一、执行数据库迁移（约 1 分钟）

Supabase Dashboard → `SQL Editor` → `New query`，粘贴 `supabase/migrations/202610220001_ai_classroom_and_credits.sql` 的全部内容，点 `Run`。

- 会新建 8 张表、5 个服务端函数和一个**私有** Storage bucket `ai-classroom`。
- 不会改动已有的测评、订单、会员数据。脚本可以重复执行。

## 二、部署 Edge Function（约 3 分钟）

**网页部署**：`Edge Functions` → `Deploy a new function` → `Via Editor`，名称填 `ai-classroom`。

1. 把 `index.ts` 的内容粘贴到默认文件里。
2. 在编辑器左侧新建一个文件，命名为 `core.ts`，粘贴 `core.ts` 的内容。
3. 点 `Deploy function`。
4. 部署后进入这个 Function 的设置，**关闭 `Verify JWT with legacy secret`**。学生不登录，靠课堂口令换来的令牌访问；老师身份由函数内部校验。以后每次更新都要确认这个开关还是关闭的。

**或者用命令行**：`supabase functions deploy ai-classroom --no-verify-jwt`

## 三、配置 Secret

`Edge Function Secrets Management` 里添加：

| Key | Value |
|---|---|
| `WANJIE_API_KEY` | 万界数据的 API 密钥（和原来课堂工作台用的是同一个） |

可选：`AI_CLASSROOM_CHAT_MODEL`（默认 `qwen-flash`）、`AI_CLASSROOM_VISION_MODEL`（默认 `qwen3-vl-flash`）、`WANJIE_API_BASE`（默认 `https://maas-openapi.wanjiedata.com/api`）。

画图和视频固定用即梦：`jimeng_t2i_v40`、`jimeng_t2v_v30`、`jimeng_i2v_first_v30`。这些是原工作台实测过的组合。

## 四、发布前端

按平时的方式发布网站即可（新增了 4 个路由，没有新的 npm 依赖）。

## 五、上线后检查（管理员账号）

1. 登录 → 打开 `/ai/classroom` → 新建一个课堂。
2. 在控制台左下“积分”里点 **检查模型连接**，要显示“连接正常”。如果失败，先看 `WANJIE_API_KEY`；如果显示网络错误，可能是 Supabase 所在地区连不上万界数据，需要告诉我。
3. 点 **给自己加 1000 积分**（只有管理员能看到这个按钮）。
4. 切到“老师演示”，各试一次：问 AI、文字画图、改一张照片。
5. 用手机打开 `你的社区域名/class`，输入口令和名字。老师开放“画图 3 分钟”，手机上应该立刻出现画图功能。

## 积分规则

- **新用户自动送 100 积分**。数量在 `ai_credit_settings.welcome_credits` 里改。
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

-- 看今天消耗了多少
select reason, sum(delta) from public.ai_credit_ledger where created_at > now() - interval '1 day' group by reason;
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

- 积分购买（微信/支付宝）还没接。下一步会在现有 `ai-group-payment` 里加“积分包”商品，复用已经在收款的通道。
- 图片和视频的进度靠页面轮询推进：老师控制台每 3 秒、学生页每 4 秒查询一次。所有页面都关掉时，任务会停在“生成中”，下次打开页面会接着查询。
- Supabase 免费额度：Storage 1GB，视频每段约 2–8MB。课多了以后需要定期清理旧作品，或者升级套餐。

## 本地测试

```bash
# 需要本地 Postgres（迁移里用到的 auth/storage 等表需要先建好替身）
node --experimental-strip-types supabase/functions/ai-classroom/core.test.mjs
```

测试用真实 Postgres 执行迁移和 RPC，配合模拟的模型平台和内存存储。覆盖了：开关、限次、失败不占次数、自动关闭、预算、扣费和退费、共享图、视频保存、令牌失效、自学扣费、流水与余额一致。
