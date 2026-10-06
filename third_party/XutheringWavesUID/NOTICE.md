# XutheringWavesUID 声骸规则来源

规则来源：[Loping151/XutheringWavesUID](https://github.com/Loping151/XutheringWavesUID)，作者及贡献者。GPL-3.0 许可证见 LICENSE。

公开仓库提交：`b02c7a58870234bbebc29563eb1e45a646395792`。公开资源服务器：https://ww1.loping151.top/XutheringWavesUID/resource/map/character/。
资源独立于 Git 提交更新，逐文件 SHA-256 与 Last-Modified 见 resource-manifest.json。

data/echo_score_rules.js 完整打包公开角色 ID 权重、COST 分母、档位与套装条件。
modal.py 是上游未修改的模态选择说明；浏览器只使用其默认模态及选项，不执行 Python。
浏览器计算使用公开规则的加权和 / COST 分母 × 50，并按公开 draw_char_card.py 的 >49.95 单件归 50 展示规则处理。
评分基础加权实现保留旧公开源码的 GPL 来源，见 ../WutheringWavesUID/NOTICE.md。
本地适配：按 ID 匹配，支持五件合鸣与模态条件，只计角色对应属性的伤害词条，缺失值不评分。

限制：当前上游 calculate.py 仅转调 waves_build 原生编译模块，没有公开核心源码；没有下载或执行该二进制。
因此本实现是公开权重规则的离线适配，尚未与当前原生核心逐例校验，不宣称完全一致。
150 分综合面板评分和伤害计算属于另一套系统，本模块仅展示单件 50 / 五件 250 的声骸词条评分。


矩阵读取流程参考以下公开 Python 源码（2026-10-06 查阅，未执行原生模块）：

- https://github.com/Loping151/XutheringWavesUID/blob/main/XutheringWavesUID/utils/api/api.py
- https://github.com/Loping151/XutheringWavesUID/blob/main/XutheringWavesUID/utils/api/requests.py
- https://github.com/Loping151/XutheringWavesUID/blob/main/XutheringWavesUID/utils/api/model/battle.py

本地 JavaScript 适配位于 data/account_matrix.js，读取官方库街区 newTowerIndex / newTowerDetail，使用临时 b-at 与绑定账号区服，不调用该项目的排行上传服务。真实战绩和本地推演独立展示，不从总分反推未经接口提供的实际伤害。
