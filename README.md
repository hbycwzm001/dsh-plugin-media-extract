# 视频解析下载（dsh-plugin-media-extract）

把一条链接变成 **原片 + 文案 + 转写文本**，全平台通用，全部在本地跑。

> 📖 **完整使用手册：[docs/使用手册.md](docs/使用手册.md)**（安装、依赖与模型清单、代理怎么填、ego 登录态、常见问题）

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


## 依赖与模型（明确清单）

**必须**：DSH Desktop ≥ 0.2.2-rc.1、本插件、解析引擎 `extract.exe`（约 240MB zip，首次解析自动下载）。

**引擎包内已包含**（用户无需另装 Python / Node / ffmpeg）：

| 组件 | 用途 | 体积 |
|---|---|---|
| Python 运行时（PyInstaller 冻结） | 运行引擎 | 内置 |
| yt-dlp + yt-dlp-ejs | 海外平台下载、解 YouTube n 挑战 | 内置 |
| quickjs | JS 运行时，替代 Node | 内置 |
| ffmpeg | 合并音视频 / HLS | 内置 |
| sherpa-onnx + **SenseVoice-Small int8 模型** | 语音转文字（中英日韩粤） | **228MB** |

模型随包下发，落在 `~/.dsh/media-extract/extract-tool/models/sense-voice-onnx/`，**不需要单独下载**。

**可选**：ego lite 浏览器（抖音/小红书图文、登录墙页面）、代理出口（YouTube/TikTok/X/IG/FB）、各平台登录态（cookies 自动导出）。

## 首次使用

1. `media_setup(action="check")` —— 看引擎在不在
2. 不在就 `media_setup(action="download")` —— 下载约 240MB 引擎包并解压到 `~/.dsh/media-extract/extract-tool`
   （装了插件第一次解析时也会**自动下载**，见下面的 `autoInstall`）
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
| `autoInstall` | true | 引擎缺失时自动下载安装（首次解析会下载约 240MB） |

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

### 0.3.1

- 小红书改走 ego lite 真实页面渲染：直接取笔记原图/原视频（`标题_01.webp`…），不再把首页 logo 当结果返回
- 小红书域名迁移适配：`rednote.com` / `xhslink.cn` 归入国内平台，短链自动解析出带 `xsec_token` 的完整地址
- 遇到登录墙 / 笔记已失效时明确报错，不再产出 0.04MB 的「小红书 - 你的生活兴趣社区」假结果
- YouTube 出口自动轮换：配置的代理连不上时依次尝试备用代理、本机探测到的代理、直连；登录态 cookies 过期时自动从 ego 重新导出
- 同一作品重复解析不再堆 `_2` / `_3`，也不再残留 `_tmp-*` 临时文件名
- 对应引擎版本 v0.2.5

### 0.3.0

- 转写区新增「✎ 纠错别字」按钮：把转写文本交给大模型只做错别字/标点修正，改完显示「已纠错」，可点「还原本」查看原始识别结果
- 自动纠错的提示词收紧：不再把标题/平台文案复述进正文（之前会把整段结构吐出来），并对模型输出做清洗与长度校验
- 国内平台解析失败时先走浏览器旁路（抖音/小红书图文、连接重置都能救），最后才退 yt-dlp
- 对应引擎版本 v0.2.4（新增 `extract.exe --polish` 子命令）

### 0.2.8

- 引擎抗网络抖动：yt-dlp 库路径改成「多出口 × 瞬时错误重试」——依次尝试 Clash、自建 TLS 代理、直连，每个出口遇 `SSL: UNEXPECTED_EOF` / 连接重置 / 超时才重试一次，硬失败直接换下一个出口
- 对应引擎版本 v0.2.3（`media_setup action=download` 拉的就是它）

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
