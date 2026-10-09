# AGENTS.md — 给接手本仓库的 AI agent（Codex 等）

**开始任何工作前，先完整读一遍 `docs/HANDOFF.md`。** 里面有项目全貌、当前状态、未完成事项，以及踩过的坑。

## 和 Owner 协作的硬规则

- **Owner 是谁：** Will，非程序员，通过"结果对不对"验证，不读代码。
- **怎么说话：** 用中文，先结论后解释，用完整段落说话；没验证的事要直说没验证。
- **先说计划：** 多文件改动前，先说计划。
- **Git：** 在分支上开发，开 PR，**由 Will 自己合并**。绝不直接推 `main`，不 force push。
- **发布：** 每次发布同时把 `sw.js` 的 `BUILD_VERSION` 和 `js/build.js` 的 `version` 升到同一个版本号。新增文件要加进 `sw.js` 的预缓存清单。
- **改画面：** 改完先自己渲染截图检查，再交给 Will；真机效果要请 Will 在 iPad 上确认。

## 项目速览

- **技术栈：** 原生 ES Modules 写的 PWA，没有构建步骤。
- **本地运行：** 用 `python3 -m http.server` 起一个本地服务器即可。
- **主线代码：** Hoops IQ，在 `js/games/hoops/`。
- **测试：** 单元测试跑 `node --test tests/*.test.mjs`；浏览器冒烟测试跑 `HOOPS_DECIDE=150 node scripts/hoops-smoke.mjs <输出目录>`。
- **线上地址：** https://feelings8210.github.io/caesar-games/（push 到 main 后自动部署）
