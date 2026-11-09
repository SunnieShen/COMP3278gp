# Group Eats 前端

[English](README.md) | **简体中文**

参考 Foodpanda 风格的响应式学生项目原型。使用 HTML、CSS 和 JavaScript 模块，无需构建或安装 npm 依赖。

## 本地运行

在仓库根目录执行：

```bash
python3 -m http.server 5173 --directory frontend --bind 127.0.0.1
```

打开 http://127.0.0.1:5173。请使用 HTTP 服务；直接打开 `index.html` 可能无法加载 JavaScript 模块。

## 已有功能

- 浏览餐厅和杂货店、搜索、分类筛选、排序及商家收藏。
- 查看菜单、收藏商品、调整购物篮数量及移除商品。
- 演示登录、修改送餐地址、自取模式和本地订单记录。
- 创建拼单、设置截止时间、模拟好友加入、均摊配送费、锁单及取消。
- 桌面和手机响应式布局，演示状态保存在 localStorage 中。

订单、账号和拼单成员均为当前浏览器内的模拟数据。尚无真实后端、MySQL 连接、支付、配送或跨设备邀请。邀请操作只复制演示链接；可用“Simulate a friend joining”模拟另一位成员。其他业务规则仍需后端实现。

## 后端交接

`data.js` 保存商家和商品示例数据；`api.js` 集中处理模拟数据访问；`app.js` 负责页面和交互。接入后端时，将模拟方法替换成真实请求，并让调用方等待异步结果。权限、价格、成员资格、截止时间和事务都必须由服务器校验。

核心编号和字段与数据库对应：`user_id`、`seller_user_id`、`item_id`、`item_name`、`quantity` 和 `unit_price_snapshot`。图片、预计送达时间和描述等是界面示例字段。提前锁单、注册及完整结算需要约定后端规则；前端模拟不代表数据库结构已经调整。

## 素材

食物照片从 Unsplash 下载并保存在本地，来源见 `assets/SOURCES.md`。可选在线字体为 Google Fonts 的 DM Sans 和 Manrope，离线时使用系统字体。视觉参考：https://www.foodpanda.hk/ 。Group Eats 是学生项目，与 Foodpanda 无关联。

## 品牌与商家示例

界面使用 foodpanda 名称和 Simple Icons 收录的现成熊猫标志，没有自行绘制或生成熊猫；来源见 `assets/SOURCES.md`。示例数据包含 18 家餐厅和 4 家杂货店，每家都有菜单。名称、价格、评分和优惠均为演示数据，不是实时商家信息。本仓库仍为 Group Eats 课程项目。

列表页将搜索放在右上方，左侧提供可扫描的 App 下载二维码和链接，指向香港官方下载页。
