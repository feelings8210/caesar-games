# 独立上篮动作 — local.24

Owner 的整体目标仍是 NBA 2K Mobile 的球员、动作与比赛氛围；视听品质未达成。这个检查点完成一段原创右手上篮，不代表全套篮球动作或 NBA 品质通过。继续本地，不 push/PR/发布。

## 动作与运行链

新增 `assets/hoops/basketball-actions.glb`，83,484 字节，仅一个 `LayupR` 动作、65 个对应骨骼的 195 条轨道、1.25 秒 / 60fps 烘焙。导出的微小 skin carrier 用来保留关节树，加载后销毁，不加入场景。现有 `athlete-arena.glb` 几何保持原样，SHA `0d4cd3774827a9c84338f86406016882471bf64e12e731d4eae4528a80b85940`。

新包 SHA `90406f46c50330edb779e45813862c8cf3222257572a37344c894d63700470d8`；实际执行的 builder 与仓库 `tools/blender/build_basketball_actions.py` 一致，SHA `47da99e63272a96431eaf67821586ea720974ff2d8d1707fad8bfb1d8e693b5e`。worker 输出 `/srv/ai-data/media-work/projects/caesar-hoops-20261011/layup-study/layup-v5.glb`，出处与父文件在 provenance。沿用批准的 CC0 人体/既有骨架，没有新外部动作资产。

制作顺序为右脚支撑、左脚支撑蹬地、右膝提升、右手单手出球，左手连续离球后保持平衡；随后手腕跟随、下落与屈膝。重心使用连续抛物线上升/下降与 Hermite 蹬地/落地过渡，落地后保留压低姿势，再与原有站姿渐变恢复。曲线是原创设定，不是从 NBA 录像提取的时序或身体力学测量。

运行层按回合时间定位新动作，使它与球的准备/释放时刻一致；渐变中或渐变完成后掉帧，都不能让出球姿态还混在站姿里。水平脚位在支撑期固定，脚踝高度按实际鞋底俯仰调整；不能拿固定脚踝高度代替接地。近篮终结选择新片段，跳投继续保留原来的 `Shot`。新包不可用时仍可运行原有终结。经典/2D 数据保持原有路线。

## 研究范围

[Jr. NBA Rookie 训练计划](https://jr.nba.com/basketball-practice-plans/rookie/page/4/) 提供右、左两步与左脚蹬地的基本顺序。此前 Klay/Brunson 参考的实际观察与失败见 `NBA_MOTION_AND_ARENA_REVIEW_20261011.md`。

本轮另打开 [Layup Hi-Five Drill](https://jr.nba.com/video/layup-hi-five-drill/) 的官方播放器。观察到 25.362 秒的教练举手示范，随后播放停在约 34 秒并报错，未取得完整球员上篮周期。[Kyrie 官方 How To](https://www.nba.com/watch/video/jr-nba-how-to-series-kyrie-irving-brooklyn-nets) 在普通浏览器返回 Access Denied。没有绕过访问控制，也没有下载录像作为游戏素材。因此仍不能声称已复刻 NBA 球员动作；完整参考动作观察仍待补齐。

## 失败与修正

证据根为 `/Volumes/MiniStorage/media-projects/caesar-hoops-20261011/layup-study/`，所有候选/失败分开保存。

- v1 的鞋底在地板下约 .16ft，手腕方向还沿用旧姿态。保留 `layup-v1.glb`、receipt、`pose-*.png` 与 `capture-report.json`。
- v2 按实际 source shoe 评估后的最低点校准，修正手掌朝向；`v2/` 保存九个游戏渲染姿势。第一轮运行锚的是脚踝，俯仰变化会导致鞋底悬空，`finishes-v19-first` / `finishes-v19-diagnostic` 保留失败。
- 改为固定水平位置、从实际鞋底推导脚踝高度后，`finishes-v19-sole-anchor` 通过。前一个脚本未在断言前保存失败 case；已修为先保存 case，避免再丢诊断帧。
- v3 消除抬脚开关和左手切换造成的突变；v4/v5 将重心改为连续腾空与落地缓冲。各 builder、GLB、receipt 与测试目录保留，当前只安装 v5。
- `layup-v20/runtime-audit.mjs` 首次剪掉声音回归步骤时，也剪掉了回主页的动作，第二次点首页按钮超时。它的已录录像/报告保留；后续明确回主页，再检查离线。此失败不是游戏首页失效。

## 已验证与未验证

- `unit-v22.log`：最后运行层改动后，全部 21 个顶层 Node 测试通过。之后只有动画数据、落地支撑窗口和构建号调整；相关最终浏览器检查如下。
- `motion-v24/report.json`：匹配当前角色所有轨道；高低画质实际鞋面顶点检查，75 帧取样没有明显穿地、能够腾空并返回地板；接触标记跟随实际鞋面。渐变完成后和从站姿起手期间模拟掉帧，实际鞋面均进入腾空出球姿势。
- `finishes-v24/report.json`：第 1/6 关使用 `LayupR`，第 2/4 关仍用 `Shot`；两步支撑、地面固定、晚期手球误差、出球后腾空、单次落地声、完整球轨迹在画内通过。已观察四关 gather 截图。
- `layup-v24/runtime-report.json`：errors / 外部 requests 为空；离线重开 v2.9.0-local.24、3D loaded=true、LayupR=true；六次场景资源为 geometries=80、textures=128；高低档 1,315,709 / 560,504 面、276 calls，人物几何和场馆负载未因动画包增长；手机无溢出。
- `layup-v21-legacy/`：只在 QA 上下文禁用新片段，实际记录准备期均为 `Shot`；保持当前场馆、镜头和混音，作为原有“跳投加抬腿”对照。与新录像的真实时长略有差异，不是逐样本盲测。

视频与新旧对照在 worker/SSD `proof-layup-v24/`，已 native CPU 导出 H.264 / AAC 48kHz 双声道。新 10.867 秒、SHA `7af1e2458e02ee9d1ed3ee41663ddba0001714bccfe0dad116d8404997ea5c51`；旧 10.797 秒、SHA `17464754710d83594d0c6867f20399ff6ccd42b98348e3819dd298efffff6ad6`。实际观察了新回合的 12fps/24 帧动作采样条与更新后的对比页。游戏渲染截图与采样检查不等于持续 1x 观察，音频输入能力此前已明确不支持，不能写已听审。iPad Pro/普通 iPad 的型号、长期帧率/触控/声音与 Owner 审美仍未验收。

## 下一段仍须推进

接球急停与双脚跳投仍是通用动作，要继续制作专门的重心与脚步，并核对离手高度和瞄筐姿态；当前没有左手终结。人物脸部身份、皮肤/头发/球鞋细节、前排完整观众与场边人物、场馆材质灯光层次仍有明显差距。下一代表回合应同时提升这些可见问题，不停在数值接触合格。继续补真实参考周期与真机/实际听审证据；整体 goal 保持 ACTIVE。
