# 滴答清单（桌面版复刻）

基于原型截图完整实现的待办事项桌面应用：四象限、任务清单（列表 / 看板 / 时间线）、日历（日 / 周 / 月）、番茄专注、习惯打卡、倒数纪念日、全局搜索与完整设置面板。

技术栈：Vite + React 18 + TypeScript + zustand（localStorage 持久化）+ dayjs + lucide-react，桌面壳为 Electron。

## 运行

```bash
npm install
npm run dev          # 浏览器中打开 http://localhost:5173
```

桌面窗口（Electron）：

```bash
npm run electron     # 先构建 dist 再以桌面窗口打开
```

开发模式下用桌面窗口打开 dev server：

```bash
set VITE_DEV_SERVER_URL=http://localhost:5173 && npm run electron:dev
```

## 功能一览

| 模块 | 内容 |
| --- | --- |
| 四象限 | 按优先级规则划分 I–IV 象限，按清单 / 日期分组，卡片内添加任务，拖动任务跨象限自动改优先级，自定义象限规则 |
| 任务 | 智能清单（今天 / 最近7天 / 收集箱 / 已完成 / 垃圾桶）、自定义清单、标签、过滤器；列表 / 看板 / 时间线三种视图；排序、分组、拖动排序；任务详情（日期、时间、提醒、重复、优先级、子任务、标签、描述、便签） |
| 日历 | 日 / 周 / 月视图，当前时间线，点击空白创建，拖动改期、拉伸改时长，倒数日在日历中显示 |
| 番茄专注 | 番茄计时 / 正计时，休息自动衔接，关联任务，概览统计，专注记录增删改 |
| 习惯 | 每周目标、每日打卡、连续天数、归档与统计 |
| 倒数纪念日 | 纪念日 / 倒数日 / 节日，卡片颜色与图标，每年重复 |
| 搜索 | Ctrl+F 全局搜索任务与清单，关键字高亮，键盘选择 |
| 设置 | 账号、高级会员、功能模块、智能清单、提醒与通知、日期与时间、外观（浅色 / 深色 / 主题色）、AI 功能、更多设置、关联与导入、共享协作、便签、桌面小部件、快捷键、关于 |

快速添加支持智能解析：`明天 14:00 写周报 #工作 !高 ~本周`。

## 数据

数据层通过 `src/data` 的 `DataAdapter` 接口读写：默认 `LocalAdapter` 保存在浏览器 / Electron 的 localStorage（键 `dida-data-v2`，旧版 `dida-clone-v1` 自动迁移）；在「设置 → 账号 → 数据与同步」切换为 NOTE OS 服务器后由 `HttpAdapter` 走 `/v1/sync/mutations` 与 `/v1/sync/changes` 增量同步（离线先写本机，联网后推送）。可在「设置 → 账号」导出 / 导入 JSON 或重置。

## 桌面版（Electron）

```bash
npm run desktop      # 构建 dist 后以桌面窗口启动（等价于双击 启动滴答清单.cmd）
```

桌面版由 `electron/main.cjs`（主进程）与 `electron/preload.cjs`（通过 `contextBridge` 暴露 `window.desktop`，契约见 `src/desktop.d.ts`）组成，所有窗口加载同一个 `dist/index.html`，用 URL 参数区分：

| 窗口 | URL 参数 | 说明 |
| --- | --- | --- |
| 主窗口 | 无 | 关闭按钮只隐藏到系统托盘；托盘菜单：显示主窗口 / 新建任务 / 退出 |
| 便签 | `?window=sticky&task=ID&color=…&opacity=…&font=…` | 无边框小窗口，一个任务一个；默认 300×320，可置顶、不在任务栏显示、调整不透明度；颜色可在便签标题栏切换；位置与尺寸记在 `userData/stickies.json`，「设置 → 便签 → 排列便签」按间距在主显示器上平铺 |
| 小部件 | `?window=widget&kind=today\|calendar\|pomo` | 今日任务（含过期、可勾选、快速添加）、月历（有任务的日期带圆点，点击查看当天）、番茄计时（环形进度 + 开始 / 暂停 / 结束）；位置记在 `userData/widgets.json`，在「设置 → 桌面小部件」开关 |

- 全局快捷键：`设置 → 更多 → 快速添加`（默认 Ctrl+Shift+A，唤起主窗口并聚焦输入框）与 `设置 → 快捷键 → 显示或隐藏窗口`（默认 Ctrl+Shift+E）。
- 开机自启：`设置 → 更多 → 开机自动启动`，通过 `app.setLoginItemSettings` 实现。
- 数据同步：所有窗口共享同一份 localStorage；便签 / 小部件改动后通过 `desktop.broadcastDataChanged()` 通知其他窗口重新读取，窗口获得焦点时也会重新读取。
- 浏览器中打开时没有 `window.desktop`：便签退化为应用内浮动卡片（可拖动、可缩放），小部件与托盘不可用。
