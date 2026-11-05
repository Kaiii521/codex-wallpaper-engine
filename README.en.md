# Codex Wallpaper Engine

[简体中文](README.md) · **English**

Use local videos, images, and Steam Workshop wallpapers as backgrounds in **Codex Desktop**. Videos loop silently and pause when the window is hidden by default. The wallpaper sits behind the native chat, sidebar, and composer, so you can continue using them as usual.

This experimental third-party tool connects to the desktop client through the local Chrome DevTools Protocol (CDP) port. Wallpapers apply to the current window session. No API key is required. Images, videos, and Workshop previews work without installing npm dependencies.

[Changelog](#changelog) · [Start a wallpaper session](#start-a-wallpaper-session) · [Wallpaper Workbench](#wallpaper-workbench)

| Source | Support |
| --- | --- |
| Local files | JPG, PNG, WebP, GIF, MP4, and WebM, up to 32 MiB per file |
| Steam Workshop Video | Play downloaded MP4 or WebM files |
| Steam Workshop Scene and Web | Try live rendering with WebWallGL from the Workshop panel, with a fallback to the project preview |
| Steam Workshop Picture and Preset | Display the project's JPG, PNG, WebP, or GIF preview |
| Current Wallpaper Engine wallpaper | On Windows, run `current` to load the primary display's wallpaper. Scene and Web projects use their previews |
| Built-in demo | Play a gradient animation without downloading media |

## Start a wallpaper session

Install Node.js 22.4 or newer and open a terminal in this repository. Save your work and **fully quit Codex** from the app menu or system tray. Then relaunch it with the debugging arguments. An existing instance may ignore arguments passed to a second launch.

On Windows, for installations where you can run the executable directly, replace the example path with your own.

```powershell
Start-Process -FilePath 'C:\path\to\Codex.exe' -ArgumentList '--remote-debugging-address=127.0.0.1','--remote-debugging-port=9341'
```

On macOS, use the command that matches your installed app name.

```sh
open -a Codex --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=9341
# If you use Codex from the ChatGPT desktop app
open -a ChatGPT --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=9341
```

```sh
node src/cli.mjs doctor
node src/cli.mjs demo
```

Microsoft Store (MSIX) packaging can affect startup arguments and access to the local port. This project does not include an MSIX launcher, and compatibility depends on the installation. If `doctor` cannot find the main window, check that the app was fully closed before relaunching and that the debug port is available. Use `--port` if you already opened a different port. Run one appearance tool per window to avoid overlapping styles.

## Usage

```sh
# Apply a local file. A higher --dim value blends the wallpaper more strongly
# into the theme background. The default is 68.
node src/cli.mjs apply "my-wallpaper.mp4" --dim 62

# List downloaded Steam Workshop projects
node src/cli.mjs list
node src/cli.mjs list --steam "D:/Steam"

# Open the Steam Workshop library in Codex
node src/cli.mjs library

# Replace the example ID with the first column from the list command
node src/cli.mjs workshop 1234567890
node src/cli.mjs workshop 1234567890 --preview

# Apply the primary display's current wallpaper from Wallpaper Engine
node src/cli.mjs current

node src/cli.mjs pause
node src/cli.mjs resume
node src/cli.mjs clear
```

### Restore a wallpaper at startup on Windows

If you already have the HeiGe Codex Skin Studio Windows startup helper installed, run this command from the project directory to create a desktop shortcut.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\windows\wallpaper-launcher.ps1 -InstallShortcut
```

Fully quit Codex and open **Codex Wallpaper** from your desktop. Select a Workshop wallpaper on the first launch. Opening Codex through the shortcut again restores the last Workshop selection. Picking a local file in the workbench or running `clear` forgets that selection. To restore it manually in an existing debugging session, run `node src/cli.mjs library --restore`.

### Wallpaper Workbench

After applying a wallpaper, click **Wallpaper Appearance** (`壁纸外观`) in the lower-right corner of Codex. The panel currently uses Chinese labels.

- **Wallpaper** (`壁纸`) switches between the Steam Workshop library and the rotation queue. The library offers thumbnails, search, type filters, favorites, and refresh. Click a card to apply it or click **+** to enqueue it. The queue holds up to 50 local and Workshop items and lasts until the window reloads or closes. Applying another wallpaper from the command line also clears the queue.
- **Appearance** (`外观`) adjusts brightness, contrast, saturation, blur, and theme tint. The sidebar and composer can use a frosted glass style with adjustable color, opacity, blur, and borders. Open **Appearance Presets** (`外观预设`) to apply a built-in preset or import and export a JSON preset. **Night Glass** (`夜幕玻璃`) combines a dark tint, frosted surfaces, and translucent backgrounds behind chat text.
- **Playback** (`播放`) controls pause and resume, video speed, image fit, and pausing when the window is hidden. You can also set a timed rotation interval. For live Scene and Web wallpapers, enable **Mouse Response** (`实时壁纸响应鼠标`) to feed the pointer position to effects such as parallax and hover.

Appearance and playback settings are saved locally. Pass `--dim` to override the tint strength for the current application of a wallpaper. To refresh the panel for a wallpaper already running in the current window, run `node src/cli.mjs appearance`.

Keep the terminal running while using the Workshop library. Click **Disconnect** (`断开`) or press Ctrl+C in the terminal to stop the connection. The applied wallpaper remains visible. Run `library` again after reloading the Codex window. Favorites are stored locally, and the tool reads thumbnails and media from your Steam library as needed.

### Live Scene and Web wallpapers

Run `npm install` in the project directory to install the optional dependencies. The renderer uses Microsoft Edge by default. To use Google Chrome, set the `CWE_BROWSER_CHANNEL` environment variable to `chrome`. Then run `node src/cli.mjs library` and select a Scene or Web project in the Workshop panel.

WebWallGL renders the original assets at 1600 × 900 in an isolated headless browser and sends the frames to Codex. The browser can access the selected project's local assets. Switching wallpapers closes the old scene. Pausing playback, or hiding the window when automatic pausing is enabled, pauses live playback. Disconnecting leaves the last frame visible. If live rendering fails, the panel labels the fallback as **Workshop Preview** (`工坊预览`). These previews are often small and can look blurry when enlarged. Mouse response is off by default and forwards pointer positions only. Web projects that depend on external sites, clicks, or scrolling may behave differently.

On Windows, enable **System Audio Response** (`系统音频响应`) in Playback to feed the default output device's stereo frequency spectrum to compatible live Scene or Web wallpapers. This is off by default. Raw audio is processed temporarily on your computer and is never written to a file. Pausing, clearing, or disconnecting the live wallpaper stops capture. After changing your output device, turn the switch off and on again.

`list` reads the Steam installation and libraries in `steamapps/libraryfolders.vdf`. On Windows, it checks Steam's registered installation path first. If discovery fails, pass `--steam` the directory that contains `steamapps`. Use the same option with `library`, `workshop`, or `current` as needed. [Wallpaper Engine Workshop directory documentation](https://help.wallpaperengine.io/en/steam/backup.html)

`current` queries Wallpaper Engine's `getWallpaper` command for the primary display. If it returns no path, the tool uses the current Windows user's last saved selection and tells you in the terminal. Run it again after changing the desktop wallpaper. Scene and Web projects use previews with this command. Open them from the Workshop panel for live rendering. GIF previews play in the browser. [Wallpaper Engine command-line documentation](https://help.wallpaperengine.io/en/functionality/cli.html#get-current-wallpaper)

`clear` removes the wallpaper from the current window. Reloading the window also clears the effect. To close the debug port after a session, fully quit the app and launch it normally. The debug port lets local processes inspect or control the app, so keep it bound to `127.0.0.1`.

## Development and compatibility

```sh
node --test
```

Set `CWE_TEST_LIVE=1` to run the additional browser test for synthetic audio spectrum delivery, capture release on pause, and playback resumption.

The tool depends on the desktop client's internal page structure and media policies. If a video fails to decode, try WebM or H.264 MP4. Automated tests cover multiple Steam libraries, Workshop path restrictions, and debug target selection. Gradient animation, images, WebM playback, pausing, retaining the previous wallpaper on failure, and clearing have also been checked in an Edge fixture. Use the startup steps above to verify your Codex build.

## Changelog

Feature updates are listed from newest to oldest.

### 2026-11-05 · Restore wallpapers at startup on Windows

- **Added** the `Codex Wallpaper` desktop shortcut. Opening Codex through it restores the last successfully applied Steam Workshop wallpaper.
- **Added** `library --restore` for existing debugging sessions. If the saved project is unavailable, the Workshop library opens instead.

### 2026-11-04 · Wider chat layout

- **Changed** The message column and composer widen together on large windows and stay aligned. In a 1920 px window, the measured content width increased from 736 px to 928 px.
- **Adjusted** The layout leaves space for the right-hand Sources panel. Narrow windows use Codex's native width limit.

[View commit `b935ee3`](https://github.com/Kaiii521/codex-wallpaper-engine/commit/b935ee362d2b6ae109c59e715cac33daeb7d5505)

### 2026-11-04 · Night Glass and text readability

- **Added** Night Glass, a preset with a dark wallpaper tint, light text, a frosted sidebar and composer, and a dark Sources panel.
- **Fixed** Glass styling for newer Codex sidebar and composer layouts. Sidebar entries, input text, and placeholders use light colors in this mode, while the composer keeps a dark background.
- **Fixed** Message readability over bright wallpapers. Assistant replies and user message bubbles each have a translucent dark background.

[View commit `02808ff`](https://github.com/Kaiii521/codex-wallpaper-engine/commit/02808ff572cbd32383c678b4b66e8e7f86307b2f)

### 2026-11-04 · v0.1.0 initial release

- **Local playback and Workshop browsing** Added image and video playback, Steam library discovery, thumbnails, search, filters, and favorites. Windows users can import the primary display's Wallpaper Engine selection.
- **Workbench and rotation** Added Wallpaper, Appearance, and Playback tabs, plus a mixed queue for local files and Workshop projects, pause controls, and image fit settings.
- **Live scenes and web wallpapers** Added WebWallGL rendering with a preview fallback, optional mouse position response, and Windows system audio spectrum support.
- **Appearance controls and presets** Added brightness, contrast, saturation, blur, theme tint, glass styling, and JSON preset import and export.
- **Layout fixes** Removed the native white backing behind the composer and the white fades above and below the conversation while a wallpaper is active.

[View the initial commit `e04331d`](https://github.com/Kaiii521/codex-wallpaper-engine/commit/e04331d49ca80938c2ba83938704edb029d27d4a)

## Credits

- The wallpaper and Workshop features were inspired by [DSH Wallpaper Engine](https://github.com/elysia395/dsh-wallpaper-engine).
- [HeiGe Codex Skin Studio](https://github.com/HeiGeAi/heige-codex-skin-studio) demonstrated that local debugging can be used to customize the desktop client. This repository is an independent implementation.
- Live Scene and Web rendering uses the MIT-licensed [WebWallGL](https://github.com/oneincase/webwallgl).

Licensed under the [MIT License](LICENSE). The names Codex, ChatGPT, and Wallpaper Engine identify the products this project works with.
