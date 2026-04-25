# 115Rename2026

> 版本：**1.7.0**

专为 115 网盘设计的视频整理与标准化重命名脚本。本地加工与多站刮削并行，支持分段统一、智能标记、评分获取和归档整理。

## ✨ 功能

### 🧹 本地番号加工
- 番号识别（`T28`、`S2M`，`h637`→`TokyoHot-h637`）
- 分段统一（`part1`、`.Part.2`、`(CD3)` → `-1`、`-2`、`-A`）
- 智能标记：`4K`/`8K`/`60fps`/`120fps`/`VR`/`中文字幕`/`无码`/`流出`
- 垃圾词自动清除

### 🌐 多站改名（在线刮削）
- 四引擎轮询：**JavLibrary → JavBus → xslist → JavDB**
- 补全标题、女优、日期，统一命名格式
- 同名番号全局缓存，避免重复请求

### 📁 归档整理
- **按女优**：自动创建女优文件夹并移动文件
- **按番号系列**：按系列前缀归档（如 `SSIS`、`IPX`）
- **按女优+系列**：复合分类
- 支持设置归档根目录

### ⭐ JavDB 评分
- 从 JavDB 获取评分并写入 115 文件星级

### ⚡ 高效并发
- 本地加工并发 5，联网改名并发 3，归档并发 3，评分并发 2
- 可视化进度条实时反馈

## 📋 用法

1. 登录 115 网盘，选中文件或文件夹（可多选）
2. 在 **更多** 菜单中点击对应功能：
   - **本地番号加工**：标准化文件名（不联网）
   - **改名(多网站轮询)**：在线补全信息
   - **归档至文件夹**：选择归整方式（需先设置归档根目录）
   - **设为归档根目录**：右键文件夹将其设为归整根
   - **获取javdb评分**：批量获取评分
3. 右下角进度条显示完成情况

## ⚠️ 限制

- FC2 番号暂不支持在线查询（仅限本地加工）
- 请确保 Tampermonkey 中允许脚本访问 `javbus.com`、`javlibrary.com`、`xslist.org`、`javdb.com` 等域

## 🚀 安装

### 从 GitHub 安装（推荐，自动更新）
1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开脚本的 GitHub 原始文件链接：  
   [https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js](https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js)
3. Tampermonkey 会识别并提示安装，确认即可
4. 以后版本更新会自动推送，无需手动下载

### 从 GreasyFork 安装（可选）
- 前往 [115Rename2026 脚本主页](https://greasyfork.org/zh-CN/scripts/574424-115rename2026) 点击安装（发布后更新至最新版本）

## 📄 许可

MIT License