/*!
 * No-Download Interceptor v2.0.0
 * Single-file bookmarklet payload. No dependencies, no build step.
 * Blocks file-download links in the capture phase and shows a cyberpunk
 * glass HUD with a live capture feed.
 */
(() => {
  'use strict';

  const NS = '__NDI_V2__';
  const VERSION = '2.0.0';
  const HOST_ID = 'ndi-v2-host';
  const MAX_ITEMS = 300;
  const ALLOW_KEY = 'ndi:v2:allowed-hosts';

  const existing = window[NS];
  if (existing && typeof existing.reveal === 'function') {
    existing.reveal();
    return;
  }
  if (existing) return;
  window[NS] = { loading: true };

  // v1 left an older panel behind; retire it so only one HUD is on screen.
  try {
    if (window.__NDI_V1__ && typeof window.__NDI_V1__.destroy === 'function') window.__NDI_V1__.destroy();
  } catch {}
  const legacyHost = document.getElementById('ndi-v1-host');
  if (legacyHost) legacyHost.remove();

  const FILE_EXT = new Set(
    (
      'zip rar 7z tar gz tgz bz2 tbz2 xz txz zst lz lzma cab iso img dmg pkg deb rpm ' +
      'msi msix appx apk aab ipa exe bin jar war xpi crx torrent ' +
      'pdf epub mobi azw azw3 djvu chm ' +
      'doc docx xls xlsx ppt pptx odt ods odp rtf csv tsv ' +
      'mp3 wav flac aac ogg oga m4a opus wma mid midi ' +
      'mp4 mkv avi mov webm flv wmv m4v mpeg mpg 3gp ' +
      'psd ai eps sketch fig xd indd blend obj fbx stl glb gltf ' +
      'ttf otf woff woff2 eot ' +
      'sql db sqlite sqlite3 bak ps1 bat cmd sh'
    ).split(/\s+/)
  );

  const CSS = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button { font: inherit; color: inherit; margin: 0; }
    button:focus-visible { outline: 2px solid #67e8f9; outline-offset: 1px; }

    .ndi-panel {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 2147483647;
      width: min(392px, calc(100vw - 20px));
      max-height: min(80vh, 760px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(6, 182, 212, 0.34);
      border-radius: 14px;
      color: #cdeffb;
      background:
        radial-gradient(130% 80% at 100% 0%, rgba(236, 72, 153, 0.13), transparent 58%),
        radial-gradient(120% 90% at 0% 0%, rgba(6, 182, 212, 0.16), transparent 55%),
        linear-gradient(160deg, rgba(8, 18, 32, 0.86), rgba(3, 7, 18, 0.95) 60%);
      backdrop-filter: blur(22px) saturate(165%);
      -webkit-backdrop-filter: blur(22px) saturate(165%);
      box-shadow:
        0 0 0 1px rgba(236, 72, 153, 0.1),
        0 28px 64px -18px rgba(0, 0, 0, 0.9),
        0 0 34px -6px rgba(6, 182, 212, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);
      font: 12px/1.45 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      letter-spacing: 0.01em;
      text-align: left;
      isolation: isolate;
      color-scheme: dark;
      animation: ndi-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    .ndi-panel::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 1.5px;
      background: linear-gradient(90deg, #06b6d4, #ec4899 52%, #06b6d4);
      background-size: 200% 100%;
      animation: ndi-scan 7s linear infinite;
      pointer-events: none;
    }
    .ndi-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 3px);
      opacity: 0.3;
      mix-blend-mode: overlay;
      pointer-events: none;
    }
    .ndi-panel[data-mode="paused"] { border-color: rgba(236, 72, 153, 0.38); }
    .ndi-panel.collapsed { width: auto; min-width: 236px; }
    .ndi-panel.collapsed .ndi-body { display: none; }
    .ndi-panel.collapsed .ndi-head { border-bottom: 0; }
    .ndi-panel.dragging { cursor: grabbing; }
    .ndi-panel.dragging ::selection { background: transparent; }

    .ndi-head {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 11px 10px 14px;
      border-bottom: 1px solid rgba(6, 182, 212, 0.14);
      background: linear-gradient(180deg, rgba(6, 182, 212, 0.07), transparent);
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    .ndi-head:active { cursor: grabbing; }

    .ndi-dot {
      flex: 0 0 auto;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22d3ee;
      box-shadow: 0 0 10px #06b6d4, 0 0 22px rgba(6, 182, 212, 0.6);
      animation: ndi-pulse 1.9s ease-in-out infinite;
    }
    .ndi-dot[data-state="paused"] {
      background: #f472b6;
      box-shadow: 0 0 10px #ec4899, 0 0 22px rgba(236, 72, 153, 0.55);
      animation: none;
    }

    .ndi-brand { display: flex; flex-direction: column; min-width: 0; line-height: 1.12; }
    .ndi-brand b {
      color: #eafcff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      white-space: nowrap;
      text-shadow: 0 0 12px rgba(6, 182, 212, 0.6);
    }
    .ndi-brand b span { color: #ec4899; text-shadow: 0 0 12px rgba(236, 72, 153, 0.75); }
    .ndi-brand i {
      margin-top: 1px;
      color: #4f7f96;
      font-size: 8px;
      font-style: normal;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .ndi-hbtns { margin-left: auto; display: flex; gap: 4px; }
    .ndi-icon {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid rgba(6, 182, 212, 0.24);
      border-radius: 6px;
      background: rgba(6, 182, 212, 0.06);
      color: #7fd9ec;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition: color 140ms, border-color 140ms, box-shadow 140ms, background 140ms;
    }
    .ndi-icon:hover {
      color: #eafcff;
      border-color: rgba(236, 72, 153, 0.55);
      background: rgba(236, 72, 153, 0.1);
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.35);
    }
    .ndi-close { font-size: 15px; }

    .ndi-body { display: flex; flex-direction: column; min-height: 0; }

    .ndi-stats {
      flex: 0 0 auto;
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding: 12px 14px 10px;
      border-bottom: 1px solid rgba(6, 182, 212, 0.1);
    }
    .ndi-count { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ndi-count em {
      font-style: normal;
      font-size: 8px;
      letter-spacing: 0.26em;
      text-transform: uppercase;
      color: #4b7f97;
    }
    .ndi-count strong {
      font-size: 38px;
      line-height: 0.95;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #a5f3fc;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 16px rgba(6, 182, 212, 0.65), 0 0 44px rgba(6, 182, 212, 0.3);
    }
    .ndi-count strong.bump { animation: ndi-bump 320ms ease-out; }

    .ndi-switchwrap { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .ndi-switchlabel {
      font-size: 8px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #67e8f9;
      white-space: nowrap;
    }
    .ndi-panel[data-mode="paused"] .ndi-switchlabel { color: #f9a8d4; }

    .ndi-switch {
      position: relative;
      width: 50px;
      height: 24px;
      padding: 0;
      border: 1px solid rgba(6, 182, 212, 0.55);
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.08));
      box-shadow: inset 0 0 12px rgba(6, 182, 212, 0.28), 0 0 14px -4px rgba(6, 182, 212, 0.75);
      cursor: pointer;
      transition: border-color 200ms, background 200ms, box-shadow 200ms;
    }
    .ndi-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #a5f3fc;
      box-shadow: 0 0 10px #22d3ee, 0 0 20px rgba(34, 211, 238, 0.65);
      transform: translateX(26px);
      transition: transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1), background 200ms, box-shadow 200ms;
    }
    .ndi-switch[data-on="0"] {
      border-color: rgba(236, 72, 153, 0.55);
      background: linear-gradient(90deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.32));
      box-shadow: inset 0 0 12px rgba(236, 72, 153, 0.25), 0 0 14px -4px rgba(236, 72, 153, 0.7);
    }
    .ndi-switch[data-on="0"] .ndi-knob {
      transform: translateX(0);
      background: #f9a8d4;
      box-shadow: 0 0 10px #ec4899, 0 0 20px rgba(236, 72, 153, 0.65);
    }

    .ndi-allowbar {
      flex: 0 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      max-height: 58px;
      overflow-y: auto;
      padding: 8px 14px 4px;
      border-bottom: 1px solid rgba(6, 182, 212, 0.08);
      scrollbar-width: thin;
      scrollbar-color: rgba(236, 72, 153, 0.45) transparent;
    }
    .ndi-allow-label {
      margin-right: 3px;
      color: #4b7f97;
      font-size: 8px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ndi-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 190px;
      height: 18px;
      padding: 0 6px;
      border: 1px solid rgba(236, 72, 153, 0.35);
      border-radius: 99px;
      background: rgba(236, 72, 153, 0.09);
      color: #fbcfe8;
      font-size: 8.5px;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 140ms, border-color 140ms, box-shadow 140ms;
    }
    .ndi-pill-host {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ndi-pill b {
      flex: 0 0 auto;
      color: #ec4899;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .ndi-pill:hover {
      border-color: rgba(244, 114, 182, 0.8);
      background: rgba(236, 72, 153, 0.2);
      box-shadow: 0 0 10px rgba(236, 72, 153, 0.35);
    }
    .ndi-act-allow {
      color: #f9a8d4;
      border-color: rgba(236, 72, 153, 0.32);
      background: rgba(236, 72, 153, 0.07);
    }
    .ndi-act-allow:hover {
      border-color: rgba(244, 114, 182, 0.8);
      background: rgba(236, 72, 153, 0.18);
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.4);
    }
    .ndi-act-allow.is-on {
      border-color: #f9a8d4;
      background: #f9a8d4;
      color: #04121a;
      box-shadow: 0 0 14px rgba(236, 72, 153, 0.5);
    }

    .ndi-feedhead {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px 6px;
      font-size: 8px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .ndi-fh-title { color: #67e8f9; }
    .ndi-fh-title::before {
      content: "";
      display: inline-block;
      width: 10px;
      height: 1px;
      margin-right: 6px;
      vertical-align: middle;
      background: #ec4899;
      box-shadow: 0 0 8px #ec4899;
    }
    .ndi-fh-meta { margin-left: auto; color: #3f6d84; letter-spacing: 0.14em; }

    .ndi-feed {
      flex: 1 1 auto;
      min-height: 64px;
      max-height: 46vh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 2px 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      scrollbar-width: thin;
      scrollbar-color: rgba(6, 182, 212, 0.5) transparent;
      transition: opacity 200ms;
    }
    .ndi-panel[data-mode="paused"] .ndi-feed { opacity: 0.78; }
    .ndi-feed::-webkit-scrollbar { width: 6px; }
    .ndi-feed::-webkit-scrollbar-track { background: rgba(6, 182, 212, 0.05); border-radius: 99px; }
    .ndi-feed::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #06b6d4, #ec4899);
      border-radius: 99px;
    }

    .ndi-item {
      position: relative;
      flex: 0 0 auto;
      padding: 8px 9px 7px 10px;
      border: 1px solid rgba(6, 182, 212, 0.16);
      border-left: 2px solid rgba(6, 182, 212, 0.55);
      border-radius: 8px;
      background: linear-gradient(120deg, rgba(6, 182, 212, 0.07), rgba(236, 72, 153, 0.05));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      transition: border-color 160ms, box-shadow 160ms;
    }
    .ndi-item:hover {
      border-color: rgba(236, 72, 153, 0.42);
      border-left-color: rgba(236, 72, 153, 0.7);
      box-shadow: 0 0 0 1px rgba(236, 72, 153, 0.16), 0 8px 20px -12px rgba(236, 72, 153, 0.55);
    }
    .ndi-item.new { animation: ndi-slide 280ms ease-out; }

    .ndi-item-top { display: flex; align-items: center; gap: 6px; }
    .ndi-chip {
      flex: 0 0 auto;
      height: 14px;
      display: inline-flex;
      align-items: center;
      padding: 0 4px;
      border: 1px solid rgba(236, 72, 153, 0.45);
      border-radius: 3px;
      background: rgba(236, 72, 153, 0.13);
      color: #fbcfe8;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-shadow: 0 0 8px rgba(236, 72, 153, 0.65);
    }
    .ndi-name {
      flex: 1 1 auto;
      min-width: 0;
      color: #e8fbff;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ndi-hits {
      flex: 0 0 auto;
      color: #22d3ee;
      font-size: 9px;
      font-weight: 700;
      text-shadow: 0 0 8px rgba(6, 182, 212, 0.75);
    }
    .ndi-url {
      margin-top: 3px;
      color: #557f95;
      font-size: 9px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ndi-host { color: #7dd3fc; }
    .ndi-path { color: #4d7288; }

    .ndi-actions { display: flex; align-items: center; gap: 5px; margin-top: 6px; }
    .ndi-time { margin-right: auto; color: #3d6076; font-size: 8.5px; letter-spacing: 0.06em; }
    .ndi-act {
      height: 20px;
      padding: 0 7px;
      border: 1px solid rgba(6, 182, 212, 0.34);
      border-radius: 4px;
      background: rgba(6, 182, 212, 0.08);
      color: #a5f3fc;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 140ms, border-color 140ms, box-shadow 140ms, color 140ms;
    }
    .ndi-act:hover {
      border-color: rgba(34, 211, 238, 0.8);
      background: rgba(6, 182, 212, 0.2);
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.42);
    }
    .ndi-act:active { transform: translateY(1px); }
    .ndi-act-direct {
      border-color: rgba(236, 72, 153, 0.4);
      background: rgba(236, 72, 153, 0.09);
      color: #fbcfe8;
    }
    .ndi-act-direct:hover {
      border-color: rgba(244, 114, 182, 0.8);
      background: rgba(236, 72, 153, 0.2);
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.45);
    }
    .ndi-act.ok {
      border-color: #67e8f9;
      background: #67e8f9;
      color: #04121a;
      box-shadow: 0 0 16px rgba(6, 182, 212, 0.65);
    }
    .ndi-act.err {
      border-color: rgba(248, 113, 113, 0.8);
      background: rgba(248, 113, 113, 0.2);
      color: #fecaca;
      box-shadow: 0 0 12px rgba(248, 113, 113, 0.4);
    }

    .ndi-empty {
      flex: 0 0 auto;
      margin: 2px 0 4px;
      padding: 20px 12px;
      border: 1px dashed rgba(6, 182, 212, 0.22);
      border-radius: 8px;
      background: rgba(6, 182, 212, 0.03);
      color: #45708a;
      font-size: 9.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-align: center;
    }
    .ndi-empty span { color: #67e8f9; animation: ndi-blink 1.1s steps(2) infinite; }

    .ndi-foot {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px 9px;
      border-top: 1px solid rgba(6, 182, 212, 0.14);
      background: rgba(3, 7, 18, 0.55);
    }
    .ndi-fbtn {
      height: 22px;
      padding: 0 8px;
      border: 1px solid rgba(6, 182, 212, 0.26);
      border-radius: 4px;
      background: rgba(6, 182, 212, 0.05);
      color: #8fd7e8;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 140ms, border-color 140ms, box-shadow 140ms, opacity 140ms, color 140ms;
    }
    .ndi-fbtn:hover {
      border-color: rgba(236, 72, 153, 0.55);
      background: rgba(236, 72, 153, 0.1);
      color: #ffe4f3;
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.3);
    }
    .ndi-fbtn:disabled { opacity: 0.35; cursor: default; box-shadow: none; border-color: rgba(6, 182, 212, 0.2); background: transparent; color: #5c8498; }
    .ndi-fbtn.ok { border-color: #67e8f9; background: #67e8f9; color: #04121a; }
    .ndi-footstatus {
      margin-left: auto;
      max-width: 56%;
      color: #3f6d84;
      font-size: 8px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ndi-footstatus.hot { color: #67e8f9; text-shadow: 0 0 8px rgba(6, 182, 212, 0.6); }

    .ndi-panel.flash { animation: ndi-flash 560ms ease-out; }

    @keyframes ndi-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.99); }
      to { opacity: 1; transform: none; }
    }
    @keyframes ndi-scan {
      from { background-position: 0% 50%; }
      to { background-position: 200% 50%; }
    }
    @keyframes ndi-pulse {
      0%, 100% { box-shadow: 0 0 8px #06b6d4, 0 0 18px rgba(6, 182, 212, 0.45); }
      50% { box-shadow: 0 0 12px #22d3ee, 0 0 30px rgba(6, 182, 212, 0.75); }
    }
    @keyframes ndi-bump {
      0% { transform: scale(1); }
      35% { transform: scale(1.16); color: #eafcff; }
      100% { transform: scale(1); }
    }
    @keyframes ndi-slide {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes ndi-blink { 50% { opacity: 0; } }
    @keyframes ndi-flash {
      0% {
        box-shadow:
          0 0 0 1px rgba(236, 72, 153, 0.6),
          0 30px 70px -20px rgba(0, 0, 0, 0.9),
          0 0 46px -4px rgba(236, 72, 153, 0.6),
          inset 0 1px 0 rgba(255, 255, 255, 0.07);
      }
      100% {
        box-shadow:
          0 0 0 1px rgba(236, 72, 153, 0.1),
          0 28px 64px -18px rgba(0, 0, 0, 0.9),
          0 0 34px -6px rgba(6, 182, 212, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.07);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition: none !important;
      }
    }
  `;

  const state = {
    active: true,
    destroyed: false,
    bypass: false,
    total: 0,
    seq: 0,
    items: [],
    byKey: new Map(),
    allowed: new Set(),
    lastFlash: 0
  };

  let host = null;
  let shadow = null;
  let panel = null;
  let dot = null;
  let brand = null;
  let collapseBtn = null;
  let countEl = null;
  let stateLabel = null;
  let toggleBtn = null;
  let feedMeta = null;
  let allowBar = null;
  let feed = null;
  let empty = null;
  let footStatus = null;
  let copyAllBtn = null;
  let clearBtn = null;

  let sayTimer = 0;
  let flashTimer = 0;

  const abort = new AbortController();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function h(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function safeDecode(text) {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }

  function extensionOf(name) {
    const match = /\.([a-z0-9]{1,10})$/i.exec(name || '');
    return match ? match[1].toLowerCase() : '';
  }

  function splitUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'blob:') {
        return { host: 'blob', rest: raw.slice(5, 75) };
      }
      const rest = (url.pathname || '/') + (url.search || '');
      return { host: url.host || url.protocol.replace(':', ''), rest: rest.slice(0, 90) };
    } catch {
      return { host: '', rest: String(raw).slice(0, 90) };
    }
  }

  function hostOf(rawUrl) {
    try {
      const url = new URL(rawUrl, document.baseURI);
      if (url.protocol === 'blob:' || url.protocol === 'data:') return '';
      return (url.host || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function loadAllowlist() {
    try {
      const raw = localStorage.getItem(ALLOW_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      list.forEach((host) => {
        if (typeof host === 'string' && host) state.allowed.add(host.toLowerCase());
      });
    } catch {}
  }

  function saveAllowlist() {
    try {
      localStorage.setItem(ALLOW_KEY, JSON.stringify([...state.allowed]));
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Detection
  // ---------------------------------------------------------------------------

  function findAnchor(path, target) {
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      if (node && node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === 'A' || tag === 'AREA') return node;
      }
    }
    if (target && target.closest) {
      const anchor = target.closest('a[href], area[href]');
      if (anchor) return anchor;
    }
    return null;
  }

  function fileNameOf(anchor, rawUrl) {
    const attr = anchor.getAttribute('download');
    if (attr && attr.trim()) {
      const cleaned = attr.trim().split(/[\\/]/).filter(Boolean).pop();
      if (cleaned) return cleaned;
    }
    try {
      const url = new URL(rawUrl, document.baseURI);
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments.length ? safeDecode(segments[segments.length - 1]) : '';
      if (last) return last;
      if (url.host) return url.host;
    } catch {}
    return 'download';
  }

  function matchDownload(anchor) {
    if (!anchor.hasAttribute('href')) return null;
    const raw = anchor.getAttribute('href');
    if (!raw) return null;

    let url = null;
    try {
      url = new URL(raw, document.baseURI);
    } catch {
      return null;
    }
    if (!/^(https?|blob|data|ftp|file):$/i.test(url.protocol)) return null;

    const name = fileNameOf(anchor, url.href);
    const ext = extensionOf(name) || extensionOf(safeDecode(url.pathname));

    if (anchor.hasAttribute('download')) {
      return { url: url.href, name, ext, reason: 'download attribute' };
    }

    if (ext && FILE_EXT.has(ext)) {
      return { url: url.href, name, ext, reason: '.' + ext };
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------

  function handleClick(e) {
    if (!state.active || state.bypass || state.destroyed) return;

    let path = [];
    try {
      path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    } catch {
      path = [];
    }

    if (path.length && host && path.indexOf(host) !== -1) return;
    if (e.target && shadow && e.target.getRootNode && e.target.getRootNode() === shadow) return;

    const anchor = findAnchor(path, e.target);
    if (!anchor) return;
    if (anchor.ownerDocument && anchor.ownerDocument !== document) return;

    const hit = matchDownload(anchor);
    if (!hit) return;

    const hitHost = hostOf(hit.url);
    if (hitHost && state.allowed.has(hitHost)) {
      say('allowed host · ' + hitHost, 1400);
      return;
    }

    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    record(hit);
  }

  function handleAux(e) {
    if (e.button !== 1) return;
    handleClick(e);
  }

  // ---------------------------------------------------------------------------
  // Feed rendering
  // ---------------------------------------------------------------------------

  function buildNode(item) {
    const el = h('article', 'ndi-item');
    el.dataset.id = String(item.id);

    const top = h('div', 'ndi-item-top');
    top.append(
      h('span', 'ndi-chip'),
      h('span', 'ndi-name'),
      h('span', 'ndi-hits')
    );

    const urlRow = h('div', 'ndi-url');

    const actions = h('div', 'ndi-actions');
    const copy = h('button', 'ndi-act', 'copy link');
    copy.type = 'button';
    copy.dataset.act = 'copy';
    copy.dataset.id = String(item.id);
    const direct = h('button', 'ndi-act ndi-act-direct', 'direct link');
    direct.type = 'button';
    direct.dataset.act = 'direct';
    direct.dataset.id = String(item.id);
    const allow = h('button', 'ndi-act ndi-act-allow', 'allow');
    allow.type = 'button';
    allow.dataset.act = 'allow';
    allow.dataset.id = String(item.id);
    actions.append(h('span', 'ndi-time'), copy, direct, allow);

    el.append(top, urlRow, actions);
    fillNode(el, item);
    return el;
  }

  function fillNode(el, item) {
    el.querySelector('.ndi-chip').textContent = item.ext ? item.ext.toUpperCase() : 'file';
    const nameEl = el.querySelector('.ndi-name');
    nameEl.textContent = item.name;
    nameEl.title = item.name + '\n' + item.url;

    const hits = el.querySelector('.ndi-hits');
    hits.textContent = '×' + item.hits;
    hits.hidden = item.hits < 2;

    const urlRow = el.querySelector('.ndi-url');
    urlRow.textContent = '';
    urlRow.title = item.url;
    const parts = splitUrl(item.url);
    urlRow.append(h('span', 'ndi-host', parts.host), h('span', 'ndi-path', parts.rest));

    el.querySelector('.ndi-time').textContent = fmtTime(item.at);
    el.querySelector('.ndi-time').title = item.reason;
  }

  function prependNode(node) {
    const stuck = feed.scrollTop < 24;
    feed.insertBefore(node, feed.firstChild);
    if (!stuck) feed.scrollTop += node.offsetHeight + 7;
  }

  function record(hit) {
    const key = hit.url + '|' + hit.name;
    const now = Date.now();
    state.total++;

    let item = state.byKey.get(key);

    if (item) {
      item.hits++;
      item.at = now;
      const idx = state.items.indexOf(item);
      if (idx > 0) {
        state.items.splice(idx, 1);
        state.items.unshift(item);
      }
      if (item.node) {
        fillNode(item.node, item);
        prependNode(item.node);
        pulseItem(item.node);
      }
    } else {
      item = {
        id: ++state.seq,
        url: hit.url,
        name: hit.name,
        ext: hit.ext,
        reason: hit.reason,
        host: hostOf(hit.url),
        hits: 1,
        at: now,
        node: null
      };
      item.node = buildNode(item);
      state.byKey.set(key, item);
      state.items.unshift(item);
      prependNode(item.node);
      pulseItem(item.node);

      while (state.items.length > MAX_ITEMS) {
        const old = state.items.pop();
        state.byKey.delete(old.url + '|' + old.name);
        if (old.node) old.node.remove();
      }
    }

    sync();
    flashPanel();
    say('blocked ' + (hit.ext ? '.' + hit.ext : 'download'));
  }

  function pulseItem(node) {
    node.classList.remove('new');
    void node.offsetWidth;
    node.classList.add('new');
    setTimeout(() => node.classList.remove('new'), 320);
  }

  function flashPanel() {
    const now = performance.now();
    if (now - state.lastFlash < 220) return;
    state.lastFlash = now;
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => panel && panel.classList.remove('flash'), 600);

    countEl.classList.remove('bump');
    void countEl.offsetWidth;
    countEl.classList.add('bump');
    setTimeout(() => countEl && countEl.classList.remove('bump'), 340);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function copyText(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  function triggerDownload(item) {
    state.bypass = true;
    try {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.name || '';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        state.bypass = false;
      }, 400);
    } catch {
      state.bypass = false;
    }
  }

  function flashButton(btn, text, ok) {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = text;
    btn.classList.remove('ok', 'err');
    btn.classList.add(ok ? 'ok' : 'err');
    clearTimeout(btn._ndiTimer);
    btn._ndiTimer = setTimeout(() => {
      btn.textContent = btn.dataset.label;
      btn.classList.remove('ok', 'err');
    }, 1300);
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  function baseStatus() {
    return state.active ? 'listening' : 'paused — native downloads allowed';
  }

  function say(text, ms) {
    if (!footStatus) return;
    footStatus.textContent = text;
    footStatus.classList.add('hot');
    if (sayTimer) clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      if (!footStatus || state.destroyed) return;
      footStatus.textContent = baseStatus();
      footStatus.classList.remove('hot');
    }, ms || 2200);
  }

  function refreshAllowUi() {
    if (!allowBar) return;

    allowBar.textContent = '';
    allowBar.hidden = state.allowed.size === 0;
    if (state.allowed.size) {
      allowBar.append(h('span', 'ndi-allow-label', 'allowed'));
      state.allowed.forEach((host) => {
        const pill = h('button', 'ndi-pill');
        pill.type = 'button';
        pill.dataset.host = host;
        pill.title = 'Stop allowing ' + host;
        pill.append(h('span', 'ndi-pill-host', host), h('b', null, '×'));
        allowBar.append(pill);
      });
    }

    state.items.forEach((item) => {
      if (!item.node) return;
      const btn = item.node.querySelector('button[data-act="allow"]');
      if (!btn) return;
      if (!item.host) {
        btn.hidden = true;
        return;
      }
      const on = state.allowed.has(item.host);
      btn.hidden = false;
      btn.textContent = on ? 'allowed' : 'allow';
      btn.classList.toggle('is-on', on);
      btn.title = on ? 'Stop allowing ' + item.host : 'Allow downloads from ' + item.host;
    });
  }

  function sync() {
    if (!countEl) return;
    countEl.textContent = String(state.total);
    feedMeta.textContent = state.byKey.size + ' unique';
    refreshAllowUi();
    empty.hidden = state.byKey.size > 0;
    const noItems = state.byKey.size === 0;
    copyAllBtn.disabled = noItems;
    clearBtn.disabled = noItems;

    toggleBtn.dataset.on = state.active ? '1' : '0';
    toggleBtn.setAttribute('aria-checked', String(state.active));
    toggleBtn.setAttribute('aria-label', state.active ? 'Pause interception' : 'Resume interception');
    stateLabel.textContent = state.active ? 'grid active' : 'standby';
    dot.dataset.state = state.active ? 'live' : 'paused';
    panel.dataset.mode = state.active ? 'live' : 'paused';
    if (!sayTimer || !footStatus.classList.contains('hot')) {
      footStatus.textContent = baseStatus();
      footStatus.classList.remove('hot');
    }
  }

  function setActive(next) {
    state.active = !!next;
    sync();
    say(state.active ? 'interception resumed' : 'paused — downloads allowed', 1600);
  }

  function toggleAllow(host) {
    if (!host) {
      say('no host to allow', 1600);
      return;
    }
    if (state.allowed.has(host)) {
      state.allowed.delete(host);
      say('intercepting · ' + host, 1800);
    } else {
      state.allowed.add(host);
      say('allowed · ' + host, 1800);
    }
    saveAllowlist();
    sync();
  }

  function clearFeed() {
    state.items.forEach((item) => {
      if (item.node) item.node.remove();
    });
    state.items = [];
    state.byKey.clear();
    state.total = 0;
    sync();
    say('feed cleared');
  }

  function copyAllLinks() {
    if (!state.items.length) return;
    const text = state.items.map((item) => item.url).join('\n');
    copyText(text).then((ok) => {
      flashButton(copyAllBtn, ok ? 'copied' : 'failed', ok);
      say(ok ? 'copied ' + state.items.length + ' links' : 'clipboard blocked');
    });
  }

  // ---------------------------------------------------------------------------
  // Panel behaviour
  // ---------------------------------------------------------------------------

  function startDrag(e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;

    const rect = panel.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, w: rect.width };

    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.transform = 'none';
    panel.classList.add('dragging');

    const move = (ev) => {
      const maxLeft = Math.max(4, window.innerWidth - start.w - 4);
      const maxTop = Math.max(4, window.innerHeight - 44);
      panel.style.left = clamp(start.left + ev.clientX - start.x, 4, maxLeft) + 'px';
      panel.style.top = clamp(start.top + ev.clientY - start.y, 4, maxTop) + 'px';
      ev.preventDefault();
    };

    const end = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      if (panel) panel.classList.remove('dragging');
    };

    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    e.preventDefault();
  }

  function reveal() {
    if (!panel || state.destroyed) return;
    panel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.textContent = '−';
    const rect = panel.getBoundingClientRect();
    if (rect.left > window.innerWidth - 40 || rect.right < 40 || rect.top > window.innerHeight - 40) {
      panel.style.left = 'auto';
      panel.style.right = '18px';
      panel.style.top = '18px';
      panel.style.transform = 'none';
    }
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
  }

  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    abort.abort();
    if (sayTimer) clearTimeout(sayTimer);
    if (flashTimer) clearTimeout(flashTimer);
    if (host) host.remove();
    host = shadow = panel = feed = empty = countEl = footStatus = allowBar = null;
    try {
      delete window[NS];
    } catch {
      window[NS] = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Mount
  // ---------------------------------------------------------------------------

  function mount() {
    host = document.createElement('div');
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    panel = h('div', 'ndi-panel');
    panel.dataset.mode = 'live';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'No-Download Interceptor');
    panel.setAttribute('aria-live', 'off');

    // head
    const head = h('div', 'ndi-head');
    dot = h('span', 'ndi-dot');
    dot.dataset.state = 'live';

    brand = h('div', 'ndi-brand');
    const title = h('b');
    title.append(document.createTextNode('NO'), h('span', null, '//'), document.createTextNode('DOWNLOAD'));
    brand.append(title, h('i', null, 'interceptor · v' + VERSION));

    const headButtons = h('div', 'ndi-hbtns');
    collapseBtn = h('button', 'ndi-icon', '−');
    collapseBtn.type = 'button';
    collapseBtn.title = 'Collapse panel';
    collapseBtn.setAttribute('aria-label', 'Collapse panel');
    const closeBtn = h('button', 'ndi-icon ndi-close', '×');
    closeBtn.type = 'button';
    closeBtn.title = 'Close interceptor';
    closeBtn.setAttribute('aria-label', 'Close No-Download Interceptor');
    headButtons.append(collapseBtn, closeBtn);

    head.append(dot, brand, headButtons);

    // body
    const body = h('div', 'ndi-body');

    const stats = h('div', 'ndi-stats');
    const countWrap = h('div', 'ndi-count');
    countEl = h('strong', null, '0');
    countEl.id = 'ndiCount';
    countEl.setAttribute('aria-live', 'polite');
    countWrap.append(h('em', null, 'captured'), countEl);

    const switchWrap = h('div', 'ndi-switchwrap');
    stateLabel = h('span', 'ndi-switchlabel', 'grid active');
    toggleBtn = h('button', 'ndi-switch');
    toggleBtn.type = 'button';
    toggleBtn.dataset.on = '1';
    toggleBtn.setAttribute('role', 'switch');
    toggleBtn.setAttribute('aria-checked', 'true');
    toggleBtn.setAttribute('aria-label', 'Pause interception');
    toggleBtn.append(h('span', 'ndi-knob'));
    switchWrap.append(stateLabel, toggleBtn);

    stats.append(countWrap, switchWrap);

    allowBar = h('div', 'ndi-allowbar');
    allowBar.hidden = true;

    const feedHead = h('div', 'ndi-feedhead');
    feedMeta = h('span', 'ndi-fh-meta', '0 unique');
    feedHead.append(h('span', 'ndi-fh-title', 'capture feed'), feedMeta);

    feed = h('div', 'ndi-feed');
    empty = h('div', 'ndi-empty');
    empty.append(document.createTextNode('awaiting first intercept '), h('span', null, '▌'));
    feed.append(empty);

    const foot = h('div', 'ndi-foot');
    copyAllBtn = h('button', 'ndi-fbtn', 'copy all');
    copyAllBtn.type = 'button';
    copyAllBtn.disabled = true;
    clearBtn = h('button', 'ndi-fbtn', 'clear');
    clearBtn.type = 'button';
    clearBtn.disabled = true;
    footStatus = h('span', 'ndi-footstatus', 'listening');
    foot.append(copyAllBtn, clearBtn, footStatus);

    body.append(stats, allowBar, feedHead, feed, foot);
    panel.append(head, body);
    shadow.append(panel);
    (document.body || document.documentElement).appendChild(host);

    // panel listeners
    const opts = { signal: abort.signal };

    head.addEventListener('pointerdown', startDrag, opts);

    collapseBtn.addEventListener(
      'click',
      () => {
        const collapsed = panel.classList.toggle('collapsed');
        collapseBtn.textContent = collapsed ? '+' : '−';
        collapseBtn.title = collapsed ? 'Expand panel' : 'Collapse panel';
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
      },
      opts
    );

    closeBtn.addEventListener('click', destroy, opts);

    toggleBtn.addEventListener(
      'click',
      () => {
        setActive(!state.active);
      },
      opts
    );

    feed.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button[data-act]') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const item = state.items.find((entry) => String(entry.id) === btn.dataset.id);
        if (!item) return;

        if (btn.dataset.act === 'copy') {
          copyText(item.url).then((ok) => {
            flashButton(btn, ok ? 'copied' : 'failed', ok);
            say(ok ? 'link copied' : 'clipboard blocked', 1600);
          });
        } else if (btn.dataset.act === 'direct') {
          triggerDownload(item);
          flashButton(btn, 'sent', true);
          say('download triggered', 1600);
        } else if (btn.dataset.act === 'allow') {
          toggleAllow(item.host);
        }
      },
      opts
    );

    copyAllBtn.addEventListener('click', copyAllLinks, opts);
    clearBtn.addEventListener('click', clearFeed, opts);

    allowBar.addEventListener(
      'click',
      (e) => {
        const pill = e.target && e.target.closest ? e.target.closest('button.ndi-pill') : null;
        if (!pill) return;
        e.preventDefault();
        e.stopPropagation();
        toggleAllow(pill.dataset.host);
      },
      opts
    );

    // keep page handlers from reacting to HUD interaction
    ['click', 'pointerdown', 'mousedown', 'mouseup', 'pointerup', 'wheel'].forEach((type) => {
      shadow.addEventListener(type, (e) => e.stopPropagation(), opts);
    });

    sync();
  }

  try {
    loadAllowlist();
    mount();
    window.addEventListener('click', handleClick, { capture: true, signal: abort.signal });
    window.addEventListener('auxclick', handleAux, { capture: true, signal: abort.signal });

    window[NS] = {
      version: VERSION,
      reveal,
      destroy,
      getState() {
        return { total: state.total, unique: state.byKey.size, active: state.active, allowed: state.allowed.size };
      }
    };
  } catch (err) {
    try {
      delete window[NS];
    } catch {
      window[NS] = null;
    }
    if (host) host.remove();
    console.error('[No-Download Interceptor] failed to start', err);
    alert('No-Download Interceptor could not start on this page: ' + (err && err.message ? err.message : err));
  }
})();
