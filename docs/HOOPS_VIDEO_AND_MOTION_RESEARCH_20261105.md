# 篮球动作与战术视频：研究和实现状态

## 现状

目前的比赛球员基于 Blender 官方 Human Base Meshes 和 Quaternius 的 CC0 素材改造；上篮和跳投是本项目在 3090 上用 Blender 制作的原创动作，不是 NBA 球员动捕。球馆和观众主体由程序及已登记模型组合。参见 `assets/hoops/CREDITS.md`、`athlete-arena.provenance.json`、`basketball-actions.provenance.json` 和 `jump-shot.provenance.json`。现有画面及动作未达到 Owner 的 NBA 2K 参考目标；机器测试不代表审美通过。

## 动作候选

2026-11-05 完成统一资产库 policy/preflight、commercial search 和 resolve。没有找到可直接用于篮球的动捕模型：`mocap` 商用搜索和 `basketball --type model` 均为空；普通篮球查询返回插画等不合适结果。不能因为 resolve 返回 FOUND 就不检查内容。

CMU 官方 [Motion Capture Database](https://mocap.cs.cmu.edu/) 说明动作可用于商业销售产品，但不得直接转售原始数据或其转换格式。官方 [篮球索引](https://mocap.cs.cmu.edu/search.php?maincat=4&subcat=1) 有运球、变向、投篮等；[全库索引](https://mocap.cs.cmu.edu/search.php) 的 subject 124 还列有跳投及上篮。官网特别说明手和脚趾数据可能有噪声、手指和拇指并未捕捉。是否有球轨迹、节奏质量、重定向后接触与 iPad 开销还未核实。

CMU 当前不在 GLOBAL_ASSET_SOURCES 已批准来源清单内，尚未下载、入库或接入；不得把官网许可直接当成已完成受控采集。应先通过资产库的批准来源机制核实逐资产授权、修改及 PWA 分发条件，采集和记 SHA、许可与 provenance，再在 3090 做小样和正常速度观察。CMU 是候选，非 NBA 2K 级品质保证。另有 [Quaternius 的 CC0 许可](https://quaternius.com/faq.html)，项目已有其通用动作；不能仅凭通用动作包推断它含高质量篮球动作。

## 视频导出

`scripts/hoops-video-timeline.mjs` 现在可从实际战术数据、每一步已测得的旁白时长，生成动作和旁白时间线及 SRT。动作比旁白长时保留动作结束，旁白比动作长时保留画面；每步分隔，旁白缺失或时长无效即拒绝。`scripts/hoops-video-plan.mjs` 输出 JSON 和 SRT，拒绝覆盖已有文件。

它只是导出的底层时间计划：**没有生成旁白、视频画面或 MP4，也没有画面对口型或逐字字幕**。输入必须使用通过质量门的各步音频实际时长。此前 `research=true` 生成的样音未过关且研究路径无正式次数上限，禁止用于成片。正式配音服务需要 episode 而独立游戏教学视频接入方式未验证；不能伪造 episode 或把研究样音当成已批准语音。

下一步在注册 3090 worker 上建立真实游戏画面采集、已通过旁白和字幕按同一时间线合成的闭环，先以牛角一套完成真实播放、同步、逐帧采样及听审证据；然后扩战术、纵横视频。需要支持失败、取消和不覆盖已有成品，iPad 与浏览器支持单独验证。Owner 视觉听觉判定之前不标生产完成。
