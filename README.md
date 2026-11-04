# No-Download Interceptor v1

A Chrome bookmarklet that stands between you and every file link on a page. It listens for clicks in the **capture phase**, cancels file downloads before the browser can start them, and collects what it caught in a floating cyberpunk glass panel so you can copy the link or trigger the download deliberately.

No build step. No dependencies. One JavaScript file, inline CSS, shadow DOM.

## What it does

1. `window.addEventListener('click', handler, true)` — capture phase, so the interceptor runs before the page's own handlers.
2. A click on a file link (`.zip`, `.pdf`, `.apk`, `.mp4`, …) or on any element with a `download` attribute gets `preventDefault()` **and** `stopPropagation()`.
3. The click is added to a floating panel: filename, source URL, hit count, timestamp, and **Copy Link** / **Direct Link** buttons.

The panel is rendered inside a shadow root, so the host page's CSS cannot restyle it and its CSS cannot leak out.

## Files

| File | What it is |
|---|---|
| `no-download-interceptor.js` | The entire bookmarklet payload. This is the file the loader fetches. |
| `bookmarklet.txt` | Generated artifact (not committed): the same payload as a one-line percent-encoded `javascript:` bookmark, for when you cannot host the file. |
| `test.html` | Local bench with file links, non-file links, duplicate/dynamic/blob cases and a page-side event log. |
| `README.md` | This file. |

## Install

The loader expects a **public** GitHub repo named `no-download-interceptor` under `aomsinjaroensuk15-stack`, with the script on `main`:

```
https://raw.githack.com/aomsinjaroensuk15-stack/no-download-interceptor/main/no-download-interceptor.js
```

raw.githack cannot read private repositories. If your account, repo name or branch differ, change the URL inside the loader.

### 1. Push the files

Push `no-download-interceptor.js` to that repo. The loader appends `?v=<timestamp>` so githack does not serve a cached copy after an update.

### 2. Add the bookmark

Create a bookmark and paste this as its URL:

```js
javascript:(()=>{const s=document.createElement('script');s.src='https://raw.githack.com/aomsinjaroensuk15-stack/no-download-interceptor/main/no-download-interceptor.js?v='+Date.now();s.onerror=()=>alert('No-Download Interceptor failed to load. Check that the GitHub repo is public and that this page allows scripts.');document.documentElement.appendChild(s)})()
```

### 3. Or paste the payload directly

Open `bookmarklet.txt`, copy the single long line, and paste it as a bookmark URL. That is the whole interceptor percent-encoded, so no hosting is involved and no network request is made. It is about 60,000 characters (37 KB of source), which Chrome accepts in a bookmark URL but is unpleasant to edit — the loader above is easier to maintain.

Generate it again after editing the payload:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('no-download-interceptor.js','utf8');fs.writeFileSync('bookmarklet.txt','javascript:'+encodeURIComponent(s))"
```

### Bookmarklet notes

- Chrome strips the `javascript:` prefix when pasting into some URL fields. If that happens, type `javascript:` yourself, then paste the rest.
- GitHub sanitizes `javascript:` links in rendered Markdown, so copy from a code block rather than dragging the snippet out of a page.
- On a strict-CSP site the page may block the loader script, the inline shadow styles or the whole bookmarklet. That is a browser security restriction, not something the script can bypass.
- Clicking the bookmark again reveals an existing panel instead of mounting a second one.

## Controls

| Control | Behavior |
|---|---|
| **Status dot** | Cyan and pulsing while interception is live, magenta while paused. |
| **Switch** | `grid active` / `standby`. Standby lets every click through untouched — nothing is recorded. |
| **Captured counter** | Every intercepted click, duplicates included. Flashes on each new capture. |
| **N unique** | Distinct URL + filename pairs currently in the feed. |
| **Feed entry** | Extension chip, filename, source host/path, hit count (`×2`, `×3`, …) and local time. Hover the filename for the full URL, hover the time for the detection reason. |
| **Copy Link** | Copies the absolute URL. The button flashes `copied` or `failed`. |
| **Direct Link** | Performs the download you blocked, bypassing the interceptor once. |
| **Copy all** | Newline-separated URLs, newest first. |
| **Clear** | Empties the feed and resets the counter. |
| **− / +** | Collapse and expand the panel. |
| **×** | Removes the panel, its listeners and `window.__NDI_V1__`. Running the bookmarklet afterwards creates a fresh instance. |
| **Header drag** | Moves the panel. |

Feed entries are capped at 300; the oldest is dropped first. Duplicate clicks bump the hit count and move the entry back to the top instead of adding a second row. If you have scrolled down the feed, new items will not yank the list back to the top.

The panel is in-memory only: a reload or navigation clears everything.

## Detection rules

| Signal | Example | Result |
|---|---|---|
| Path extension in the file-type list | `/downloads/alpha-build.zip` | blocked |
| `download` attribute, any extension | `href="/get?id=42" download="payload.apk"` | blocked |
| `download` attribute, no extension at all | `href="/get?id=42" download="file"` | blocked |
| File-type link clicked through a nested element | `<a href="/a.zip"><strong>a.zip</strong></a>` | blocked (composed path) |
| Middle-click on a file link | `auxclick`, button 1 | blocked |
| Ordinary page link | `href="/pricing"` | untouched |
| Extension outside the list | `/docs/readme.txt` | untouched |
| Link with a file extension only in the query | `/download?id=1` | untouched — no reliable way to tell a file from a page |

File types currently recognised:

- **Archives / installers:** `zip rar 7z tar gz tgz bz2 tbz2 xz txz zst lz lzma cab iso img dmg pkg deb rpm msi msix appx apk aab ipa exe bin jar war xpi crx torrent`
- **Documents:** `pdf epub mobi azw azw3 djvu chm doc docx xls xlsx ppt pptx odt ods odp rtf csv tsv`
- **Audio:** `mp3 wav flac aac ogg oga m4a opus wma mid midi`
- **Video:** `mp4 mkv avi mov webm flv wmv m4v mpeg mpg 3gp`
- **Design / 3D:** `psd ai eps sketch fig xd indd blend obj fbx stl glb gltf`
- **Fonts / data / scripts:** `ttf otf woff woff2 eot sql db sqlite sqlite3 bak ps1 bat cmd sh`

Blocking is applied to anchors (`<a>`) and image-map areas (`<area>`) only, because those are the elements the browser treats as download triggers.

## Visual design

Deep-space base `#030712`, frosted panel (`backdrop-filter: blur(22px) saturate(165%)`), neon cyan `#06b6d4` borders and glow, magenta `#ec4899` accents on extension chips, hover states and the pause state. An animated cyan→magenta gradient line runs across the top edge over a faint scanline overlay. Animations are disabled under `prefers-reduced-motion`.

## What is *not* intercepted

A bookmarklet can only cancel cancellable events it can see. These paths bypass it:

- **Right-click → "Save link as…"**, and **Save page as** / **Ctrl+S**. Browser chrome is off limits.
- **Dragging a link** to the desktop or tab bar.
- **Script-initiated downloads:** `window.open(url)`, `location.href = url`, form posts, `fetch` + Blob + `<a download>` created outside a user click, service-worker downloads.
- **Clicks inside iframes.** The listener lives on the top window; cross-origin frames are unreachable and same-origin frames are not instrumented in v1.
- **Downloads that begin without a click** (auto-start timers, media "save" context menus, PDF viewer toolbar).
- **Extensions or other scripts** that call `chrome.downloads` directly.

Behavioural details worth knowing:

- **Cross-origin `download` attributes** are ignored by browsers for security. If the original link relied on a `Content-Disposition` header, **Direct Link** reproduces the anchor click and the browser downloads it; if the resource is a cross-origin PDF or video with no such header, it opens in a new tab instead of saving.
- **Direct Link** sets `target="_blank"` deliberately so a tab-opening fallback never replaces the page you are working on.
- **`isTrusted` is not checked**, so scripted `element.click()` on a file link is intercepted too. That is intentional for automation and for pages that trigger downloads from their own handlers.
- **Strict CSP** can block the loader script or the inline `<style>` inside the shadow root. If styles are blocked the panel still works but renders unstyled.
- **Page navigation** destroys the injected script; click the bookmark again afterwards.
- **Only tested on desktop Chromium.** Shadow DOM, `backdrop-filter` and `AbortController` are supported in current Firefox and Safari, but the loader relies on a `javascript:` bookmark and `blob:`/`download` behaviour that were not verified there.

## Test bench

Serve this folder and open `test.html`:

```bash
npx --yes serve -l 8123 .
# http://127.0.0.1:8123/test.html
```

Press **Load interceptor**, then click the targets. The right-hand log is written by the page itself, independent of the HUD, and reports `prevented` plus whether propagation reached the page.

Measured in Chromium on the local bench:

- **5/5** file targets intercepted: `.zip`, `.pdf`, `.mp4`, `download`-attribute `.apk`, nested-element `.tar.gz` — each recorded once, `defaultPrevented === true`, propagation stopped before `document`.
- **3/3** non-file targets passed untouched: `#anchor-test`, `readme.txt`, and `<a download>` with no `href`; the captured counter did not move.
- Duplicate clicks produced **one** row with `×2` and counter `2`.
- Middle-click (`auxclick`, button 1) on a file link was intercepted.
- Standby mode let the same click through and recorded nothing; the label flipped to `standby` and the panel border to magenta.
- **Copy Link** reported `copied` (clipboard API on `127.0.0.1`).
- Clicking HUD buttons never appeared in the feed and was not counted.
- **×** removed the host, the listeners and `window.__NDI_V1__`; re-running the script mounted exactly **one** panel with a fresh feed.
- Collapse/expand and drag round-tripped without losing feed entries.
- Computed styles confirmed `backdrop-filter: blur(22px) saturate(1.65)`, a `rgba(6, 182, 212, 0.34)` border, `z-index: 2147483647` and the 392 px panel width.

**Direct Link** was inspected but not executed in the automated pass, because it writes a file to disk. It is a single anchor click with `download` and `_blank`, guarded by a one-shot bypass flag.

## Privacy

The payload makes no network requests of its own. The loader variant fetches one script from raw.githack; the `bookmarklet.txt` variant fetches nothing. Captured URLs never leave the page — they live in that tab's memory until you close the panel or reload.

## Console API

```js
window.__NDI_V1__.getState()  // { total, unique, active }
window.__NDI_V1__.reveal()    // expand and flash the panel
window.__NDI_V1__.destroy()   // remove the HUD and all listeners
```
