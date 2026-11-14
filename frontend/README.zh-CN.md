# foodpanda 前端

[English](README.md) | **简体中文**

HTML/CSS/JavaScript 界面，由 Flask 同源提供网页，通过 `/api/v1` 读取 MySQL，不需要 npm 构建。

## 运行

先按[项目说明](../README.zh-CN.md#运行完整应用)准备环境，再在仓库根目录运行：

```bash
python app.py
```

打开 http://127.0.0.1:5000。静态服务器或直接打开 index.html 无法提供 API。

## 功能

- 买家登录退出、商家菜单浏览、搜索和筛选。
- 个人单：创建、加菜、改数量、删除、提交或取消草稿。
- 拼单：创建、分享、加入、退出、修改自己的菜品、查看成员金额。
- 配送或自取；运费按整数分均摊，余数由 host 承担。
- Host 可在截止前或后提交非空拼单；截止或提交后禁止加入和编辑。
- Orders 显示当前账号的个人单及已加入拼单，包括 Completed，提供分类、数量和刷新。
- 提交后只读，模拟在 15–60 分钟后完成；页面每 15 秒刷新。

Alice 和 Bob 使用不同浏览器配置或普通／无痕窗口；普通标签页共享登录。账号、迁移命令、状态说明及测试见[项目 README](../README.zh-CN.md)。登录邮箱默认留空。

## 文件与素材

`api.js` 处理异步请求及 CSRF，`app.js` 显示接口结果，`styles.css` 提供样式。登录、订单和成员不存 localStorage，接口失败会显示错误。

菜单及价格来自数据库，本地图片按真实编号配图。图片、标志和二维码来源见 [assets/SOURCES.md](assets/SOURCES.md)。Google Fonts 不可用时回退系统字体。现有熊猫 SVG 来自 Simple Icons。本项目是课程原型。

[English API](../docs/API.md) · [中文接口约定](../docs/API.zh-CN.md)
