## 交接与恢复说明（2026-11-22）

本工作树此前被归档，现已从 Codex 归档恢复到 `/Volumes/MiniStorage/CodexData/home/worktrees/hoops-tactics/caesar-games`。恢复后的 HEAD 是 detached 的归档快照 `35c33b8`，它把归档前的未提交工作保存在快照提交中；恢复前的分支/未提交状态不等同于当前状态。接手前先核对 `git status`、`git log` 和快照内容，不要 reset、覆盖或误以为可以直接推送。此前记录多为 2026-11-05 的实验结果，本次恢复没有重跑测试、播放样片或重新验证设备。

Owner 当前目标是继续提升篮球游戏的可玩性、球场人物和动作，并实现可自动讲解、可导出分享的战术视频；不必等教练。下方旧记录中“Goal ACTIVE”和等待教练的安排只是历史状态，不代表当前执行命令。牛角/电梯门样片与历史实验详见下方；合成音调不是正式旁白，内部录制不是面向用户完成的导出功能。下一位接手者先核实现有视频链路和旁白生产规则，选一个现有战术推进可审看、讲解与画面同步的端到端样片；同时保留游戏动作修复为并行待办。`scripts/hoops-gait-audit.mjs` 的三画面对比是未完成实验，修订后是否正确尚需重跑和验证，不得当作已验收修复。媒体操作遵循当前全局素材库、3090 与存储规则，测试静音并关闭自己启动的浏览器/服务。

## Blender 球馆"可卖级"一轮：真人观众、整圈看台、LED 广告（2026-11-22 至 23 凌晨，Claude Code，分支 `claude/hoops-narrated-sample`）

Owner 原话要点：远看反光不舒服，地板塑料感重；人物像像素、马赛克；灯四方四正要倒角；要求用 Blender 把场景做到"可以在网上卖"的程度，并向 Cutaway 频道（媒体仓库 `projects/cutaway_airliner_series/CRAFT_SHARED.md`）学习：人物要么真实要么不要，细节密度要量，模型只用 CC0 / CC-BY。

`tools/blender/build_arena_venue.py` 本轮改动（只在 3090 跑，经 `gpuq submit --worker cd001 --wrapper bare`）：
- **地板**：去掉镜面感，改成缎面清漆（Coat 0.55 / 粗糙 0.17）+ 程序化 2¼ 英寸木条明暗与接缝；外圈和油漆区也从 coat 1.0/0.06 降到同一缎面，场边灯的白色高光点消失。
- **观众**：方块小人换成 `assets/hoops/casual-audience.glb` 的真实三维坐姿人（CC0 衍生），按衣服/肤色/头发分槽随机配色，集合实例化；独立带倒角的座椅。现在约 1.4 万座、1.2 万人。
- **看台**：上下两层都改成一个凸多边形（侧边、端线、四个斜角），每排两端沿多边形的斜接方向延伸（`bowl()` / `stand(ma, mb)`），四角接成整圈，不再有三角黑洞；过道台阶 + 扶手；长边下层中间是嵌入看台的出入通道（两侧斜矮墙、内部暖光、黑色隧道口，`wedge()`）；上层前沿是玻璃护栏。
- **LED**：`tools/blender/make_led_ribbon.py` 生成六块 10:1 广告画面（HOOPS IQ / CD GAMES / READ THE DEFENSE / PLAY SMART / MAKE THE RIGHT READ，Anton 字体，全部自有文字），按看台 UV 贴在场边围挡、上层前沿和记分台正面，字从场内看是正向。
- **其他**：包厢一圈是深色玻璃 + 每格亮度不同的暖光；顶棚三角桁架和猫道；圆形灯具（锥形灯罩 + 圆镜片 + 支架）；所有硬表面加倒角（Bevel 0.05、3 段）；记分大屏贴游戏截图；新增"宣传主图"机位 `hero`（下层角落高位看对面篮筐和大屏）。

渲染：预览 a11→a14（64 spp 1280×720，一版约 20–60 s）；终版 a14 256 spp 1920×1080 四机位共 71 s。3090 `/srv/ai-data/media-work/projects/CAESAR_HOOPS_TACTICS/work/arena-venue-a14/final/`，SSD 副本 `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261122/arena-final-a14/`（含 JPG 和四宫格）。SHA256：hero `36cde9ef…`、broadcast `59e1e8d8…`、courtside `da290670…`、wide `ce0b4a88…`，脚本 `fd62295f…`；LED 贴图 `6f84c475…`。

还不够"可卖"的地方（自评）：①近看观众姿势基本一样（三种坐姿），没有站立、挥手、拍照；②顶棚太黑，桁架和猫道在多数机位看不到；③没有场边摄影师、记者席、替补席人员；④场地没有球员；⑤尚未按 Cutaway 的边缘密度法（gapmeas）和参考照片定量对比细节密度；⑥还没整理成可交付的 .blend 资产包（集合命名、材质打包、授权清单）。游戏内地板/观众本轮没改；Owner 在 iPad 上看到的是线上旧版本和旧 Blender 海报（方块观众），推送前不会变。

## 球馆对标与按实测数调整（2026-11-22 深夜，Claude Code，分支 `claude/hoops-narrated-sample`）

Owner 问有没有对标头部球馆现场设计——之前没有。做了：从 Wikimedia Commons 取 4 个 NBA 球馆（湖人、快船两张、勇士）比赛照片，按区域量颜色亮度，写成目标数（`docs/ARENA_REFERENCE.md`，网页版对标板源文件 `docs/arena-reference/index.html`）。核心：地板是全场最亮的浅色枫木（Y≈0.72、色相 36–43°），地板÷观众 5–13 倍，地板÷外圈≈8 倍（外圈深海军蓝 50,77,130），天花板几乎全黑。
游戏按数调整（`scripts/arena-measure.py` 每次截图重量）：地板 0.48→0.69、地板÷观众 20.8→11.4、地板÷外圈 29.9→9.3，外圈颜色和参考几乎一致；地板加了 2¼ 英寸木条明暗和接缝。**决定不把 Blender 4K 木纹烘进游戏**：游戏地板贴图 2048 像素盖半场，一根木条只有 7–8 像素，转播机位下约 3 像素，4K 烘焙看不出来却多几 MB 下载和几十 MB 显存；Blender 球馆改为海报 / 宣传 / 视频用，同样按目标数调（a04）。
Owner 同时要求：**只用中文说话；顺序明显的事自己定、一路往下做，只在真需要他拿主意时才停。**

## 菜单改版（深色球馆风）+ Blender 球馆第一版 + 3080 Ti 录屏（2026-11-22 深夜，Claude Code，分支 `claude/hoops-narrated-sample`）

Owner 原话：UI「太不好看了，这给孩子的游戏」；「这可不是幼稚园小孩啊，这是十岁到十五岁的这些小孩儿，也有可能青少年都可以用，大人也可以玩」。方向：体育游戏 / 2K 菜单风格，不要卡通、粉彩、幼稚文案。

①**UI 改版**：新文件 `css/theme-arena.css`，只作用于 `body[data-screen="home"|"hoops"]`（`js/app.js` `render()` 给 body 写 `data-screen`），四个棋类自己的棋盘页不受影响。首页：深色球馆底 + 顶部蓝色聚光，CD GAMES 用 Anton，篮球智商做成左侧大海报卡（Blender 球馆渲染 `assets/hoops/ui/arena-poster.jpg` 作底图，「开打 ▸」金色徽章），四个棋类是右侧 2×2 深色卡（各自队色竖条 + 大字水印）。篮球菜单：章节头用球馆图作底、三色顶条；标签改成转播式下划线；关卡卡大号 Anton 编号水印，**下一关**发光金框 +「开打」（controller 加 `is-next` 类），锁住的关卡用斜纹 + 锁图标、文字仍可读（原来是半透明灰）；战术手册卡修掉「米色底白字」看不清；随机应变 / 数据页同风格。中英文、1180×820 横屏和 820×1180 竖屏都截图自查过（SSD `ui-before-a01/` 对比 `ui-after-a01…a03/`），比赛画面不受影响。`scripts/ui-screens.mjs <SSD目录> [WxH] [zh|en]` 一键截全部菜单页。iPad 真机未验证。

②**Blender 球馆**：`tools/blender/build_arena_venue.py`（只在 3090 跑，经 `gpuq submit --worker cd001 --wrapper bare`）。整片地板（Poly Haven `laminate_floor_02` 4K 枫木纹 CC0，经资产库 `asset_acquire`，路径与 SHA 见 3090 工作目录 `in/assets.json`）、篮架、两层看台约 9 千座 / 7.8 千观众、LED 带、记分台、吊顶记分牌、22 盏灯 + 补光、三个机位。**踩坑**：第一版每个座位都调 `bmesh.ops`，每次调用都遍历整个网格，建模变成平方级，28 分钟没进渲染、占着 cd001 锁（Owner 手动 kill）；改成直接造顶点后建模 1.1 s、三机位 64 spp 共 6 s。a02 预览偏曝、上层看台四角漏黑，a03 降曝光 0.7 档、木纹加饱和、补四角。下一步：定稿 look-dev → 烘焙地板贴图（可能含光照）→ 导出 glTF 接入游戏替换现有地板 / 外围。

③**录屏装到 3080 Ti（win3060）**：Owner 自己跑了安装脚本，Playwright 1.60.0 + Chromium + ffmpeg 在 `D:\ai-render\tools\browser-recorder\`，`record-test.cmd "<RUNS>" <名字>` 录实战回合（RUNS 要加引号，cmd 会按逗号拆参数）；已录 3 段无灰边。`browser-recorder.mjs` 允许输出到 `D:\ai-render\`，窗口尺寸不对时用 CDP 自动校正；`hoops-possession-check.mjs` 决策时间默认 60 s（慢机器上原来会超时）。

## 转播级画面第一轮 + 改名 CD Games + 录屏工具（2026-11-22 夜，Claude Code，分支 `claude/hoops-narrated-sample`）

Owner 要求：先把基础设施（人物模型、动作、UI、观众、地板、篮筐）往 NBA / 2K 靠；游戏里不再出现 "Caesar"，改成 CD Games；别动不动让他上 iPad 测，做到有大变化再请他看；录屏工具很重要（以后做讲解视频要用），重的软件尽量别装 Mac，装 3090 / 3080。

本轮做了：①**改名**：界面、标题、manifest、球场围挡 / LED 带 / 球衣胸字全部由 Caesar 改为 CD / CD Games（代码注释、测试日志、媒体项目 ID `CAESAR_HOOPS_TACTICS` 未改，用户看不到）。②**转播式比赛画面**（`css/hoops.css` 末尾「Broadcast presentation」，controller `render()` 给 body 加 `hoops-playing`）：比赛中隐藏网站顶栏，球场贴边铺满黑底；比分改成电视角标（CD / RIVALS 队色块 + Anton 字体，`assets/hoops/fonts/Anton_Regular.ttf` 经 3090 资产库 `asset_resolve` 取得，OFL 1.1，SHA256 `a4ba3a92…`，provenance 同目录）；右侧改成深色转播侧栏，选项按钮加大、金色字母块；标题卡和结果横幅改成电视下三分之一条；侧栏加了声音开关（顶栏隐藏后的替代）。③**球馆光线**：看台观众按高度渐暗（`arena-crowd-impostors.js`），球场上方加转播式压暗与暗角（`.hc3d::before`，`isolation:isolate` 防止盖住按钮）。④**篮架**：细黑杆 + 方盒底座换成 NBA 式包软垫的斜面底座和方柱（队色海军蓝亮面软包、金色腰线、正面 CD 标），篮板下角加黑色护垫（`hoop3d.js`）。⑤**地板**：三分线外木色加深一档（双色染色）、禁区渐变 + 金色细内线、清漆与倒影加强（倒影 0.22→0.32，`courtdesign.js` / `court3d.js` / `floor-reflection.js`）。⑥**录屏工具**（repo 内）：`scripts/browser-recorder.mjs`（静音无头 Chrome，输出必须在 `/Volumes/MiniStorage`；修掉 macOS 无头窗口少录底部 81 行灰边的问题：不用模拟视口、窗口加高 87 px）；`scripts/static-server.mjs`（Node 静态服务；Python http.server 只排 5 个连接，模块多的页面会随机 `ERR_CONNECTION_RESET`）；`scripts/hoops-possession-check.mjs`（自动打实战回合、截图、`RECORD=1` 录 WebM）。Playwright 的 ffmpeg 组件（2.5 MB）装在了 Mac 的 Playwright 缓存里；**想把整套录制装到 3090 `/srv/ai-data/tools/browser-recorder` 时被权限拦截，未装**，需 Owner 放行。

成片（SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261122/broadcast-final-a02/`，3090 上 ffmpeg 合成，工作目录 `/srv/ai-data/media-work/projects/CAESAR_HOOPS_TACTICS/work/broadcast-final-a02`）：`hoops-before-after-720.mp4`（同一包夹回合，左旧右新，1920×620 30 fps 18 s，SHA `b04d125e…`）；`hoops-broadcast-3-coverages-720.mp4`（三种防守各一回合，1280×720 30 fps 41.9 s，SHA `ed6d7dbe…`）。录制都无灰边、无页面错误。59 项单测通过。

和 NBA 2K 的差距（自评，按大小排）：①**人物与动作**最大：我们是 CC0 基础人体改造的低模，没有真实面部、汗水/皮肤着色、球衣布料；动作是 14 个通用片段 + 少量篮球片段，跑动脚滑/穿地仍在，没有 2K 那种成千上万的动捕过渡。②**观众**：已压暗，但仍是同一批坐姿重复，没有站起、挥毛巾、手环灯光秀。③**灯光**：没有真正的 HDR 球馆灯、泛光（bloom）和雾气。④**镜头**：只有固定转播机位，没有多机位、慢放回放、特写。⑤UI 已接近转播风格，菜单页仍是网页感。未验证：iPad 真机（按 Owner 要求暂不请他测）、英文界面截图、2D 降级球场。

## 牛角实战回合：第一个能玩的读防守回合（2026-11-22，Claude Code，分支 `claude/hoops-narrated-sample`）

方向（Owner 11-22 原话要点）：先做游戏和基础设施，配音最后；一个战术有多个选项，按防守 read and react；孩子能打比赛也能学战术，不做 2K 式「五边形」个人能力。已暂停：媒体厂 `HOOPS_HORNS_POP_CN` 集只登记、未锁稿（Owner 未签字），实验期**不生成任何配音**。

本轮做了：①新 `js/games/hoops/shot-model.js`：命中率 = 区域基础 × 球员星级 × 空位系数（出手瞬间最近防守人的距离），先看空不空、再看是谁投；五人角色卡（组织者/射手/射手/内线/外弹大个，三分·中投·篮下·传球 1–5 星）。②新 `possession.js`：牛角同一个开局，防守每回合随机三种（退防 drop / 换防 switch / 上提包夹 hedge，不连续重复）；读对后可进入第二次判断（换防→突破后读底角补防；包夹→传给外弹 5 号后**改由你控制 5 号**读扑防）；投篮 beat 写 `shot:'model'`，进不进由投篮模型按实际站位算，不再是写死的进球。③controller 新 `possession` 模式：入口在「随机应变」页第二张卡「牛角：实战回合」；多次判断的星数取最低；复盘写每次判断星数 + 投篮者角色、区域星级、空位档（米）、命中率、结果；「再打一回合」连打并累计总分；「看正确打法」把整条正确链（含第二次判断）演完且必进。④`court3d.setYou` / 2D `court.setYou`：回合中途把金色圈、计时圈和「你」交给另一名球员；`setReadFrame(level,{snap:false})` 第二次判断不跳镜头。⑤新增文件已加入 `sw.js` 预缓存（未升版本号，未发布）。⑥新 `tests/hoops-possession.test.mjs`：重放每种防守的站位，验证**每次判断中最佳选项的命中率都高于其他投篮选项**，以及写着「三分」的出手确实在三分线外（抓到一个 bug：包夹时 5 号外弹点离篮 21.7 ft 被算成中投，已移到线外）。全部 59 项单测通过。

验证：本机无头 Chrome（`--mute-audio`，硬件渲染）五个回合各打一遍（退防最佳、换防两次最佳、包夹两次最佳、包夹第二次读错再看正确打法、换防直接急停），无页面错误，截图和逐回合结果在 SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261122/possession-check-a02/`（`report.json`）。服务与浏览器已关闭。**未验证**：iPad 真机手感、2D 降级球场上的 setYou、英文界面截图；没有录视频（Playwright 录屏需要额外下载 ffmpeg，未下载）。

已知不足 / 下一步：固定转播机位下，包夹时弧顶四个人会叠在一起，要靠导演层的机位解决；防守还是按剧本写死的三套，下一步做规则化防守引擎（防守人按规则自己补防、扑防），再加二号战术（电梯门等）和防守回合；角色卡目前只影响命中率，还没进 UI 的球员卡；动作脚穿地照旧待办（IK 实验未验收，不接入）。

## 真人声讲解样片端到端打通（2026-11-22，Claude Code，分支 `claude/hoops-narrated-sample`）

牛角挡拆外弹第一次用真人克隆声跑通「战术数据 → 配音 → 逐词对齐 → 3D 录制 → MP4」。声音是 seven-voice MOSS **research 试听**（`research:true`，CB0003，seed 42：27.44 s、241 字/分、声纹 0.80、对稿 0.97；语速未达正式 255–260，ASR 报「牛→扭」声调疑点未听审），**只能当链路验证与内部审看，不可外发**。对齐：新 `tools/voice/align_narration.py` 经 CB0001 `narration-align/trial-a01` 跑 mf_align，覆盖 0.973、20 个短语 token。成片 SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261122/horns-trial-a04-30fps.mp4`（SHA `850357018d47…`，归档 CB0001 `narrated-mp4/trial-a04b`）：1280×720 H.264 30 fps 29.4 s + AAC 48k。编码后实测：旁白在片中 1.237 s 起（互相关 0.99），四步字幕切换比对应语音早 4–24 ms；录制帧间隔均值 33 ms、最大 89 ms。

本轮代码：①`playbook.js` beat 可带 `cue`（该步讲解里的原文短语，游戏忽略），录制时该 beat 在说到这句时才开始；`hoops-aligned-cues.mjs` 由对齐 token 算 `beatsMs`（短语落在 token 内按字符位置估算并标出），`beatSchedule` 校验每拍在下一步前做完。修掉「传球投篮在『一号就可以回传』之前就做完」。②录制画面画上球员号码牌和掩护提示（游戏里号码是 HTML 层，原录制会丢）。③导出时把球场放大到整个画幅（1280×585，去掉两侧黑边），`HOOPS_EXPORT_QUALITY=high`，按讲解语言切 app 语言（之前中文片里出现英文「Screen!」）。④录制前预渲染所有中文字幕/提示，修掉首次出现中文提示时 0.5 s 卡帧。⑤`hoops-video-transcode.sh` 加 `-vf fps=30`：浏览器 WebM 是毫秒时钟，旧脚本输出 1000 fps（29302 帧）MP4，此前所有 MP4 都有这个问题。52 项单测通过。本机录制用 `PLAYWRIGHT_MODULE=/Users/cdmini/AIProjects/bakery-ai-order-guide/node_modules/playwright CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`（无头硬件渲染约 30 fps）。

**卡点（需 Owner 决定）**：Owner 11-22 要求声音全部改用 ElevenLabs 并整体对标 NBA 2K。`eleven_voice.py` 入口门要求集在 `studio/registry.json` 登记（`ep.py new … --channel`），现有频道都不属于 Hoops IQ；新建 Hoops IQ 频道/集要 Owner 同意，教练语音（87 条中文 + 87 条英文，原 Qwen3-TTS「傅叔」）用谁的声音也待定。

参考片拆解（@NBANFLHistory「Mastering the Horns Offense」，竖屏 62 s，静音无头截图在 SSD `ref-7FKVIvBEkbY/sheet.jpg`）：全 3D 无脸人偶球员 + 球队色球衣号码、**有防守人**、发光跑位/传球轨迹、巨型动态大字、球员名牌、战术板小窗、SLOW MOTION/REPLAY、多机位（俯视/低角/特写）快剪。它用了 NBA 球队与真实球员名，我们不能照搬。我们缺：防守人、轨迹光带、多机位与慢放回放、竖屏、动态字幕层、节奏感；我们强：真人比例人物和完整球馆观众。未完成：ElevenLabs 正式配音、英文版、电梯门样片、动作脚穿地（IK 实验仍未验收）、Owner 观感与 iPad。

## 脚部 IK 全身起停对照片段（2026-11-05 继续）

`hoops-gait-audit.mjs` 加四帧热身、跑位前250ms和后300ms观察，比较机位后移看全身；静音 `gait-continuous-a10.webm/json` 在 SSD。105次采样从约15ms至1763ms，角色起点 z=6、终点 z=25，最大观察间隔41.5ms；左右为同帧原动作和**未渐变**独立 IK。`gait-continuous-original-a10.png` 和 `gait-continuous-a10-playback.png` 已目视，观察帧中人物头脚可见；Chromium 静音播放到1.10秒无错误。额外渲染可能影响帧速，单帧查看不是持续1×观影或完整动作质量验收，未量全部鞋面、脚滑与膝盖连续；候选不接入游戏。继续处理可用的连续脚部修正、实际观察和正式旁白/用户导出；浏览器/服务已退出，Goal ACTIVE。

## 脚部 IK 连续对照初样（2026-11-05 继续）

`hoops-gait-audit.mjs` 可额外静音录制同一帧原始姿态和独立未渐变 IK 两侧画面，SSD `gait-continuous-a09.webm`（VP8 1280×480、无音轨）和 `gait-continuous-a09.json`。本次50个采样约376–1212ms，录制回调期间多次额外渲染且没有开头约376ms，不能声称完整动作或真实帧率通过；`gait-continuous-a09-playback.png` 是播放时单帧，已目视，人物头部被近景裁掉。Chromium 静音播放至0.502秒无解码错误，未持续1×观察、未验证逐帧连续性，也不是 Owner 评价。候选未进入游戏，下一步先确保录完整起停、相同相机覆盖全身及鞋，再正常速度比较、量相邻帧与脚面/膝盖。浏览器和服务关闭；正式旁白和视频入口仍未完成，Goal ACTIVE。

## 脚部 IK 同帧画面对照（2026-11-05 继续）

静音 `hoops-gait-audit.mjs` 同一运行时帧生成原始和未渐变 IK 的相同机位图，SSD `gait-original-a08.png` / `gait-candidate-a08.png`，`gait-compare-a08.json`。约470ms帧左鞋所选顶点最低 -0.107→+0.004英尺，左膝夹角140.3→129.9°、踝目标误差约0.0087英尺。两张图已目视：候选中近侧脚离地板切面更完整、左腿姿态有变化；截图人物头部不在画幅，鞋与腿的细节仍简化，单帧不能证明膝盖自然、全鞋接地或连续步态。该候选是每帧独立非渐变求解，未接入游戏，前一轮数值已显示相邻帧修正量变化较大。下一步做可播放连续候选，处理接触预测/平滑并核全程足底、膝部与1×画面。浏览器和临时服务已退出，Goal ACTIVE。

## 同帧 IK 渐变试验（2026-11-05 继续）

`hoops-gait-audit.mjs` 在同一运行采样帧同时比较原始姿态、独立 IK、相对当前原始骨骼旋转的指数渐变 IK；每帧试算后恢复游戏姿态。SSD `gait-ik-smooth-a07.json`：53帧约359–1214ms（开头未采），左鞋原先下探18帧；这些帧筛选顶点最深原始 -0.178、未渐变 IK -0.006、渐变 IK -0.116英尺；仍负值的帧分别为18/3/15。相邻观测帧左膝修正量变化最大约10.28°→2.09°，只是本次不等间隔采样里的数值，不代表腿部总速度或自然度。渐变改善修正量跳变，却明显滞后、保留大量下探；此候选不接游戏。下一步需考虑提前预判接触/受限支撑与脚底接触，而不是简单滤波，再看完整1×对照。静音浏览器和临时服务退出；Goal ACTIVE。

## 同帧脚部 IK 隔离试验（2026-11-05 继续）

`hoops-gait-audit.mjs` 对实际穿门运行的每个采样帧保存原腿骨四元数，遇筛选鞋顶点低于地面时仅将对应脚踝向上移（上限0.3英尺、原脚朝向保持）并用现有 `reach` 解髋膝；测完立刻恢复原骨骼，不影响下一帧和游戏。SSD `gait-ik-experiment-a06.json`：49个观察帧约420–1207ms，其中17帧左鞋所选点低于地面；这些帧最低值约-0.143→-0.018英尺，仍有4帧负值；最大脚踝目标误差约0.036英尺、左膝夹角相对原姿势最大变化约13.6°。这是对每帧独立试算、不是可播放的 IK 动画；漏开头、筛选顶点而非全部网格、数值不证明膝部自然、连续、脚滑或真实接触，也未检查同帧视觉。**候选未接入游戏**；下一步量相邻帧关节/脚底速度和误差、显式处理残余穿地，并做正常速度对照后才考虑集成。静音浏览器/服务已退出；Goal ACTIVE。

## 跑位最低鞋面顶点定位（2026-11-05 继续）

`hoops-gait-audit.mjs` 现在记录选中左右鞋最低蒙皮顶点编号及世界坐标；额外近景帧用关闭深度测试的红色球标出左侧最低点（标记穿透地面以便定位，不代表该点实际可见）。SSD `gait-runtime-a05.json/png` 同帧约421ms：左侧顶点206世界 y=-0.160英尺，floor.position.y=0；右侧最低 +0.311英尺。截图已目视，红点位于近侧脚下方并通过地面显示；地板网格为水平 plane、position.y=0，和该顶点使用世界高度一致。红点尺寸有半径、且关闭深度测试，不能把其底部当作顶点深度；画面近侧鞋/足外形仍较简陋。仅观察一次实际跑位的一帧、权重筛选子集；尚未确认足底哪一部位的解剖对应、全程或修复质量。下一步针对脚部而非整体抬高尝试受限修正，量膝脚连续与蒙皮后鞋面并正常速度对照。测试浏览器/服务退出，Goal ACTIVE。

## 跑位鞋面下探近景（2026-11-05 继续）

`hoops-gait-audit.mjs` 可选将实际 runner 中首次左鞋筛选顶点低于 -0.08英尺时的独立近景相机帧保存到 SSD；`gait-runtime-a04.json/png` 在同一回调的约497ms记录左/右最低 -0.127/+0.085英尺。截图已目视，画面近侧白色鞋/足底与地板交界被切平，和所选顶点进入地板的数值一致，但单帧仍难分辨接触是鞋底哪一部分、地面遮挡或个别顶点权重。截图用额外同步 render，可能改变后续帧性能；该次只观察389–1214ms、51次回调，不能与上一轮最深值精确对比。下一步在同帧标出最低顶点及与鞋底网格对应关系，核对地板高度/变换，再做保留步态的候选修正；不以整体抬高人物掩盖。浏览器和临时服务均退出，Goal ACTIVE。

## 电梯门真实跑位鞋面采样（2026-11-05 继续）

`hoops-gait-audit.mjs` 先在实际 runner 播放电梯门 o2 穿门 beat 时观察蒙皮鞋顶点，再暂停球场采原动作；SSD `gait-runtime-a03.json` 记录真实回调53次，时间约356–1206ms（首356ms未采到，故不是全程逐帧），跑位从 z=6 到近25，观察到 Sprint 31帧、Jog 20帧、Idle 2帧；所选左/右鞋最低顶点分别约-0.212/-0.064英尺（约-6.5/-2.0cm）。本采样含运行时动画与脚部处理，但仅覆盖权重筛选顶点、一次浏览器运行且不含开头；帧调度/更新顺序和下探对应的实际画面仍需检查，不证明整只鞋、所有设备或持续脚滑。下一步锁定下探时间点看鞋与地的近景并核顶点选择/坐标，再设计修正；不得仅上移身体掩盖。脚本首轮输出成功，静音浏览器与临时服务关闭。正式旁白、视频入口和 Owner/iPad 验收未完成，Goal ACTIVE。

## 跑步片段实际蒙皮鞋顶点采样（2026-11-05 继续）

扩充 `scripts/hoops-gait-audit.mjs`：在前述24个等相位点同时采集真实游戏人物 Shoe 蒙皮网格的左右侧选定顶点，按 foot/ball/toe/calf 同侧权重总和 >0.5 筛选，左262、右304点；`gait-surface-a02.json` 在 SSD。静止原地单独播放 Sprint 时，选中左鞋点的最低值约 -0.099 英尺（约-3.0cm）、右鞋约 -0.023英尺；Jog 左约 -0.009、右约 -0.023英尺。此采样比骨骼锚点更接近真实网格，但不覆盖全部鞋面或三角形，不含行进、混合、运行时脚部校正，也不是逐帧或接触真值；不能直接推断实际游戏同样穿地或脚滑。下一步在真实穿门动作逐帧取样同一网格并比较运行时校正，再做动作候选。浏览器/服务均退出；Goal ACTIVE。

## 跑步片段可重复鞋底锚点采样（2026-11-05 继续）

新增 `scripts/hoops-gait-audit.mjs`：独立临时服务和 `--mute-audio` 浏览器加载真实游戏球员，分别对 Idle/Jog/Sprint 每片段24个等相位采样骨盆—上躯干角度及两脚现有骨骼附着鞋底锚点最低高度；输出 SSD `gait-anchor-a01.json`，72条。观察 Sprint 躯干约35.1–37.0°；所选左鞋锚点最低约-0.034英尺，右鞋约+0.016英尺。Jog 所选右鞋锚点最低约-0.008英尺；这些是随 foot bone 变换的绑定姿态锚点，不是蒙皮后鞋网格全表面、接触标签或带位移的步态，不能称真实穿地/脚滑或验收。首次脚本误把锚点扁平数组当左右嵌套数组而失败，临时空输出已清理；按父骨分组后成功，浏览器和服务均退出。下一步用蒙皮网格逐帧核接地、动画混合和行进，再做同相位候选。Goal ACTIVE。

## 原跑步片段躯干采样（2026-11-05 继续）

静音浏览器用实际游戏球员 `AnimationMixer` 分别单独播放 Idle/Jog/Sprint，停用其他动作，在每片段8个等相位点量 pelvis 到 spine_03 的世界空间骨骼连线与竖直方向夹角：Idle 约5.9–7.8°，Jog 约19.3–21.8°，Sprint 约35.1–37.0°。此前真实穿门主要触发 Sprint，结合本次孤立采样，较大的躯干倾斜已存在于冲刺片段本身，不必归因于运行时 balance（该过程未施加 balance）。夹角没有区分前后或侧倾、骨骼并非皮肤躯干、8点不能覆盖所有帧或动作过渡；此结果不评判合适角度。脚骨高度记录不能当鞋底触地证据。下一步在同相位对比实际方向、足底与游戏中的混合，提出独立候选并正常速度观察。临时浏览器/服务关闭；正式旁白视频、iPad/Owner 验收仍未完成，Goal ACTIVE。

## 电梯门平滑起停试验未接入（2026-11-05 继续）

试将穿门改为1800ms smoothstep（起止速度为零、理论峰值为平均速度1.5倍），其余合门时序保持顺序；静音合成音调 `elevator-smooth-v49.webm` 录制成功，4秒截图 `elevator-smooth-v49.png` 已目视，射手仍前倾，单帧不能证明连续动作/脚底或审美改善。48项篮球测试是在试验期间通过，不能作为动作验收；未连续1×审看。因未证明改进，已撤回 beat、曲线、版本及试验测试，保留证据；游戏仍 local.44。浏览器及录制服务关闭，下一步应检查实际 Jog 和 Sprint 躯干骨架及同相位足底，而非只换跑位曲线。Goal ACTIVE。

## 电梯门跑位触发动作测量（2026-11-05 继续）

静音浏览器对实际电梯门 o2 穿门 beat 逐帧读取 `p.speed` 和 `athlete.loopName`：原1200ms cubic 一次采到53帧（首帧延迟约399ms），其中 Sprint 32帧、Jog 15帧、Idle 6帧，平滑速度峰值约39英尺/秒。对隔离实验中的1600ms linear 同样采样92帧，Jog 89、Sprint 1、Idle 2，峰值约19；这证实原跑位确实主要触发冲刺而实验主要触发慢跑，但帧间隔和首帧延迟不同，计数不是运动质量比较，也不证明前倾来自哪个骨骼或两版步态自然。上轮拒绝的等速试验仍未接入；下一步隔离查看 Jog/Sprint 片段与转场，同相位比较身体、鞋底和起停。测试中首个页面启动未初始化 `caesarApp`，手动重新导入 app 模块后才开始；浏览器及临时服务均已关闭。Goal ACTIVE。

## 电梯门射手跑位时序试验拒绝（2026-11-05 继续）

检查发现射手从 z=6 到25（19英尺）在1200ms内按 cubic easeInOut 运动，理论峰值约3倍平均速度，可能触发 Sprint；这是线速度估算，不证明前倾唯一原因。试将该 beat 改1600ms等速，静音录制 `elevator-movement-v48.webm`，3.8秒 `elevator-movement-v48-cut.png` 与原 `elevator-angle-v47-cut.png` 已目视：仍明显前倾，且两帧处于不同时序，不能作为同姿态直接对比；等速也可能突兀起停。因缺连续正常速度与步态证据，**拒绝并撤回**该游戏时序/版本改动；当前仍 local.44。47项篮球测试在试验期间通过，不代表动作通过。浏览器/服务已关闭；下一步检查 Jog 与 Sprint 动画本身、转场、鞋底及同动作相位比较。正式旁白视频与 Owner/iPad 验收未完成，Goal ACTIVE。

## 电梯门教学机位试验（2026-11-05 继续）

内部录制器对 `elevator-shooter` 使用更沿球场纵向、俯视的专门机位，仍以全战术跑位包围盒取景；只影响录制，普通游戏镜头与其他战术不变。静音合成音调样片 `continuous-voice-a01/elevator-angle-v47.webm` 的3.8秒 `elevator-angle-v47-cut.png` 与6秒 `elevator-angle-v47-shot.png` 已目视：两名掩护人相较前侧向视角更容易分辨，篮筐和五人可见；射手穿门时身体姿态明显前倾，动作自然度仍差，视角较高且画幅留白多，不能视为成片品质通过。相机/录制12项测试通过；未连续1×观察、未验证其他设备和 Owner 评价，测试浏览器已关闭。正式旁白、产品导出、动作与 iPad 验收仍未完成，Goal ACTIVE。

## 电梯门教学录制检查（2026-11-05 继续）

以当前战术文字、8秒合成音调和独立静音浏览器生成 `continuous-voice-a01/elevator-teaching-v46.webm`，跳至6秒截图 `elevator-v46-shot.png` 已目视：球场与字幕可见，但两名掩护人在当前侧向视角重叠，电梯门结构不够清晰；不能将该截图当战术画面验收。该音调与三步不是语音讲解，也不验证讲解同步。下一步对电梯门专门比较更适合展示通道的角度，检查跑位与合门全程且保留篮筐和持球队员。

另检查录制器生命周期：目前导出使用独立浏览器页面；`setScene` 会重建人物，而 `snapshot/restoreState` 只保存位置与球，不能恢复任意已有球场的完整人物、镜头与界面。不得将目前录制器直接挂到正在玩的页面并声称状态无损；用户入口应使用隔离场景或实现完整生命周期。测试浏览器/服务已关闭，正式旁白和 iPad/Owner 验收未完成；Goal ACTIVE。

## 教学录制保留整体战术视野（2026-11-05 继续）

上轮牛角开场五人在画内，但 `caption-layout-v45-shot.png` 第9秒投篮时游戏的 finish 推近镜头将近侧底角球员裁出。内部录制器现在根据战术全部跑位设置全局取景，复制 shot beat 并只在录制用副本关闭 finishCamera；不改共享战术数据和游戏比赛镜头。13项相机/录制测试通过。静音合成音调录制 `teaching-camera-v46.webm`，第9秒截图 `teaching-camera-v46-shot.png` 已目视，投篮、篮筐和五名球员均在画面；球员因此更小，观感尚未经 Owner 判断。只核了该战术该时点，未验证全部帧、其他战术、长片、iPad 或真实配音；浏览器与录制服务已关闭，Goal ACTIVE。

## 更正：牛角开场五人均在画面（2026-11-05 继续）

上一条说另一侧底角球员未出现，是目视漏数。复看录制截图 `caption-layout-v45.png` 可数到五人：两端底角、两个肘区及持球队员；进一步静音浏览器实际打开牛角战术，稳定后五个角色中心坐标分别为 o1 (661,357)、o2 (177,513)、o3 (400,249)、o4 (517,402)、o5 (542,309)，都在球场画布 x=20–970、y=62–609 内；截图 `framecheck-v45.png` 已目视。坐标是浏览器中角色中心，不证明所有动作全身均在画内或动态镜头不会裁切。没有因此改镜头，测试浏览器及临时服务已退出。仍须检查整段动作与正式讲解、iPad 和 Owner 观感；Goal ACTIVE。

## 战术视频字幕不遮球场（2026-11-05 继续）

内部录制 `hoops-video-capture.mjs` 把画面等比例放进字幕带上方，字幕带不再覆盖球场；横屏/竖屏/小尺寸比例和边界测试通过，13项视频相关测试通过。静音 Chromium 录制合成音调样片 `continuous-voice-a01/caption-layout-v45.webm`，第2秒截图 `caption-layout-v45.png` 已目视：近侧底角球员脚部不再被字幕遮挡；另一侧底角球员仍未出现在当前录制画幅里，须继续调查录制取景与初始尺寸。画面缩小和两侧留白的观感尚未由 Owner 审核；截图含浏览器播放控件，不能判断字幕整体设计完成。该样片不是正式旁白，未做 iPad 验证；浏览器/测试服务已退出，Goal ACTIVE。

## MP4 字幕草稿与来源绑定（2026-11-05 继续）

`scripts/hoops-observed-subtitles.mjs` 在原始 WebM 用法之外，允许提供 WebM 原件和注册 worker 的转码完成收据，为对应 MP4 生成 SRT 草稿。生成前逐流计算文件 SHA，核对原录屏与 capture report、worker 收据的原文件/输出、实际调用的本仓库转码脚本和命令；当前文字与报告仍须相符。工具检查收据内容和文件字节，不证明收据不可伪造，也不证明转码后的字幕时间与画面逐帧精确对齐。

上轮合成音调测试用真实收据生成 `continuous-voice-a01/streaming-test-v44-final.mp4.srt`，4条文字与捕获事件时间已检查；将另一 MP4 混入时工具拒绝且无输出。10项录制/字幕相关测试通过。此 SRT 是测试草稿，不是已审听的旁白或正式交付字幕；字幕时间沿用浏览器事件，真实音画与 PTS 偏差仍需复核。未播放声音；正式讲解视频和 Owner/iPad 验收仍未完成，Goal ACTIVE。

## 分块录制的 MP4 与合成音调核验（2026-11-05 继续）

CB0001 `streaming-mp4/a01` 用既有 `hoops-video-transcode.sh` 对上轮分块 WebM 转码并 collect：H.264/yuv420p + AAC 48kHz 双声道，MP4 时长10.033秒，SHA `315e9dd103890ac79210097e2b8ff2f75d96a4beb971f94aad0a58bad45b4633`，归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/streaming-mp4/a01/outputs/video.mp4`，SSD `continuous-voice-a01/streaming-test-v44-final.mp4`。静音 Chromium 读到时长及 seekable，实际跳到2、5、8秒并返回 readyState 4；ffmpeg 同位置解码帧哈希不同。这不证明所有播放器或 iPad 兼容。

CB0001 `streaming-mp4-tone/a01` 已 collect：合成450/600/750/900 Hz 音调分别约1.6/3.2/5.6/7.4秒开始，100ms窗口分辨率；对应捕获事件字幕约1.623/3.173/5.575/7.373秒。四个音调中段解码帧已目视、字幕分别为四个正确步骤，截图在 SSD `continuous-voice-a01/streaming-mp4-audit/`。这是合成音调的有限同步检查，不是逐字语音、完整动作或实听验收。浏览器关闭、worker 任务归档。正式旁白、视频用户入口、长片及 iPad/Owner 审核仍未完成；Goal ACTIVE。

## 战术录制分块写盘（2026-11-05 继续）

内部 `hoops-video-capture.mjs` 增加可选有序分块接收，原 Blob 返回方式保留；`hoops-video-export.mjs` 逐块写入 SSD，边写计算视频 SHA，不再在浏览器和 Node 中各建立整段 WebM 的 base64 副本。写入错误拒绝完成，导出原有 finally 清理部分文件；单测模拟写入失败和有序等待，未模拟真实磁盘故障或长片压力。音频输入仍整体读入内存，浏览器写入速度跟不上时仍可能排队，因此不能宣称内存上限已证明。

以合成音调、当前牛角稿、静音 Chromium 录制 `continuous-voice-a01/streaming-test-v44-final.webm`：4,317,683 字节，VP9 1280×720 + Opus，ffmpeg 全部解码无错误，报告的 SHA 与实际文件一致，记录到4个字幕开始事件。ffprobe 格式级 duration 缺失；文件完整解码不代表可寻址、已核音画同步或 iPad 可播放。该样片不是正式旁白、未做视觉或听觉验收；浏览器及服务器随任务退出。11项录制相关测试通过。继续完成合规正式配音、同步/导出界面、长片资源与端到端验收，Goal ACTIVE。

## 战术自动演示的阅读时间（2026-11-05 继续）

`v2.9.0-local.44`：Watch 自动播放由固定等待900ms改为根据中英文字长度和动作时长估算阅读时间（短说明仍至少900ms；估算仅为初始节奏，非儿童实测），使长说明不会在约1–2秒后切走。给自动播放每次启动独立编号，暂停后立即继续时旧等待不会重新开始，也不会在手动切到下一步后沿用前一步的等待。完整 `node --test tests/*.test.mjs` 44项通过，含长短文字、暂停/继续和手动切步；未做正常速度实人阅读评估或 iPad 验收。没有播放声音或启动浏览器。正式旁白视频、场景和动作品质仍未完成，Goal ACTIVE。

## 战术练习计分与退出音效（2026-11-05 继续）

`v2.9.0-local.43`：修正 Walk 练习连续答错后跟提示答对，同一道任务被算两次的问题；现在完成每个任务只计一次，首次答对才计 first。另给完成时延迟播放的星星音效加当前 flow 的 token 和球场可见性检查，退出或切换后旧计时器不再触发星星声。静音单测覆盖多次答错后答对、下一题首次答对，以及离开后未执行剩余音效；篮球测试38项通过。未实测 iPad 的触控/声音、没有修复此前所有可能的后台声音来源；正式自动讲解视频仍未完成，Goal ACTIVE。

## 异步退出与背景声（2026-11-05 继续）

`v2.9.0-local.42`：战术页等待球场初始化后核对 flow，退出或进入另一轮后旧操作不能重新打开页面；战术与比赛的观众声音频预载完成后同时核对原 flow 和球场是否可见，防止旧回调在新一轮播放观众声。测试模拟延迟加载后退出、延迟音频后切换，以及仍在页面时正常启动；完整 `node --test tests/*.test.mjs` 39项通过。测试没有实际播放声音，未验证 iPad 后台声音或全部其他声音路径，不能把它当成原因已完全排除。

复查独立讲解片登记：`ep.py new` 要现有频道，现有 basketball 频道属于另一项目；Shorts 模板按中英双语机械频道设计，通用长片模板还有8:10稿长门槛。共享 registry 有他人未提交修改，当前没有登记适合 Hoops IQ 教学短片的独立频道，也未绕过正式中文配方 / 关卡；实际正式配音及视频仍未完成。继续寻找适用于此产品的正式独立接入方式，同时推进其他游戏品质工作，Goal ACTIVE。

## 研究语音的真实对齐试验（2026-11-05 继续）

`tools/voice/audit_research_alignment.py` 在 CB0001 使用现有 `mf_align.py`，对旧版讲稿对应的 research-only 语音运行实际对齐，不生成新语音。任务 `hoops-research-align-a01` 已完成并收档至 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/research-align/a01/outputs/`；对齐报告 PASS、覆盖率0.969，报告及字幕副本在 SSD `research-align-a01/`。audit 记录输入和工具 SHA、标记 research_only 与非交付。PASS 仅是识别文本相似度与对齐结果的技术门槛，不证明读音、逐词时间或音质合格；该语音此前语速和文本检查未通过，不能用作成片。

实测将这份旧稿对齐结果输入当前牛角战术，`alignedCues` 以 `Aligned text differs at step 1` 拒绝，防止旧讲解误配新脚本。尚未以当前正式讲稿和合格真实语音完成对齐，也没有正式讲解视频。下一步独立登记 Hoops IQ 教学片并按适用流程完成讲稿、配音及听审，再验证真实音频与战术同步；Goal ACTIVE。

## 手部皮肤网格与球体试验（2026-11-05 继续）

`scripts/hoops-grip-surface.mjs` 在 Three.js 已蒙皮的 AnatomicalBody 中，按手和手指骨骼总权重≥0.5筛选每侧869个顶点，逐帧测顶点到球球面的有符号距离；阈值0.02英尺。临时浏览器在 right-foot/a01 341–385共45帧对现有 `reachBall` 测量：两侧每帧均有顶点深入球面超过阈值，最深约-0.080英尺（约-2.4cm）；这是顶点数据，不是整片三角面或所有手部皮肤的完整碰撞检测。

仅在临时试验中，球实际半径仍0.45英尺、把手部求解的目标半径改0.53英尺（约多2.4cm间隙），同一45帧两侧所筛顶点均未进入球体、每帧均有顶点在球面±0.02英尺内；`surface-audit.json` / `surface-clearance.json` 与 `clearance-sheet.jpg` 在 SSD `right-foot-a01/`，351/361/381对照帧已目视。该半径补偿是针对这套候选和球心的试验，未验证其他体型、球径、姿态、手指互穿或连续1×动作，**未改游戏运行时**，不能推广或称手球接触完成。下一步用更近镜头和连续动作检查手指/掌面及松指、出手，量三角面和全身碰撞再考虑接入。相关测试通过，浏览器/服务/临时symlink关闭。正式自动讲解仍未完成，Goal ACTIVE。

## 复用游戏手部求解试验（2026-11-05 继续）

临时静音浏览器 `right-foot-a01/grip-test.html` 在独立 CMU 候选上实例化游戏实际 `AthleteKit` / `reachBall`，球心仍是两手骨中点（人工假设），球半径0.45英尺；样帧341、351、361、371、381、385的左右求解目标锚点距球心约0.002–0.007英尺。锚点是为球心计算的虚拟目标，不是皮肤顶点，**不能称为掌面贴球误差**；未启用求解的首帧锚点尚未初始化，不能拿它的首个数值与已求解结果做公平比较。

`grip-audit.html` 用同一玩法在341–385每帧检查10根指骨末端中心相对球面距离，450个采样约+0.030～+0.113英尺（约0.9～3.4cm），但指骨末端不是皮肤表面，不能从此断定穿模或实际手指接触。`grip-sheet.jpg` 351、361、381帧对比已目视：约束后手趋向球，但高举时手指交叉/遮脸仍有风险，截图偏远，未做连续1×观察和球面网格接触。`grip-report.json`、`finger-audit.json` 在 SSD `right-foot-a01/`。候选仍未入游戏；下一步测真正掌面及手指网格对球球面、合理球心与自然松指/出手、再连入筐并正常速度审查。浏览器服务与临时symlink已退出。正式旁白视频仍未完成，Goal ACTIVE。

## 实验出手速度连续（2026-11-05 继续）

`scripts/hoops-shot-trajectory.mjs` 添加 Hermite 实验球路：以每秒速度给出起点和终点切线，额外弧高项在两端斜率为0，测试以数值微分核对离手与到筐速度、端点及非法输入。临时预览 `right-foot-a01/ball-rim-velocity.html` 从第384→385帧手骨中点估算速度、在385帧出手，再用该速度和人工设定的篮圈到达速度生成球路。静音 `ball-velocity-sheet.jpg` 六帧已目视，轨迹能到示意篮圈；出手切线连续仅是数学条件，不代表加速度、飞行物理或入网真实。

预览仍以双手骨中点当球心、画面有球遮脸，手指及掌面未约束；出手帧、篮圈和末速度均是假设，源动作没有球轨数据。不能称已实现可靠持球或把候选接入游戏。下一步需量掌面/球接触和不同时刻手与球的相对速度，处理入网及正常速度画面审查。静音浏览器及服务器已结束；正式讲解视频和 iPad/Owner 验收未完成，Goal ACTIVE。

## 实验球路瞄准篮圈（2026-11-05 继续）

`scripts/hoops-shot-trajectory.mjs` 提供隔离预览用的三维抛物线路径，显式给定起点、篮圈、时长和弧高；端点/参数测试通过。临时 `right-foot-a01/ball-rim-test.html` 使用手骨中点与**人工选定**的第385帧出手、0.9秒飞向示意篮圈；源动捕并无球、篮圈或出手标签。静音六帧 `right-foot-a01/ball-rim-sheet.jpg` 已目视：球从手附近移动到示意篮圈，不再像上一版停肩旁；但手未按球面约束，球在部分帧遮脸，简易圆环无篮板/篮网、没有入网物理，飞行初速与手速不匹配，**不代表真实接触或合格投篮，不能接入游戏**。继续以真实手掌/球面校准、确保离手位置与速度连续、球筐接触和1×观察。浏览器/服务关闭；正式旁白视频及 iPad/Owner 验收均未完成，Goal ACTIVE。

## 投篮手部与实验球轨迹（2026-11-05 继续）

`tools/blender/audit_cmu_hands.py` 在 CB0001 对 right-foot/a01 的301–461帧逐帧采样 AnatomicalBody 左右手权重>.85的64+64个顶点；`hands/a01` 已 collect，JSON SHA `14c50e7d5c6498ac6b6a9972fdee533042a7bc3687a134aad6c11672822b09b3`，archive `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/hands/a01/outputs/hands.json`。双手顶点中心距离帧351约28.5cm、371约34.1cm、401约38.6cm、421约52.7cm；游戏当前球直径0.9英尺（约27.4cm，非赛事标准大小结论）。权重顶点中心不是掌心接触面、源动作没有球/出手标注，距离不能证明握球成功。

临时预览 `right-foot-a01/ball-test.html` 仅用于实验：帧330–370放一个球于手骨中点、370后用臆设抛物线，无真实源球、篮筐或手球约束。静音六帧 `right-foot-a01/ball-test-sheet.jpg` 已目视：帧401球仍靠近肩部、与手和出手方向不协调，**该轨迹拒绝，不入游戏**。不能把实验球当动捕数据或成片；接下来需以手掌表面/投篮方向、明确出手时序、篮筐和运动连续性设计球轨迹，并在1×观察。浏览器、服务器与临时symlink已关。正式自动讲解视频仍未完成，Goal ACTIVE。

## 右膝逐帧及无声对照素材（2026-11-05 继续）

CB0001 `right-knee/a01` 对比 landing-ik/a03 与 right-foot/a01 的431–521帧右腿，输出 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/right-knee/a01/outputs/reach.json` SHA `02ce72929d534c75b8539c3dea429ad729acee35101b55e5320a71e4a1da2849`。髋—膝—踝夹角基线约126.11–152.42度，最大帧间1.59度；候选约126.10–152.42度，最大帧间1.48度；最大膝位置帧间速度两版均约266cm/s（该时间段含落地，不是品质阈值）。这些数值仅覆盖窗口，不足以证明自然、无穿模或脚滑合格。审计脚本支持明确指定基线、候选和左右腿，输入路径均绑定 worker manifest。

已生成无声正常速度左右对照 `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261105/right-foot-comparison/comparison.webm`，动画时长6.575秒、录制约6.619秒；Chromium 能播放到3.9秒、单帧 `playback.png` 已目视。只有静帧检查、**未完成持续正常速度观影和 Owner 验收**，画面没有球；两侧相机各自按模型包围盒归一化，不能用图像中的绝对坐标做精确位移比较。第一次 Playwright 视频录制因缺依赖未启动，改用无声画布录制；一次页面语法错误已修且无遗留任务。浏览器、服务与临时 symlink 关闭。继续解决手球、接触与正常速度观察，正式自动旁白视频仍未完成。Goal ACTIVE。

## 右脚落地轨迹试验（2026-11-05 继续）

`tools/blender/try_cmu_right_foot.py` 在独立候选上对右腿做手选441–511帧的渐入/渐出 IK，以源右脚骨位移经原有坐标及身高比例换算，驱动目标固定鞋顶点的水平轨迹；保留足部朝向。源脚骨不是鞋底接触标记，不能把它当真实锁脚或足底轨迹。CB0001 `right-foot/a01` 候选 SHA `215acc24051ba6c0fe8597120472274b7a1dc2741ca4c1358a9a033a2b559f7e`，`right-foot-audit/a01` 独立逐帧采样 SHA `f6375c9fc56482f9968c202fc62c90c35f0893fe9380e93de6debc342c9f826c`，均已 collect 到对应 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/`。

帧451–501右鞋同一顶点水平位移由6.42cm变3.03cm；该区间源脚骨按身高比例换算约3.04cm，但两者不是同一解剖点。右鞋最低高度范围约 -0.034～+0.030cm，左鞋约0～0.006cm（逐帧权重顶点，不代表完整鞋面或全部时间）。其他已采样起跳窗口与左脚位移接近原版。静音六帧 `right-foot-a01/sheet.jpg` 已目视，无法证明膝盖连续自然、动画过渡、全身形变、带球或1×观感；候选不入游戏。继续核右膝及窗口边界速度、加球和正常速度对照，素材公开分发边界仍未解决。浏览器和服务已关闭，任务完成；正式旁白与 iPad/Owner 验收仍未完成。Goal ACTIVE。

## 战术开场画幅变更（2026-11-05 继续）

`v2.9.0-local.41`：继续查 local.40 横屏开场左侧底角被裁；进入战术时从完整宽度切到侧栏布局，ResizeObserver 重新算 goal，但原来镜头位置从旧尺寸慢慢移动。`court3d.js _resize` 仅在尺寸变化且 arena broadcast/decide 时立即采用新取景；其他镜头保留原过渡。静音浏览器 1024×768、768×1024 分别检查尺寸更新后镜头已到新目标、五名球员投影在球场容器内，并目视 `narration-prep/camera-v41-{1024,768}.png`；30项篮球 Node 测试通过。不是 iPad 真机验收，截图也只检查该战术开场。浏览器和服务已关闭。

复核 [CMU 官方条款](https://mocap.cs.cmu.edu/)：允许数据包含在商业销售产品中，禁止直接转售原始或转换后数据；其文字没有明确讨论静态 PWA 离线缓存、公开仓库或可直接提取的 GLB。不能把第三方对重分发的概括当成 CMU 明示授权；保持原素材库 `redistribution=false`，未解决前不公开动作资产。自动讲解成片和真实旁白仍未完成，Goal ACTIVE。

## 录制字幕文件（2026-11-05 继续）

新增 `scripts/hoops-observed-subtitles.mjs`：依据录制过程中 `caption-start` / `caption-clear` 实际事件生成 SRT 字幕草稿，校验事件顺序、视频 SHA 和录制文字与当前战术完全一致，拒绝缺失/过期数据或覆盖文件。导出报告现保存浏览器实际录制使用的文字并与清单比较。事件时间基于浏览器时钟，仍要与最终编码视频逐项对照，不能单凭它判同步；旧报告缺少文字快照会拒绝。

用完整3D和合成测试音调重新生成 `continuous-voice-a01/subtitle-test-v40-b.webm` 及对应 `.srt`，静音成功；SRT文本和时点已检查，自动测试覆盖缺失、倒序及过期文本，9项相关测试通过。该文件不是正式语音，也尚未对编码后的字幕/语音逐项复验。浏览器和临时服务已关闭；正式语音、独立登记、iPad 与 Owner 验收仍未完成。Goal ACTIVE。

## 战术面板按钮可读性（2026-11-05 继续）

`v2.9.0-local.40`：修复上一版中文「自动播放」按钮在横屏面板内换成两行，三个按钮等宽、文字不换行，保留至少44px高度。静音 Chromium 1024×768、768×1024 中文截图 `narration-prep/controls-v40-{1024,768}.png` 已目视，三按钮均未溢出；1024英文 Back / Next step / Play all 也检查无溢出，28项篮球 Node 测试通过。实际 iPad 触控/排版尚未验证。测试浏览器和服务关闭。

正式旁白仍未生成：media-factory 的 basketball channel 实际是另一个无旁白项目，共享 registry 有其他任务修改；不得冒用该项目或覆盖他人更改。下步为 Hoops IQ 教学片建立真实独立登记、完成配音及读音/听审，再将实录音对齐动作。Goal ACTIVE。

## 牛角讲解稿改写（2026-11-05 继续）

`v2.9.0-local.39`：改写牛角外弹中文四步，解释站位空间、站稳掩护、外弹和出现空位才回传；末步是无防守演示的条件性教学，不表示演示中实际检测了防守。讲解与游戏文字仍同源，动作数据未改。重新生成 `narration-prep/horns-pop-zh-v3.txt` 和对应 SHA 清单，短稿检查句均27.5、标准差7.4，机检通过但标记「角、分、冲、空、传」5处读音风险；tts_traps 无输出，实际读音、音色和听审未验证。不能把机检通过写成正式配音已就绪。

最终中文页面 `narration-prep/horns-v39-zh-final.png` 已静音浏览器截图并目视，四步文字、按钮可见；未测 iPad。首次浏览器等待初始化失败、第二次因将 aria-label 当可见按钮名而超时；改用 `#btn-language` 后成功，测试会话与服务均已退出。改写前完整31项Node测试通过，最终措辞修改后28项篮球测试通过。实际自动配音、对齐、视频和 Owner 视听验收仍未完成；Goal ACTIVE。

## 牛角讲解稿准备（2026-11-05 继续）

新增 `scripts/hoops-narration-draft.mjs` 从当前战术生成同一段中文讲解稿和逐步动作预算，附文本与 playbook SHA、DRAFT_UNREVIEWED 状态，不创建配音任务。SSD 草稿 `narration-prep/horns-pop-zh-v1.txt` 和 `.json`；脚本为四个相邻文本行、无空行，按七声服务的写稿规则用于一段而不是自动逐句生成。4步动作时长分别700、1700、900、1450ms，不是音频时点。10项相关测试通过。

既有 `ai_tell_lint.py` 对此短稿报句长标准差2.7、句均21字，均不达通用解说稿阈值；标记「角」「传」「空」等4处多音字风险。`tts_traps.py` 没有输出；不能据此宣称听觉/读音合格。需在不丢失战术步骤、教练可理解性和战术准确性下改写并重新核验；旧版不发起正式配音。现有 media-factory `basketball` channel 是另一项无旁白街球短片，不能借用其 episode 身份；共享 `studio/registry.json` 有其他会话未提交修改，不擅自覆盖。Hoops IQ 教学片需真实独立登记并经过适用配音门槛，不可伪造已存在的集或以 research 结果冒充成片。目标仍 ACTIVE。

## 旁白对齐到战术步骤（2026-11-05 继续）

`scripts/hoops-aligned-cues.mjs` 和 `hoops-alignment-manifest.mjs` 把现有 `mf_align.py` 的字幕 token/对齐报告转成整段录音的战术步骤清单：文字必须按原战术逐字归一后吻合、步骤边界不能落在 token 中、时间必须递增不重叠、报告与 token 覆盖/置信至少0.95、相邻步骤须容纳动作；任何失败拒绝而非猜时间。CLI 绑定音频 SHA，导出器在录制前复核音频 SHA。**这只绑定操作者提供的文件，不证明对齐结果真由此音频生成，也不证明说对了；真实来源、识别及读音/听觉 QC 仍须独立验证。** 对不满足条件的真实语音须回到对齐/编排处理，不得剪自然呼吸或变速。

用此前8秒合成音调和人为构造的假对齐文件作端到端技术测试，自动生成清单并录制 `continuous-voice-a01/video-aligned-fixture.webm`；实际浏览器频谱检查四种测试音调相对字幕事件分别约 +80/+64/+66/+84ms。**这是合成测试数据，不是实际语音识别、自动配音或合格样片。** 错误音频 SHA 拒绝；30项 Node 测试通过。调查偶发3D降级得到一次明确错误：动态模块加载 `ERR_CONNECTION_RESET`，本地临时 Python 服务的 accept 队列从默认加到128，下一次3D导出成功；尚未反复验证全部加载故障。浏览器与临时服务关闭。接下来按正式配音流程完成真实音轨和可溯源的对齐并听审，完成用户界面和 iPad/Owner 验收；Goal ACTIVE。

## a03 落地区间逐帧核对（2026-11-05 继续）

CB0001 `landing-full/a01` 将 `audit_cmu_fixed_foot.py` 和 `audit_landing_reach.py` 指向 a03，在起跳/落地局部逐帧采样；两个输出归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/landing-full/a01/outputs/`，`fixed-foot.json` SHA `a7859487f3c75629f998f4b42433a132163b7bf0a118cdd16329c1cb74fc1949`、`reach.json` SHA `efb94cf271b1a35b892cafdb455b51ad8e0c4ee590ab6dd255f2d74a5e426106`。左脚落地451–501共51帧，筛选顶点最低高度四舍五入约0cm；右鞋最低约 -0.034～+0.031cm。右鞋同一个顶点在该区间横向移动6.42cm，与基线一致：本次 IK 没解决脚滑；源脚骨经身高比例换算约3.04cm，但不是同一解剖点，也不是足底接触标记。左脚固定点水平位移1.64cm，与基线相同。

以髋—膝—踝算的左膝夹角在431–521帧约137.7–166.6度，最大相邻帧变化1.60度（120fps）；基线约124.8–154.2度、最大2.33度。这只排除该数值采样里的明显跳变，不证明膝盖形变、脚底全表面、接触窗口、视觉自然或全片连续性。尚未带球或正常速度观察，候选仍不得入游戏。两份审计器支持环境变量指定被复核的模型；记录与输入 SHA 均绑定 worker manifest。任务已结束，无测试声音；自动讲解及 Owner/iPad 验收仍未完成。Goal ACTIVE。

## 左脚朝向与落地修正 a03（2026-11-05 继续）

CB0001 `landing-reach/a01` 对比 a08 与 landing-ik/a02，`tools/blender/audit_landing_reach.py` 输出 SHA `b56f8ee1fcae310c76d636ecd29af564b7daa9e6b3f9d5d430befc74221e3da0`；帧461左腿长度约95.14cm，达到将踝降低4.42cm的位置仍有约5.93cm余量。a02 的踝确实降低4.42cm，但脚部方向随小腿旋转约6.69度，鞋底只降低约2.48cm。诊断是针对该手选帧窗口与该骨架，不证明全部动作或地面接触。

`try_cmu_landing_ik.py` 更新：在试验窗口内将脚骨朝向保持为原始的 armature-space 旋转，再烘焙。CB0001 `landing-ik/a03` candidate SHA `742e6b075185224cf47de0d282136342267c1e17fe637f2041c0e124e519fa17`，archive `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/landing-ik/a03/outputs/`；独立 `landing-audit/a03` SHA `1ce790d14d6fd257f94abbc5fec11d9c536a32ae1de880af9183d9eab18bcb93`。每5帧抽查451、461、471、481、491、501左鞋最低约0cm，右鞋也约0；帧421起跳仍在、441与511及其他少数窗口外鞋高与基线相同。这不能证明未抽样帧、骨骼其余部分、膝部、自然过渡或脚滑正确。静音浏览器六帧 `landing-ik-a03/sheet.jpg` 已目视，但人物不够大且无球和正常速度，不能作动作审美或触球验收。候选仍隔离、不进游戏；须继续逐帧接触/膝关节、真实跑动与落地、带球与1×对照。测试服务及浏览器已关闭，GPU任务完成；正式语音视频和 iPad/Owner 验收未完成。Goal ACTIVE。

## 左腿独立落地 IK 试验（2026-11-05 继续）

`tools/blender/try_cmu_landing_ik.py` 从 a08 生成独立试验：仅在手选帧441–511对左腿施加垂直 IK、451–501全权重并渐入渐出，保留水平踝轨迹；不是自动接触检测，也没有水平脚锁或球。a01 因 glTF 导入后才设120fps，帧158后冻结，已否决，`landing-audit/a01` 是失败证据。a02 在导入前设120fps，6.575秒候选 SHA `f18221b40c839476902a1cde89bb254b03032105b7fce7f9ac0146cbb36d2546`，CB0001 archive `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/landing-ik/a02/outputs/`；不可把导出成功视为动作合格。

独立 `landing-audit/a02` 逐5帧鞋面：帧461左鞋最低从4.42cm降至1.94cm、右鞋近地未变；帧451左4.02→1.97cm、481左3.16→1.44cm、501左2.02→1.91cm，仍悬空。窗口外若干样点（101、351、421、601、781）鞋面高度相同，421有完整起跳；这不是全骨骼逐帧等价证明。静音六姿态 `landing-ik-a02/sheet.jpg` 已目视，但无球、无正常速度和腿部近景，尚无法确认形变/滑步和审美。该候选不入游戏；下一步分析 IK 不到地原因与膝关节，并用真正源接触时序和运动连续性验证，避免凭静态鞋高过关。`audit_cmu_shoes.py` 接受 `HOOPS_AUDIT_MODEL` 供绑定路径的独立复测。任务已结束、浏览器/服务已关闭；正式旁白/视频和 Owner/iPad 验收均未完成。Goal ACTIVE。

## 固定鞋底顶点与落地比较（2026-11-05 继续）

新 `tools/blender/audit_cmu_fixed_foot.py` 在 CB0001 逐帧追踪起跳/落地附近选中的同一个鞋顶点，与源脚骨做对照，`fixed-foot/a01` 已 collect；JSON SHA `c44b028301602451ba817fc8b8367514b00307d7fc2c93e9bc0a09436eac2e8b`，archive `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/fixed-foot/a01/outputs/fixed-foot.json`。右脚落地后451→501帧，目标固定点水平移动6.42cm；源脚骨位移经当前 root_scale 3.7108 换算为目标比例约3.04cm。左脚351→376：2.61cm vs 2.67cm；右脚361→381：5.56cm vs 3.27cm。注意源脚骨与目标鞋顶点并非同一解剖点，源也没有真实接触标记，窗口仅供研究、不能把差异当确定滑移量。上次口头未先应用比例、把右脚源位移误报0.82cm，已向 Owner 更正。逐帧检查这些窗口右鞋最低约 -0.06cm；左脚落地后最低约2cm以上，显示整个人抬高引起悬空仍在。

带网格地面的静音六帧 `retarget-a08/ground-sheet-b.jpg` 已目视：可观察起跳和落地姿态，但无球、无接触阴影，静帧无法判断连续动作与真实鞋底接触，未在游戏使用。对比脚滑应设计与源动作相应的可观察接触时段，避免锁住真实跑步/起跳；持球需另定球轨与手约束。该 GPU attempt 已完成、没有后台任务，测试浏览器与服务清理。正式旁白视频仍未完成，Goal ACTIVE。

## CMU 鞋底修正独立复测（2026-11-05 继续）

原占用 GPU 的 PID 663580/663851 已结束，预检通过后在 CB0001 启动并 collect `cmu-shoes/a02`，独立复测 a08 逐5帧鞋权重顶点最低高度，JSON SHA `ba748841fb2e7fd46862387e24ab898140f64e00f3aaa78126feeff738fd7827`；归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-shoes/a02/outputs/shoe-contact.json`。a07 的右鞋158个样点最低 -0.11309 英尺（约 -3.45cm），39点低于 -0.01 英尺；a08 最低 -0.00198 英尺（约 -0.60mm），0点低于 -0.01 英尺。左鞋最低从 -0.03044 英尺改善到 -0.00031 英尺。第461帧右鞋近地，但左鞋被整体上移约0.145英尺（4.4cm）；这是整个人抬高而非独立落脚求解，不能把该改动当脚锁或自然动作。采样每5帧不能排除插值帧穿地，鞋子按足骨权重筛选也不是精确鞋底材质边界。

静音浏览器看 a08 六个姿态 `retarget-a08/pose-sheet.jpg`，能辨认跳投，但预览模型太小、没有地面和篮球；未能检查手球接触或连续1×动作，不能做审美验收，也没接入游戏。落脚近地的顶点质心会随接触区域变化，水平位移不能直接当脚滑结论；下一步以明确脚底点与源动作接触时段比较，并在带地面和球的正常速度画面审查。此次测试浏览器、8197 服务与临时 symlink 已关闭。正式旁白视频、产品导出和 iPad/Owner 评审未完成，Goal ACTIVE。

## MP4 转码与播放检查（2026-11-05 继续）

`scripts/hoops-video-transcode.sh` 是注册 `media.ffmpeg` worker 用的转码脚本，读取 manifest SHA 绑定的 WebM，输出 H.264/yuv420p、48kHz 双声道 AAC、faststart MP4 和 ffprobe 信息。CB0001 两个 CPU attempt `continuous-mp4/a01`、`a02` 完成并 collect；a02 用此脚本且输出与先前命令输出逐字节一致，MP4 SHA `2d4649f8c619f58375de69ab6eb52066365f962ee8378646518853323ecd36db`，归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/continuous-mp4/a02/outputs/video.mp4`。SSD 测试副本 `continuous-voice-a01/test.mp4`。这是合成音调技术测试，不是正式影片。

ffprobe：1280×720 H.264 + 48kHz stereo AAC，10.1秒。静音 Chromium 同源播放分析4种音调，其起点相对对应字幕事件约 +0.06～0.08秒；本地文件在3→0→2→1的非顺序跳转均到达预期时间、4帧 `mp4-file-seek-sheet.jpg` 目视字幕和动作正确。用 Python 简易 HTTP server 的定位测试时间均返回0，其不支持 Range，不能据此认定文件定位坏；先注册 seeked 后再注册视频帧回调也超时，属于测试方法失败。未在 iPad 或发布渠道验证，未生成正式语音和讲解成片。浏览器与本次 HTTP 服务已关闭。CB0001 其他GPU任务仍运行（PID 663580/663851），鞋底复测继续等待。Goal ACTIVE。

## 单段连续旁白与战术时点（2026-11-05 继续）

`capturePlaybook` 与 `hoops-video-export.mjs` 新增整段音频模式：一个音频文件只播一次，清单给每步的毫秒时点，期间不裁剪、变速或插入语音；动作与字幕随时点触发。时点不递增、越过音轨、动作预估装不下会拒绝；实际播放跑过下一个时点超过 250ms 也会失败，不输出成片。`tests/hoops-video-capture.test.mjs` 覆盖时点与动作不能容纳的边界，错误清单在启动浏览器前即拒绝。

SSD `continuous-voice-a01/` 是**合成音调**的8秒单音轨测试，不是实际人声：真实浏览器播出的4个频率起点相对录制字幕事件偏差约 +60～80ms；顺序实时播放时抓的 `live-contact-sheet.jpg` 已目视4帧各自文字和动作。先 seek 再立即截图的 `contact-sheet.jpg` 没显示期望的帧，不能用于验证；WebM 的随机定位仍待独立检查。当前没有语音自动生成、真实语音的时点提取/准确性或 Owner 听审，音频清单文字只是声明而非音频内容鉴定。实际录制需对应音轨的准确 cues、并校准自然语速下动作空间；短时间不够会拒绝，不能擅自剪掉呼吸或变速。

两次错误清单浏览器尝试分别遇到3D降级、页面初始化超时；现已把明显的步间时点冲突前移到启动浏览器之前检查，但间歇加载原因未解决。测试浏览器与临时服务已结束。目标 ACTIVE；CB0001 其他项目正在运行，鞋底复测等待释放。

## 战术视频真实播放同步修复（2026-11-05 继续）

发现上一轮视频虽可播放但音画不同步：对 `test-observed-b.webm` 用同源 HTTP 视频元素经 Web Audio 分析四种测试频率，后3段分别提前约0.52、2.18、2.99秒，播放器把无声间隔压缩；不可沿用旧测试成品。`capturePlaybook` 加持续连接、零增益的常量源，让音轨在无声间隔持续计时，并记录真实录制事件；导出器同时输出带清单、音频、视频 SHA 和事件记录的 `.webm.json`。记录是浏览器事件，不等于已验证的成品时间戳；清单文字匹配也不能证明音频念的内容。

新 `export-prototype-a01/test-clocked.webm` 在实际 Chromium 播放分析中，四段音调起点相对记录的偏差约 +0.06～0.08秒，四帧 `clocked-contact-sheet.jpg` 对照字幕正确；`scripts/hoops-video-capture-smoke.mjs` 加真实播放频谱回归，`capture-clocked-regression-a01/report.json` 四段通过，6项视频单测通过。一次录制因页面初始化60秒超时失败且清理输出，另一次成功；需继续查间歇性加载问题。所有测试静音，自己的浏览器/服务已退出。此结果仅验证测试音调，不代表正式旁白、所有设备、iPad/MP4或美术听觉验收。

目前正式配音入口要求真实 episode/longform，而录制原型需要逐步音频；需解决一场一次生成、连续自然呼吸与每步画面同步的兼容，不得伪造 episode 或剪掉呼吸。CB0001 其他任务仍在运行，未启动的鞋底复测继续等待。Goal ACTIVE。

## 战术视频音频接入原型（2026-11-05 继续）

新增 `scripts/hoops-video-export.mjs`：读入战术 ID、语言与逐步音频清单，逐条核对文字必须和当前战术完全一致，使用独立的本地临时服务器和静音 Chromium 调用实际 3D 录制器，导出 WebM，禁止覆盖已有文件。音频需另经正式配音及审听流程；脚本不生成或认证旁白，也不是面向用户的游戏按钮。测试清单和四个合成音调（不是正式人声）在 SSD `export-prototype-a01/`，导出 `test.webm` 为 1280×720，浏览器播放至5秒无解码错误，`playback.png` 已目视；错误文字和重复输出均拒绝，6项视频单测通过。浏览器与本次服务器正常退出。尚未独立核整片音画同步、音频审听、真实旁白、MP4/iPad 或 Owner 审美。该工具为内部原型，依赖 Node 22、Playwright 和 Chromium；`PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` 可指定环境。

正式中文配音全局配方 `studio/core/VO_RECIPE.json` 要求 episode 和 longform，先前 research 输出未通过且不可用于成片；不要伪造 episode 或绕过重试限制。CB0001 的其他项目 PID 663580 / 663851 仍运行，等其释放后复测 cmu-shoes/a02。Goal 仍 ACTIVE。

## 战术开场取景修正（2026-11-05 继续）

`v2.9.0-local.38`：上一轮牛角开场截图缺底角球员，复测镜头稳定后五人均在画面。原因是 `court3d.js setScene` 把 arena 镜头定位到完整阵型后，又把观察目标重置成旧展示位；现在仅 classic 模式保留旧入场移动，arena 从完整广播取景开始。静音浏览器加载后核对五名球员坐标在球场容器内，并目视 `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261105/horns-v38-start.png`；稳定后对照 `horns-v37-settled.png`。27项 Node 测试通过。浏览器用 `--mute-audio`，本次 session 与 8198 服务已退出。这个桌面检查不代表 iPad 或视觉品质验收。

CB0001 其他项目 PID 663580 / 663851 仍存活，继续等它释放再提交未启动的 `cmu-shoes/a02`。目标仍 ACTIVE，正式旁白视频、动作、游戏与审美验收均未完成。

## 鞋面探测与牛角战术时序（2026-11-05 继续）

Goal 仍 ACTIVE。`cmu-shoes/a01` 对 a07 的鞋子权重顶点逐5帧采样，发现穿地：第461帧右鞋最低约 -0.109 英尺；脚滑也未解决。CB0001 的 `cmu-retarget/a08` 生成候选 SHA `7632d2b3b9a2fdbbe28e73521923d71188859132a0f8ba958d63df2383b583de`，按包含鞋子的整个网格最低点上移骨盆，395 帧中143帧有修正，最大约0.114英尺；这不是鞋子专属约束，也不是脚锁。`tools/blender/audit_cmu_shoes.py` 已准备针对 a08 独立复测，manifest `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261105/cmu-shoes-a02.json`；此前提交因其他项目持有 GPU 锁而被拒，任务没有启动。等锁释放后用 `workers.py run` 提交 `hoops-cmu-shoes-a02` 并 collect、对比 a01；不得干扰其他项目。尚未确认修正是否生效，仍需正常速度视觉、脚滑及手球接触验证，不入游戏。

牛角外弹首步现在先静止展示阵型，第二步五号上提前往掩护，再由一号借掩护；同步调整视频时间线测试。版本 local.37，两处一致。27项 Node 测试及静音3D录制通过；浏览器核实前两步五号位置与顺序，截图 `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261105/horns-v37-start.png`。截图中有一名底角球员疑似不在画面内，需在镜头稳定后复核；等待 cameraSettled 的测试未产出结果，不当作通过。测试浏览器及自己的服务已退出。正式自动旁白、成片导出和 iPad/Owner 验收均未完成。

## CMU 投篮位移修正与视频音轨同步测试（2026-11-05）

Goal 仍 ACTIVE、未达成。CB0001 的 a05/a06 依据骨骼方向迁移，a06 发现原始跳投起跳时目标反向掉到地下：`cmu-geometry/a01` 逐5帧比较原始/目标足部高度，源361→421两脚约0.08→0.42米，目标约-0.6→-3.2英尺，明显错误。病根为向 PoseBone.location（骨骼局部轴）直接写入 armature 轴位移。`tools/blender/retarget_cmu_candidate.py` a07 改在 armature space 给 pelvis.matrix 赋平移，让 Blender 经父骨/静态骨骼矩阵转换到局部坐标再 keyframe。CB0001 Blender `cmu-retarget/a07` candidate SHA `153c18273d822796fb172d707f7d0440c8f099533e8fde7e1d4c6aa439746044`；`cmu-geometry/a02` 证据目标两足361→421约0.39/0.46→1.71/1.68英尺，461回0.43/0.39，方向与比例接近原始；这是骨骼位置而非鞋底接触或视觉通过。正面关键帧 SSD `retarget-a07/wide/` 已目视，真实手球、地面鞋底接触、脚滑、全速动作、实际游戏集成/iPad 和 Owner 均未验证；未入游戏。a05/a06/a07 仅试验。接下来做鞋底准确锚点、原动作接触时序和球轨迹，并用修正源码/目标同时段比较，不要把位置数值通过当自然动作。

视频同步：Chromium 使用 `--mute-audio` 且 WebAudio 只连 MediaStreamDestination，四段不同频率合成测试信号进入真实3D游戏录制，SSD `capture-sync-tones-a02/capture-test.webm` SHA `8adc5b9e6e34b431c63fb6f64c3314521f71516ab08cbff26280ad0a39a44c08`。CB0001 `capture-tone/a03` 用 ffmpeg aresample=async 保留原时间戳，四段音频对应时刻分别1.55/2.75/4.3/5.7秒；提取四帧均目视对应步骤字幕。此前 audit a01 直接解码 PCM 错将 WebM 稀疏音轨时间戳拼接，假报重叠；失败保留，a02/a03 修正。发现第三步三行字幕下沿裁切，`captionBaselines` 已修、回归与最终第3帧目视通过。所有测试只输出合成信号文件，宿主静音且无旁白审美/听审；还没有正式旁白、用户导出入口、MP4/iPad或成片。完整27项Node测试通过。正式语音接入和游戏性/视觉提升仍须继续。

## CMU 转移动作 a04 被否（2026-11-05 继续）

Owner 明确持续追求最好的球馆、人物动作、游戏性及自动讲解视频，不要中间停。接 a03，用目标现有 `Shot` 初始姿态对齐源首帧，CB0001 Blender 生成 a04，归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a04/outputs/`，SHA `a5263dd629364d25cf3736e101dd65cb527e12b2698747d3719e6e1da74e950e`。静音浏览器逐姿态图 SSD `retarget-a04/pose-*.png` 已目视；`pose-1` 双臂明显扭曲，仍无根位移、脚锁、手球约束，候选拒绝、不入游戏。a02/a03/a04 均未通过；不可从导出成功推品质。下一步核世界空间骨骼局部坐标、姿态对应与关节方向，使用清晰的源/目标骨骼语义和标准化姿势而非粗略四元数相减；逐帧核与球、地的接触再实机看。注意静音，测试完退出。

## CMU 首次人物动作转移与视频画幅（2026-11-05 继续）

Owner 重申“做出一个最好的效果来，中间不要停”，当前目标未达成、仍需继续；不靠测试替代 Owner 对视觉、听觉和游戏性的验收。CB0001 Blender 尝试将 CMU 124_05 修正跳投转给现有球员骨架（脚本 `tools/blender/retarget_cmu_candidate.py`）。a01 混出源动作；a02 删除其他 action，输出仅1动作/13网格，SHA `58ade08ea89f80397be3ba30a4c86a0396fd749ba196b22ef71b4df9c4de5b43`，但静音浏览器样帧显示双腿交叉、手臂不自然，拒收。a03 把源首帧对应目标静止姿态，输出 SHA `f706575b6d230a217ef4909118041964821722c500f171be43a8cdccca5ef4c2`，首帧不扭曲，投篮姿态更接近，但开始姿态和原动作对齐不正确、无根位移、脚锁或球接触，不是可用游戏动作。检查帧 SSD `retarget-a02/pose-*.png` 和 `retarget-a03/pose-*.png`；原始 GLB 裸预览没有运行时材质、不能用作人物质感判断。两版 archive `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/{a02,a03}/outputs/`；未接入游戏。下一步基于真实来源静止姿态与目标骨骼语义重定向，保留根位移并求解脚地/手球接触，连续1x看动作再定。

录制器 `scripts/hoops-video-capture.mjs` 新增按比例适配画布、避免画面拉伸，单测覆盖横竖比例；静音浏览器试录解码检查 `capture-silent-aspect-a04` 通过且已看截图。原型只用合成静音，正式旁白、剪辑、产品导出入口、声画同步和真机验证仍未做。当前完整26项 Node 测试通过；本轮测试浏览器和自己起的8197服务已关闭，别的会话不动。

## 修正版骨架动作采样（2026-11-05，继续）

`cmu-inspect/a03` 在 CB0001 Blender 完成并 collect：修正版跳投789帧中每5帧采样159次，上篮694帧采样140次，各31骨/120fps，JSON SHA `c3adeba80881ba6f5d73cbd77f83c9cdc7cefb87da2bb68d199945c6484aca8d`；归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-inspect/a03/outputs/`。CB0001 CPU 合成两个**无声音**正侧骨架连续检查视频（每5帧以24fps播放，近似原120fps），归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-video/a01/outputs/`，SSD 代理 `cmu-jump-skeleton-a02.mp4` / `cmu-layup-skeleton-a02.mp4`。编解码和时长已核，尚未连续1x目视、未与原始动作/球对照、未 retarget，不能称品质/运动准确性通过。代码 `scripts/hoops-cmu-pose-video.py`。不要把前文 a03 排队中的历史当当前状态；a03 已 collect，任务无后台作业。

下一步按 Owner 目标继续：正常速度核修正版运动及原始数据方向、落脚/持球与裁切阶段，做游戏骨架重定向小样；同时接入正式旁白及可靠的导出工作流。测试静音并结束即关闭。

## CMU 转换器修正（2026-11-05，继续）

核实 amc2bvh 源码的 `sample_rotation` 确实存在未初始化通道：它对非三轴关节将未定义内存带进四元数。已在隔离源码把初始角度归零、默认轴置 XYZ（补丁 `tools/mocap/amc2bvh-init.patch`；上游 f89c731，MIT），CB0001 CPU 注册路径重转并归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs/`。跳投 SHA `d6d5f0d0a02e6b007baaee7c158014717f2da950227fbfb510e0e277d0dcde19`；上篮 SHA `5707c9baa2a8104987ed24d04ba6f9863b3a54a9aa298372312b2089b9cae6d1`。与 a01 比每帧两处旋转发生变化（跳投 1578、上篮 1388 项；最大差约23度），旧 a01 转换/目视不能当可信结果；a02 仍需独立正确性验证。

修正版 Blender 全过程每5帧检查任务 `hoops-cmu-inspect-a03` 已受控派 CB0001，PID 630022，原生 GPU 锁排队；已登记 jobs，不要重复发或中断其他工作。看 `/srv/ai-data/media-work/tools/mf/logs/hoops-cmu-inspect-a03_20261105T173129Z.txt` 及原 job/同一 PID，完成后 collect `--worker CB0001 --project CAESAR_HOOPS_TACTICS --task cmu-inspect --attempt a03`；UNKNOWN 不换机重发。完成后验证骨骼动作、接触、retarget 与原始输入语义，不能凭有限值或截图称通过。实验始终静音，尚无正式解说视频或产品导出入口。

## CMU Blender 导入与静音导出进度（2026-11-05）

CMU 两段 BVH 已通过 CB0001 注册路径导入 Blender 5.2.2：跳投 1–789 帧、上篮 1–694 帧、各31根骨骼/120fps；采样坐标有限、正侧骨架采样图已目视，见 SSD `cmu-jump-poses.png`、`cmu-layup-poses.png`。它们只证明导入和少数姿态，不能证明转换精度、自然动作、触地或与游戏骨架适配。权威 Blender JSON `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-inspect/a01/outputs/cmu-bvh-pose-samples.json`；正侧采样图 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-sheets/a01/outputs/`。已准备 a02 全过程每5帧采样，首次派工因 CB0001 GPU 锁忙而拒绝（未启动、无重复 attempt）；等锁空或按真实依赖 stage 到认证 worker 再做，不能中断他人任务。脚本 `tools/blender/inspect_cmu_bvh.py`、`scripts/hoops-cmu-pose-sheet.py`。

后续优先看完整正常速度动作、检查转换器未初始化旋转/零长骨和目标骨架重定向，再核脚步与持球；CMU 原始数据不得直接转售，PWA 分发限制仍需核实，不直接复制到网页。正式旁白与自动导出入口仍未完成。静音自动化测试应使用 `--mute-audio` 并在 finally 关闭浏览器/服务器；Owner 多次要求不能让测试声音干扰。

## CMU 来源核验与转换（2026-11-05）

Owner 允许采集；原始五文件来自 CMU HTTP 后，已从 Let’s Encrypt 官方获取中间证书补全系统信任链，hostname/CA 校验开启、partial-chain 禁用，通过 HTTPS 再取同一五份并全部 SHA 匹配；证据 `/srv/ai-data/media-work/asset-library/evidence/cmu-basketball-mocap/https-verification-20261105.json`。条目解除隔离并标商用产品许可，原始数据直接转售禁止，redistribution=false，PWA 分发仍待核；注册来源暂不开放新采集，因为默认客户端证书链不全。

在 CB0001 注册 CPU 路径用 MIT amc2bvh f89c731 转换了 subject124 跳投和上篮，收集到 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a01/outputs/`；789/694 帧、96 通道、有限值仅为机械检查。跳投 SHA `876dc61d9811debd96cd4d6bb8c812ba693edf1b68d71dad5016ff9795cd0d0a`；上篮 SHA `376f7bc8d9e235c78e31492b6a54366dbc0aaba64c65338a79bfc7fc94fe476d`。尚未用 Blender 观察或接入；须核转换器零长骨及缺失旋转通道、人体比例和脚/手/球接触。详情在 `docs/HOOPS_VIDEO_AND_MOTION_RESEARCH_20261105.md`。

## 篮球动捕素材与静音录制实验（2026-11-05）

Owner 明确授权所需 CMU 动作下载并纳入素材库，要求测试静音且结束后关闭。已受控采集 CMU subject 124 的跳投/上篮和 subject 06 的变向运球投篮，以及两套 ASF 骨架，共五份；canonical 路径、许可、原始来源和 SHA 在 `docs/HOOPS_VIDEO_AND_MOTION_RESEARCH_20261105.md`。CMU 原站 HTTPS 证书链在 worker 和 Mac 校验失败，五份通过 HTTP 获取；SHA 仅是内部字节校验。五份现已隔离（index commercial_use=NULL，provenance quarantine），CMU 来源暂停再次采集，先独立验证安全来源及 PWA 分发权限，不能入游戏或声称商用可用。动作本身、骨架适配、真人接触尚未实测。

实验性 `scripts/hoops-video-capture.mjs` 把现有 3D 球场、每步输入音频和字幕录成 WebM，音频只连接录制输出。测试采用静音合成缓冲、并以 `--mute-audio` 开启浏览器；`capture-silent-a03/report.json` 验证 640×360 输出可解码和播放，decoded-frame.png 已目视（修复英文断词）。这只是静音技术试验，没有合格旁白、产品按钮、MP4、iPad 验证或正常速度视听/Owner 验收。`hoops-smoke.mjs` 也强制宿主静音并 finally 关闭浏览器/服务；最终完整冒烟通过（10关/5随机/战术/退出/超时，errors=[]），25 个 Node 顶层测试通过。当前测试浏览器均已结束；别的会话的军棋浏览器不碰。

下一步：核实 CMU HTTPS 来源与许可/PWA 分发，并在 3090 做原始动捕对比和重定向；确认独立篮球教学内容的正式 voice 接入，完成真实旁白/字幕/画面/输出闭环及用户可用的导出入口。继续打磨球员、动作与场馆，距离 NBA 2K 和 Owner 验收仍远。

## 篮球动作研究与视频时间线（2026-11-05，后续）

Owner 再次指出球馆细节、人物造型、动作与 NBA 2K 相距很远，要求检索可商用开放资源并认真做自动讲解视频。核实当前人体由 Blender 官方人体和 Quaternius CC0 基础改造，专门上篮和跳投是项目原创 Blender 动作；不是 NBA 动捕。统一资产库预检通过，篮球模型和 mocap 商用查询无适合结果。CMU 官方目录有真实篮球运球、变向、跳投和上篮，网站允许在商业产品中使用但禁止直接转售动作数据；CMU 不在当前批准来源注册表，因此没有下载/接入，也没有验证品质、球轨迹和与现有骨架的兼容性。证据和来源见 `docs/HOOPS_VIDEO_AND_MOTION_RESEARCH_20261105.md`。不能称已达到 NBA 2K。

本轮建立 `scripts/hoops-video-timeline.mjs`，从现有战术和已测逐步旁白时长生成动作/音频时间线与 SRT；`scripts/hoops-video-plan.mjs` 可输出 JSON/SRT，拒绝缺失、错误时长和覆盖文件。单元测试与真实 CLI 以假时长输入通过，完整23项 Node 测试通过。**还没有自动旁白、游戏视频录制、音画合成或可分享视频**，时间线不证明画面和配音已同步；之前失败且 research-only 的声音不可用于成片。

下一步：确认独立篮球教学片的正式中文配音接入（服务要求真实 episode；不可伪造或把 research 输出当成片），建立逐步音频/画面/字幕合成与正常速度验证；CMU 按资产库来源批准及受控采集流程入库并以 3090 小样验证后才可使用。继续球馆、真实动作和游戏体验，保留对标差距和 Owner/iPad 验收。

## 篮球战术与教学视频：进行中（2026-11-05）

Owner 要求继续打磨游戏，不等教练，研究 NBA 常见战术（牛角、电梯门及变化），自动生成带讲解视频。当前开发 worktree `codex/hoops-tactics-video`，从 `codex/hoops-local` local.35 开始；原军棋 checkout 和未提交改动保留。此项未完成、未发布、没有 PR。`v2.9.0-local.36`：战术本加入牛角挡拆外弹和电梯门无防守示范；后者先让射手过门再让掩护人合拢，文字强调实战合法掩护与给防守人避让空间；无防守场景不能验证真实碰撞与裁判判罚。原牛角挡拆顺下仍在。修战术面板按钮被 primary 200px 最小宽挤出的问题。资料：[NBA Horns](https://www.nba.com/lakers/playbookclippershtml)、[NBA Elevator](https://api-hub.nba.com/news/cleveland-cavaliers-golden-state-warriors-go-plays-breakdown)、[NBA screening](https://official.nba.com/third-installment-of-the-nba-rule-authority/)。原创数据，没有复制视频素材。

验证：篮球测试通过；浏览器 3D 电梯门自动演示跑到终点，截图 `/Volumes/MiniStorage/media-projects/caesar-hoops-tactics-20261105/`；控制按钮 44px、未越界。未做 iPad 真机、听审、Owner 审美或市场级验收。完整测试及最终修改后的浏览器复测以本轮结果为准。

**视频功能未实现**：还需一个使用同一战术数据的可复现时间线、讲解与字幕同步、导出与真实可播放验证，不能把现有 Watch 或录屏称作自动讲解导出。中文旁白研究尝试 `caesar_hoops_horns_pop_20261105_a01` 经注册 CB0003 完成但 0/1 通过，最终约235汉字/分，目标255–260；归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/caesar_hoops_horns_pop_20261105_a01/a-7202b32090ae2a450caa`，SSD `voice-a01/job_result.json`。此次 request 使用 `research=true` 而非正式 episode：代码只在 episode 分支设置四条上限，research 路径首 take 失败后自动生成了七个额外候选，与 `studio/core/VO_RECIPE.json` 的正式配方上限不同；此音频不得进入成片。正式出口及允许的生产接入须先明确并验证，不可假定 research 路径受四条限制。实听和识别细查均未通过或未做。不要重发同一 attempt，勿伪造 episode 通过正式切次门。

下一步：优先修复配音路由的自动重试规则；设计战术数据→同期解说/字幕→受控画面/音频导出，先做牛角一套真实样片，验证画面、动作、讲解同步与文件播放，再扩展电梯门及变化；同时继续球员动作、视听和实际游戏性，不宣称 NBA 水平已达成。遵守素材库和3090生产入口。

## Current local.35 — continuous near spectator shirts and fuller hands (2026-10-12)

Goal best audiovisual / NBA 2K Mobile ACTIVE and unmet. Branch `codex/hoops-local`, local/private only, no push/PR/publish. New near reaction model has a continuous shirt shell from the approved uncut Human Base male surface, same source proportions/native heat bind, exact neck/waist/sleeve rest-pose cuts before seated evaluation and target bake. Skin retains more arm/palm/finger geometry in both tiers. Existing static casual fallback and far atlas remain unchanged. Runtime event/return/reset/LOD/shadow logic stays34. Both build identities35; current asset already in SW precache. `casual-reactions.provenance.json` includes canonical full source/parent/derivative paths, static parent recipe, builders/helper/output hashes. Final output2,095,600bytes SHA `32e926cf296e451e924e04c077bc784f9546977b21a548d326c7fbebe0ba19fa`, worker `crowd-hems-v8b/crowd-clap.glb`.

Owner added GLOBAL RULE: ALL Blender operations run on3090 `las-3090-automation`, including CPU-only; never Mac Blender/fallback. This entire modeling/baking/export sequence was already worker-native. Canonical rule `/Users/cdmini/How to use hermes agent/RULES.md` section Blender执行位置, installer updated and its forced summary verified in Codex/Claude/Hermes/Antigravity global entrances. Explicit requested persistent note saved in Codex memories/extensions/ad_hoc/notes/2026-10-12T18-02-06Z-blender-3090-only.md. Global rule/installer locally committed97b6edf in media repo; no push. Existing unrelated VERDICTS dirty state preserved. Worker RULES.md path absent; attempted narrow updater failed without changes, no competing authority created. Mac is code/control/browser/result viewer only.

Native rejected trials retained worker/SSD:V1 protected garment boundaries insufficient;V2 spatial sleeve weights pulled side torso;V3 authored sleeve masks fixed torso flare but intersection persisted (first BMesh-layer handle failure, correctedV3b);V4 cuff expansion still coarse;V5 body-wrap used cropped runtime anatomy, missing shirt;V6 full source restored but seated cuts left wrists/knees, ribbons. V7 cuts in rest pose and preserves inherited weights, clean high cuff; V8 improves skin resolution, V8b cleans unused generator and adds source/helper receipts. Exact experiments in media EXPERIMENTS.md HOOPS-HEM-BOUNDARIES-20261012. Thirty study samples each, actual representative high/low images reviewed; purely mechanical passes did not allow those rejected assets into game.

SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/crowd-clap-study/`: final `check-hems-v8b`30frames/errors[]; `integration-v35` actual made-basket participation/delay/return/reset,179 visible/tier, lower delta0, six scene resource plateau,9/9 morph textures disposed, real shadow pixels26,206high/7,569low pass; `support-v35`179/tier shoe geometry versus support max0.62mm. Main/near high+low screenshots inspected. Actual same-camera triangles2.10m→2.35mhigh(~12%),1.05m→1.20mlow(~14%), calls unchanged; extra GPU cost/iPad FPS unmeasured. Low fingers/arms now fuller; faces/hair/cloth still stylized, neckline/waist drape and body detail need further work.

`hoops-unit-v35.log`18Hoops Node suites pass. Previous full21 run34 has20pass/unchanged chess deeper-search-budget1fail; no chess change. Full hardware smoke34 is green, not rerun35 (asset-only improvement after same runtime). Focused35 actual gameplay/physics, left+right458x504 corner buttons, current35 offline four enabledbuttons plus actual successful corner/review pass. `runtime-v35` current/fullround AV, skin/clips/atlas/reflection, six resources, phone nooverflow, JS/external errors[]; `offline-v35.json` explicitly imports35 and confirms35SWcache, new reaction model and successful choice.

Final worker/SSD `crowd-hems-v8b/crowd-v35.mp4`,11.231s,H264850x742/encoded60fps,AAC48kstereo,SHA `916da3f3af4477e6b3dde3105abc54da29b10d0eedc30d62b95c29c1eb5e9bb2`. Actual match/near screenshots and sampled frame grid observed; no continuous1x/actual listening/iPad/Owner or NBA parity. Same review URL now35 with34→35 near comparison and latestfullround; first4images and topvideo readyState4/dimensions verified, appopenqueued only. LAN Mac address192.168.1.128:8001 from34; verify server/IP live before next iPad instruction. No new media source or paid assets.

Next prioritize NBA target's players/athletic motion and natural face/garment/hand detail, plus far audience motivated reactions and sound perceptual review. Do not keep multiplying rows or adding decorative light. Keep local privacy and exact global3090Blender requirement, visible action buttons and physical contact. No background native job left running at this checkpoint.

## Current local.34 — native near spectator reactions (2026-10-12)

Goal best audiovisual / NBA 2K Mobile remains ACTIVE and unmet. Branch `codex/hoops-local`, private/local only, no push/PR/publish. Default near audience adds rig-derived ClapLift/Open/Closed morph targets, with real made-basket triggering, staggered delays/rates, fixed pants/shoes/support and return to neutral. Away/staff stay neutral. `hoopsCrowdReaction=legacy` restores static casual near audience; load failure falls back. Far multiview spectators stay static. Surface/depth height transforms follow morphs. The bundled geometry merger drops `morphTargetsRelative`; local merged geometry now preserves the GLTF delta flag, avoiding collapsed limbs. Owned instance morph textures dispose on Court destroy; reset/new scene zeroes poses. Asset provenance/source/license/worker/builder hashes are in `casual-reactions.provenance.json`.

Native candidate studies retained v1 ID-property failure, v2/v3 fingertip strips, first v3 runner wrong-cwd upload failure, v4 arm-only weight fix and v5 real IK lift intermediate. Actual v5 samples inspected: hands meet, lower body fixed, but ragged sleeve borders/low hand angularity and face/hair remain coarse. Close art is not accepted. Candidate GLB is1,649,536 bytes, output SHA `2f1f8f1fcc4bc42d8818476c4255f5b64197731b224ce66aea394efa98eabe11`; no new downloaded assets, NBA scans or mocap.

SSD `crowd-clap-study/integration-v34-shadow/report.json`:179 visible near actors in each tier, actual corner-button made-basket triggers >50 reactions with different timing, away/staff neutral, poses return/reset, pants/shoes delta0, six rebuild resource plateau,9/9 owned morph textures disposed, shadow on/off real pixel differences29,962 high/9,240 low. JS/shader errors empty. The first runtime attempt found the8000 server dead (connection refused, retained); next exposed the delta flag issue (retained), fixed. One comparison wait failed because the harness lacked preview unlock, corrected; final integration passes. Small-window `buttons-v34` passes both left/right corner actions. Serial Node run `unit-v34.log` has20 passing suites and unchanged chess deeper alpha-beta budget failure, no chess code/test change. Full hardware smoke `smoke-v34/report.json` is terminal:10chapters,5Read rounds,playbook3/3,wrong/demo/timeout/exit/phone,errors[] pass.

`runtime-v34` records actual full round/current AV, six scene rebuilds, current model/clips/atlas/reflection, errors/external requests empty and phone no overflow. Its old version-match regex missed the identity: separate final `offline-v34.json` explicitly imports cached BUILD and verifies cache name local.34, offline reactions/model, four enabled buttons and actual successful corner choice/review. Browser offline emulation is loopback evidence only, not iPad/LAN PWA proof.

Worker/SSD `crowd-clap-study/crowd-v34.mp4`,11.482333s,850x742,H264/encoded60fps,AAC48k stereo,SHA `079de80bd191de6df18934363839c9673f3ee90b5259da7868e354658d24bfb9`. Native decoded peak−6.3dBFS (not actual listening). Main-view/near high+low screenshots and sampled movie grid inspected; no continuous1x/actual listening/iPad/Owner or NBA parity. Review original URL now34; first2images and topvideo metadata/readyState4 verified, app-open queued only.

Both loopback8000 and LAN8001 were dead at resume; restarted as separate Python server sessions71578/87099, observed PID93608 for loopback. Wi-Fi is now192.168.1.128, LAN binds that address: `http://192.168.1.128:8001/?hoopsPreview=drive-kick&hoopsDecide=150`. Mac browser confirms34; insecure LAN HTTP has no SW. Keep servers/Mac running, IP may drift. iPad has not been observed.

Next highest art need: clean connected sleeve hems and credible hand surfaces (current decimation leaves sharp borders), richer player/face/garment detail and more natural athletic motion; far audience reaction remains absent. Keep underlying physical actions, visible choice buttons and local privacy. Do not mark the broad goal complete from these desktop checks.

## Current local.33 — explicit action buttons, clear corner pass and stable viewport (2026-10-11)

Owner clarified they do not recall which circle, but the real problem is visibility/confusion: knowing the answer yet not knowing where to tap. Prioritize that requirement. Default play now offers explicit action buttons (e.g. Pass to3/corner, Layup at rim, Pass to2/wing, Pass to5/paint) alongside direct court targeting. Desktop uses the coaching panel, <=860px/portrait uses a2x2 tray below the court; all four buttons remain visible/clear/touch-sized at the actual458x504 IAB size. Watch/outcome buttons disable and retain their space. Display order shuffles once per round, remains stable across renders, and preserves the option index; no answer grades in labels. Pass badges share receiver hit coordinates; HUD stays outside all play phases. Narrow3D title/result overlays are constrained to the canvas, rather than spilling onto the score/actions. Both identities33 avoid retaining the earlier32-development cache.

Goal NBA best audiovisual ACTIVE/unmet; artwork remains31. No new media/voice/source, no push/PR/publish. Native clapping was proposed but never started because Owner's usability report took priority. Actual IAB2 was refreshed, shows33 and the new buttons in the play; initial title overlay shown during intro prompted the final narrow overlay bounds fix. It was then opened at `?hoopsPreview=drive-kick&hoopsDecide=150` and Level2 entered so Owner has more time to inspect/press. Do not claim Owner selected/accepted an action. Existing progress7 stars remained; no fabricated stars/unlocks.

Final UI evidence SSD `action-buttons-v32-final/report.json`:12 viewport/normal/mirror cases, all four >=44px buttons within screen and actual hit unobstructed, real corner button sends to3 and correct grade/review, stable canvas across phases. `action-outcomes-v32/report.json`:8 actual touch/keyboard choices (four choices in English/Chinese), exact expected grades3/0/1/0, buttons disable afterward, order stable. Final33 overlay/small-window two-case rerun `action-buttons-v33-small-final` passes. Images: small English/right+left and `actions-zh.png` inspected; review includes these. Full new-buttons hardware smoke in `action-buttons-v32-smoke-final` passes10chapters/5reads/playbook3/3/wrong/demo/timeout/exit/phone/errors[]. Final33 loopback offline `action-buttons-v33-runtime` confirms four enabled buttons plus3D/art/action assets, no errors/external requests/phone overflow; build-only33 follows the same feature source. Last two CSS overlay bounds change only title/result placement, with the focused33 rerun.

Testing limit: final full Node run has20 suites passing, unchanged chess deeper-search budget assertion fails; isolated rerun also fails under this desktop session. Earlier pre-button alone run passes21, retained; do not advertise final33 as all21 green. Files/logs `action-buttons-v32-final/unit-final.log`, `chess-final-alone.log` and older `corner-targets-v32/unit-alone.log` show exact outcomes. No chess logic/tests changed. Actual iPad/Owner/continuous1x/real listening remain unverified. Next resume small native audience reaction trial and player/garment detail; do not claim NBA parity.

## Previous local.32 development — corner pass badge alignment and stable play viewport (2026-10-11)

Owner reports Drive & kick's corner circle outside the court. Inspected actual IAB tabs: one home, one level2 timeout review, visible458x504. At that size, the3 badge had an outward floor offset and part of its24px circle crossed the projected sideline. Gold floor ring world centre already equals receiver22,3.5 and max hot radius stays inside. Asked optional clarification badge vs gold ring; no answer yet at writing. Fix the observed badge issue without claiming a different unobserved ring bug: eligible pass badges now share `_target3` with hit testing, centred on the receiver with a gold outline; clearMarkers removes that style. Other identity labels retain prior layout.

Score/HUD sits outside the court throughout play, keeping the canvas dimensions stable across intro→decide→outcome→review. Previously local.30 only relocated it at decide, altering aspect/camera framing and recorded video dimensions. Both build identities local.32; no new media source/asset, no push/PR/publish. NBA audiovisual goal ACTIVE/unmet. The proposed native clapping work was not started when the bug report arrived; resume that after the usability fix.

SSD `corner-targets-v32/report.json`:12 cases at458x504,820x780,1180x820,390x844,1024x768,1024x1366 ×normal/mirrored. Real receiver/ring centres equal, pass badge aligns within.8px of target centre, badge centre selects correct option, max hot rings within court; actual simulated tap sends ball to3 and grade3/review, all-phase canvas dimensions stable. `corner-targets-v32-floor/report.json`: additional two actual small-window floor-circle taps choose/send correctly on both sides. Small-window right screenshot inspected. Unit first run overlaps browser and fails known chess timing/deeper-search budget; unchanged tests pass21 suites alone in `unit-alone.log`, earlier failure retained.

Full smoke and offline/current-source runtime are being checked in `corner-targets-v32-smoke` / `corner-targets-v32-runtime` on SSD; read their actual terminal reports before claiming final pass. Review now includes left/right458px positioning screenshots via `corner-targets-v32` symlink, previous31 crowd video remains its checkpoint (not32). iPad/Owner/continuous1x/real listening still pending. Current artwork remains31; only positioning/layout change32.

## Current local.31 — native middle/far spectator views (2026-10-11)

NBA 2K Mobile / best audiovisual goal remains ACTIVE and unmet. Previous goal turn made concrete progress (local.30 UI/LAN), this turn adds actual native crowd art/runtime, checks and review. Branch `codex/hoops-local`, local/private only, no push/PR/publish. Default middle/far crowd now uses six native rendered clothing looks ×eight yaw views ×two pitches from the existing CC0 casual model; near rows/benches retain3D. Human-height seat cushions replace the low distant placeholders. `hoopsCrowdDepth=legacy` restores the preceding distant crowd/seats; loading failure also falls back. Atlas source/parent/license/worker/builder/output SHA in `crowd-atlas.provenance.json`; details and retained failures in local.31 section of `docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md`.

SSD `crowd-atlas-study/runtime-final/report.json`: actual same-camera high2.62m→2.10m triangles,low1.27m→1.05m,calls457→452/454→449;2483/1242 impostors,1.19MB PNG with~6MiB decoded before mipmaps. No JS/shader/external request errors, phone no overflow, six player-scene rebuilds plateau. Final serial21 Node suites pass; full hardware smoke10chapters/5reads/playbook/wrong/demo/150s timeout/exit/phone passes errors[]. Final current-source loopback offline31 loads atlas,casual,faces/skin,both action clips and reflection. These are desktop checks, not iPad FPS evidence; cutout fill cost remains unmeasured.

Actual main-view and side/overhead studies plus final sampled movie grid inspected. Native worker/SSD final `crowd-atlas-v2/crowd-v31-final.mp4`,11.051s,850x742 fixed all frames,encoded60fps,H264/AAC48k stereo,SHA `5d6d8b8914de40f657dac72e01f8141112fdcf6ddcf906868f1c1674677325c5`. First changing-dimension export is retained/withdrawn; current review uses final filename. Review first two pictures and top video load/readyState4/dimensions verified via browser. Review URL unchanged,31 now. No continuous1x/actual listening/iPad/Owner acceptance or NBA parity.

Remaining: static repeated spectator identities, coarse close-up pixels, discrete view changes and approximate cutout depth; distant cheering arms disappear in this static representation. Next improve continuous motivated audience reactions from the actual rig and player/face/garment detail, plus stabilize stage height across phases (local.30 HUD outside court only in decide changes canvas height). Do not merely add more rows or treat metric reductions as art acceptance. Actual iPad can try Wi-Fi8001 below; server still needs to be live.

## Current local.30 — clear decision targets and LAN iPad preview (2026-10-11)

Owner reports text obscuring choices in the right browser, then asks whether iPad can test the local version. Prioritize this usability/access fix; NBA audiovisual goal remains ACTIVE and unmet. Branch `codex/hoops-local`, local/private only, no push/PR/publish.

Responsive arena grid now follows the same <=860px/portrait breakpoint as the rest of the app; content-sized rows prevent the coaching panel overlapping the court. During decide, the score graphic occupies its own row below the court. Option labels use screen-space placement avoiding 48px target areas, player numbers, YOU, view control and other labels; hidden labels cannot intercept a target. No targets/labels means no collision-layout DOM work outside decide. Both build identities are local.30.

SSD `decision-layout-v30-final/report.json`: all 10 chapters at 1180x820,820x780,700x780,1024x1366,390x844 (50 cases), labels visible/nonoverlapping, touch centres select their own option, panel/HUD do not overlap court, no horizontal overflow/JS errors; actual best-option mouse click reaches review in all ten. 820px and phone final screenshots inspected. Earlier failed layout attempt retained in `decision-layout-v30/` (grid row shrink caused panel overlap); final rows correct it. `decision-unit-final.log`: 21 serial Node suites pass. These are browser size checks, not iPad device results. Additional final-source touch checks `decision-layout-v30-touch-final/report.json` pass levels 2/9 at all five sizes (10 cases), with actual simulated taps selecting best/reaching review; use `HOOPS_LAYOUT_TOUCH=1 HOOPS_LAYOUT_LEVELS=2,9` with the same script.

8000 loopback server remains. Separate Python process PID34769 currently binds Mac Wi-Fi `192.168.1.125:8001` from this repository; iPad on same LAN can try `http://192.168.1.125:8001/?hoopsPreview=drive-kick`. Mac browser verified this URL loads the game. Keep Mac/server running; address can change. HTTP LAN is not a secure context and service worker is unavailable (observed), so this does not validate PWA offline caching. iPad has not been observed. See `docs/LOCAL_DEVELOPMENT_20261009.md` for the launch command. No GitHub upload is required.

Resume the bounded native multi-view crowd impostor trial after the usability fix. No atlas model/render job has begun. local.29 remains the current crowd/arena art checkpoint; do not report NBA parity.

## Current local.29 — casual crowd, seating support and shadows (2026-10-11)

Persistent best audiovisual / NBA 2K Mobile goal remains ACTIVE and unmet. `codex/hoops-local`, local.29 only; no push/PR/publish. Native Blender casual spectators (crew neck/sleeves, trousers, shoes, three poses and authored face proportions) are installed in near rows and benches. Runtime height variation preserves feet/seat relationships; foot platforms, LED barrier/aisle landing and apron are corrected, near shadows are added and low quality reduces shadow casters. `hoopsCrowd=legacy` restores the preceding crowd/placement. Full recipes, retained failures and source/asset/builder hashes: local.29 section of `docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md` and `casual-audience.provenance.json`.

Actual imported sole/support geometry check passes179 visible actors in both tiers (max0.62mm), shadow on/off has real GPU pixels, final presentation/LOD/mirror checks pass,21 serial Node suites pass. Full hardware smoke passes10 chapters/5 reads/playbook3/3/wrong/demo/timeout/exit/phone. Final new/legacy runtime/offline local.29 has no JS errors/external requests, six-rebuild resource plateau and no phone overflow. Shader depth and surface use the same upper-body height transform. Parallel chess timing failure remains recorded; no test changes were made.

Final new MP4: worker/SSD `proof-crowd-v29/new.mp4`, SHA `a16612088eee67a1a67f826550329e774bc52efc520b87c9e73b5c2f8d869578`,11.122333s/encoded60fps/H.264/AAC48kHz stereo. Same-seed preceding audience/placement in `legacy.mp4`. Review URL unchanged and now29. Final gameplay, near/side studies and sampled movie grid were inspected. No continuous1x/actual listening/iPad/Owner acceptance or NBA parity.

Quality/performance remain unresolved: close faces/hair/shoes/cloth and middle/far primitives are simplified. Total high/low draw triangles ~2.62m/1.27m (including shadow/reflection passes); iPad cost unknown. Next: visible middle/far crowd with credible shapes and mobile budget (bounded native multiview impostor trial), and richer player/cloth/lighting. Current source geometry is groundwork, not the requested final aesthetic.

## Current local.28 — original faces, skin surface and arena structure (2026-10-11)

Persistent NBA 2K Mobile / best audiovisual goal remains ACTIVE and unmet. Branch `codex/hoops-local`, local.28 only; no push/PR/publish. Four native Blender face targets in both head tiers, ten runtime identities, CC0-photo-derived microheight detail, refined skin/eyes/cropped hair, roof trusses/fixtures/acoustic panels, upper-left deck/fascia and actual HUD-linked score displays are integrated. `hoopsSkin=legacy` and `hoopsStructure=legacy` provide independent preceding versions. Exact assets/license/build receipts and observed limitations: `docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md` local.28 section.

Actual head deformation/stability in both tiers, hands/neck, motion/contacts, presentation/LOD, physical reflection and score/clock checks passed. Final 21 Node suites pass serially; fresh current/legacy offline local.28 3D, six rebuild memory plateau, no JS errors/external requests or phone overflow. New total high/low ~1.89m/1.01m triangles, 453 calls in the same scene, still no iPad performance evidence. Default SwiftShader smoke initially timed out before the first decide; retained in SSD `skin-material-study/smoke-final`. Final hardware smoke passes all ten chapters, five Read & React rounds, playbook walk, wrong-read/demo, deliberate timeout, mid-level exit and phone layout; errors empty.

Private final 60fps proof: worker/SSD `proof-skin-v28/new.mp4`, SHA `bb22b0babb7fe85bd199b13c3bae92d359d41a3ff453852708359d747abad8a4`; same-seed preceding version `legacy.mp4`. Initial 1000fps export and grid overwrite failure are retained; final probes have explicit 60fps/H.264/AAC 48kHz stereo. Review URL unchanged and now shows actual new game views, portrait/roof studies and both current videos. First five images plus both top video metadata/readyState checked. App open request queued. No continuous 1x/actual listening/iPad/Owner acceptance; no NBA parity.

Full hardware smoke initially passed chapters1–8 then exposed chapter9's intro-shot close-up cropping the correct decision target below the court. Fixed with per-intro `finishCamera:false`; normal click now succeeds at y≈578 rather than863. Fresh final offline verification checks current cached source, four actual head targets, skin map and successful box-out choice/review. Final canonical full-smoke rerun in SSD `skin-material-study/smoke-fixed-final/report.json` passes (hardware browser mode); the earlier failures are retained. Final 21 Node suites rerun after the camera fix also pass.

Next priority: spectators' casual clothing, sleeves, hair/face cohorts and seated relationships via native Blender. Current crowd still visibly repeats the athlete face and sleeveless kit. Prove a small close row before scaling; keep rejected shoulder-pad and floating-head attempts withdrawn. Skin texture improvement is subtle, not a substitute for better anatomy and cloth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HANDOFF
STATE ID: HO-2026-10-11-hoops-local.27   ← THIS NODE

## 当前 local.27：实时局部地板反射，整体品质仍未达标

持续goal ACTIVE，NBA 2K Mobile最好视听未达成、未暂停。`codex/hoops-local`、`v2.9.0-local.27`，无push/PR/发布。新增 `floor-reflection.js`：实时镜像相机/裁切面，实际球员低档网格/球/篮架/篮网反射，柔化并保留原PBR木纹/涂装；恢复主画面LOD和renderer状态。高低目标宽512/256，默认.32强度、较柔清漆，`?hoopsReflection=off`可对照。几何/动作/音频不因反射替换，也无新媒体下载。

SSD `reflection-study/physical-final` 真GPU像素球倒影射线误差0.57–1.43px/UV约1e-16、地板下球0像素、每主绘制一次反射、LOD/renderer状态恢复、6次重建geometry123/texture220稳定。总高档约171.95万→183.83万面、318→443 calls，低约85.01万→96.89万；仍增加调用/资源，iPad未知。桌面rAF/CPU提交采样不是GPU计时或真机性能。

21个顶层单测、`presentation-final`、`regression`、`finishes`均通过对应范围。`runtime-on/off`同种子L2带声回合，最终v27断网3D/on反射更新196次、off更新0，错误/外部请求空，手机不溢出。没有连续1x视听、实际耳听、iPad/Owner美术验收。人物/观众脸、衣物、皮肤仍粗糙同质化，整体未达NBA；下一步优先这些素材/身份与动作的真实细节。详见 `docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md` local.27。

最终worker/SSD `proof-reflection-v27/on.mp4` SHA `5184f29dc66ef5d5136857bb3e9f629399ec21cfb17f5d885ebf238c4994d007`，off为同种子/当前材质/动作/混音对照。原review URL已更新local.27，图与两段metadata/readyState实际通过；帧板采样已观察，不是持续1x或听审。

## 当前 local.26：场边设施/完整首排与跳投，整体仍未达标

持续 goal ACTIVE；目标仍是最好的视听/NBA 2K Mobile，未达成、未暂停。`codex/hoops-local`、`v2.9.0-local.26`，无push/PR/发布。同期原创 JumpShot 接入跳投（上篮保持LayupR）、球与动作时钟/鞋底支撑同步、有限俯仰瞄筐；来源与builder在 `jump-shot.provenance.json`。皮肤AO试验未替换当前人物。

球馆默认增加前排完整坐姿、球队替补席、记录台/显示器、场边摄像设备/饮水箱；减少冷蓝色灯光，调整扫描木纹/法线/清漆。`?hoopsVenue=legacy` 查看同人物动作的前一场馆。坐姿由批准CC0人体原创新作，三姿态/高低网格，native worker v7 SHA与builder在 `seated-audience.provenance.json`。按姿势合批、原创palette shader，少数首排和替补用细网格，其余完整低网格。

**近景美术仍不足**：脸/衣物/皮肤同质化、远排比例和肢体仍简化。v3鞋/腕问题、v5–v6袖口像肩垫、v7放大远排出现悬空头部/细长手臂均保留并处理/撤回；不要声称完整写实观众或NBA观感已实现。详见 `docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md` local.26。

SSD `arena-v26/` 最终 `check-v8` 新旧约131.66万/56.14万→171.89万/84.94万面、293→323 calls；仍增加成本，iPad未知。`presentation-v8`无遮挡/LOD/投篮取景/返回/手机通过，`finishes`四种终结、`motion`两个片段实际鞋面与掉帧恢复通过，21个顶层单测串行通过。`runtime-v8` errors/外部requests空、6次重建geometry110/texture129稳定、3D离线v26含两个片段与首排坐姿加载成功、手机无溢出。没有持续1x视听、实际听审、iPad/Owner美术验收。

最终新/旧场馆AV在 worker/SSD `proof-arena-v26`，new.mp4 SHA `5e9f64fc0ae73421acd05b63a8f185f46ca3fb18b7475238a8a686c0e8e279ea`；本地 review 同原URL已换 local.26，实际两段 metadata/readyState 通过。可重复场馆截图检查：`scripts/hoops-venue.mjs <SSD输出目录>`，仍需本机8000服务。

下一步继续真实衣物/皮肤/头发/身份多样性，以及主机位可见的球馆光照和地板反射。首排模型是局部结构进展，不能当整体品质成功；不要只堆场外几何或拿测试通过当验收。

## 当前 local.24：独立上篮已接入，整体品质仍未达标

持续 goal ACTIVE，Owner 目标仍是最好的视听/NBA 2K Mobile 球员、动作与比赛氛围，未暂停、未达成。当前 `codex/hoops-local`、`v2.9.0-local.24`，未 push/PR。新增 83,484 字节的原创 Blender `LayupR` 动画包；旧人物 GLB 不变。右、左两步、左脚蹬地/右膝上抬、单手离球、左手平衡、手腕跟随、连续腾空和落地屈膝已接入真实回合。保持原有跳投与失败时的原有终结路线。详见 `docs/LAYUP_PROGRESS_20261011.md`。

当前输出 SHA `90406f46c50330edb779e45813862c8cf3222257572a37344c894d63700470d8`，builder SHA `47da99e63272a96431eaf67821586ea720974ff2d8d1707fad8bfb1d8e693b5e`。`assets/hoops/basketball-actions.provenance.json` 指向 worker v5；此前 v1 鞋陷地、v19 锚脚踝悬空和 v20 QA 导航失败均保留在 SSD。新片段以回合时钟定位；起手渐变掉帧后须结束旧姿态混合，不能仅快进新片段而仍混在站姿里。

最终 SSD `layup-study/motion-v24`、`layup-study/finishes-v24`、`layup-v24/runtime-report.json` 均通过对应检查：高低档实际鞋面、两种掉帧边界、四种终结/晚期接触/落地/取景、无异常/外部请求、资源计数稳定、带新片段的 v24 3D 离线重开与手机布局。高低档仍约 132 万 / 56 万面、276 calls，是桌面计数，不是 iPad 性能。新旧同回合录像分别为 `layup-v24` 与 `layup-v21-legacy`，worker/SSD `proof-layup-v24` 已导出，new.mp4 SHA `7af1e2458e02ee9d1ed3ee41663ddba0001714bccfe0dad116d8404997ea5c51`。观察了动作采样条与 review-v24 页面，review 页沿用原入口。

完整参考周期仍没观察到：Jr. NBA 官方上篮视频看到 25 秒教练示范后约 34 秒报错，Kyrie 官方页 Access Denied。动作顺序来自官方文字，节奏和曲线原创，不能声称 NBA mocap/已复刻球员。没有实际听审、独立连续 1x/iPad/Owner 品质验收。下一步专门的接球急停/双脚跳投与瞄筐姿态，同时提升脸/皮肤/头发/鞋、前排完整人和场边/场馆材质。不要仅再堆场外几何或把测试通过当 NBA 品质。

## 前一检查点 local.18：Owner 明确仍远未达标

Owner 最新要求：动作参照真实 NBA 球员；球场、环境、观众席和灯光仍简陋，离 NBA 2K 很远。接受反馈，持续 goal 仍 ACTIVE；未暂停、未达成，不要把版本号增长当成审美进展。当前本地 `codex/hoops-local`、`v2.9.0-local.18`，无 push/PR。

本轮增加转角/上层看台、包厢层、分体座椅、近排坐姿腿、第一排 Blender 解剖头（低档保持便宜头），减弱座椅蓝色重复。头来自既有批准人体衍生，provenance/builder 已存。第一版高档 184 万面太贵，保留失败后缩减到约 132 万；最终另一个相邻场景为 1,315,709 / 560,504 三角形、276 calls。新看台仍有额外成本，没有 iPad 性能证明。上层结构常在比赛画幅外，不能将它的存在夸大为主画面提升。

研究与下一动作入口：`docs/NBA_MOTION_AND_ARENA_REVIEW_20261011.md`。实际看过 Klay 官方教学 25 秒全身/52 秒脚部、Brunson 官方 30 秒跑动帧及 2K Mobile 官方宣传比赛图片。进一步视频 seek 卡住/报错已保留，未测完整急停、起跳、离手和落地周期。重点缺陷：当前上篮还是通用双脚 Shot 加右腿覆盖。下一步先取得完整可观察的收球→两步→左脚蹬地→右手上篮周期，制作原创 Blender `LayupR`，保留原有跳投。同步研究急停接球动作；不要根据搜索描述声称已量出动作。canonical 库暂无适用篮球动作，NBA 解说频道素材例外不能扩成游戏资产许可。

SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/`：`arena-v17-presentation-first`、`arena-v17-presentation-trimmed`、`arena-v17-unit-serial.log`、`arena-v17-regression` 均有实际结果；最终 `arena-v18/runtime-report.json` errors/外部请求为空、六次资源计数稳定、3D 离线重开 v18、手机无溢出。worker/SSD `proof-v18/arena.mp4` SHA `32b6c862e708a98baf1970ea3dc9c8cc66df3313bf4a98b1e39257df7b95b512`；片段采样已观察，未连续 1x 视听/实际听审/iPad/Owner 品质验收。Loopback review 页仍 `/review/hoops-nba-20261010/`，须服务器实际存活。不要用 SW 缓存假象确认服务正常。

## 前一检查点 local.16（2026-10-11）

Owner 的持续目标为「继续 我要看到最好的视听效果 中间不要停」，目标仍是 NBA 2K Mobile 的球员、动作与比赛氛围，当前 goal ACTIVE，未达成、未暂停。不要以一次试版或测试通过替代整体视听品质。

当前 `codex/hoops-local`、`v2.9.0-local.16`，本地开发，无 push/PR。保持 local.12 模型；运行层新增低机位、按实际球员/跑位/决策目标取景、同侧出手推近，修复镜像 catch-sag 目标掉到屏幕下方。皮肤/短发/鞋加入原创材质细节；离手后有限幅手腕跟随；从实际鞋底校准落地声，不再拿踝骨高度当鞋底。教练声对比赛音效压低/自然结束与取消后恢复；新早期反射声场；`?hoopsSound=legacy` 可对比旧混音逻辑。

本轮证据在 `/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/`：21 个顶层 Node 测试串行通过；20 个随机题型/镜像真实点击与评分通过；修正后的完整冒烟、静音/退出/资源/2D 回归、四类终结与脚底落地、取景/LOD、最终 v16 离线重开通过。早期镜像目标/踝骨落地检查失败、并发时棋类耗时测试失败已保留。原生音频输入试验明确返回 `audio content omitted because you do not support audio input`，不能写实际听审通过；同样没有独立持续 1x 视听、iPad/Owner 终验或 NBA 品质验收。

最新视频 `arena-v16`，worker/SSD `proof-v16`；同种子声音对照在 `proof-v15` 的 arena/legacy 两段。详见 `docs/NBA_LOOK_PROGRESS_20261010.md` 的 local.16 章节。下一步继续脸部身份/真实皮肤头发细节、专门篮球动作与场馆观众，让实际比赛观感接近目标；仍须真实视听与真机证据。不要停在材质噪声或机检层；新素材继续先查 canonical 库与批准来源，未批准皮肤/mocap 来源不自行下载。

下一项已启动 CPU 观众头部候选：worker `/srv/ai-data/media-work/projects/caesar-hoops-20261011/crowd-head/run.sh`（rjob 日志/输出同目录），脚本镜像 SSD `crowd-head/build_crowd_head.py`，输入为已批准的 local.12 GLB。先读实际 run.sh.log / receipt 验证 terminal，再取候选与现有球体头对比；候选未接入。当前 arena 头部是 SphereGeometry(.25,6,4)，观众量很大，不能把高面数新头盲目替换全部实例；需要前排/远排分级和实际 triangles/calls 测量。

以下 local.12 为前一检查点：

## 当前补充：人物/服装/握球已进入 local.12

Owner 已明确 **NBA 2K Mobile：优先球员、动作与比赛氛围**，并授权继续使用 Blender。当前 `codex/hoops-local`，`sw.js` / `js/build.js` 同为 `v2.9.0-local.12`，保持本地，无 push/PR/发布。新模型已进入游戏：解剖手指骨架、有效手掌/手指皮肤权重、原创贴合人体的球衣、表面号码、平滑发际/眉毛、颈部权重接缝。运行层修正手掌半径、手腕与手指参与握球、离手松指、可达上篮高度、停步朝向、转角与左右防守蹲姿。

研究：`docs/BLENDER_DECISION_20261010.md`；交付与失败：`docs/NBA_LOOK_PROGRESS_20261010.md` 的 local.12 章节。final GLB SHA `0d4cd3774827a9c84338f86406016882471bf64e12e731d4eae4528a80b85940`，builder / 来源在 provenance。不得沿用 v9 的“手指接触已合格”判断；那版 AnatomicalBody hand 权重为 0。新 shader 号码贴球衣表面，经典版仍保留旧号码贴片。

已检：19 个顶层 Node 测试；v11 完整主关/随机/战术/错误/超时/退出/手机冒烟与回归，随后 v12 只修 GLB 颈部，补查最终模型的 24 组手掌/手指高低档皮肤响应、颈部混合、近景三面、42 采样姿态、取景/LOD、四个终结与断网重开。代表回合 `slice-v16`（突破分球）与 `pullup-v12`（挡拆急停）；新页仍 `/review/hoops-nba-20261010/`。所有证据落 SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-20261010`。独立持续 1x 审美观察、实际听审、iPad 与 Owner 验收未完成；不能标 NBA 品质已达成。

下一步是人物皮肤/头发/球鞋细节及专门篮球动作的重心与过渡，检查跑动/急停脚滑、手指表面接触（不仅 socket 误差），并完成真机视听验证。保留 `mobile-refinement` 的失败候选，尤其 Boolean 肩部破面、旧颈部侧面翘片与上篮超出可达高度的证据；不要通过加光效掩盖模型问题。
PARENT STATE ID: HO-2026-10-09-hoops-v2.8.1（云端基线）
WORKING MANUAL: embedded（见下方"协作规则"；根目录 AGENTS.md 有精简版）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【本地开发更新 — 2026-10-10】
Owner 新指令“继续 一直到到达nba观感”。当前 `codex/hoops-local`，`v2.9.0-local.9`；本地默认完整球馆、解剖人体/眼睛/平滑服装、侧线转播、持球联动、单手上篮/跳投、真正的身体/服装 LOD。`?hoopsLook=classic` 保留旧美术，`?hoopsSound=training` 可对比安静训练声场。没有 push/PR/发布。当前审美目标仍未标完成；详见 `docs/NBA_LOOK_PROGRESS_20261010.md`，最新对比入口 `/review/hoops-nba-20261010/`。第一、二版人体换权重试验拉丝，第三版露肤，均保留失败；A pose 骨架拟合、世界矩阵重烘焙、衣服覆盖面隐藏后的第四版已经进入本地游戏，随后加入眼睛/服装/LOD。不要回退成“全身模型仍未进入”的旧判断。下一步继续皮肤/服装细节、真实急停/转身与手指接触，再做更丰富的终结；不要将桌面测试、录像存在或形状数值合格写成 NBA 品质/实际听审/真机通过。

【本地开发更新 — 2026-10-09】
当前在 `codex/hoops-local`，试版 `v2.9.0-local.2`。Owner 已决定先本地开发，暂不 push、不创建 PR、不发布；以下云端基线和旧的 EXACT NEXT ACTION 留作历史，当前接手请先读 `docs/LOCAL_DEVELOPMENT_20261009.md` 与 `docs/LOCAL_AUDIT_20261009.md`。
Owner 已说明：球场、场景、球员、动作要向 NBA 游戏靠近；声音由我们建议；同时研究游戏性。使用普通 iPad / iPad Pro，代际未知，教练未反馈。第一批核心修复和“突破分球”试版已实现，真机、实际听审和 Owner 美术验收仍待完成。继续优先真实篮球动作、球员模型和手球/脚步接触，再扩其他关卡与两段决策。
本机对比入口 `http://127.0.0.1:8000/review/hoops-local-dev-20261009/`（需仓库根目录的本地服务器）。`?hoopsLook=arena&hoopsPreview=drive-kick` 可直接查看代表关卡；不写入虚假星数。不要恢复旧的“先问教练、先做俱乐部配置”优先级。

【READ THIS FIRST — 接手者第一步】
1. 先读下面的"协作规则"，了解怎么和 Owner 配合。
2. 读 PERSISTENT CORE，了解项目是什么。
3. 从 EXACT NEXT ACTION 接着做。
4. 下方云端基线写于 2026-10-09；本地最新方向在顶部更新与 NBA_LOOK_PROGRESS_20261010.md。当前 Owner 决定先本地开发，不 push/PR/发布；先核实本地分支与修改，不自动沿历史流程拉取/发布。

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

## 【云端基线历史 ACTIVE STATE — 本地最新状态见顶部】

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
