# Hoops IQ NBA 观感升级：2026-10-10

Owner 指令：继续，一直到达到 NBA 观感。当前分支 `codex/hoops-local`，仍只在本地开发，不 push、不 PR、不发布。当前审美目标未宣称完成；需要继续比较 NBA 2K Mobile 的球员、动作与球馆，并由 Owner 看实际效果。

## 最新可查看结果

- 本地对比：`http://127.0.0.1:8000/review/hoops-nba-20261010/`，截图、带声音录像与直接进入代表关卡的链接。
- 最新画面现在是本地默认；`?hoopsLook=classic` 保留原有美术，底层可靠性修复共用。
- `?hoopsPreview=drive-kick` 只允许查看代表关卡，不补写通关星数。
- 原型版本 `v2.9.0-local.9`，`js/build.js` / `sw.js` 一致；新增模型与运行模块已预缓存。

## 本轮实现

球员：用 canonical Blender Human Base Meshes v1.4.1 的真实头部拓扑替换光滑卵形头，加入两种发型和头部/手臂比例差异。身体也已换成同一 canonical 人体：休止骨架按自然 A pose 拟合，原生 heat weights，旧动作世界矩阵烘焙到新绑定空间。隐藏衣服内皮肤并保护手臂权重，手部拉丝与裤子内露肤已退回修复；原球衣、鞋和动作语义保留。布料增加轻微织纹法线；皮肤、球衣、鞋保持分材质。加入 canonical 成对眼睛与原创眼白/虹膜/瞳孔分区；球衣/短裤在休止空间细分平滑，胸前有原创球队字样。高低画质切换真实身体/头部/头发/球衣/短裤几何，不只降低分辨率。

球馆：地面由展示台改成 94×50 ft 的连续完整球场，远端篮架和中场标志存在，训练坐标仍在原半场。看台增加排数，观众有头、发型、身体和手臂，进球后部分观众举手回应。场馆静态结构按材质合批，避免每根栏杆一个 draw call。低画质减少均匀分布的观众。避免近景遮挡的屋顶横梁和旧博物馆光束。

动作：持球位置有准备、下压、起手和离手阶段；右臂跟随持球目标，接球者转向传球人、双手迎球。防守者面向持球人，伸手或抬手干扰；保留原步态的摆动，仅稳定可达的触地阶段，不能够到的脚步释放而不拉长腿。暂停判断时稳定握球与身体方向。修复“Catch 在下一帧覆盖刚准备好的 Shot”问题，专项测试断言起手时始终使用 Shot 动作。自动准备阶段已扩到所有有持球人的传投 beat，明确作者时序保留，原数据与 2D 时序不修改；篮下使用单手起手、抬膝与腾空，外线双手起手跳投，防守滑步按左右方向选择。它们是原动作上的代码层，不是已经获取篮球 mocap。

镜头与界面：宽屏、iPad、手机按实际动作边界计算取景，保住篮筐与目标。完成选择后拉近看投篮，随后回全景解释。横屏默认改为侧线视角与较长焦距，竖屏保留更适合教学的正后方构图。场馆立柱移到与新墙体一致的外缘，避免侧线相机穿过旧立柱。比赛记分条、深色教练面板与关卡菜单；突破分球的三分计为 3 分。其他评分/训练结构保留。

声音：复用既有可用声音，球声按球、急停鞋声按急停球员的屏幕位置做温和声像与距离衰减，鞋声要求减速且至少一脚处于触地高度并限频，替代新版移动 beat 开始时固定鞋声，语音和人群仍分层。静音、退出取消语音和落地声音保持既有回归；没有新下载或生成音乐/配音。`?hoopsSound=training` 降低观众、欢呼与混响，默认 arena 保留球馆层，两段同一回合的最终混音录像可试听；未实际听审，不宣称任一声音更好。

## 较早检查点（下面另列最新 v9 记录）

- 既有 222 个内部用例、新增此前 7 个时序/轨迹测试与本轮 5 个姿态/取景测试通过。Node 显示 16 个顶层测试，不等于内部所有断言数。
- 全流程 `review/hoops-nba-20261010/smoke-fullcourt/report.json`：10 主关、Read & React 四次最佳与一次故意错误、统计、5-out Watch/Walk、错误选择、示范、超时、退出、手机布局通过，无 console/page errors。迎球与 Shot 保留修复后的最新全流程 `smoke-catch-final/report.json` 也通过。
- 2D 全流程 `smoke-2d/report.json` 通过。
- `regression-catch-final/report.json`：静音 RMS=0、迟到语音取消、30 次场景重建资源持平、2D 原始/镜像正确命中；没有将资源计数低当作美术通过。
- `presentation-final/report.json`：默认新版、预览不造星数、600 次身份尺寸更新不累计缩小、真实 LOD、出手球保持在镜头内、回全景、三分计数、手机无横向溢出通过。起手保持 Shot 的专项结果 `presentation-catch-fix/report.json` 通过。
- 桌面短采样 median/P95 约 16.7 ms；是 Mac Chrome 短样本，不代表 iPad 或长时间热稳定。
- 最新完整球馆高画质约 242 calls / 548,540 triangles；切到低画质约 225 calls / 319,622 triangles（具体场景与预热状态会改变数值）。完整球馆新增了远端篮架和观众，不与初始半场计数冒充同条件性能提升。
- `slice-v10` 留存最新正常速度 canvas + 最终混音回合。新版预缓存后断网重载，3D loaded=true / online=false。
- 右手目标的求解误差与手掌/球真实表面接触是两件事；没有将数值误差小升级为全部解剖和碰撞合格。此前未修正脚步可达条件时出现最大约 0.91 ft 的目标误差，已释放不可达脚步；后续已保持的 34 个样本 median 约 0.0095 ft、max 约 0.054 ft。只覆盖这一回合，不证明全部脚步无滑动。
- 截图已实际查看，原速录像可播放；尚未独立实际听审、真机验证或获得本轮 Owner 美术验收。

全身替换后 `presentation-full-body` 通过；`pose-grid` 对 14 个原动作的 25%/50%/75% 共 42 个姿态逐张检查，未发现前两版的皮肤拉丝；这是采样姿态检查，不代表完整连续动作/全部接触已合格。

## 最新 v9 核实记录

- `presentation-final-v9/report.json`：默认新版、身份/头部稳定、真正 LOD、预览不造星数、取景、回全景、三分和手机布局通过。侧线镜头另做从相机到每个球员头部的 raycast，所有 10 人均没有被球馆结构遮挡；此检查不保证任意重叠球员或每个动态镜头完全无遮挡。
- 服装细分后最初 `presentation-v8` 因 low/high 三角形比超过 0.7 被退回，保留失败，没有放宽门限。加入身体与服装 LOD 后通过；同一取景高 1,071,594 / 低 401,634 triangles，约减少 62.5%，当次均 280 calls。不是 iPad 帧率测量。
- `finishes-v9/report.json`：实际第 1/2/4/6 关最佳打法连续采样，单手上篮/跳投分类、准备期间 Shot 不被 Catch 覆盖、飞行球在镜头内与坐标有限通过。四关近景已查看；没有将手部目标数值当成所有手指/皮肤表面接触合格。
- `regression-v9/report.json`：静音 RMS=0、退出取消迟到语音、30 次重建 GPU 资源持平、篮网下落/接球、2D 原始/镜像输入通过。
- `unit-final-v9.log`：16 顶层、原 222 内部与新增 12 个时序/姿态/取景用例通过。
- `kit-pose-grid`：服装细分与成对眼睛后，14 个原动作各 25%/50%/75%，42 个采样姿态保留并查看。高低档截图均已查看；不等于全连续动作碰撞验收。
- 最新 AV / 离线核查 `slice-v13`；安静训练试听 `sound-training-v9`。这两版用相同随机种子、同一回合与最终混音节点录制；真实执行时长/音频时钟有细小差异，不称为逐样本严格盲测。

- `smoke-v9/report.json`：最新模型与侧线镜头下，10 主关全部最佳打法、Read & React 四次最佳/一次错误、统计、5-out Watch/Walk、错误示范/超时/退出/手机布局通过，console/page errors=[]。桌面 hardware Chrome；另有 `smoke-all-prepared` 软件渲染检查通过，时序有差异，不能由它断言真机性能。
- `slice-v13/runtime-report.json`：errors=[]、外部 requests=[]；断网重开 3D loaded=true、version=v2.9.0-local.9、online=false。另一个同场景高/低采样为 1,070,058 / 400,098 triangles、均 268 calls，与上面的关卡/时刻不同。
- 两个试听录像实际包含 VP8 + Opus，长度 10.934 / 10.910 s；FFmpeg 最终混音 mean volume -26.2 / -26.1 dB、sample peak -5.8 / -6.6 dB。不是 LUFS、不是 true peak，也不是听感验收。`layup-v9` 10.737 s AV；已查看连续采样的画面，独立原速观察与实际听审仍待完成。
- 媒体线 `relay.sh out` 的存储/证据闸门通过，落盘闸门被共享媒体仓库的无关 VERDICTS / EP01 修改挡住。本轮未修改或提交那些内容，未声称共享媒体交接完成；游戏的交接、源代码、provenance 与 worker/SSD 证据在本仓库独立落盘。

## 素材出处与失败保留

新源素材没有重复下载。先读取 canonical asset policy / sources，preflight PASS，再 search/resolve FOUND 官方 CC0 人体。canonical：`/srv/media-vault/datasets/universal-media-asset-library-v1/assets/models/blender-human-base-meshes/811f43accbb31a88/members/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend`。

runtime 派生模型 2,951,976 bytes，SHA256 `3519bb125cbe2e187db5945e0919352e24225437ca09609e4176e0333fcc9e9b`。构建 `tools/blender/build_arena_athlete.py`，Blender 5.2.1 CPU；未抢 GPU、未改原库。完整来源与构建 SHA 在 `assets/hoops/athlete-arena.provenance.json` / CREDITS.md。原模型和原动作来自仓库已有 Quaternius 素材；没有 NBA 肖像、队徽或 ProPLAY 资产。

完整人体自动转 T pose、近邻转移权重，以及完整拓扑原生 heat weights 两次研究被退回：手部与皮肤产生拉裂、长三角和畸形，见 SSD `anatomy-close.png` / `anatomy-study-rejection.json`。候选 SHA `4f10c108320588ff2bbb66c6ff2b5c62d312d78ec613ce040f8918b04b3cfcc9`；只通过 Playwright route 在隔离测试里替换过，未装入项目资产。以后全身替换要拟合完整休止骨架和服装，不能用近邻权重或“原生 heat weights 没有未绑定顶点”证明品质。第三个候选改为休止骨架 A pose 拟合、旧动作世界矩阵重烘焙，手部与裸露皮肤的拉丝已消失，但身体从旧球衣/短裤内露出。随后按绑定权重保护手臂，只隐藏真正被衣服覆盖的皮肤面；第四个候选已通过近景与代表回合观察后进入本地游戏，`body-v4-av` 留存隔离试片；之前各失败候选仍保留。

其他退回：第一轮宽屏裁掉篮筐/边角人物；侧线角度被看台立柱遮挡；前景屋顶横梁挡画面；深色面板仍继承黑字；新增 HUD 访问战术本的 null level.hud。均保存证据并修复相应实现。第一轮 smoke 因战术本空 level 失败，保留 `smoke-arena-v1/report.json`；不能引用成通过结果。

worker 项目根：`/srv/ai-data/media-work/projects/caesar-hoops-20261010`。
SSD：`/Volumes/MiniStorage/media-projects/caesar-hoops-20261010`，源码快照、模型候选、测量、录像与失败；Mac 仓库只放运行需要的小模型、代码、文件指针和 QA 图。`review/hoops-nba-*` 被忽略，链接到 SSD 的录像需该卷仍挂载。

## 继续达到目标

当前球馆/转播感已有可比较的实现，但人物的身体/皮肤/服装和完整篮球动作仍不足以宣称 NBA 2K 观感已达到。下一步继续真实步态、急停/转身、手指握球与人物皮肤/服装细节；单手上篮与跳投已有实现，仍要观察动作衔接与接触，再考虑扣篮等终结；不要先加无关光效或关卡。

参考已浏览：[NBA 2K Mobile 官方 App Store 页面](https://apps.apple.com/us/app/nba-2k-mobile-basketball-game/id1252850847?platform=ipad) 与其画面；官方页面截屏只作本机参考，未作为游戏资产。官方 2K Gameplay 页面 403，保留访问失败，未假装读过其内容。

候选仅研究、没有采购/下载：[Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) 说明人物/动画可用于游戏且免费 Adobe ID 可访问，但本项目未获其素材、未上传项目模型；[MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html) 列 CC0 的皮肤/眼睛/头发/服装，尚非本库批准来源；[CMU mocap](https://mocap.cs.cmu.edu/) 搜索发现篮球目录，但本次原页超时，许可与具体片段未核实。均不能当作已解决的人物/动作方案，后续按资产政策受控引入。

Owner 后续已明确选择 **NBA 2K Mobile：优先球员、动作与比赛氛围**。最终仍需 Owner 看实际回合，iPad Pro / 普通 iPad 测型号、Safari/PWA、持续运行、触控、音频、后台与离线；不能由桌面机检代替。

## Blender 研究与近景纠正（研究时检查点，后续已进入 local.12）

详见 `docs/BLENDER_DECISION_20261010.md`。Blender 已用于资产制作，后续重点是模型/服装拓扑、贴合人体的骨架、权重修整、篮球动作与贴图烘焙；现有游戏代码承担实时播放、接触和交互。

近景进一步发现 v9 AnatomicalBody 左右 hand 骨骼权重均为 0，部分手指没有有效影响。此前“42 个姿态未见拉丝”不能说明手指真的带动皮肤。拟合手部候选的手掌权重已有效；新球衣三次候选仍有肩部破面，最后的 `mobile-refinement/anatomical-jersey-v3.png` 已实际查看并退回。候选均留 SSD，未替换 v9 模型；未声称新回合或审美通过。

工作区新增的握球/朝向/转角等源码实验全量 Node 测试 19 个顶层通过（原 222 内部用例和新增 15 个独立用例），浏览器、连续回合、实际听审与真机验证待完成；v9 的已有报告不能用于证明新实验通过。仍未 push/PR/发布。

## 最新 local.12：球衣、颈部与真实手部绑定

已进入本地游戏，覆盖上面的未安装实验状态。`sw.js` / `js/build.js` 同为 `v2.9.0-local.12`；无 push/PR/线上发布。GLB 2,693,760 bytes，SHA256 `0d4cd3774827a9c84338f86406016882471bf64e12e731d4eae4528a80b85940`。仓库生成器就是 worker 实际执行的 `build_neck_blend.py` 内容，SHA 及 canonical CC0 来源在 provenance。

- 人物：手掌与手指骨架按同一人体的实际位置拟合，原生皮肤权重有效；头部下缘精确裁切，局部颈部权重与身体匹配，避免头部独占权重造成侧面皮肤翘片。平滑发际和眉毛，保留真实高低几何。
- 球衣：原创前后片/肩带 quad 网格，明确领口、两个袖口和下摆的四个边界循环；按同一人体表面拟合与归一化局部权重，包含织纹 UV。号码直接混合到球衣表面，修复平面贴片在背面被身体遮住的问题；经典版仍用旧模型/贴片。
- 动作：基于实际手掌表面校准球半径，考虑骨骼非均匀缩放；手腕、手臂、手指共同参与握球，离手后松指。上篮最高持球点从 7.1 调至 6.8 ft（运动员局部坐标，不是离地最终高度），避免超出可达范围。停步不再误转向 atan2(0,0)，回到面向比赛；小幅转角圆滑与加减速重心；左右防守动作同样混入站立姿态。

最终检查在 SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-20261010/`：

- `unit-v11.log`：19 个顶层测试通过，原 222 内部用例 + 新增 15 个独立用例。之后运行代码未再变化，仅 GLB 颈部修正与 QA 脚本补查。
- `smoke-v11/report.json`：10 主关、随机连续挑战、战术 Watch/Walk、错误选择/示范、150 秒超时、退出和手机检查，failure 未出现、errors=[]。测试加载颈部修正前的 v11 模型，不冒充完整 v12 冒烟。
- `regression-v11/report.json`：静音、退出取消迟到语音、30 次场景资源持平、接球/篮网与 2D 输入通过；运行代码相同，模型颈部随后补查。
- `athlete-v12/report.json`：24 组左右手掌/五指在高低档的有效权重与真实皮肤位移通过，最少 42 个有效顶点；颈部 514 个低位顶点有非 Head 骨骼混合。不是全表面接触/碰撞证明。正面/侧面/背面近景已实际查看。
- `mobile-refinement/neck-blend-poses/`：最终模型 14 原动作的 25% / 50% / 75%，42 采样姿态已查看；不是全连续动画验收。
- `finishes-v12/report.json`：第 1/2/4/6 关上篮/跳投、Shot 不被 Catch 覆盖、球的取景与临近离手手掌目标误差 < .08 ft 通过。前一最终运行代码样本最大约 .0191 ft；只证明虚拟掌心球中心接近目标，不证明每根手指都贴球或无脚滑。
- `presentation-v12/report.json`：最终模型默认、新旧身份尺寸稳定、真实 LOD、球馆视线、出手取景、回全景、三分与手机布局通过。
- `slice-v16/runtime-report.json`：最终 v12 断网重开 loaded=true、online=false，errors=[]、外部 requests=[]。同场景高/低 1,067,258 / 424,162 triangles，均 268 calls；桌面计数，不是真机性能。

代表回合：`slice-v16` 的突破分球与 `pullup-v12` 的挡拆急停。最终压制在 worker `proof-v12/`，镜像 SSD 同名目录；H.264 + AAC 48kHz 双声道，10.933 / 10.139 秒，保留原 VP8/Opus。MP4 SHA 分别 `6ba504fd90136a2773a88d3b1b954edd716ab4ec721226f42fe97b0b98ec25af` / `de29aeff5e783ce71a43da2609781a4e2af2d0b64abc527a7ef4393abbf92ba5`。最终视频的密集采样帧已查看；声音沿用现有最终混音，未新生成配音/音乐，未实际听审。正常速度可在本地对比页播放；独立持续 1x 观察与 Owner 判词仍待完成。

失败保留：`mobile-refinement` 的 anatomical-jersey v1–v3 切袖口后出现外侧面、panel-jersey 未贴人体导致露肤、game-jersey 侧面颈部翘片，以及 `finishes-v10` / `finishes-palm-wrist` 的上篮目标仍高于手掌可达范围。改动在实际近景与回合中验证后进入 local.12，未用机检合格替代审美。

下一步仍是皮肤/头发/球鞋、专门篮球动作的重心与衔接、脚步接触、镜头与真实听感。整体 NBA 2K Mobile 品质、iPad Pro/普通 iPad 的持续性能、触控与音频未验收。

本轮游戏代码已本地提交 `7ed3bd8`，工作区干净，无远端操作。共享媒体仓库 `relay.sh out` 的证据/存储闸门通过，落盘闸门仍被无关 EP03/health/缩略图修改与 NOW 更新时间挡住；未修改、提交或清理那些文件，也未声称共享媒体交接成功。游戏的交接与证据独立保存在本仓库和上述 worker/SSD 路径。


## 最新 local.16：持续视听目标（2026-10-11）

Owner 新持续目标「继续 我要看到最好的视听效果 中间不要停」，goal ACTIVE。当前不是完成验收；继续向 NBA 2K Mobile 的整体观感推进。模型仍为 local.12 的 canonical CC0 派生，未新下载或生成音频；素材库 skin/basketball 查询没有得到合适皮肤纹理/篮球 mocap，批准来源登记也未含 MakeHuman/CMU，因此没有绕过来源政策取用。材质细节由原创运行代码生成，不是摄影皮肤贴图。

实现：

- 主镜头俯角约 23°，按实际球员身体、开场跑位和所有决策点取景，出手推近保持同一球场侧，不再在回合中反转球场方向；竖屏单独适配。经典版保持原有路径。
- 原创 `athlete-surface.js`：微弱不规则皮肤/短发细节随像素覆盖衰减，避免远景摩尔纹；少量皮肤清漆层，鞋底/鞋面分区。仍未达到真实皮肤、毛发、球鞋资产品质。
- 离手后的手腕转动限制在 .45 rad；指骨恢复与先前握球层每帧还原，避免累积。落地音使用鞋底顶点校准的接触点，经过起跳后只触发一次轻微鞋声。
- 比赛混音与教练声分路：教练播放时压低比赛音效，结束/取消后平滑恢复。新混响加入可控早期反射；`hoopsSound=legacy` 保留旧的混响/无音效压低逻辑，以便比较。两版仍使用现有 CC0 SFX 与现有教练声。

本轮 SSD 证据：

- `unit-serial-v14.log`：21 个顶层、239 个内部/独立用例通过。并发第一轮 `unit-v14.log` 的 Chess 深搜耗时用例失败，未改门限，串行复测通过。
- `read-targets/report.json`：全部 20 原始/镜像题型的真实最佳目标点击及评分通过；并非直接调用 choose 凑分。先前 `catch-sag` 镜像最佳点 y=845.924，球场底部 y=804，确实不可点；修正覆盖真实路径/目标后通过。第一次报告/图在复跑时意外被覆盖，失败控制台保留，具体数据由真实 tool 输出恢复在 `read-targets-first-failure.json`，不冒充原始文件。后续 QA 输出须使用独立目录。
- `smoke-final-v14/report.json`：10 主关、连续随机/战术 Watch/Walk、错误/示范/超时/退出/手机完整流程通过，errors=[]。早期 `smoke-v13` 在随机题点击后超时，保留失败。
- `audio-natural/report.json`：隔离真实教练源，以校准信号测量比赛总线实际输出 RMS：正常约 .007427、说话时 .004083、自然结束 .007191、取消后 .007421；证明输出压低与恢复，不是主观听感。
- `regression-final/report.json`：最终运行代码的静音、退出取消语音、30 次资源持平、接球/篮网和 2D 输入通过。
- `same-side-finishes/report.json`：四个实际终结的准备/取景/持球目标与一次落地鞋声通过。早期 `landing-first` 用踝骨导致没有落地事件，保留；鞋底点修正后最终触发位置低于 .12 ft。是参考接触点，不是所有鞋顶点完全无穿透证明。
- `same-side-presentation/report.json`：身份、几何 LOD、球馆视线、出手/回全景、三分与手机布局通过；同侧推近的关键帧已查看。
- `athlete-v15/report.json`：材质层后的高低档手掌/五指实际皮肤响应与颈部混合通过，三面近景已查看。
- `arena-v16/runtime-report.json`：最终 v16 断网重开 3D loaded=true，online=false，外部 requests=[]、errors=[]；包含最新 shader 模块预缓存。

最终 AV：worker `/srv/ai-data/media-work/projects/caesar-hoops-20261011/proof-v16` 与 SSD 同名目录的 `arena.mp4`。新旧混音对照在 `proof-v15/arena.mp4` / `legacy.mp4`：相同随机种子/相同回合/同一最终输出节点，真实执行时长有差异，不是逐采样严格盲测。原 VP8/Opus保留，展示 H.264/AAC 48kHz 双声道；逐帧采样用于动作检查，不能等同持续原速审美观察。

尝试把真实最终混音送入原生音频工具，返回「audio content omitted because you do not support audio input」。因此实际听审仍未完成；不能以波形、增益或转录代替。普通 iPad / iPad Pro 与 Owner 品质验收也未完成。下一步继续人物脸部/表面、专门篮球动作和观众细节，持续目标不收缩为当前技术检查点。
