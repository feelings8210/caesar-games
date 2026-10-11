# Hoops IQ：Blender 使用决策（2026-10-10）

Owner 已明确目标：**NBA 2K Mobile，优先球员、动作与比赛氛围**。本轮请求是研究是否应使用 Blender。结论：将 Blender 作为人物、服装、篮球动作和轻量模型的制作工具，继续由现有 Three.js / PWA 负责交互与实时比赛；当前证据不足以要求重写游戏引擎，也不足以宣称达到目标。

## 研究时检查点与后续落地

后续制作已进入 `v2.9.0-local.12`，球衣、手部与颈部修正已安装；最新证据与未验收项见 `NBA_LOOK_PROGRESS_20261010.md` 的 local.12 章节。以下保留研究时的 v9 检查点与失败，不能作为最新运行状态。

本项目已经使用 Blender 5.2.1 CPU，生成器是 `tools/blender/build_arena_athlete.py`。当前正式本地模型仍是 `assets/hoops/athlete-arena.glb`（v2.9.0-local.9）：canonical CC0 人体、旧素材的 14 个动作、高低几何、原创服装标识。Blender 不是尚未引入的新工具；需要提升的是人物制作与动作修整的质量。

本轮检查暴露了此前远景与姿态采样没有覆盖的缺陷：v9 的 AnatomicalBody 左右 hand 骨骼权重均为 0，部分手指也没有有效影响。改变骨骼位置不等于皮肤真的握住球。拟合手部骨架的候选已产生有效手掌权重，但这是局部绑定进展，尚未通过完整回合接触验收。新球衣的第三次候选近景仍有明显肩部破面，不能安装到游戏资产。

证据目录：`/Volumes/MiniStorage/media-projects/caesar-hoops-20261010/mobile-refinement/`。

- `hand-weights.json`：v9 hand_r / hand_l 的 maxWeight=0、count=0。
- `anatomical-jersey-v3.json`：候选手掌 maxWeight=1；检查脚本对应阈值下左右 count=204 / 202，不是全部手指接触或全动作通过。
- `anatomical-jersey-v3.png`：已查看，球衣肩部/袖口破面，候选退回。其 GLB SHA256：`20066cfd070509491cd1dfe5af06633b15720b574dd807c945b3b0f20342094e`。尚未确定全部成因，不将猜测写成诊断。

当前工作区的握球、停步朝向、路径转角、材质等源码调整仍属实验，未随新模型发布。全量 `node --test tests/*.test.mjs` 19 个顶层测试通过（既有 222 个内部用例与新增 15 个独立用例）；不代表浏览器、连续动作、听感或真机合格。v9 的原有离线/回归记录不能代替这些新修改的验证。

## 制作与运行分工

| 工作 | Blender | 游戏代码 |
| --- | --- | --- |
| 人物和服装 | 修比例、脸部、颈肩接缝、领口袖口拓扑；让骨架贴合人体，逐处检查与修整权重 | 身份差异、队色、名字和号码 |
| 篮球动作 | 制作/修整接球、急停、转身、跳投、上篮的关键姿势与节奏；修脚掌触地、髋部重心、手指握球；导出动作片段 | 按决策切换/混合片段，适配路径和速度；实时手球、脚地接触修正 |
| 表面细节 | UV、皮肤和布料材质，烘焙法线/粗糙度/AO；高低模型保持轮廓 | 实时灯光、阴影、曝光、实际屏幕上的材质表现 |
| 球馆 | 可制作关键篮架、座椅或场馆细节 | 球场坐标、镜头、看台实例、进球反应 |
| 比赛和声音 | 不承担当前游戏逻辑与声音系统 | 触控、教学、球轨迹、计分、音效事件、混音、缓存 |

官方 glTF 文档说明可以导出对象变换、骨骼姿态和形态键，以及受支持的 PBR 材质；其他动画属性如物理、灯光、材质动画会被忽略，Area light 和 World lighting 也不随 glTF 导出。因此不能用 Blender 渲染出来的漂亮影片代替浏览器中的游戏证明。控制骨架/约束的结果需落实到可导出的姿态；球与服装的交互也需在本项目运行链中验证。[Blender glTF 官方手册](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)

Three.js 官方明确给出 Blender → GLTFLoader → AnimationClip / AnimationMixer 的路线，并支持动画淡入淡出、混合、变速和同步。当前技术栈具备承接这些资产的基础；本轮不建议仅为采用 Blender 而迁移引擎。[Three.js 动画系统](https://threejs.org/manual/pages/animation-system.html)

Blender 官方也说明自动权重可能产生非预期形变，需要手动修正。我们的失败样本与这个风险相符；“没有未绑定顶点”不是美术或关节形变合格的标准。[Blender 骨架绑定手册](https://docs.blender.org/manual/en/5.0/animation/armatures/skinning/parenting.html)

## 面向 iPad 的路线

先用高模制作脸、布料和球鞋细节，再烘焙到运行用的轻量模型，不继续靠细分所有球员增加细节。Blender 官方列出向游戏引擎输出贴图、烘焙 AO 与光照贴图的用途。[Blender 烘焙手册](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html)

现有 v9 某同场景高/低采样约 107 万 / 40 万三角形、268 次绘制调用（见 NBA_LOOK_PROGRESS 的 slice-v13）；这是桌面计数，不能据此推断普通 iPad 的流畅度。需要分别测模型、阴影、分辨率和观众的成本，让重要球员优先保留细节。

建议验收目标是 iPad Pro 尽量稳定 60fps、普通 iPad 在合适画质稳定至少 30fps；这只是待测目标，型号未知，尚无性能保证。Apple 的性能文档强调逐帧 CPU/GPU 耗时、帧间稳定性与不同设备上的测试。该文档针对原生 Metal，不能把其 API 或硬件能力直接套到本项目 Safari/WebGL。[Apple 图形性能文档](https://developer.apple.com/documentation/metal/improving-your-games-graphics-performance-and-settings)

## 下一段可检验的交付

1. 一个原创球员：正面/侧面/持球近景，领口肩部连续，手指实际带动皮肤，服装随抬臂与屈髋正确形变。保留失败对照。
2. 约 10–15 秒游戏内接球 → 急停 → 跳投 → 落地回合：远景和近景都看，按正常速度检查重心、衔接、脚滑和手球接触。球声、鞋声、篮网和观众反应按真实事件同步，并实际试听。
3. 同一回合的高低画质与真机检查：iPad Pro / 普通 iPad 的持续帧耗、触控、声音、后台恢复和离线。先证明代表回合，再扩全部球员与动作。

目标是接近 NBA 2K Mobile 的比赛观感。其官方商店页面可作产品参考；未得到其模型、动作资产或内部制作信息，不把 NBA 2K 主机版的 ProPLAY 技术当成 Mobile 的已核实方案。[NBA 2K Mobile 官方商店页](https://apps.apple.com/us/app/nba-2k-mobile-basketball-game/id1252850847?platform=ipad)

全程继续本地分支开发。大型 .blend、贴图与候选留在 worker/SSD；新素材仍按 canonical 资产库 policy → preflight → search/resolve → 受控 acquire，留许可、出处、SHA256。此次研究只读取官方文档，没有新下载、采购、上传项目素材或推送 GitHub。

访问限制：2K 官网 Mobile 页返回 403；部分 Blender 官方页面直接打开返回 402，相关内容由工具返回的官方搜索索引取得。未将失败访问写成看过官网比赛录像，也未据此判定审美已达标。
