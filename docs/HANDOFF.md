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
