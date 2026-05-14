# Game Opus — Kenney 网页街机厅

使用 [Kenney](https://kenney.nl) 提供的 CC0 像素素材打造的 5 款网页小游戏合集，全部前端实现，无需后端、无需构建。

🎮 在线试玩：**https://gordensun.github.io/Game-Opus/**

## 游戏列表

| 游戏 | 玩法 | 操作 |
| --- | --- | --- |
| 🚀 太空大战 | 纵向卷轴射击，闪避陨石与敌舰，连击爆破刷新分数 | 方向键 / WASD / 触屏 |
| 💥 坦克竞技场 | 俯视角坦克战，物理弹道与履带涂鸦 | WASD 移动，鼠标瞄准/射击 |
| ✈️ Tappy Plane | Flappy 风格闪避，节奏点击穿越巨石 | 空格 / 点击屏幕 |
| 🐯 动物记忆 | 翻牌配对，30 种可爱动物，三档难度 | 鼠标 / 触屏 |
| 🌟 像素冒险 | 横版平台跳跃，收集宝石击败敌人，抵达终点旗帜 | 方向键 + 空格（手机有屏幕按钮） |

每个游戏都内置加载进度条；资源加载完成后自动进入游戏。

## 项目结构

```
.
├── index.html             # 首页（游戏选择器）
├── home.css               # 首页样式
├── shared/                # 公共加载器/工具/样式
│   ├── atlas.js           # Kenney 图集 XML 解析 + 进度加载
│   ├── game-shell.js      # 顶栏 / 加载界面 / 自适应 canvas
│   └── loader.css         # 通用 UI 样式
├── assets/                # 解压后的精灵图与 XML 元数据
│   ├── space-shooter/
│   ├── tappy-plane/
│   ├── topdown-tanks/
│   ├── animals/
│   └── platformer/
├── games/                 # 5 款游戏
│   ├── space-shooter/
│   ├── tank-battle/
│   ├── tappy-plane/
│   ├── memory-cards/
│   └── platformer/
└── .github/workflows/pages.yml   # GitHub Pages 部署
```

## 本地预览

任意静态文件服务器皆可：

```bash
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

或直接双击 `index.html` 在浏览器打开。

## 资源版权

所有图像素材来自 [Kenney.nl](https://kenney.nl/assets)，遵循 [CC0 1.0 公共领域](https://creativecommons.org/publicdomain/zero/1.0/) 协议，可免费用于个人和商业用途。
