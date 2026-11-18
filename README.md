# 视频解析下载（dsh-plugin-media-extract）

把一条链接变成 **原片 + 文案 + 转写文本**，全平台通用，全部在本地跑。

支持的平台：

| 平台 | 能力 |
|---|---|
| 抖音 | 视频原片、图文全套 |
| 小红书 | 视频原片、原图（最高 2304×4096） |
| TikTok | 无水印原片 |
| YouTube | 最高 1080p（HLS） |
| Facebook | 原片 |
| X（Twitter） | 原片（最高 60fps） |
| Instagram | 1080×1920 原片 |

## 界面（解析面板）

装好后，对话上方的标签栏会出现一个 **解析** 标签（和「对话 / 轨迹 / 上下文 / 队列」并列）：

1. 点「解析」
2. 粘一条链接，回车或点「解析」
3. 结果按顺序展开：**视频**（可直接播放）→ **文案** → **标题** → 转写（可折叠）→ 本地文件路径

图文笔记会把整套原图平铺出来。整个面板不需要跟 Agent 对话，粘完就出结果。

> 面板走同源路由 `/api/media-extract/run`（解析）与 `/api/media-extract/file`（读文件，支持 Range 以便拖动进度条）。

## 工具

| 工具 | 作用 |
|---|---|
| `media_extract` | 传链接 → 下载原片 + 提取文案 + 语音转文字，返回本地路径 |
| `media_setup` | `check` 检查引擎、`download` 下载引擎包、`config` 读写配置 |

`media_extract` 参数：

- `url`（必填）：视频/图文链接，或本地音视频文件路径
- `transcribe`：是否转写，默认 `true`
- `preferBrowser`：抖音/小红书强制走浏览器旁路，默认 `false`

## 首次使用

1. `media_setup(action="check")` —— 看引擎在不在
2. 不在就 `media_setup(action="download")` —— 下载约 400MB 引擎包并解压到 `~/.dsh/media-extract/extract-tool`
3. 海外平台需要代理：`media_setup(action="config", patch={ youtube_proxy: "http://127.0.0.1:7897" })`
4. 需要登录态的平台（YouTube/TikTok/Facebook/X/Instagram）：把 cookies 放进引擎目录的 `cookies/<平台>.txt`

## 配置项

插件层（`cordis.patch.yml`）：

| 键 | 默认 | 说明 |
|---|---|---|
| `binPath` | 空 | extract.exe 路径，空则用 `homeDir/extract-tool/extract.exe` |
| `homeDir` | 空 | 工具目录，空则用 `~/.dsh/media-extract` |
| `timeoutMs` | 900000 | 单次解析超时 |
| `maxChars` | 20000 | 回给模型的文本上限 |

引擎层（引擎目录下 `config.json`）：

| 键 | 说明 |
|---|---|
| `youtube_proxy` | 主代理，如 `http://127.0.0.1:7897` 或 `https://user:pass@host:8443` |
| `youtube_proxy_fallback` | 备用代理，主代理失败时自动切换 |
| `max_height` | 最高分辨率，默认 1080 |
| `concurrent_fragments` | HLS 并发分片数，默认 6（提速关键） |
| `prefer_hls` | 优先 HLS，默认 false（渐进式更稳） |
| `player_clients` | YouTube 客户端矩阵，默认 `["android","mweb","web_embedded"]` |

## 已知限制

- 抖音/小红书依赖 ego lite 浏览器（`dsh-plugin-ego`）做页面旁路；没装也能跑，但失败率会高。
- YouTube 机房 IP 容易被判机器人，登录态 cookies + 代理是必需的。
- HLS 单流约 2Mbps 上限，多分片并发才能跑满带宽。
