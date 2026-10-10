# 人脉星图

入口：顶栏“人脉星图”（手机端在导航菜单中），也可从“产品”或“找伙伴”进入。线上地址：https://jwcommunity.space/network 。使用现有 React / Three.js，数据与头像随网站静态部署，无新增服务或数据库表。

名录只收录 CipherTalk 当前群成员。显示名优先群昵称，其次微信昵称；不使用私人通讯录备注。对外 ID 为散列值，不公开微信账号。成员资料来自已逐条核对的群内自我介绍，未识别介绍的成员只显示现有昵称。原始头像保存为 160px WebP，图片内容保持原样。

关系分为成员自述的合作、可定位消息的群内引用或提及、基于资源与需求关键词的潜在匹配、共同方向。后两类明确标注推荐，不代表真实合作。页面可搜索、筛选主题与项目阶段，切换名录，打开名片、查看自述和关系依据，复制名片链接，导出筛选后的 CSV。

## 更新数据

先让 CipherTalk 同步，随后在项目目录执行：

```powershell
node scripts/import-network-atlas.mjs
node scripts/import-network-atlas.mjs --write --avatars
node --test scripts/network-atlas.test.mjs
```

默认只读检查。`--write` 更新 `public/data/network-atlas.json`，`--avatars` 补齐本地头像。已下载头像不会重复下载。数据目录自动读取本机 CipherTalk CLI 配置；解压使用现有 CipherTalk 的 fzstd。可用 `CIPHERTALK_ROOT` 指定 CipherTalk 安装目录。需要支持 `node:sqlite` 的 Node 版本。

`scripts/network-atlas.config.json` 的 `reviewedIntroductionIds` 是人工核对过的自述消息 ID；新成员介绍应先核对，再加入。`collaborations` 仅添加原话明确说明的合作。脚本不会把普通讨论自动变成个人履历。已退群者在下次导入后不再出现在名录，已下载的孤立头像文件可按 ID 清单单独审核清理。

这是同步快照，不是实时监听。部署更新后才会反映新资料。页面标注更新时间。聊天正文仅使用经核对的介绍和少量互动依据，不导出全部聊天记录，电话号码和微信账号在输出时隐藏。

## 部署与回退

沿用健文社区现有前端部署流程，包含新增 `public/data/network-atlas.json` 和 `public/images/network/`。历史路由回退必须支持 `/network`，与已有 `/qa` 路由一致。不要把 CipherTalk 原始数据库或 CLI 配置上传。

向现有 GitHub 仓库的 `main` 分支推送会触发自动部署，目标站点为 `https://jwcommunity.space/`。本次变更为独立页面、数据导入器与入口修改；不涉及 Supabase、身份权限或其他产品。若需回退，回退本功能提交并沿用同一发布流程。

## 本次验证（2026-10-10）

- 当前快照：67 位成员，60 位有核对过的自述，67 张原头像，96 条关系（67 条互动、1 条合作自述、18 条潜在匹配、10 条共同方向）。
- 数据与导出定向测试 7 项通过；本次涉及的前端文件 lint 通过。
- 1440×1000 和 390×844 实测：3D 渲染、成员名录、搜索、原话与关系依据、分享地址、CSV 下载、空状态、星图点击、手机筛选与名片、Escape 关闭、失效名片地址均通过；未捕获页面脚本错误。
- 按 React 组件检查，路由按需加载；WebGL、事件监听与动画帧在退出时释放；静止画面不重复渲染，手机关闭的筛选栏不进入键盘焦点。
- 项目 TypeScript 检查仍有 55 条已有诊断，本次新增文件及修改入口未出现诊断。生产构建通过。
- 构建和截图在 `D:/cache/agent-tests/jianwen-network-20261010/`。此目录仅为本任务验证产物，确认上线后可删除；源码、数据与头像在项目目录内。
- 发布后应检查线上顶栏和手机导航入口，并直接打开 `/network` 验证数据及头像加载。
