# NBA 动作与场馆复查 — 2026-10-11

Owner 最新判断：球场、环境、观众席和灯光仍过于简陋，离 NBA 2K 很远；动作要以真实球员录像为参照。接受这一判断。整体目标继续 ACTIVE，不能把新模型、截图或功能测试当成美术验收。

## 实际研究与边界

已检索 NBA / Jr. NBA 官方来源，并在浏览器打开参考。没有下载 NBA 录像作为游戏资产，没有上传项目内容，没有复制球员扫描或专有动作数据。

- [Klay Thompson: Shoot with great form — NBA India](https://www.youtube.com/watch?v=8-7JVqPlUJ4)：播放器显示 104.621 秒；实际观察到 25 秒人物全身与 52 秒脚部近景。52 秒帧显示双脚有前后错位，脚尖方向与膝部准备姿态应联合判断。63 秒跳转出现播放器错误。没有完整观察一次出手周期，不能填写起跳、离手、落地的帧数。
- [Brunson: elite footwork — NBA 官方](https://www.nba.com/watch/video/how-jalen-brunsons-elite-footwork-made-him-an-all-star)，[官方 YouTube](https://www.youtube.com/watch?v=Cy-J2WS5CAU)：浏览器实际取得约 30 秒跑动帧；90 秒跳转等待卡住，保留访问失败。该帧不足以量出急停重心和脚掌接触，尚未据此重烘焙动作。
- [Jr. NBA Rookie 训练计划](https://jr.nba.com/basketball-practice-plans/rookie/page/4/)：官方文字给出右手上篮的右、左两步及左脚起跳，并指出双脚力量上篮是另一种动作。用来区分我们的基础上篮与双脚跳投，不能用所有终结共享双脚 Shot 再抬右膝作为完整动作解法。
- [NBA 2K Mobile 官方商店页面](https://apps.apple.com/us/app/nba-2k-mobile-basketball-game/id1252850847)：浏览器实际检查官方 01、02、05、06 图片。01 是卡片 UI；02 与 06 是被宣传人物/文案遮住一部分的比赛画面；05 是对阵画面。不能把宣传人物大特写当成未遮挡的运行中细节或拿主机版代替 Mobile。06 可见完整坐姿、腿部和座椅关系，人物的皮肤/衣物/头发材质仍明显优于本项目。

本次参考截图与失败在 SSD `crowd-head/`。浏览器观看是研究证据，没有将版权不明的下载素材装入游戏。canonical 库已按 policy/preflight/search 检查，basketball footwork 查询只找到插画、字体和图标，未找到可用篮球动作。`nba-public-commentary` 例外的范围是原有篮球解说频道，不能自动扩张成游戏素材许可。

## 当前动作诊断和制作顺序

现在模型仍保留 Quaternius 的 14 段动作。运行层有脚步稳定、路径朝向、速度适配、握球、有限手腕跟随及上篮右腿覆盖；这些修正不是专门篮球动作的替代品。

尤其 `layupStride()` 在通用双脚 Shot 上提升右腿，尚未导入专门左脚蹬地的原始动作。因此下一次 Blender 动作工作要先拆基础右手上篮：收球、右脚跨步、左脚支撑蹬地、右膝抬起、单手离球、落地；另做接球跳投的双脚准备与出手。先获取完整可观察的动作周期，记下真实时间与关键姿势，再制作原创骨骼曲线，不凭名字或一张帧图伪造测量。进入游戏后同时核对脚掌停留、髋部重心、持球与离手时刻；功能评分与美术质量分别记录。

## local.18 场馆试版

本轮从实际整体截图定位三面直排看台的黑色转角空洞、长方体座椅、无腿观众和过强单色重复。增加转角看台、后方/对侧上层看台、包厢开口与局部暖色亮线；将座椅分成坐垫与靠背；前几排补完整坐姿腿部。中性环境顶光和较灰的座椅减弱蓝色重复。

Blender 已批准人体衍生的 9,808 字节头部进入第一排，低画质使用球体头，远排保持便宜轮廓。三角度近景已观察：候选有鼻、耳、下巴，仍有明显简化面与光滑度缺陷，不能说成写实观众。来源、输出 SHA256 与 builder 在 `assets/hoops/crowd-head.provenance.json`，大型来源仍在 canonical worker，仓库只装运行 GLB 和小脚本。

第一版约 1,838,906 / 708,020 三角形，高低档 288 calls；没有接受这个成本增长。减少上层人物密度、仅第一排用细头、仅近排补腿后，同一测试回合约 1,317,245 / 562,040 三角形，288 calls。此前 local.16 约 107 万 / 42 万 / 268 calls，场景与取景会影响计数；新球馆仍有额外成本，不能推断普通 iPad 流畅。

试版没有解决以下明显差距：球员身份/脸/毛发的真实细节，观众身体多样性，接球、急停、上篮的专门动作，场边球队替补/工作人员，以及材质与动态灯光整体层次。上层包厢常在比赛主机位画幅外；结构存在不等于主画面有相同幅度提升。继续以实际回合为准，而非不断堆场外物件。

## 验证

SSD 根：`/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/`。

- `arena-v17-presentation-first/` 保留昂贵第一版，主机位无遮挡、身份/LOD、投篮保持画内和返回、手机布局通过。
- `arena-v17-presentation-trimmed/` 保留缩减版，同样通过；不能覆盖前版。
- `arena-v17-unit-serial.log` 全部 21 个顶层测试通过。后续仅座椅色与版本改动没有重复全量单元测试。
- `arena-v17-regression/` 静音/取消语音、场景回收和 2D 实际输入通过。
- 最终 local.18 的当前回合、缓存/离线与高低档检查在 `arena-v18/`：errors 和外部 requests 为空；相邻关卡高低档为 1,315,709 / 560,504 面、276 calls；六次重建 geometries=80、textures=128 稳定；离线 3D loaded=true、version=v2.9.0-local.18、online=false；手机未溢出。`proof-v18/arena.mp4` 已 native CPU 导出 H.264/AAC，SHA `32b6c862e708a98baf1970ea3dc9c8cc66df3313bf4a98b1e39257df7b95b512`；观察了回合采样条与最终比赛截图，仍不构成连续视听。

没有实际音频听审、独立连续 1x 审美验收、iPad 真机或 Owner 品质通过。未上传 GitHub。

## local.26 场边结构与灯光检查点

Owner 仍认为球场、环境、观众和蓝光简陋，NBA 2K Mobile 整体目标仍未达成。当前改动仅在 `codex/hoops-local` 本地，未 push/PR/发布。默认加入首排完整坐姿人体、球队替补席、记录台/显示器/场边摄影器材/饮水设备；首排座椅改到适合人体的高度，远排保留轻量模型。球馆顶光/补光/轮廓光偏中性，环境强度降低；地板保留批准的木纹来源，降低法线起伏，增加原扫描纹理对比并调整清漆。`?hoopsVenue=legacy` 对照此前场馆，当前球员/动作相同。

人体库已按 canonical policy/preflight/search/resolve 查证：CC0 Blender Human Base Meshes v1.4.1，`blender-human-base-meshes:3c121505651140ce`。通过既有批准运动员 GLB 烘焙三种原创坐姿与高低网格，native CPU Blender v7 输出、许可、canonical 路径、SHA256 在 `assets/hoops/seated-audience.provenance.json`。没有下载 NBA 游戏资产、扫描球员或提取动作，也没有上传私有项目。

试验不是一次成功：v1 因骨名 Head 大小写失败；v3 首排鞋/腕破面且约184万面；v4 修腕朝向/保留鞋；v5–v6 加袖口后仍像肩垫、服装连接差，最终撤回袖口；v7 远排放大导致细长手臂/悬空头部，撤回远排比例。所有 worker 构建脚本、日志和 SSD 捕获保留。当前三种姿态仍用同一人物基础，近景衣服/皮肤/脸部明显粗糙、同质化，不能标美术通过。

首排/替补模型按姿态合并材质几何，以原创建色 shader 提供皮肤、衣物、头发、眼睛/鞋的调色；高档少数首排/替补用细网格，其余使用完整低网格。低档切换真实网格；高档低网格单独分组，不再缩到0却照样提交其全部面数。功能检查与美术品质分别记录。

最终 SSD `/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/arena-v26/`：`check-v8/` 新旧同关截图通过载入检查、无 pageerror；相同视图旧约131.66万/56.14万面，新约171.89万/84.94万面，293→323 calls。增加成本仍是风险，不能从桌面推断 iPad 性能。`presentation-v8/` 通过实际 LOD、10名球员视线无遮挡、跳投持续在画内和镜头返回、手机无横向溢出；`finishes/` 四种终结通过；`motion/` 两个片段的实际鞋面和掉帧恢复通过；`unit.log` 21个顶层单元测试串行通过。

`runtime-v8/runtime-report.json` 保留实际回合、6次重建资源、v26带 LayupR/JumpShot/首排坐姿的3D离线重开、手机布局与外部请求检查。没有独立连续1x审美观察、实际音频听审、iPad/Owner美术验收。下一步应改真实衣物/人体材质、多样性和比赛主机位中可见的场馆光照/地板反射；不要继续只堆场外几何。

## 同期独立跳投

`jump-shot.glb` 新增1.3秒原创 JumpShot：加载/双脚起跳/随球瞄筐/跟随/屈膝落地；上篮仍使用 LayupR。按回合时钟定位和已有实际鞋底支撑，修正起手掉帧时旧姿态混合。射手头部新增有限俯仰瞄筐，非射手的目光不追到地板。动作基本顺序参考 [Jr. NBA jump shot](https://jr.nba.com/how-to-shoot-a-jump-shot/)，时长曲线原创；不能说NBA mocap或完整录像测量。source/output/builder SHA在 `jump-shot.provenance.json`。此前皮肤AO候选留在 SSD `jump-study/skin-after-fresh`，没有替换当前人物，也没有宣称它解决写实材质。

最终带声音回合与此前场馆对照均已 native CPU 导出：worker/SSD `proof-arena-v26`，new.mp4 10.833333秒、H.264/AAC 48kHz双声道，SHA `5e9f64fc0ae73421acd05b63a8f185f46ca3fb18b7475238a8a686c0e8e279ea`；legacy.mp4 10.797秒，SHA `c8bd339ba35a70294390dd57960adbdb29d905a934c3d1e5be2d08ccff10a57f`。相同种子/关卡/动作/混音，场馆参数不同，真实执行时长略不同。review 页两段实际readyState=4及尺寸/时长已核对，仍不能声称持续1x或听审通过。页面沿用 `/review/hoops-nba-20261010/`，本机8000服务器需实际存活。重复场馆检查入口 `scripts/hoops-venue.mjs <SSD输出目录>`，其余 motion/presentation/finishes 入口不变。

## local.27：实时地板反射

Owner 的NBA 2K Mobile整体目标仍ACTIVE/未达成。新增原创 `floor-reflection.js`：使用镜像相机与地板斜裁切面，仅反射实际球员/篮球/篮架/篮网，保留原PBR木纹与涂装，透明空像素不覆盖地板。算法入口参照 [Three.js 官方 MIT Reflector](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Reflector.js)，使用当前本地 r186 引擎，不增加外部媒体资产或上传项目。球员反射通道使用当前骨骼姿态的低档网格，完成后恢复主画面档位；每次主绘制只做一遍反射，两个半场共用目标。高/低目标宽512/256、按画幅设高，五点柔化、有限强度与视角变化；支持 `?hoopsReflection=off` 的同场对照。

近景按强度0/.22/.32/.44和清漆三档分别比较，默认强度.32、清漆.16/粗糙.4/基础镜面.12；降低禁区大块环境高光并保留局部人体倒影。没有把光泽提升当写实人物通过。截图与失败首检查在SSD `reflection-study/first` / `close`：first的passed=false只因为把已知的Playwright禁SW/音频启动警告计入失败；无pageerror/Shader Error，原记录保留，正式检查区分警告。

真实GPU像素检查入口 `scripts/hoops-reflection.mjs <SSD输出目录>`。最终 `reflection-study/physical-final`：两位置×高低档的可见球倒影相对物理镜像射线的加权像素质心误差0.57–1.43px，世界投影UV误差约1e-16；完全低于地板的球产生0个改变像素。不是只检查matrices存在。每次主render反射更新1次，主球员LOD和renderer背景/clearAlpha/shadow/XR/RT/autoReset恢复；6次重建几何/纹理123/220稳定。texture计数包含骨骼数据和反射目标，不能当新增外部图像张数。

同一视图总绘制：关闭反射318 calls/1,719,518面，开启443 calls/1,838,324面；低档850,097→968,903面。额外125 calls/118,806面仍有成本，不能从三角形小幅增长推断iPad流畅。首次单独桌面采样rAF约16.7ms、CPU提交中位数1.5→4ms；最终同时跑其他浏览器检查时2.6→8.6ms。两者均不是GPU计时、实际掉帧统计或iPad结果。

21个顶层单元测试串行通过；最终 `presentation-final`取景/身份/真实LOD/10名球员无遮挡/跳投返回/手机布局通过；`regression`静音、退出、GPU资源回收、2D输入等原有检查通过；`finishes`四种真实终结通过。`runtime-on`与`runtime-off`为同种子L2/当前灯光/动作/混音的完整带声回合；on重新断网进入v27的3D并反射更新196次，off启用=false/更新0；两者pageerror/外部请求为空。on六次重建geometry120/texture220稳定，手机无溢出。

仍无连续1x审美观察、实际音频听审、iPad或Owner品质通过。人物、观众衣物/皮肤/身份仍明显落后于目标。下一步优先真实人体材质与衣物/身份细节，不靠反射掩盖几何/动作缺陷。

最终worker/SSD `proof-reflection-v27` 已导出 H.264/AAC 48kHz双声道：on.mp4 10.947333秒，SHA `5184f29dc66ef5d5136857bb3e9f629399ec21cfb17f5d885ebf238c4994d007`；off.mp4 10.900秒，SHA `e71bd197aad1cf3cb291dd7dfbfdb321e487fc7e5bb6f6432f761c26bcbfe891`。native CPU recipe `reflection-study/export.sh`；观察了3fps/6×6帧板（末3格是布局空格，不是影片黑场）与最终比赛图，不是持续1x/实际听审。原本地review URL已更新local.27，头两张图加载成功、两段实际readyState=4及时长已查；app面板打开请求返回queued，不能说用户已看到。

另通过真实 `.hp-view` 按钮取得球员视角的 on/off 近景，位于 `reflection-study/pov/`，未隐藏球员、未用隔离单人物画面冒充实际比赛。已观察：局部人物倒影更清楚、没有整体发白；上方场馆黑墙、人物/观众身份与衣物仍明显简陋。review页加入这个实际角度，继续保持整体品质未通过。

## local.28 — face proportions, surface detail and visible arena structure

Local/private only on `codex/hoops-local`. `athlete-faces.glb` is a native Blender derivative of the approved CC0 athlete with four original rest-space proportion targets in both head tiers. Ten authored combinations vary jaw width/length, nasal bridge and cheek width; the original 14 skeletal clips are retained with no animated weight channels. This is not NBA likeness data, scans or mocap. Output SHA `0879e18cad41cacf7c8a97eb24b4ae30a6a6616928e8998f880303148c8a0b1f`; builder SHA `1c1ebe3ac6781ab07c7fafad1f819bbfa09d36992ed80f38b6c5a68ddcc1f2fb`.

Canonical asset policy/preflight and commercial image search preceded two controlled Commons CC0 acquisitions. The per-file Commons API license metadata, URLs and API SHA1 were independently checked against each acquired file; the approved source registry alone does not verify a particular file's license. License evidence lives at `/srv/ai-data/media-work/asset-library/licenses/commons-skin-20261011.json`. Human_Skin.jpg was inspected and retained as a reference but not used as a face atlas. `skin-micro.png` uses the observed hair-free crop from [Image skin texture](https://commons.wikimedia.org/wiki/File:Image_skin_texture.jpg), Pixnio CC0. Native CPU Blender compositor: grayscale minus Gaussian blur, authored contrast, Raw PNG. It is micro-height detail, not physically calibrated normals or face colour. Output SHA `fe18176b6d779904fd3a395980f2a3d11894c7da022fd78a5c63b850fe6d43a0`; complete canonical source and builder evidence are in `skin-micro.provenance.json`.

Original rest-space triplanar skin detail, regional warmth/roughness and physical eye/hair materials are integrated. The first periodic hair-strand shader visibly resembled waves; it was withdrawn in favour of restrained stochastic cropped-hair detail. The observed texture difference remains modest, especially in a full-court view; this does not solve realistic skin, brows, hairline or kit fidelity. `?hoopsSkin=legacy` restores the original athlete asset and surface materials.

`arena-architecture.js` adds authored trusses, catwalks, lamp housings, acoustic wall panels, upper fascia and two shared-score displays; the upper-left deck closes a missing portion of the visible bowl. Screens share a single 1024×384 canvas and update only when the actual HUD score/clock/note changes. No extra light or scene render pass is added. The [historical Jazz arena media guide](https://ak-static-int.nba.com/wp-content/uploads/sites/3/2016/10/2016-17-Media-Guide-Jazz.pdf) supports the design reference of upper-bowl auxiliary displays and fascia rings; all our artwork and geometry are original. `?hoopsStructure=legacy` restores the preceding architecture, independently of skin. The roof study is an explicitly separate camera; normal broadcast framing sees less of this structure.

Actual desktop evidence under SSD `skin-material-study/`: `faces-final-both` validates deformed head vertices in both tiers, ten distinct identities and stability after animated updates; `binding-final` validates hand/finger influences and neck blending; `motion-final`, `presentation-final`, `reflection-final` pass their respective actual contact, camera/LOD and mirror-pixel/state checks. `architecture-ui-final` uses the normal player-view button and checks HUD 90–86 / 12.4 plus updated display texture. The earlier score test incorrectly assigned a getter instead of `current`; that failure remains in `architecture-final.log`. Reproducible new entrypoints: `scripts/hoops-face-variants.mjs` and `scripts/hoops-architecture.mjs`, with the same Playwright/Chrome environment and an SSD output-directory argument.

Final 21 top-level Node suites pass serially. `runtime-new` and `runtime-legacy` have no JS errors or external requests, stable resources over six player rebuilds, no phone overflow, and actual offline local.28 3D loads. New offline load includes skin microtexture, face variant, two finish clips, seated audience and live reflection. Resource count is 130 geometries / 232 textures in the rebuild study; those textures include skeleton buffers, not just external images. Same pose/scene total high/low triangles are 1,889,116 / 1,007,204 with 453 calls; preceding structure/skin is 1,838,324 with 443 calls in this check. These are desktop counts, not iPad performance.

Worker/SSD `proof-skin-v28` retains the original WebM and failed initial export. The initial new MP4 was incorrectly encoded at 1000 fps from variable timestamps; it was replaced by an explicit native 60fps CFR H.264/AAC export. A second export's grid step refused to overwrite an existing grid; a separate retained grid recipe repaired only that output. Final new.mp4: 11.004333s, 60fps, AAC 48kHz stereo, SHA `bb22b0babb7fe85bd199b13c3bae92d359d41a3ff453852708359d747abad8a4`; legacy.mp4: 10.920s, SHA `2f04fe729c4b18603f1da6bf89df445ebabee0d42eb0ff5cad02769ed77cd5b3`. Same seed/level/actions/mix, elapsed capture durations differ. Actual sampled grid and gameplay/portrait studies were inspected; no continuous 1x or actual ear-listening claim.

The local review URL remains `/review/hoops-nba-20261010/`. Its new first five images loaded and both top videos reached readyState 4 with actual dimensions/durations. The app panel request returned queued, not confirmation of foreground visibility. Current overall quality still falls well short of NBA 2K Mobile: crowd clothing/poses/face repeats, facial anatomy/texture, material richness and animated cloth remain principal gaps. Next: native Blender casual spectator clothing and varied hair/face cohorts, first prove a close row with seated contact and sleeves, then integrate high/low batched cohorts. Retain failed sleeve/neck/remote-head studies; do not revive shoulder-pad or floating-head candidates. iPad Pro/ordinary iPad, continuous audiovisual and Owner acceptance remain pending.

Full smoke discovered an actual existing intro-camera regression in box-out (chapter 9): `_prepareAction` selected the finish close-up during the intro, and the best decision spot projected to client y≈863 below the court bottom804. `controller.js` now marks intro beats `finishCamera:false`; `court3d.js` keeps the full-play camera for those beats while preserving outcome finish shots. Actual pointer recheck puts the target at y≈578, on the canvas, and reaches review with choice0. Fresh final offline check verifies the current cached controller/court source, skin map, four real morph targets, visible box-out target and a successful normal click. Evidence: `box-debug.png`, `box-fixed.png`/log and `offline-box-final.json`. Both earlier full-smoke failures remain recorded; do not describe them as passes.

Final `HOOPS_HARDWARE=1 HOOPS_DECIDE=150 node scripts/hoops-smoke.mjs <SSD>/smoke-fixed-final` exits0: ten chapters, five Read & React rounds, playbook3/3, Chinese wrong-read/demo, real decision timeout, clean mid-intro home return (`idle`), 3D court and no phone overflow/errors. Final serial Node rerun after the camera fix also passes21 suites. Original SwiftShader startup timeout and pre-fix hardware chapter9 timeout are retained. The unchanged L2 intro has no shot, so the final camera fix does not alter the recorded L2 visual comparison. Local commercial clothing asset search returns no matches (`clothing-search.json`); next crowd clothing work should derive from the already approved humanoid or a controlled approved source, not an ad-hoc download.

## local.29 — casual spectators and actual supporting surfaces

Original connected crew-neck sleeves, trousers and flat shoes, three seated poses and baked facial proportions now replace the sleeveless sports kit in near spectators and benches. Input remains the approved fitted CC0 parent `athlete-neck-blend.glb` (SHA `0d4cd3774827a9c84338f86406016882471bf64e12e731d4eae4528a80b85940`). Canonical model resolve returned FOUND with commercial/modification/redistribution permissions. Local commercial clothing/shirt queries had no usable 3D garment; shirt matches were icons, which were rejected. No new source/download or global asset-policy modification was used. The output is project-specific, not a promoted reusable asset.

Final native CPU Blender v9 GLB SHA `8c15aeaaf5c1b575cc0e4915697d53c547aaf47e1c093ef271939cbee810ab86`, builder SHA `091a0ba96364129bf5d7c1c6b5d94c952db7c36a3b3f994ac9ceeea4e0b5405a`; complete source/license/canonical/worker receipts are in `casual-audience.provenance.json`. Original face proportion targets are baked before decimation; three hair silhouettes retain scalp coverage. Clothing is fitted to evaluated static poses, not cloth simulation or NBA mocap.

Retained trials: v1/v2 sleeves tore through skin and the inherited kit also had broken shorts/shoe fragments (confirmed in the preceding version's actual close image). Changing parent input did not cure those defects, so the input-change hypothesis was not accepted. v3's lower-body mask could remove lap hands; v4 protects arm/hand influences. Static connected sleeves, authored trousers/shoes, local skin clearance and removal of genuinely covered upper-arm skin were added. v7 changes crew neck and simplifies before fabric thickness, preserving sewn openings; actual six imported pose/tier bounds exposed 0.06–0.10ft ankle gaps. v8 closes the trouser/shoe overlap, but a hair compression exposed the scalp; v9 keeps the shell outside the scalp. All scripts, outputs and observed failures are retained under worker/SSD `crowd-clothing-study/`.

`hoopsCrowd=legacy` restores the preceding audience and courtside placement. New width/height variation keeps the lower body fixed and adjusts only geometry above the seated hip; normals and the owned shadow-depth material share the same height transform. Expanded first-row foot platforms, a moved LED barrier, flush first aisle landing and extended courtside apron provide real surfaces underneath the shoes. The original aisle step at +0.06ft caused a measured first-row sole intersection; the final landing is flush. Stand seat data are slab centres, not top faces; bench seat height and floor placement are matched to the native pose. Front-row cage rails are removed for the courtside barrier, while aisle/top rails remain.

Actual imported sole vertices, instance transforms and ray intersections with real arena support meshes are checked by `scripts/hoops-crowd.mjs <SSD output>`, in both geometry tiers: 179 visible actors, maximum absolute sole/support discrepancy 0.00204ft (~0.62mm), no JS/shader errors. This is a geometry/render check, not full physical cloth/contact simulation. Actual GPU shadow on/off capture changed 55,561 pixels with the custom height-matched depth material. High quality casts all near-audience shadows; low casts the detailed cohort only, including benches/staff. Treads receive those shadows after static batching, and the owned depth material is disposed at court destruction.

Final serial Node run passes21 top-level suites. A parallel run's existing chess deeper-search budget assertion failed while browser geometry checks were active; the failure remains and tests were not changed. Full hardware smoke passes10 chapters,5 Read & React rounds, playbook3/3, wrong read/demo, real timeout, exit and phone layout. Final presentation/LOD/sight-lines/shot framing and mirror pixel/state checks pass. Fresh final new/legacy runtime reports have no JS errors/external requests, stable six-rebuild resources, no phone overflow, and actual local.29 offline3D loads; new offline mode loads the casual model, both finishes, player face/skin assets and live reflection.

Rendering cost rose: final mirror/tiers study records total high2,619,697 / low1,273,010 triangles across colour, shadow and reflection passes,459 /456 calls. Legacy example is ~1.89m/1.01m in an adjacent same-level view. These are desktop submission counts; rAF/CPU timing is not GPU time or iPad performance. This remains a substantial iPad validation risk, not a performance acceptance.

Final worker/SSD `proof-crowd-v29` uses explicit native 60fps CFR H.264/AAC48kHz stereo: new11.122333s SHA `a16612088eee67a1a67f826550329e774bc52efc520b87c9e73b5c2f8d869578`; legacy10.977s SHA `2747bb10e752e51e1bcc02c8f09cb6bd4f0a8d15a4bed6b8228bcbcc25ca33cf`. Same seed/level/player actions/mix, real capture durations differ. Normal game views, close/side studies and the final3fps grid were observed; no continuous1x/actual-ear/Owner/iPad acceptance. Review URL is unchanged and updated to29.

Overall NBA 2K Mobile parity remains unestablished. Near faces, hair, shoe/cloth detail are still simplified; middle/far spectators remain repeated primitives. Next major visual work should improve those visible middle/far people (consider controlled authored multiview impostors for mobile cost), face/cloth richness and court lighting. Do not count tests, model hashes or submitted triangles as an aesthetic success.
# local.31 — native multiview middle/far crowd

The NBA 2K Mobile audiovisual goal remains active and unmet. Middle/far spectators now use a native CPU Cycles atlas of the existing original casual seated model: six clothing looks, three poses, eight yaw views and two pitches, 1024x1536 RGBA (1,194,740 bytes). Closest rows and courtside benches remain real 3D. Seat cushions behind the closest row rise to the same human seat height, and the atlas shader chooses the corresponding view from the actual camera. `hoopsCrowdDepth=legacy` restores the preceding distant silhouettes and seat heights; asset-load failure falls back to them. No new people source, likeness, scan or mocap was downloaded.

Canonical output is worker `projects/caesar-hoops-20261011/crowd-atlas-v2/crowd-atlas.png`; the full source/license/parent/builder/output chain is `assets/hoops/crowd-atlas.provenance.json`. Atlas V1 remains on worker/SSD: its bright repeated blue/pink figures distracted from the floor. V2 changes clothing palette and runtime brightness together, so it is not a single-variable colour experiment. Middle/far art comparison uses the same seeded level, camera and near figures, with distant representation and seat heights changing together.

SSD `crowd-atlas-study/runtime-final/report.json`: actual high 2,619,697→2,099,828 triangles, low 1,273,010→1,053,286; calls 457→452 and454→449. One instanced atlas draw represents2483 actors/high and1242/low. Geometry counts include main/shadow/reflection passes, not just model polygons. The atlas needs about6MiB decoded before mipmaps and adds cutout fill work; these counts are not iPad FPS evidence. Six player-scene rebuilds plateau, no JS/shader errors/external requests, phone no overflow. Original QA harness tried to click a hidden retry button; that failure is retained in `runtime-v2/`, final starts a fresh level correctly.

Final current-source loopback offline verification in `runtime-av-final/runtime-report.json` confirms local.31,3D,atlas,casual near figures,skin/face variants,both action clips and mirror loaded,errors/external[] and no phone overflow. Final serial Node suites21 pass in `unit-final.log`. Browser screenshots of actual gameplay, side/overhead/backside studies and the sampled final movie grid are inspected. These do not establish continuous1x/audio/Owner/iPad acceptance.

Original recording changes canvas dimensions at decide/outcome; first export retained as `crowd-v31.mp4` has changing encoded dimensions and is withdrawn from review. Final export fixes scaling/padding to850x742,60fps,H.264/AAC48k stereo,11.051s. All decoded video frame dimensions are850x742. Final SHA `5d6d8b8914de40f657dac72e01f8141112fdcf6ddcf906868f1c1674677325c5`; native worker recipe `crowd-atlas-v2/export-v31-final.sh` and SSD copy. The encoded frame rate is not a gameplay performance claim. Review first two pictures show current/preceding distant crowd; first video is this final31 recording, lower older films retain their checkpoint role.

Limitations: static seated people, repeated face/hair/body identities, low-resolution close-ups, discrete yaw/pitch transitions and cutout depth approximation. Far cheering arms from the old silhouettes are not present in the static atlas. Near facial/garment quality and player motion still need work. A continuous reaction/clapping sequence and more identities would improve atmosphere; close spectators need real geometry. Decision HUD relocation also changes court height across phases, which should be stabilized in a later layout pass. Do not call this NBA parity or completed best audiovisual output.
# local.32 — corner choice location and stable viewport

Owner reports the Drive & kick corner circle outside the court. Actual IAB dimensions were458x504. The gold floor ring already matched the receiver at22,3.5 and stayed inside even at maximum pulse; the offset circular3 badge partly crossed the projected edge. Pass-choice badges now share the receiver hit-test world position, have a gold outline, and clear that state after choices. The displayed choice no longer sits beside the player on the apron. Optional badge/gold-ring clarification was asked; the observed badge problem is fixed without claiming an unobserved ring-coordinate defect.

All play phases now reserve the score/HUD row outside the court, eliminating the decision-only aspect/canvas resize. SSD `corner-targets-v32/report.json`:six viewport sizes ×normal/mirror=12 actual taps, marker/root match, badge error max0.066px, receiver3 really gets the ball, grade3/review and stable dimensions across intro/decide/outcome/review. Additional `corner-targets-v32-floor/report.json` checks both actual floor-circle taps at the small window. Final alone21Node suites pass; initial simultaneous browser/chess-budget failure retained and tests unchanged. `corner-targets-v32-runtime` loopback offline32 reopens3D/atlas/both actions/skin/near crowd/mirror with no JS/external errors or phone overflow. Artwork remains31, no new assets/voices, and no iPad/continuous1x/audio/Owner acceptance or NBA parity. Reaction/clapping model work was only proposed before this bug report, not started.
# local.33 — explicit choice controls

Owner clarifies: cannot recall which circle, but visibility must be clear, knowing the answer still does not tell them where to tap. Add direct action buttons using the original option index/action, no grade hints: pass recipient+location, shoot label, movement label. Desktop buttons are in the coaching panel; narrow/portrait has a2x2 tray directly below the court with >=46px buttons. The camera height reserves this area during all phases; controls disable while watching/outcome. Order shuffles once per round and does not move while deciding, so grade3 is not always buttonA. Pass badges still align with receiver hit coordinates, score is outside the court, and narrow3D title/outcome overlays stay inside the canvas.

Final UI/source evidence: `action-buttons-v32-final/report.json`12 normal/mirror×six viewport cases, all four buttons fit and real element hit unobstructed, actual corner button receives/scores correctly and dimensions stable. `action-outcomes-v32/report.json`8 real touch/keyboard cases, all four exact outcomes in both languages, no grade hints/order changes. Final33 overlay bound small two-case check passes. New-buttons full hardware smoke passes10chapters/5reads/playbook3/3/wrong/demo/timeout/exit/phone/errors[]; final33 offline confirms four enabled controls and3D/current art/actions/errors[]. Current20Node suites pass, unchanged chess deeper-budget assertion fails in the full and isolated runs; earlier pre-button21-suite alone pass retained. No chess logic/tests changed and do not claim final all21 green. Small Chinese and English screenshots inspected; actual IAB2 shows33/new controls and is opened with150sec debug decision time for Owner inspection, no choice made on their behalf. Goal NBA/audiovisual/iPad/Owner acceptance still unmet; artwork31 and sound unchanged, no asset download or GitHub upload.
