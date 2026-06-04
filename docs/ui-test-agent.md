# UI 测试 Agent

这个 agent 用 Playwright 从浏览器交互层测试站点。它会先执行生产构建，再启动 preview 服务，随后在桌面和移动端视口跑核心页面、导航、登录入口和路由兜底测试。

## 睡前运行

```bash
npm run test:agent
```

跑完后会生成 Markdown 报告：

```text
reports/ui-test-agent/<时间戳>/ui-test-report.md
```

如果有失败，报告会列出失败用例、错误摘要和原始输出。Playwright 的 HTML 报告在：

```text
playwright-report/index.html
```

失败时还会保留截图、视频和 trace：

```text
test-results/
```

## 单独调试 E2E

```bash
npm run test:e2e
npm run test:e2e:ui
```

## 当前覆盖范围

- 公共页面：`/about`、`/qa`、`/community`、`/tools`、`/guide`、`/login`、`/register`、`/forgot-password`
- 桌面导航：关于我、问题星球、社区广场、工具箱
- 移动端菜单：打开菜单并跳转问题星球
- 登录入口：手机号/密码填写、未完成安全验证提示、密码显隐切换
- 权限路由：匿名访问 `/profile` 自动跳转登录
- 404：未知路径显示兜底页面

## 后续可加

有稳定测试账号后，可以设置专门的 E2E 环境变量并加入完整登录后流程，例如资料编辑、通知中心、后台页面、打卡发布等。
