# Codex Wallpaper Engine

**简体中文** · [English](README.en.md)

把本地视频、图片和 Steam 工坊壁纸带到 **Codex 桌面端**的对话背景。视频静音循环，窗口隐藏时自动暂停。壁纸铺在原生界面下方，聊天、侧栏和输入框可以照常操作。

这是一个实验性的第三方工具。当前版本通过本机 Chrome DevTools Protocol（CDP）连接已打开调试端口的桌面客户端。壁纸随窗口会话生效，无需 API Key。图片、视频和工坊预览无需安装 npm 依赖。

[更新记录](#更新记录) · [开始壁纸会话](#开始壁纸会话--start-a-wallpaper-session) · [壁纸工作台](#壁纸工作台)

| 来源 | 支持方式 |
| --- | --- |
| 本地文件 | JPG、PNG、WebP、GIF、MP4、WebM，每个文件最多 32 MiB |
| Steam 工坊 Video | 播放已下载项目中的 MP4 或 WebM |
| Steam 工坊 Scene、Web | 从工坊面板尝试 WebWallGL 实时渲染，失败时使用项目预览 |
| Steam 工坊 Picture、Preset | 加载项目提供的 JPG、PNG、WebP 或 GIF 预览 |
| Wallpaper Engine 正在使用的主屏壁纸 | Windows 下运行 `current`。支持的媒体直接加载，Scene / Web 等项目显示预览 |
| 内置演示 | 渐变动画，无需下载素材 |

## 开始壁纸会话 · Start a wallpaper session

准备 Node.js 22.4 或更高版本，并在本仓库目录打开终端。保存进行中的工作，从托盘或应用菜单**完全退出** Codex，再用调试参数启动。单实例应用已有进程时，新参数可能被忽略。

Windows（可直接启动桌面程序的安装方式，替换实际路径）

```powershell
Start-Process -FilePath 'C:\path\to\Codex.exe' -ArgumentList '--remote-debugging-address=127.0.0.1','--remote-debugging-port=9341'
```

macOS（按实际安装名称选择一个命令）

```sh
open -a Codex --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=9341
# 若 Codex 位于 ChatGPT 桌面应用内
open -a ChatGPT --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=9341
```

```sh
node src/cli.mjs doctor
node src/cli.mjs demo
```

Windows 商店版（MSIX）的启动参数和本地端口访问可能受打包方式限制。本项目暂无 MSIX 启动器或真机兼容结论。`doctor` 找不到主窗口时，先检查应用是否完全退出后再启动，以及端口参数是否生效。已通过其他本地工具打开调试端口时，可用 `--port` 指定该端口。同一窗口内建议只启用一个换肤工具，避免样式覆盖。

## 使用

```sh
# 本地文件；--dim 越大，壁纸越接近原生背景色（默认 68）
node src/cli.mjs apply "my-wallpaper.mp4" --dim 62

# 查看已经下载的 Steam 工坊项目
node src/cli.mjs list
node src/cli.mjs list --steam "D:/Steam"

# 在 Codex 的壁纸页打开 Steam 工坊库
node src/cli.mjs library

# 将 ID 换成 list 输出的第一列
node src/cli.mjs workshop 1234567890
node src/cli.mjs workshop 1234567890 --preview

# 从正在运行的 Wallpaper Engine 读取主屏当前壁纸并应用一次
node src/cli.mjs current

node src/cli.mjs pause
node src/cli.mjs resume
node src/cli.mjs clear
```

### Windows 启动时恢复壁纸

在已有 HeiGe Codex Skin Studio Windows 启动助手的电脑上，可在项目目录安装桌面快捷方式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\windows\wallpaper-launcher.ps1 -InstallShortcut
```

完全退出当前 Codex，再用桌面上的 **Codex Wallpaper** 打开。第一次在工坊页选择壁纸，之后用同一快捷方式打开时会恢复上次选中的工坊壁纸。在工作台选取本地文件或执行 `clear` 会清除上次工坊选择。需要手动接入调试会话时，也可以运行 `node src/cli.mjs library --restore`。

### 壁纸工作台

应用壁纸后，点击 Codex 窗口右下方的 **壁纸外观**。

- **壁纸** 可在 Steam 工坊和轮播队列之间切换。工坊页提供缩略图、搜索、类型筛选、收藏和刷新。点卡片应用壁纸，点卡片上的 **＋** 加入轮播队列。队列支持混排本地文件和工坊壁纸，最多 50 项，保留到窗口重载或退出。通过命令行应用其他壁纸会清空当前队列。
- **外观** 可调亮度、对比度、饱和度、模糊和主题遮罩。可为侧栏与输入框开启玻璃外观，并调整颜色、不透明度、模糊和边框。展开「外观预设」可套用内置配置，或通过 JSON 导入、导出当前外观。「夜幕玻璃」搭配深色遮罩、磨砂输入框与侧栏，以及对话文字背后的半透明底色。
- **播放** 可暂停、继续，调整视频速度、画面适配和隐藏窗口时的暂停策略。可让队列按指定间隔轮播。Scene / Web 实时播放时可开启「实时壁纸响应鼠标」，把窗口内的鼠标位置传给壁纸，用于视差和悬停效果。

外观和播放设置保存在本机。显式传入 `--dim` 可以单独指定本次应用时的遮罩。当前窗口已在使用旧版壁纸时，运行 `node src/cli.mjs appearance` 即可更新面板。

使用工坊页时请保持 `library` 的终端窗口打开。点击面板内的 **断开** 或在终端按 Ctrl+C 可以结束连接，已应用的壁纸仍会显示。重载 Codex 窗口后需要重新运行该命令。工坊收藏保存在本机，缩略图和媒体从本机 Steam 库按需读取。

### 高清场景和网页壁纸

在项目目录运行 `npm install` 安装可选依赖，并准备 Microsoft Edge。使用 Google Chrome 时，可将环境变量 `CWE_BROWSER_CHANNEL` 设为 `chrome`。运行 `node src/cli.mjs library`，从工坊页点选 Scene 或 Web 项目。

项目在独立的无界面浏览器中运行 WebWallGL，以 1600 × 900 渲染原始素材，并把画面送进 Codex。这个浏览器仅能访问选中项目的本机素材。切换壁纸会关闭旧场景，暂停或隐藏窗口会暂停实时播放，断开工坊会保留最后一帧。实时渲染失败时，面板会标记为「工坊预览」。预览通常是低分辨率缩略图，铺满窗口会变糊。实时鼠标响应默认关闭，只转发位置。依赖外部网站、点击或滚轮的网页效果可能有差异。

Windows 可在「播放」开启 **系统音频响应**。它默认关闭，只在实时壁纸播放时读取默认播放设备的左右声道频谱，供支持音频响应的 Scene / Web 壁纸使用。原始音频只在本机临时处理，不写入文件。暂停、清除或断开实时壁纸时会停止采集；更换输出设备后可关闭再重新打开开关。

`list` 会读取 Steam 安装目录和 `steamapps/libraryfolders.vdf` 中登记的库。Windows 会优先查找 Steam 登记的安装位置。自动查找失败时，用 `--steam` 指向包含 `steamapps` 的目录，并在 `workshop` 或 `current` 命令中使用相同参数。 [Wallpaper Engine 工坊目录文档](https://help.wallpaperengine.io/en/steam/backup.html)

`current` 使用 Wallpaper Engine 的 `getWallpaper` 查询主屏当前壁纸。查询没有返回路径时，读取当前 Windows 用户上次保存的壁纸选择，并在终端提示。桌面换壁纸后可再次运行该命令。`current` 对 Scene 和 Web 使用预览图。实时渲染入口在 Steam 工坊页。GIF 预览由浏览器播放。 [Wallpaper Engine 命令行文档](https://help.wallpaperengine.io/en/functionality/cli.html#get-current-wallpaper)

`clear` 移除当前窗口里的壁纸。重载页面也会清除效果。结束会话后，完全退出应用并正常打开，即可关闭调试端口。调试端口允许本机进程检查或控制应用，请保持仅监听 `127.0.0.1`。

## 开发与兼容性

```sh
node --test
```

设置环境变量 `CWE_TEST_LIVE=1` 后运行测试，可以额外验证网页壁纸收到合成频谱、暂停时释放采集和恢复播放。

当前版本依赖桌面端的内部页面结构以及媒体播放策略。视频遇到解码错误时，可试 WebM 或 H.264 MP4。自动化测试覆盖 Steam 多库扫描、工坊文件路径限制和调试目标筛选。在 Edge 的测试页面中验证过渐变动画、图片、WebM 播放、暂停、失败时保留已有壁纸，以及清除后恢复原样。Codex 桌面端真机效果仍需按上面的步骤验收。

## 更新记录

按 GitHub 功能提交倒序排列。

### 2026-11-05 · Windows 启动时恢复壁纸

- **新增**桌面快捷方式 `Codex Wallpaper`。从该入口启动后，自动恢复上次成功应用的 Steam 工坊壁纸。
- **新增** `library --restore`，可在已开启调试端口的窗口手动触发恢复。选择失效时会打开工坊列表。

### 2026-11-04 · 宽屏聊天布局

- **调整**宽窗口中消息列和底部输入框同步加宽并保持对齐。1920 px 窗口中实测内容宽度从 736 px 增至 928 px。
- **适配**右侧资料面板打开时为它预留空间。窄窗口沿用 Codex 原生宽度限制。

### 2026-11-04 · 夜幕玻璃与文字可读性

- **新增**「夜幕玻璃」预设，配合深色遮罩、浅色文字、磨砂侧栏和输入框，以及深色资料面板。
- **修复**新版 Codex 侧栏与输入框的玻璃样式。深色模式下，侧栏条目、输入文字和占位提示使用浅色，输入框保留足够的深色底。
- **修复**亮色壁纸上的消息可读性。助手回复和用户消息分别使用半透明暗底，减少画面对文字的干扰。

[查看此次提交 `02808ff`](https://github.com/Kaiii521/codex-wallpaper-engine/commit/02808ff572cbd32383c678b4b66e8e7f86307b2f)

### 2026-11-04 · v0.1.0 首次发布

- **本地播放与工坊浏览** 支持图片、视频、Steam 工坊自动发现、缩略图、搜索、类型筛选和收藏。Windows 可读取 Wallpaper Engine 的主屏壁纸选择。
- **工作台与轮播** 加入壁纸、外观、播放三个页签，支持本地与工坊项目混合轮播、暂停和画面适配。
- **实时场景与网页** 通过 WebWallGL 渲染 Scene / Web 壁纸，失败时回退到工坊预览。支持可选的鼠标位置响应和 Windows 系统音频频谱。
- **外观调节与预设** 支持亮度、对比度、饱和度、模糊、主题遮罩和玻璃外观。可用 JSON 导入和导出外观预设。
- **界面修复** 壁纸模式下隐藏输入区的白色底板以及聊天滚动区上下的白色渐变。

[查看首版提交 `e04331d`](https://github.com/Kaiii521/codex-wallpaper-engine/commit/e04331d49ca80938c2ba83938704edb029d27d4a)

## 致谢

- 壁纸与工坊导入的产品灵感来自 [DSH Wallpaper Engine](https://github.com/elysia395/dsh-wallpaper-engine)。
- 本机调试接入的可行性参考 [HeiGe Codex Skin Studio](https://github.com/HeiGeAi/heige-codex-skin-studio)。本仓库独立实现。
- 实时 Scene 和 Web 渲染使用 MIT 许可的 [WebWallGL](https://github.com/oneincase/webwallgl)。

MIT 许可。Codex、ChatGPT 与 Wallpaper Engine 的名称用于说明兼容目标。
