━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HANDOFF
STATE ID: HO-2026-10-09-hoops-v2.8.1   ← THIS NODE
PARENT STATE ID: NONE（从 Claude Code 云端会话整段重建）
WORKING MANUAL: embedded（见下方"协作规则"；根目录 AGENTS.md 有精简版）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【READ THIS FIRST — 接手者第一步】
1. 先读下面的"协作规则"，了解怎么和 Owner 配合。
2. 读 PERSISTENT CORE，了解项目是什么。
3. 从 EXACT NEXT ACTION 接着做。
4. 本文写于 2026-10-09。动手前先 `git pull` 看 main 的最新状态，文档不等于当前现实。

## 协作规则（Owner：Will）

- Will 不是程序员，靠自然语言指挥 AI。他定需求、验证行为、做架构判断，代码由 AI 写和调试。他通过"结果对不对"来验证，不读代码。
- 用中文，先说结论再解释，像正常人说话、用完整段落。不要一句一行、一词一行，不要堆几十个 bullet。
- 不要猜看得到的技术细节：需要看代码、配置或日志，就自己去读，或请他贴出来。
- 给 Will 在 Mac 终端跑的命令，末尾加 `2>&1 | tee /dev/tty | pbcopy`，方便他复制结果。涉及密钥、token 的命令不加，并提醒他小心。绝不用裸 `cat` 结尾，会卡住等输入。
- 多文件改动前先说计划。诚实优先：没验证就说没验证，不确定就说不确定。
- 他常常先质疑再接受。他说"不对劲"时要认真对待，他的直觉通常是准的。
- 低收益的细节纠缠，可以善意提醒他收手。
- Git 规矩：在分支上开发，开 PR，**由 Will 自己合并**。绝不直接推 main，不 force push 别人的分支，没有他同意不开 PR、不合并。
- 给 Antigravity（他的另一个本地 agent，负责处理素材、视频和模型）写任务单时，必须写明"只推送这一个分支，绝不碰 main，不 force push，只提交指定文件"。

## 【PERSISTENT CORE】

**MAIN TASK**
Caesar Games 是 Will 给孩子做的 iPad 小游戏合集 PWA，里面有象棋、国际象棋、军棋、五子棋，以及近期的主线 **Hoops IQ（篮球智商）**：
- **Chapter：** 10 关情境判断。
- **Read & React：** 随机连续挑战。
- **Playbook 战术本：** 分步讲解战术，可以选 Watch 看演示，或 Walk it 自己跟着走。
- **My stats：** 个人数据。

- 仓库：`feelings8210/caesar-games`
- 线上地址：https://feelings8210.github.io/caesar-games/ （push 到 main 后，GitHub Actions `.github/workflows/deploy.yml` 自动部署）
- 当前线上版本：**v2.8.1**（首页底部小字显示版本号）

**OWNER INTENT**
- 孩子爱玩，真能学到篮球阅读能力。
- 画面要"高级"。最近一次 Will 定的方向是**参考 NBA 球馆**，前一版"克制的黑漆展台风"被他否了。
- 中长期设想：做成**俱乐部版**，每个 club team 能换 logo 和皮肤、有自己命名的战术，让自家小朋友学（见 BRANCH LEDGER）。
- 已经把线上链接发给一位教练，请他提意见。

**ARCHITECTURE**
- 纯前端，原生 ES Modules，**没有构建步骤**。直接用静态服务器跑：`python3 -m http.server`。
- **PWA / service worker：** `sw.js` 有预缓存清单，**新增的文件必须加进清单**。`sw.js` 里的 `BUILD_VERSION` 必须和 `js/build.js` 的 `version` 一致，**每次发布都要一起升版本**，否则 iPad 会继续用旧缓存。
- **3D 引擎：** three.js 放在 `js/vendor/three` 里，有 GLTFLoader、SkeletonUtils 等插件。
- **Hoops IQ 代码在 `js/games/hoops/`：**
  - `controller.js`：流程和阶段，依次是 title、intro、read、decide、outcome、review、demo
  - `levels.js`：10 关
  - `families.js`：Read & React 的题型族
  - `playbook.js`：战术数据（纯数据：setup 站位加 steps，图解和 Walk it 任务都是自动推导的）
  - `playbook-mode.js`：战术本模式
  - `runner.js`：BeatRunner，按 beat 播放跑位、传球、投篮
  - `court3d.js`：3D 球场、镜头和标签
  - `court.js`：2D 备用版，用 `?hoops2d=1` 打开
  - `arena3d.js`：展台、看台座椅、LED 屏、光柱、篮网
  - `hoop3d.js`：代码建模的篮架（玻璃板、24 秒计时器、海军蓝护垫底座）
  - `courtdesign.js`：地板涂装（海军蓝禁区和中圈、金色 CD 标志）
  - `athlete3d.js`：骨骼动画球员（`assets/hoops/athlete.glb`，Quaternius CC0 素材，65 个关节、14 个动作）
  - `audio.js`：音效、观众声、教练语音
  - `stats.js`：数据统计
- **坐标单位是英尺：** x 横向（−25 到 25），z 从底线往外（0 到 50），y 向上。篮筐在 (0, 5.25)，篮圈高 10。
- **URL 调试参数：**
  - `?hoopsDecide=N`：把决策时间拉长到 N 秒
  - `?hoopsQuality=low|high`：强制画质档位
  - `?hoopsSpeed=0.05`：慢动作，用于逐帧拍片检查
  - `?hoops2d=1`：2D 版
- **素材来源**登记在 `assets/hoops/CREDITS.md`。

**KNOWN TRAPS（都是踩过的坑）**
- **iPad 页面缩放：** 不要在 viewport 里加 `maximum-scale=1, user-scalable=no`。加了之后 iPad 不再自动适配屏幕，页面能左右拖（v2.6.2 已撤回）。防双击放大用的是 `touch-action: manipulation`，再加上只在正常比例下才拦截的 gesture 事件。
- **地板反光：** 地板不能反射带强光点的 HDR 环境图，iPad 显卡会把它放大成一大片白。现在地板只反射柔和的 RoomEnvironment，`envMapIntensity` 和 `specularIntensity` 都压得很低。调光泽之后一定要看画面底部有没有发白。
- **贴地物体闪烁：** 和地板同高的平面会 z-fighting 闪烁，比如底座、光圈。底座已经抬高，地面标记加了 `polygonOffset`。
- **后台声音：** iOS 进后台时网页声音会继续播放。现在的处理是：页面隐藏时 suspend 整个 AudioContext；观众声每 0.6 秒自查篮球场还在不在屏幕上；停止时还会按真实时间强制掐断（v2.8.1）。
- **方法名冲突：** `court3d.js` 继承了 `runner.js` 的 `_trail()` 方法，别用 `this._trail` 当变量名（以前因此出过 bug）。
- **测试机太慢：** 没有 GPU 的机器（swiftshader）大约每秒只有 2 帧，镜头移动会比 iPad 慢 5 倍左右。冒烟测试要用 `HOOPS_DECIDE=150`，否则 Read & React 第 2 轮会超时。这是测试环境的问题，不是 bug。
- **象棋计时测试：** `tests/xiangqi-chess.test.mjs` 里有一个"国际象棋 AI 在时限内完成"的计时测试，在慢机器上会失败，main 上也一样，跟 Hoops 的改动无关。
- **看不到的东西：** 真机的声音、触摸手感和流畅度，云端或本地无头浏览器都验证不了，要请 Will 在 iPad 上看。

## 【ACTIVE STATE】

**CURRENT STATE**
- main 是 v2.8.1，PR #4 到 #9 都已合并，没有进行中的 PR 或未提交的改动。
- 最近几版都改了什么：
  - **v2.6.1：** 录屏里看到的问题（底座闪烁、地板发白、镜头拉近、球的拖尾、防守姿势）
  - **v2.6.2：** 撤回缩放锁，加了全屏按钮
  - **v2.6.3：** 号码牌放到光圈外侧
  - **v2.7.0：** 展台风重做，新篮架
  - **v2.8.0：** NBA 球馆风（禁区和界外刷海军蓝、LED 屏、座椅、24 秒计时器）
  - **v2.8.1：** 退出或进后台后观众声不停的 bug

**EXACT NEXT ACTION**
先问 Will 两件事：v2.8.0 / v2.8.1 在 iPad 上的实测结果，以及教练有没有反馈。然后按他的回答，从 BRANCH LEDGER 里挑下一项做。他还没明确优先级时，推荐先做"俱乐部配置拆分（第一步）"。

**OPEN QUESTIONS**
- **v2.8.1 的声音修复是否生效：** 比赛中上滑回桌面应该马上安静；玩完篮球去五子棋，不应该再有观众声。
- **v2.8.0 的三项真机检查：** NBA 风好不好看；约 500 个座椅实例在 iPad 上流不流畅；地板清漆光泽会不会反出一片白。
- **全屏按钮：** 左上角的 X 是 iPadOS 系统按钮，网页改不了。保留全屏按钮，还是去掉、改用主屏幕 App 打开？问过 Will，他没回答。
- **教练反馈：** 还没回来。

## 【BRANCH LEDGER】

- **[俱乐部版 / 多租户]**
  - WHAT：每个俱乐部有自己的 logo、颜色和皮肤，标准战术可以改名、隐藏、排序，也能加自己的战术，最终能自助。
  - ORIGIN：Will 提出的产品设想。
  - STATUS：方案已经讲过，Will 还没说开工。
    - **第一步：** 把写死的颜色、logo 和文字（`court3d.js` 的 `TEAM`/`GOLD`、`courtdesign.js` 的 `NAVY`、`arena3d.js` 的 LED 和底线字、`hoop3d.js` 的配色）收拢成一份"俱乐部配置"，用 `?club=xxx` 切换。纯静态，不用服务器。
    - **第二步：** 用"服务"方式先接两三个真实俱乐部。
    - **第三步：** 确认有需求再做自助后台，需要账号、数据库、存储，比如 Supabase 或 Firebase。最难的一块是战术编辑器。
    - **提醒过 Will 的两件事：** 收集儿童数据有法律要求，起步不要收真实姓名；用俱乐部 logo 要有书面授权。
  - RETURN?：是。等 Will 说开工，并提供第一个样板俱乐部的名字、logo 和队服颜色。
- **[新战术录入]**
  - WHAT：教练提供战术，我们加进 Playbook。
  - ORIGIN：Will 问过教练需要提供什么。
  - STATUS：格式已经告诉 Will，等教练提供素材。格式要求：
    - 名字和类别。类别目前四类：offense、blob（底线发球）、slob（边线发球）、defense。
    - 一句话说明这个战术的目的。
    - 开始时的站位图。
    - 每一步一张图配一句话，3 到 6 步。
    - 目前的限制：只支持半场，只能讲一条固定路线（没有分支判断），进攻战术是无防守演示。
    - 加法：在 `js/games/hoops/playbook.js` 的 `PLAYS` 里照现有条目加一条纯数据，坐标换算成英尺。
  - RETURN?：是。
- **[旧素材分支清理]**
  - WHAT：remote 上的 `assets/hoops-media-1`、`assets/hoops-media-2`、`assets/hoops-models-2`、`review/recording-1` 是 Antigravity 推上来的素材和录屏拆帧分支，已经不再需要。
  - STATUS：没动。删分支需要 Will 同意。
  - RETURN?：可选。
- **[设计参考图]**
  - `assets/hoops-models-2` 分支里的 `concepts/hoops-05/AC_fusion_1.jpg`（展台方向图）和 `hoop_detail.jpg`（篮架参考），是 v2.7.0 的参考。现在方向已经改成 NBA 风，仅供参考。

## 【UNWRITTEN UNDERSTANDING】

- **改画面一定先渲染截图自己看。** 要对比旧版和参考图，确认没有发白、闪烁、穿模，再给 Will 看。不能只说"改好了"。
- **验证手段：** 本地用 Playwright 加 Chromium 截图或慢动作逐帧拍片（`?hoopsSpeed=0.05`）。拼成对比图发给 Will，比文字描述有效得多。
- **Will 测试新版的流程：** 合并 PR，等部署完成，在 iPad 上把 App 划掉重开，确认首页底部显示新版本号。每次交付都要提醒他这几步。
- **他会在 iPad 上录屏发问题，** 通常交给 Antigravity 用 ffmpeg 拆帧，再推到一个 `review/...` 分支给 AI 看。录屏里的问题要逐帧找证据，不要猜。
- **想要的高级感是"像真的 NBA 转播"：** 亮的地板、刷满球队色、LED 屏、座椅，不是"克制的艺术品"。
- **品牌：** 主色海军蓝 `#173058`，金色 `#E2BE72` / `#D9B97A`。CD 标志素材是 `assets/cd_home_mark_transparent.png`。
- **Will 在意额度和成本。** 能一轮做对就别多轮试错；大改动先说计划。

## 【DELTA FROM PARENT】

- 首个交接节点，没有父节点。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 附：常用命令（在仓库根目录跑）

```
# 本地预览：用 Safari 或 Chrome 打开 http://localhost:8000
python3 -m http.server 8000

# 单元测试（Hoops 有 81 个；象棋的计时测试在慢机器上会失败，见 KNOWN TRAPS）
node --test tests/*.test.mjs

# 浏览器冒烟测试：需要 Playwright 和 Chromium
#   - 用 PLAYWRIGHT_MODULE 指定 playwright 模块路径
#   - 用 CHROMIUM_PATH 指定浏览器
HOOPS_DECIDE=150 node scripts/hoops-smoke.mjs review/hoops-smoke-out
```
