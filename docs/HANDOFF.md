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
