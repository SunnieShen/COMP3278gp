# ⚠️ 此文档已升级，讲稿以 v2 为准

v1 是按「独立 demo」写的，没有对照 presentation slide，直接用会和 slide 大量重复（ER、快照设计、CRUD 清单、26 tests 四处撞车），而且没覆盖 slide 6 那页空白的关键 SQL。

**最新版本：[`PRESENTATION_SCRIPT.md`](PRESENTATION_SCRIPT.md)**，包含：

- slide × demo 分工诊断与分工原则（§1–2）
- Slide 增删建议（S6 填空 / S4 冗余 / S7 截图对齐，§3）
- 5 分钟新时间轴：8 页 slide 各就各位，视频压到 slide 标注的 1:50（§4）
- 8 页 slide 逐字稿（§5）
- 视频 1:50 分镜 v2，改成「印证式」口播，回指 slide（§6）
- 检查清单与超时删减 v2（§8）

v1 中仍然有价值、且未过时的内容（分屏录制设置、DBeaver auto-refresh、重录前清残留订单的 DELETE 顺序）已并入 v2 §7；需要看完整 v1 原文可查 git 历史：

```bash
git log --all --oneline -- showcase/DEMO_SCRIPT.md
git show <commit>:showcase/DEMO_SCRIPT.md
```

v1 视频分镜的旁白语速曾核算出镜 5 只有 72 wpm、镜 6 只有 87 wpm，v2 已修正到 99–132 wpm 区间。
