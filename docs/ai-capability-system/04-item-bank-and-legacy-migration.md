# PACF 候选题库与旧数据迁移说明 v1.0

> 日期：2026-08-09  
> 状态：候选题库已完成；迁移脚本已在线执行并通过完整性校验  
> 代码题库：[pacfItemBank.ts](../../src/features/aiAssessment/pacfItemBank.ts)  
> 评分器：[pacfScoring.ts](../../src/features/aiAssessment/pacfScoring.ts)  
> 数据库迁移：[20260808232543_pacf_assessment_versioning.sql](../../supabase/migrations/20260808232543_pacf_assessment_versioning.sql)

## 一、“旧数据迁移”到底是什么

这里的旧数据是已经由网站旧版能力测评产生的记录，不是迁移 Supabase 项目，也不是迁移支付系统。

### 1.1 现有三类数据

| 数据 | 位置 | 含义 | 新版处理 |
|---|---|---|---|
| 最新能力结果 | `ai_assessments` | 每位用户最新一次答案、旧分数、旧六维和入群路线 | 原样归档并标记为旧版 |
| 历史双测评记录 | `ai_assessment_attempts` | 30 道旧能力自评、28 道人格题及报告 | 人格保留有效；能力标记“需复测” |
| 支付与入群权益 | `ai_group_orders`、`ai_group_memberships` | 订单、支付状态、四位 ID、已解锁群 | 完全不迁移、不重算、不失效 |

早期项目还曾有 8 道能力题。若这些用户只有 `ai_assessments` 快照、没有 attempt 历史，新迁移会把原始内容放入 `ai_assessment_legacy_snapshots`，不会猜测其 PACF 等级。

### 1.2 为什么不能直接换算

旧版主要测“我觉得自己多常用、多会用”，总分范围 0–90；PACF v1.0 测概念、情境、开放作答和实作，总分标准化为 0–100。两版 L2/L3 的名称和行为含义也不同。

因此下面做法都不可靠：

- 把旧 60/90 线性换成新 66.7/100；
- 把旧 Level 3 直接改名为新 L3；
- 根据旧六维最高/最低猜出 30 个新能力分数；
- 因为用户已付费就自动赋予某个新版能力等级。

正确做法是：**旧结果可查看，付费权益继续有效；只有重新完成 PACF 测评，才生成新版能力结果。**

## 二、120 道候选题库

### 2.1 结构

题库覆盖 30 个能力单元，每项固定四种候选证据：

| 题型 | 数量 | 作用 | 评分方式 |
|---|---:|---|---|
| 客观概念题 | 30 | 检查关键概念和误解 | 规则确定答案，0/100 标准化 |
| 情境决策题 | 30 | 检查场景中的风险与权衡 | 0–3 行为锚点，标准化到 0–100 |
| 开放作答 | 30 | 检查解释、拆解、标准和治理 | 四项 rubric；LLM 仅给候选评分 |
| 实作任务 | 30 | 检查真实迁移、交付、可靠性 | 四项 rubric；保留作品与人工证据 |
| 合计 | 120 | 30 个能力 × 4 种证据 | 统一版本化 |

每道题包含：

- 稳定题目 ID，例如 `PACF-M01-O1`；
- 能力 ID、维度和目标等级；
- 题干、选项或 rubric；
- 正确答案/行为得分；
- 判分理由、研究/框架来源锚点；
- 是否可进入快测；
- `candidate` 状态，防止未经预测试直接宣称正式量表。

### 2.2 A 卷

#### 快速筛查 A 卷

- v1.0 为 30 道，六维各 5 道；当前 v1.1 扩展为 42 道，六维各 7 道；
- 每个能力抽 1 道客观题或情境题；
- 预计 15–18 分钟；
- 输出学习起点估计，最高只授予 L3 筛查结论；
- 不能凭快测认证 L4/L5。

#### 专业诊断 A 卷

- 44 个计分交互；
- 包含扩展快测 42 道、12 道开放作答和 2 项综合实作；
- 六维均有客观、情境和应用证据；
- 理论上可确认到 L4；
- L5 必须另做真实组织应用实验室和人工认证。

这两个 A 卷只是预测试版本。正式发布前应根据题目难度、区分度、答题时长和群体差异建立 B/C 平行卷。

### 2.3 上线时的出题规则

- 作者输入按“弱→强”便于审稿，题库生成时已按能力 ID 轮换选项位置；正式页面还应由服务端按稳定种子打乱，并按选项 ID 判分，不能让最高分长期固定在同一位置。
- 浏览器只接收题干和无分值选项；`score`、rubric 内部说明和判分理由不得进入前端包或接口响应。
- 同一用户复测优先抽平行题，避免记忆答案；题目曝光量写入运营表。
- 选项随机化不能改变“以上皆是”等相对指代，因此本题库刻意避免这类选项。
- 快测结果必须显示“筛查/估计”，不能使用“认证”措辞。

## 三、确定性评分与大模型边界

### 3.1 维度分数

专业诊断在每个维度内采用：

- 客观题：30%；
- 情境题：30%；
- 开放作答与实作：40%。

六个维度等权平均得到总分。快测因没有开放/实作证据，只对所抽题目求平均，并明确标记 `screening`。

### 3.2 晋级门槛

| 等级 | 门槛 |
|---|---|
| L2 | 六维均至少达到 L1 |
| L3 | V 核验、安全与责任至少达到 L2 |
| L4 | V、S 至少达到 L3，并通过两项实作 |
| L5 | V、S 至少达到 L4，通过组织情境、真实应用实验室和人工认证 |

### 3.3 LLM 可以做什么

- 根据固定 rubric 对开放题给出候选分、逐项证据和理由；
- 提醒答题证据不足；
- 根据确定性结果生成个性化解释和课程建议。

LLM 不可以：

- 修改选择题答案键、维度权重、等级切点或门槛；
- 仅因语言漂亮、篇幅长、职业背景好而加分；
- 在未通过人工金标准一致性测试前独立评分；
- 直接授予 L4/L5。

推荐流程：`LLM 候选评分 → 低置信/高阶结果人工复核 → 必要时第二人裁决 → 保存评分来源和证据`。

## 四、数据库迁移做了什么

### 4.1 新增表

| 表 | 用途 | 前端权限 |
|---|---|---|
| `ai_assessment_instruments` | 记录框架、题库、评分和卷版本 | 服务端 |
| `ai_assessment_items` | 运营题目、答案键、rubric 和曝光量 | 服务端，严禁返回评分键 |
| `ai_assessment_responses` | 保存逐题作答、标准化分、评分来源和证据 | 服务端 |
| `ai_assessment_legacy_snapshots` | 原样归档早期最新结果 | 服务端 |

所有新表启用 RLS，并撤销 `anon`、`authenticated` 的直接权限，只显式授权 `service_role`。这是为了适配 Supabase 2026 年新的 Data API 显式授权规则。

### 4.2 扩展现有结果

`ai_assessments` 和 `ai_assessment_attempts` 新增：

- `framework_version`；
- `scoring_version`；
- `result_status`；
- `evidence_grade`；
- `requires_reassessment`；
- `competency_scores`；
- `gate_status`；
- `scoring_audit`（attempt 历史）。

旧能力记录统一标记：

```text
framework_version = legacy-ai-portrait-v2
result_status = legacy
evidence_grade = self_report
requires_reassessment = true
```

人格结果继续有效，不要求复测。

### 4.3 明确不修改

迁移脚本没有对以下表执行更新或删除：

- `ai_group_orders`
- `ai_group_memberships`
- `ai_group_routes`

因此已支付用户的订单、四位 ID、二维码权益和既有群路线保持不变。

## 五、执行顺序

当前阶段不要把候选题库直接替换线上正式测评。推荐顺序：

1. 人工审查 120 道题的措辞、正确答案、领域偏见和泄题风险。
2. 用 8–12 位不同水平用户做认知访谈，观察他们如何理解题干。
3. 冻结预测试题库 `pacf-item-bank-1.0.0`。
4. 在 Supabase SQL Editor 执行迁移脚本。
5. 检查旧记录标记、legacy snapshot 和支付权益不变量。
6. 部署支持新版本字段的 Edge Function。
7. 先小流量开放 PACF 快测，收集题目分析数据。
8. 完成开放题人工金标准后再开放专业诊断。
9. 校准切点后将 instrument 从 `candidate` 改为 `pilot`，最终再改为 `active`。

数据库迁移是加法迁移，可以先执行；但新版题目界面、评分函数和 Edge Function 必须成套发布，不能只替换其中一个文件。

## 六、迁移前后检查 SQL

### 6.1 迁移前盘点

```sql
select 'latest_assessments' as metric, count(*) as value from public.ai_assessments
union all
select 'attempts', count(*) from public.ai_assessment_attempts
union all
select 'active_memberships', count(*) from public.ai_group_memberships where access_status = 'active'
union all
select 'paid_orders', count(*) from public.ai_group_orders where status = 'paid';

select assessment_version, kind, count(*)
from public.ai_assessment_attempts
group by assessment_version, kind
order by kind, assessment_version;
```

### 6.2 迁移后语义检查

```sql
select kind, framework_version, scoring_version, result_status,
       evidence_grade, requires_reassessment, count(*)
from public.ai_assessment_attempts
group by 1,2,3,4,5,6
order by kind, framework_version;

select count(*) as legacy_snapshots
from public.ai_assessment_legacy_snapshots;

select id, framework_version, item_bank_version, scoring_version,
       instrument_type, item_count, status
from public.ai_assessment_instruments
order by id;
```

### 6.3 支付权益不变量

```sql
select
  count(*) filter (where access_status = 'active') as active_count,
  count(*) filter (where access_status = 'active' and display_id is null) as invalid_active_without_id,
  count(distinct display_id) filter (where display_id is not null) as unique_display_ids
from public.ai_group_memberships;

select status, count(*)
from public.ai_group_orders
group by status
order by status;
```

期望：`invalid_active_without_id = 0`；迁移前后 active、paid 和唯一 ID 数量不应减少。

## 七、当前验证结果

- 120 道候选题，ID 全部唯一；
- 30 个能力单元均恰好包含四种题型；
- v1.1 扩展快测 42 道，六维均为 7 道；
- 专业诊断 44 个交互，含 12 开放题、2 实作；
- TypeScript 类型检查通过；
- 评分器模拟验证：高分快测只给 L3 筛查，高分专业诊断给 L4，只有 certified + Applied Lab 才能获得 L5。

尚未完成：真实用户认知访谈、题目统计校准、开放题人工金标准和线上迁移执行。
