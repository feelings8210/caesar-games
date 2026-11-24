# 篮球动作与战术视频：研究和实现状态

## 现状

目前的比赛球员基于 Blender 官方 Human Base Meshes 和 Quaternius 的 CC0 素材改造；上篮和跳投是本项目在 3090 上用 Blender 制作的原创动作，不是 NBA 球员动捕。球馆和观众主体由程序及已登记模型组合。参见 `assets/hoops/CREDITS.md`、`athlete-arena.provenance.json`、`basketball-actions.provenance.json` 和 `jump-shot.provenance.json`。现有画面及动作未达到 Owner 的 NBA 2K 参考目标；机器测试不代表审美通过。

## 动作候选

2026-11-05 完成统一资产库 policy/preflight、commercial search 和 resolve。没有找到可直接用于篮球的动捕模型：`mocap` 商用搜索和 `basketball --type model` 均为空；普通篮球查询返回插画等不合适结果。不能因为 resolve 返回 FOUND 就不检查内容。

CMU 官方 [Motion Capture Database](https://mocap.cs.cmu.edu/) 说明动作可用于商业销售产品，但不得直接转售原始数据或其转换格式。官方 [篮球索引](https://mocap.cs.cmu.edu/search.php?maincat=4&subcat=1) 有运球、变向、投篮等；[全库索引](https://mocap.cs.cmu.edu/search.php) 的 subject 124 还列有跳投及上篮。官网特别说明手和脚趾数据可能有噪声、手指和拇指并未捕捉。是否有球轨迹、节奏质量、重定向后接触与 iPad 开销还未核实。

Owner 2026-11-05 明确授权按需下载入库；已在 GLOBAL_ASSET_SOURCES 登记限定篮球 ASF/AMC 的 CMU 来源，并经 asset_acquire_3d 入库；来源现暂停再次采集，避免默认客户端证书链缺失时再次走 HTTP。CMU 原站 HTTPS 证书链在 worker 和 Mac 上校验失败，原站 HTTP 可访问；以下原文件从 HTTP 获取，SHA 只证明入库后的字节一致性，不证明传输真实性。随后从 Let’s Encrypt 官方获取中间证书并使用系统根证书完整验证 HTTPS（hostname 与 CA 校验启用、partial-chain 禁用），五份 HTTPS 内容与入库 SHA 全部相同，证据 `/srv/ai-data/media-work/asset-library/evidence/cmu-basketball-mocap/https-verification-20261105.json`；条目解除传输隔离并标记商用产品可用。原始数据不得直接转售，PWA 的具体分发许可需另核；未加入游戏或公开仓库。

| 原文件 | 可用 canonical 路径（3090） | SHA-256 |
|---|---|---|
| 124.asf | `/srv/media-vault/datasets/universal-media-asset-library-v1/assets/mocap/cmu-basketball/b0/cmu_basketball_124.asf` | `b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45` |
| 124_05.amc 跳投 | `/srv/media-vault/datasets/universal-media-asset-library-v1/assets/mocap/cmu-basketball/2e/cmu_basketball_124_05.amc` | `2e129afccc684091494141e0f799b00efdd51a5ae24d07a56edc823955d5f89b` |
| 124_06.amc 上篮 | `/srv/media-vault/datasets/universal-media-asset-library-v1/assets/mocap/cmu-basketball/16/cmu_basketball_124_06.amc` | `1613604580cec72e3f71a3d4e20308c1fe335512bf66ed3ef3fbeaa17f567e44` |
| 06.asf | `/srv/media-vault/datasets/universal-media-asset-library-v1/assets/mocap/cmu-basketball/c8/cmu_basketball_06.asf` | `c84ce159666201033f757eb209ac52c1ed264f75a09421cc0dccf7ead00abb50` |
| 06_14.amc 变向运球投篮 | `/srv/media-vault/datasets/universal-media-asset-library-v1/assets/mocap/cmu-basketball/cc/cmu_basketball_06_14.amc` | `cca7915ab3b190e58326fac820f51ec0941bb264bd25e91b6b59209cf4e8f2d5` |

来源 `http://mocap.cs.cmu.edu/subjects/{06,124}/`；许可 [CMU 官网](https://mocap.cs.cmu.edu/)，商用产品可含动作，但不许直接出售数据或转换数据，原数据重分发标记 false。asset_id 用 `cmu-basketball-mocap:` + 上列 SHA 前 16 位；详情见素材库索引。CMU 是候选，非 NBA 2K 级品质保证。另有 [Quaternius 的 CC0 许可](https://quaternius.com/faq.html)，项目已有其通用动作；不能仅凭通用动作包推断它含高质量篮球动作。

## 视频导出

`scripts/hoops-video-timeline.mjs` 现在可从实际战术数据、每一步已测得的旁白时长，生成动作和旁白时间线及 SRT。动作比旁白长时保留动作结束，旁白比动作长时保留画面；每步分隔，旁白缺失或时长无效即拒绝。`scripts/hoops-video-plan.mjs` 输出 JSON 和 SRT，拒绝覆盖已有文件。

`scripts/hoops-video-capture.mjs` 是实验性真实 3D 球场录制器：每步接收已解码的旁白 AudioBuffer，在录制输出中叠加对应字幕，音频只连录制目标、不连接扬声器。捕获 WebM，不生成语音、不上传；中断会停止媒体轨并恢复球场状态。它不是最终导出界面。以每段 0.2 秒合成静音输入，实际浏览器已录出、播放并目视解码帧 640×360 WebM（SSD `capture-silent-a03`）；正式声音、音画同步、完整正常速度审片和 iPad 仍未验证。测试入口 `scripts/hoops-video-capture-smoke.mjs` 强制 `--mute-audio`，结束关闭测试浏览器。

它们还没有生成通过质量门的旁白或 MP4，也没有逐字字幕。输入必须使用通过质量门的各步音频。此前 `research=true` 生成的样音未过关且研究路径无正式次数上限，禁止用于成片。正式配音服务需要 episode 而独立游戏教学视频接入方式未验证；不能伪造 episode 或把研究样音当成已批准语音。

下一步在注册 3090 worker 上建立真实游戏画面采集、已通过旁白和字幕按同一时间线合成的闭环，先以牛角一套完成真实播放、同步、逐帧采样及听审证据；然后扩战术、纵横视频。需要支持失败、取消和不覆盖已有成品，iPad 与浏览器支持单独验证。Owner 视觉听觉判定之前不标生产完成。

2026-11-05：用 MIT 许可的 [amc2bvh](https://github.com/thcopeland/amc2bvh)（提交 f89c7312588a2a4265bf8384dc7309f461be91a7），通过注册 worker CPU 路径把 124_05 和 124_06 分别转换为 120fps BVH，技术归档 `/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a01/outputs/`。跳投 789 帧 SHA `876dc61d9811debd96cd4d6bb8c812ba693edf1b68d71dad5016ff9795cd0d0a`；上篮 694 帧 SHA `376f7bc8d9e235c78e31492b6a54366dbc0aaba64c65338a79bfc7fc94fe476d`；所有数据数值有限、帧列数一致。转换器作者提示可能存在零长骨骼；不同项目指出缺失旋转通道初始化风险。**这些仅是容器转换与数值检查，不证明动作正确、可重定向或达到游戏质量；需在 3090 的 Blender 中导入，逐动作目视并核对接触和时序后再决定是否接入。**
