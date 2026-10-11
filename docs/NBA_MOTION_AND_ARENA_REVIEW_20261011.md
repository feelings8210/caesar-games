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
