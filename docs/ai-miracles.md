# AI 创造的奇迹

社区入口：`/ai/miracles`。主归属为 AI 学习，首页、AI 学习总览和产品页提供入口。无需登录或完成测评即可浏览。

## 来源与许可

- 上游项目：https://github.com/tzhu40816-ai/ai-miriacles
- 本次快照：`9ab401cd6e657a0a30026a7cdc43ec34e18d3a8b`，217 条、13 个分类（含其他）。
- `public/data/ai-miracles/events.json` 原样保留上游数据，随社区网站静态部署。
- `public/data/ai-miracles/source.json` 记录版本、导入时间和适配说明。
- 上游代码 MIT、数据 CC BY 4.0，原始许可保存在同目录 `LICENSE.txt`。
- 页面展示作者、项目链接、CC BY 4.0 链接、来源版本及修改说明。案例来源与研究边界保持可见；本站未独立核验所有科研结论。

## 页面与维护

`src/pages/ai/AIMiracles.tsx` 提供中英文、跨语言关键词搜索、领域筛选、入门精选、时间排序和案例锚点。筛选保存在 URL 查询参数，方便分享。所有案例仍可从完整时间线访问。

数据仅在进入案例页面后加载；不新增数据库、模型调用或第三方依赖。加载失败时可重试，空结果可清除筛选。

更新时从上游的确定提交读取 `data/events.json`，检查条目 ID 唯一、日期、中英文标题与摘要、来源链接协议；更新数据、来源清单、`catalog.ts` 的版本号和本文件。新增领域同步更新 `miracleDomains`。阅读精选只按 ID 筛选，不改写原始数据。
