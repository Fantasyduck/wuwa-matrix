# WutheringWavesUID 声骸评分来源

原项目：[WutheringWavesUID](https://github.com/CM-Edelweiss/WutheringWavesUID)，作者为 CM-Edelweiss 与该项目贡献者。

固定提交：`ec8696f078a8451104fe501c7a64a9812eb66996`。上游许可证为 GPL-3.0，完整文本见本目录的 LICENSE。

`calculate.py` 为未修改的上游评分实现，供离线一致性校验；浏览器不执行 Python。
`data/echo_score_rules.js` 来自上游 `utils/map/character` 的角色权重、条件与档位配置。
`data/echo_score.js` 是评分函数的 JavaScript 移植，保留同一加权和、COST 分母与档位口径。

移植修改（2026-10-05）：接入本项目规范化声骸结构，兼容暴击率与全角百分号，添加缺失数据校验、规则回退说明、词条贡献明细与前端展示；评分保留 Python 的一位小数舍入口径。
菲比按至少两件合鸣选择上游条件方案；上游条件指向不存在的规则文件时回退本角色通用方案并明确说明。
没有专属配置的角色使用上游 default 配置并标注通用权重，不代表专属角色推荐。

这些移植代码及规则遵循 GPL-3.0；保留本声明与 LICENSE。此说明不宣称拥有其他既有素材的版权。

2026-10-05 后续更新：运行时权重已替换为 XutheringWavesUID 的公开规则，见 ../XutheringWavesUID/NOTICE.md。本目录保留基础加权算法的历史来源与数学测试参照；旧角色权重不再加载。
