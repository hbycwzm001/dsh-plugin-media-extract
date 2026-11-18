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

面板细节：

- **白底黑字**，跟随主题不做深色块
- 视频**按源片原始比例显示**（竖屏就是竖条，不拉满宽度）
- 文件旁边有两个按钮：`打开位置`（弹出 output 文件夹）、`下载到…`（自己选文件夹另存）
- 输入框右边有 `清空`，用来取消上一次解析
- 切到「对话」再切回来，上一次的结果还在（模块级缓存）

> 面板走同源路由 `/api/media-extract/run`（解析）、`/api/media-extract/file`（POST 取文件，前端转 blob 播放）、`/api/media-extract/reveal`（打开文件夹）、`/api/media-extract/status`（自检）。
>
> 注意：DSH 的 fetch 网关**不会把 query string 带进 `request.url`**，所以文件路径走 POST body，不能写成 `?p=`。

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

## 更新记录

### 0.2.3

- 面板改白底黑字
- 视频按原始宽高比显示，不再出现两侧大黑边
- 文件改用 `POST /api/media-extract/file` 取二进制 + blob 播放（网关丢弃 query string，旧的 `?p=` 会 400）
- 新增「下载到…」（`showSaveFilePicker` 选文件夹）与「打开位置」（打开 output 文件夹）
- 新增「清空」按钮
- 切换标签页后保留上一次结果（模块级缓存）
- 修 `explorer /select` 对含空格路径失效的问题

### 0.2.2

- 从整段分享文案里自动抠链接
- 还原 `xhslink.cn` 短链到 `discovery/item/<id>?xsec_token=...`
- 同一条链接并发解析改为串行排队，避免 Windows 文件占用

### 0.2.7

- 文案 / 标题 / 转写 三块各加一个「⧉ 复制」按钮，点一下复制、变「✓ 已复制」
- 引擎侧新增语音转写纠错：接大模型（默认 `deepseek-chat`，key 依次取配置 / `DEEPSEEK_API_KEY` / DSH 凭据文件），同音错字会被改正（如「湖州织旅」→「湖州织里」、「温领」→「温岭」），原文另存 `text_raw`

### 0.2.6

- 每条作品单独一个文件夹（`D:\工作台\<标题>\`，里面只有这条的视频/图片 + 文案 txt），点「打开位置」直接进这个文件夹，不再在大目录里翻
- 重复解析同一条时覆盖同名文件，不再堆 `_2` / `_3` 副本
- 输出目录自动选非系统盘的 `工作台`，C 盘不再增长

### 0.2.5

- 解析产物默认改存到非系统盘的 `工作台` 目录（如 `D:\工作台`，自动创建，可用 `outputDir` 覆盖）
- 转写文本常显并标注字数，无人声时显示提示
- 文件网关与「打开位置」允许访问输出目录

### 0.2.1

- 修 `output.schema` 缺 `additionalProperties` 导致整个插件加载失败
- `render` 返回数组；返回值过滤 `undefined`
