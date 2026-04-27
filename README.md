# 115Rename2026

> 版本：**1.7.5**

专为 115 网盘设计的视频整理与标准化重命名脚本，本地加工与多站刮削并行，支持分段统一、智能标记、广告清理、评分同步及归档整理。

## ✨ 功能

### 🧹 本地番号加工
- 番号提取标准化（支持 `T28`、`S2M`，`h637`→`TokyoHot-h637`）
- 分段统一：`part1`、`.Part.2`、`(CD3)` → `-1`、`-2`、`-A`
- 标记自动识别：`4K`/`8K`/`60fps`/`120fps`/`VR`/`中文字幕`/`无码`/`流出`
- 广告残留清理：自动移除 `[3Q]`、`(原)` 等垃圾内容

### 🌐 多站改名（在线刮削）
- 四引擎轮询：**JavLibrary → JavBus → xslist → JavDB**
- 补全正式标题、女优、发行日期，生成 `番号 标题 女优名【标记】_日期.ext`
- 同名番号全局缓存，避免重复请求

### 📁 归档整理
- 按女优 / 按番号系列 / 女优+系列三种模式
- 需先设置归档根目录

### ⭐ JavDB 评分
- 从 JavDB 获取评分并同步至 115 文件星级

### ⚡ 高效并发
- 本地 5 / 联网 3 / 归档 3 / 评分 2，带进度条

## 🚀 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 直接访问脚本原始文件安装（自动更新）：  
   [https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js](https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js)
3. 或前往 [GreasyFork](https://greasyfork.org/zh-CN/scripts/574424-115rename2026) 安装

## 📄 许可
MIT License