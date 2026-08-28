import type { FastifyInstance } from "fastify";
import { config } from "./config.js";
import { ICON_180_PNG_BASE64, ICON_512_PNG_BASE64 } from "./icons.js";

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0f1115; color: #e6e8eb;
    padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);
    -webkit-text-size-adjust: 100%;
  }
  a { color: #6ea8fe; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #9aa4b2; font-size: 13px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  button {
    padding: 7px 13px; border: 0; border-radius: 8px;
    background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  button.secondary { background: #2c323d; }
  select {
    padding: 7px 9px; border-radius: 8px; border: 1px solid #2c323d;
    background: #0f1115; color: #e6e8eb; font-size: 13px; width: 100%;
  }
  .badge {
    display: inline-block; padding: 1px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 600; text-transform: capitalize;
  }
  .badge.running { background: #14351f; color: #4ade80; }
  .badge.completed { background: #10243b; color: #60a5fa; }
  .badge.failed { background: #3a1620; color: #f87171; }
  .badge.stale { background: #2a2c33; color: #9aa4b2; }
  .badge.waiting_for_user, .badge.waiting_for_permission { background: #3a2f14; color: #fbbf24; }
  .empty { text-align: center; color: #9aa4b2; padding: 40px 20px; }

  /* App shell: sidebar + main */
  .shell { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }
  .sidebar {
    width: 320px; flex: 0 0 320px; border-right: 1px solid #262b34;
    background: #12151b; display: flex; flex-direction: column;
  }
  .sidebar-head {
    padding: 16px; padding-top: calc(16px + env(safe-area-inset-top));
    border-bottom: 1px solid #262b34;
  }
  .sidebar-head .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .new-chat { width: 100%; margin-top: 12px; padding: 10px; font-size: 14px; }
  .sidebar-filter { margin-top: 12px; }
  .badge.hosted { background: #10243b; color: #93c5fd; }
  .badge.observed { background: #2a2c33; color: #9aa4b2; }
  .session-list { overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
  .session-item {
    padding: 12px 16px; border-bottom: 1px solid #1c2029; cursor: pointer;
    display: flex; align-items: flex-start; gap: 8px;
  }
  .session-item:hover { background: #1c2029; }
  .session-item.active { background: #1a2130; border-left: 3px solid #3b82f6; padding-left: 13px; }
  .session-item .session-main { flex: 1; min-width: 0; }
  .session-item .sid { font-size: 13px; font-weight: 600; word-break: break-word; }
  .session-item .sub { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .session-item .time { font-size: 11px; color: #9aa4b2; }
  .session-item .short {
    font-size: 11px; color: #6b7280; font-family: ui-monospace, Menlo, monospace;
  }
  .session-del {
    flex: 0 0 auto; background: transparent; border: 0; color: #6b7280; cursor: pointer;
    padding: 2px 6px; font-size: 15px; line-height: 1; border-radius: 6px;
  }
  .session-del:hover { background: #3a1d1d; color: #f87171; }

  /* Main: conversation */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .main-head {
    padding: 14px 22px; padding-top: calc(14px + env(safe-area-inset-top));
    border-bottom: 1px solid #262b34;
    display: flex; align-items: center; gap: 12px;
  }
  .menu-btn {
    display: none; background: #2c323d; width: 38px; height: 38px; flex: 0 0 38px;
    padding: 0; font-size: 17px; align-items: center; justify-content: center;
  }
  .main-head .title { min-width: 0; flex: 1; }
  .main-head .title .sid { font-weight: 700; word-break: break-all; }
  .metrics { display: flex; gap: 18px; flex-wrap: wrap; }
  .metric .k { font-size: 11px; color: #9aa4b2; }
  .metric .v { font-size: 15px; font-weight: 700; }
  .conversation { flex: 1; overflow-y: auto; padding: 22px; -webkit-overflow-scrolling: touch; }
  .conv-inner { max-width: 900px; margin: 0 auto; }

  /* Chat messages */
  .msg { display: flex; margin-bottom: 16px; }
  .msg.user { justify-content: flex-end; }
  .msg.assistant, .msg.tool, .msg.system { justify-content: flex-start; }
  .bubble {
    max-width: 80%; border-radius: 14px; padding: 10px 14px;
    border: 1px solid #262b34; background: #171a21;
  }
  .msg.user .bubble { background: #1e3a5f; border-color: #2b5488; }
  .msg.tool .bubble { background: #0f1115; }
  .msg.system .bubble { background: #14140f; border-color: #3a2f14; }
  .msg-role {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
    color: #9aa4b2; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;
  }
  .msg.user .msg-role { color: #93c5fd; }
  .msg.assistant .msg-role { color: #86efac; }
  .msg.tool .msg-role { color: #c8cdd6; }
  .msg.system .msg-role { color: #fbbf24; }
  .msg-md { font-size: 14px; word-break: break-word; }
  .msg-md > :first-child { margin-top: 0; }
  .msg-md > :last-child { margin-bottom: 0; }
  .msg-md p { margin: 0 0 8px; }
  .msg-md h1, .msg-md h2, .msg-md h3, .msg-md h4, .msg-md h5, .msg-md h6 {
    margin: 12px 0 6px; line-height: 1.3;
  }
  .msg-md h1 { font-size: 18px; } .msg-md h2 { font-size: 16px; }
  .msg-md h3 { font-size: 15px; } .msg-md h4, .msg-md h5, .msg-md h6 { font-size: 14px; }
  .msg-md ul, .msg-md ol { margin: 6px 0; padding-left: 22px; }
  .msg-md li { margin: 2px 0; }
  .msg-md blockquote {
    margin: 6px 0; padding: 2px 12px; border-left: 3px solid #2c323d; color: #9aa4b2;
  }
  .msg-md a { color: #6ea8fe; word-break: break-all; }
  .msg-md del { color: #9aa4b2; }
  .msg-md code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
    background: #0b0d11; border: 1px solid #262b34; border-radius: 5px; padding: 1px 5px;
  }
  .msg-md pre {
    margin: 8px 0; background: #0b0d11; border: 1px solid #262b34; border-radius: 8px;
    padding: 10px 12px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .msg-md pre code {
    background: none; border: 0; padding: 0; font-size: 12.5px; line-height: 1.5;
    white-space: pre; display: block;
  }
  .msg-meta { font-size: 12px; color: #9aa4b2; margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap; }
  .msg-time { font-size: 11px; color: #6b7280; margin-top: 6px; font-family: ui-monospace, Menlo, monospace; }
  .day-sep { text-align: center; color: #6b7280; font-size: 12px; margin: 18px 0; }
  .msg-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .msg-imgs img { max-width: 160px; max-height: 160px; border-radius: 8px; border: 1px solid #262b34; }
  /* Typing/loading indicator shown under a just-sent prompt */
  .typing { display: inline-flex; gap: 5px; align-items: center; padding: 4px 2px; }
  .typing span {
    width: 7px; height: 7px; border-radius: 50%; background: #86efac; opacity: .35;
    animation: typing-blink 1.2s infinite ease-in-out;
  }
  .typing span:nth-child(2) { animation-delay: .2s; }
  .typing span:nth-child(3) { animation-delay: .4s; }
  @keyframes typing-blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }

  /* Composer: remote prompt control */
  .composer {
    border-top: 1px solid #262b34; padding: 12px 22px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom)); background: #12151b;
  }
  .composer-inner { max-width: 900px; margin: 0 auto; }
  .composer-row { display: flex; gap: 10px; align-items: flex-end; }
  .composer textarea {
    flex: 1; resize: vertical; min-height: 44px; max-height: 200px;
    padding: 10px 12px; border-radius: 10px; border: 1px solid #2c323d;
    background: #0f1115; color: #e6e8eb; font: inherit;
  }
  .composer textarea:focus { outline: none; border-color: #3b82f6; }
  .composer .hint {
    font-size: 11px; color: #9aa4b2; margin-top: 6px; display: flex;
    align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .composer .resume-on { color: #4ade80; }
  .composer-status { font-size: 12px; margin-top: 6px; min-height: 16px; }
  .composer-status.err { color: #f87171; }
  .composer-status.ok { color: #4ade80; }
  .composer button:disabled { opacity: .5; cursor: default; }
  .composer .attach {
    background: #2c323d; padding: 0; width: 40px; height: 40px; flex: 0 0 40px;
    font-size: 18px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
  }
  .thumbs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .thumb { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid #2c323d; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb .rm {
    position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; padding: 0;
    border-radius: 50%; background: rgba(0,0,0,.65); color: #fff; font-size: 12px; line-height: 18px;
    display: flex; align-items: center; justify-content: center;
  }

  /* Scrim behind the mobile drawer */
  .scrim { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 30; }

  /* Token gate overlay */
  .gate {
    display: none; position: fixed; inset: 0; z-index: 100; background: #0f1115;
    align-items: flex-start; justify-content: center; padding: 12vh 20px 20px;
  }
  .card {
    width: 100%; max-width: 440px;
    background: #171a21; border: 1px solid #262b34; border-radius: 12px; padding: 24px;
  }
  .gate input {
    width: 100%; margin-top: 14px; padding: 12px; border-radius: 10px;
    border: 1px solid #2c323d; background: #0f1115; color: #e6e8eb;
    font: 16px ui-monospace, Menlo, monospace;
  }
  .gate button { margin-top: 14px; width: 100%; padding: 12px; font-size: 15px; }
  .gate .err { color: #f87171; font-size: 13px; margin-top: 10px; min-height: 16px; }

  /* Mobile: sidebar becomes a slide-in drawer */
  @media (max-width: 768px) {
    .menu-btn { display: inline-flex; }
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
      width: 86%; max-width: 320px; flex-basis: auto;
      transform: translateX(-100%); transition: transform .25s ease;
      padding-left: env(safe-area-inset-left);
    }
    .sidebar.open { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.6); }
    .scrim.show { display: block; }
    .main-head { padding-left: 14px; padding-right: 14px; flex-wrap: wrap; }
    .conversation { padding: 14px; }
    .composer { padding-left: 14px; padding-right: 14px; }
    .bubble { max-width: 92%; }
    /* iOS zooms inputs with font-size < 16px on focus; keep them 16px. */
    .composer textarea, select { font-size: 16px; }
    .metric .v { font-size: 14px; }
  }
`;

const renderHome = (authEnabled: boolean): string => `<!doctype html>
<html lang="zh"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Agent Gateway">
<meta name="theme-color" content="#0f1115">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" href="/icon-180.png">
<title>Agent Gateway</title><style>${PAGE_STYLE}</style>
</head><body>

<div class="shell">
  <div class="scrim" id="scrim"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <div class="row">
        <h1>Agent Gateway</h1>
        <button class="secondary" id="refresh" type="button">刷新</button>
      </div>
      <button class="new-chat" id="newChat" type="button">＋ 新建对话</button>
      <div class="sidebar-filter">
        <select id="statusFilter">
          <option value="">全部状态</option>
          <option value="running">Running</option>
          <option value="waiting_for_user">Waiting for user</option>
          <option value="waiting_for_permission">Waiting for permission</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="stale">Stale</option>
        </select>
      </div>
    </div>
    <div class="session-list" id="sessionList">
      <div class="empty">加载中…</div>
    </div>
  </aside>

  <main class="main">
    <div class="main-head">
      <button class="menu-btn" id="menuBtn" type="button" aria-label="会话列表">☰</button>
      <div class="title">
        <div class="sid" id="convTitle">选择一个 session</div>
        <div class="muted" id="convSub">从会话列表选择一个查看对话详情</div>
      </div>
      <div class="metrics" id="convMetrics"></div>
    </div>
    <div class="conversation" id="conversation">
      <div class="empty">点左上角 ☰ 选择一个 session，或在下方直接输入 prompt</div>
    </div>
    <div class="composer">
      <div class="composer-inner">
        <div class="thumbs" id="thumbs"></div>
        <div class="composer-row">
          <button class="attach" id="attachBtn" type="button" title="添加图片">📎</button>
          <input type="file" id="imgInput" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>
          <textarea id="promptInput" rows="1"
            placeholder="输入 prompt 让网关托管执行 Agent…（可粘贴/添加图片，Enter 发送，Shift+Enter 换行）"></textarea>
          <button id="sendPrompt" type="button">发送</button>
        </div>
        <div class="hint">
          <span id="resumeHint">新对话 · 发送后自动创建会话</span>
        </div>
        <div class="composer-status" id="composerStatus"></div>
      </div>
    </div>
  </main>
</div>

<div class="gate" id="tokenGate">
  <div class="card">
    <h1>Agent Gateway</h1>
    <p class="muted" style="margin-top:8px">输入 API token 登录。仅保存在本设备（localStorage），不会上传。</p>
    <input id="gateInput" type="password" inputmode="text" autocomplete="off"
      autocapitalize="off" spellcheck="false" placeholder="粘贴你的 token">
    <button id="gateBtn" type="button">进入</button>
    <div class="err" id="gateMsg"></div>
  </div>
</div>

<script>
  // ---- Token: URL param → localStorage → gate ----
  var AUTH_ENABLED = ${authEnabled ? "true" : "false"};
  var TOKEN_KEY = 'ag_token';
  function readToken() {
    try {
      var u = new URL(location.href);
      var t = u.searchParams.get('token');
      if (t) {
        t = t.trim();
        localStorage.setItem(TOKEN_KEY, t);
        u.searchParams.delete('token');   // strip from address bar/history
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
        return t;
      }
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) { return ''; }
  }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} token = ''; }

  var token = readToken();
  var listTimer = null;
  var convTimer = null;
  var activeRunId = null;
  var activeSessionId = null;
  var lastEventTs = null;   // exclusive cursor for incremental append
  var seenKeys = {};        // de-dupe across polls
  var hostedSessions = {};  // claude session ids started by this gateway

  function api(path, opts) {
    opts = opts || {};
    var headers = { authorization: 'Bearer ' + token };
    if (opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];
    return fetch(path, Object.assign({}, opts, { headers: headers }));
  }
  function onUnauthorized() {
    clearToken();
    if (listTimer) clearInterval(listTimer);
    if (convTimer) clearInterval(convTimer);
    showGate('Token 无效或已过期，请重新输入。');
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Short form of a session UUID for compact display, e.g. "a1b2c3d4…".
  function shortId(v) {
    var s = String(v == null ? '' : v);
    return s.length > 8 ? s.slice(0, 8) + '…' : s;
  }

  // Minimal, XSS-safe Markdown → HTML. The input is untrusted (assistant
  // output, tool results, user prompts), so EVERYTHING is HTML-escaped before
  // any tag is introduced, links are limited to http(s)/mailto, and only a
  // fixed set of safe tags is emitted.
  function renderMarkdown(src) {
    src = String(src == null ? '' : src).replace(/\\r\\n?/g, '\\n');

    // 1) Lift out fenced code blocks so their contents are never parsed as md.
    var blocks = [];
    src = src.replace(/\`\`\`([^\\n\`]*)\\n?([\\s\\S]*?)\`\`\`/g, function (_, lang, code) {
      blocks.push(code.replace(/\\n$/, ''));
      return '\\u0000CB' + (blocks.length - 1) + '\\u0000';
    });

    // 2) Escape everything that remains.
    src = esc(src);

    function inline(s) {
      var codes = [];
      s = s.replace(/\`([^\`]+)\`/g, function (_, c) {
        codes.push(c); return '\\u0000IC' + (codes.length - 1) + '\\u0000';
      });
      // links [text](url) — only safe schemes; url was escaped so quotes are safe
      s = s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|mailto:[^\\s)]+)\\)/g,
        function (_, t, u) {
          return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
        });
      s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\\*([^*]+)\\*/g, '$1<em>$2</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      s = s.replace(/\\u0000IC(\\d+)\\u0000/g, function (_, n) {
        return '<code>' + codes[Number(n)] + '</code>';
      });
      return s;
    }

    var lines = src.split('\\n');
    var out = [];
    var i = 0;
    var isBlockStart = function (l) {
      return /^\\u0000CB\\d+\\u0000$/.test(l) || /^(#{1,6})\\s+/.test(l) ||
        /^&gt;\\s?/.test(l) || /^\\s*[-*+]\\s+/.test(l) || /^\\s*\\d+\\.\\s+/.test(l);
    };
    while (i < lines.length) {
      var line = lines[i];
      var cb = line.match(/^\\u0000CB(\\d+)\\u0000$/);
      if (cb) { out.push('<pre><code>' + esc(blocks[Number(cb[1])]) + '</code></pre>'); i++; continue; }
      if (/^\\s*$/.test(line)) { i++; continue; }
      var h = line.match(/^(#{1,6})\\s+(.*)$/);
      if (h) { var lvl = h[1].length; out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>'); i++; continue; }
      if (/^&gt;\\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^&gt;\\s?/.test(lines[i])) { quote.push(inline(lines[i].replace(/^&gt;\\s?/, ''))); i++; }
        out.push('<blockquote>' + quote.join('<br>') + '</blockquote>'); continue;
      }
      if (/^\\s*[-*+]\\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i])) { ul.push('<li>' + inline(lines[i].replace(/^\\s*[-*+]\\s+/, '')) + '</li>'); i++; }
        out.push('<ul>' + ul.join('') + '</ul>'); continue;
      }
      if (/^\\s*\\d+\\.\\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) { ol.push('<li>' + inline(lines[i].replace(/^\\s*\\d+\\.\\s+/, '')) + '</li>'); i++; }
        out.push('<ol>' + ol.join('') + '</ol>'); continue;
      }
      var para = [];
      while (i < lines.length && !/^\\s*$/.test(lines[i]) && !isBlockStart(lines[i])) { para.push(inline(lines[i])); i++; }
      out.push('<p>' + para.join('<br>') + '</p>');
    }
    return out.join('');
  }

  function fmtTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d.getTime()) ? esc(v) : d.toLocaleString();
  }
  function fmtClock(v) {
    var d = new Date(v);
    return isNaN(d.getTime()) ? esc(v) : d.toLocaleTimeString();
  }
  function fmtNum(v) { return v == null ? '—' : Number(v).toLocaleString(); }
  function fmtCost(v) { return v == null ? '—' : '$' + Number(v).toFixed(4); }

  // ---- Mobile drawer ----
  function openDrawer() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('scrim').classList.add('show');
  }
  function closeDrawer() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('show');
  }

  // ---- Sidebar: session list ----

  async function loadSessions() {
    var status = document.getElementById('statusFilter').value;
    var path = '/api/runs?limit=200' + (status ? '&status=' + encodeURIComponent(status) : '');
    var res = await api(path);
    if (res.status === 401) { onUnauthorized(); return; }
    var data = await res.json();
    var items = data.items || [];
    var el = document.getElementById('sessionList');
    if (!items.length) {
      el.innerHTML = '<div class="empty">暂无 session。</div>';
      return;
    }
    el.innerHTML = items.map(function (r) {
      var active = r.run_id === activeRunId ? ' active' : '';
      var hosted = hostedSessions[r.session_id];
      var kind = hosted
        ? '<span class="badge hosted" title="网关托管，可继续对话">托管</span>'
        : '<span class="badge observed" title="观测会话，无法继续">观测</span>';
      // Show the human-readable session name; fall back to the UUID when the
      // first prompt wasn't captured. The short id keeps the raw id discoverable.
      var name = r.title || r.session_id;
      var showShort = r.title && r.session_id;
      return '<div class="session-item' + active + '" data-run="' + esc(r.run_id) + '">' +
        '<div class="session-main">' +
          '<div class="sid" title="' + esc(r.session_id) + '">' + esc(name) + '</div>' +
          '<div class="sub">' +
            '<span class="badge ' + esc(r.status) + '">' + esc(r.status) + '</span>' +
            kind +
            (showShort ? '<span class="short">' + esc(shortId(r.session_id)) + '</span>' : '') +
            '<span class="time">' + fmtTime(r.last_event_at) + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="session-del" type="button" data-run="' + esc(r.run_id) + '" ' +
          'title="删除 session" aria-label="删除">🗑</button>' +
      '</div>';
    }).join('');
  }

  async function deleteSession(runId) {
    if (!runId) return;
    if (!confirm('确定删除这个 session？该会话将从列表中移除，此操作不可撤销。')) return;
    var res = await api('/api/runs/' + encodeURIComponent(runId), { method: 'DELETE' });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) { setStatus('删除失败，请重试', 'err'); return; }
    // If the deleted session was open, reset the conversation pane.
    if (runId === activeRunId) startNewChat();
    await loadSessions();
  }

  // ---- Map a raw log event to a conversation message ----

  function pick(attrs, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (attrs[keys[i]] != null && attrs[keys[i]] !== '') return attrs[keys[i]];
    }
    return null;
  }

  function toMessage(e) {
    var a = e.attributes || {};
    var name = pick(a, ['event.name']) || (e.body || '').replace('claude_code.', '');
    var role = 'system', title = name, text = '', meta = [];

    if (name === 'user_prompt') {
      role = 'user'; title = '用户';
      var plen = pick(a, ['prompt_length']);
      var praw = pick(a, ['prompt']);
      text = (praw && praw !== '<REDACTED>') ? praw
        : '[用户输入' + (plen ? '，' + plen + ' 字符' : '') + '（内容未记录）]';
    } else if (name === 'assistant_response') {
      role = 'assistant'; title = '助手' + (pick(a, ['model']) ? ' · ' + pick(a, ['model']) : '');
      var rlen = pick(a, ['response_length']);
      var rraw = pick(a, ['response']);
      text = (rraw && rraw !== '<REDACTED>') ? rraw
        : '[助手回复' + (rlen ? '，' + rlen + ' 字符' : '') + '（内容未记录）]';
    } else if (name === 'tool_decision') {
      role = 'tool'; title = '工具决策 · ' + (pick(a, ['tool_name']) || '');
      text = '决定：' + (pick(a, ['decision']) || '—');
      if (pick(a, ['decision_source'])) meta.push('来源 ' + pick(a, ['decision_source']));
    } else if (name === 'tool_result') {
      role = 'tool'; title = '工具结果 · ' + (pick(a, ['tool_name']) || '');
      var ok = pick(a, ['success']);
      text = ok === 'true' ? '✓ 执行成功' : (ok === 'false' ? '✗ 执行失败' : '执行完成');
      var dur = pick(a, ['duration_ms']);
      if (dur) meta.push(dur + ' ms');
      var outsz = pick(a, ['tool_result_size_bytes']);
      if (outsz) meta.push('输出 ' + outsz + ' B');
    } else if (name === 'api_request') {
      role = 'system'; title = 'API 请求' + (pick(a, ['model']) ? ' · ' + pick(a, ['model']) : '');
      var it = pick(a, ['input_tokens']), ot = pick(a, ['output_tokens']), cost = pick(a, ['cost_usd']);
      if (it) meta.push('输入 ' + it + ' tok');
      if (ot) meta.push('输出 ' + ot + ' tok');
      if (cost) meta.push('$' + Number(cost).toFixed(4));
      text = '';
    } else if (name === 'api_error' || name === 'api_retries_exhausted') {
      role = 'system'; title = 'API 错误';
      text = pick(a, ['error']) || e.body || '';
    } else {
      role = 'system'; title = name || '事件';
      text = pick(a, ['error']) || '';
    }
    return { role: role, title: title, text: text, meta: meta, time: e.timestamp };
  }

  function messageHtml(m) {
    var metaHtml = m.meta.length
      ? '<div class="msg-meta"><span>' + m.meta.map(function (x) { return esc(x); }).join('</span><span>') + '</span></div>'
      : '';
    return '<div class="msg ' + m.role + '">' +
      '<div class="bubble">' +
        '<div class="msg-role">' + esc(m.title) + '</div>' +
        (m.text ? '<div class="msg-md">' + renderMarkdown(m.text) + '</div>' : '') +
        metaHtml +
        '<div class="msg-time">' + fmtClock(m.time) + '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- Main: conversation, incremental append ----

  function nearBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  // Optimistic send: show the user's message and a loading indicator the instant
  // they hit send, before any telemetry arrives. pendingSend holds the in-flight
  // prompt until its reply lands (or the run settles).
  var pendingSend = null;   // { text, images: [{url}] } while awaiting a reply

  function ensureConvInner() {
    var inner = document.getElementById('convInner');
    if (!inner) {
      document.getElementById('conversation').innerHTML =
        '<div class="conv-inner" id="convInner"></div>';
      inner = document.getElementById('convInner');
    }
    return inner;
  }

  // (Re)render the optimistic user bubble + loader at the bottom of the pane.
  function showPending() {
    if (!pendingSend) return;
    var inner = ensureConvInner();
    var oldU = document.getElementById('pending-user'); if (oldU) oldU.remove();
    var oldL = document.getElementById('pending-loader'); if (oldL) oldL.remove();
    var imgs = pendingSend.images || [];
    var imgsHtml = imgs.length
      ? '<div class="msg-imgs">' + imgs.map(function (im) {
          return '<img src="' + esc(im.url) + '" alt="">';
        }).join('') + '</div>'
      : '';
    if (pendingSend.text || imgs.length) {
      inner.insertAdjacentHTML('beforeend',
        '<div class="msg user" id="pending-user"><div class="bubble">' +
          '<div class="msg-role">用户</div>' +
          (pendingSend.text ? '<div class="msg-md">' + renderMarkdown(pendingSend.text) + '</div>' : '') +
          imgsHtml +
        '</div></div>');
    }
    inner.insertAdjacentHTML('beforeend',
      '<div class="msg assistant" id="pending-loader"><div class="bubble">' +
        '<div class="msg-role">助手</div>' +
        '<div class="typing"><span></span><span></span><span></span></div>' +
      '</div></div>');
    var conv = document.getElementById('conversation');
    conv.scrollTop = conv.scrollHeight;
  }

  function removeLoader() {
    var l = document.getElementById('pending-loader'); if (l) l.remove();
  }

  // The reply (or terminal state) arrived: drop the loader and stop tracking.
  // Any surviving #pending-user placeholder is left in place — it IS the user's
  // message when telemetry never delivered a user_prompt event.
  function clearPending() {
    pendingSend = null;
    removeLoader();
  }

  async function pollConversation() {
    if (!activeRunId) return;
    var runId = activeRunId;
    var qs = '?limit=1000' + (lastEventTs ? '&after=' + encodeURIComponent(lastEventTs) : '');
    var res = await api('/api/runs/' + encodeURIComponent(runId) + '/events' + qs);
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) return;
    var data = await res.json();
    if (runId !== activeRunId) return; // switched away mid-flight
    var items = data.items || [];

    var conv = document.getElementById('conversation');
    var inner = document.getElementById('convInner');
    if (!inner) return;
    var stick = nearBottom(conv);
    var added = 0;
    var loader = document.getElementById('pending-loader');

    items.forEach(function (e) {
      var key = e.timestamp + '|' + (e.spanId || '') + '|' + ((e.attributes && e.attributes['event.sequence']) || '') + '|' + (e.body || '');
      if (seenKeys[key]) return;
      seenKeys[key] = true;
      lastEventTs = e.timestamp; // items are chronological asc
      var msg = toMessage(e);
      // Adopt the optimistic placeholder for the real user_prompt so the just-
      // sent message isn't rendered twice; strip its id so later prompts render.
      if (msg.role === 'user') {
        var ph = document.getElementById('pending-user');
        if (ph) { ph.removeAttribute('id'); added++; return; }
      }
      // First assistant reply → the wait is over, drop the loading indicator.
      if (msg.role === 'assistant') { removeLoader(); loader = null; }
      // Keep the loader pinned at the bottom: stream events in above it.
      if (loader) loader.insertAdjacentHTML('beforebegin', messageHtml(msg));
      else inner.insertAdjacentHTML('beforeend', messageHtml(msg));
      added++;
    });

    if (added && stick) conv.scrollTop = conv.scrollHeight;
  }

  async function loadMetrics(runId) {
    var res = await api('/api/runs/' + encodeURIComponent(runId));
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) return;
    var run = await res.json();
    if (runId !== activeRunId || run.error) return;
    activeSessionId = run.session_id || null;
    updateResumeHint();
    document.getElementById('convTitle').textContent = run.title || run.session_id || runId;
    document.getElementById('convSub').innerHTML =
      '<span class="badge ' + esc(run.status) + '">' + esc(run.status) + '</span> · ' +
      (run.title ? '<span class="short">' + esc(run.session_id) + '</span> · ' : '') +
      '开始于 ' + fmtTime(run.started_at);
    var m = [
      ['Prompts', fmtNum(run.prompt_count)],
      ['输入 tok', fmtNum(run.input_tokens)],
      ['输出 tok', fmtNum(run.output_tokens)],
      ['费用', fmtCost(run.estimated_cost_usd)]
    ];
    document.getElementById('convMetrics').innerHTML = m.map(function (x) {
      return '<div class="metric"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>';
    }).join('');
  }

  function selectSession(runId) {
    activeRunId = runId;
    lastEventTs = null;
    seenKeys = {};
    var nodes = document.querySelectorAll('.session-item');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('active', nodes[i].dataset.run === runId);
    }
    document.getElementById('conversation').innerHTML =
      '<div class="conv-inner" id="convInner"></div>';
    loadMetrics(runId);
    pollConversation();
    if (convTimer) clearInterval(convTimer);
    convTimer = setInterval(function () {
      if (activeRunId) { loadMetrics(activeRunId); pollConversation(); }
    }, 5000);
    closeDrawer();   // on mobile, reveal the conversation
  }

  // ---- Composer: remote agent control ----

  function canResume() {
    return activeSessionId && hostedSessions[activeSessionId];
  }

  function updateResumeHint() {
    var hint = document.getElementById('resumeHint');
    if (!hint) return;
    if (canResume()) {
      // A gateway-hosted conversation is open → keep chatting in it.
      hint.className = 'resume-on';
      hint.textContent = '继续当前会话 · ' + activeSessionId;
    } else if (activeSessionId) {
      // An observed (non-gateway) session is open — we can't inject into it.
      hint.className = '';
      hint.textContent = '这是观测会话，无法继续；发送将开启一个新会话';
    } else {
      // New chat.
      hint.className = '';
      hint.textContent = '新对话 · 发送后自动创建会话';
    }
  }

  // ChatGPT-style "New chat": detach from any open session so the next send
  // starts a fresh gateway conversation.
  function startNewChat() {
    activeRunId = null;
    activeSessionId = null;
    lastEventTs = null;
    seenKeys = {};
    pendingSend = null;
    if (convTimer) clearInterval(convTimer);
    var nodes = document.querySelectorAll('.session-item');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('active');
    document.getElementById('convTitle').textContent = '新对话';
    document.getElementById('convSub').textContent = '输入下方消息，开启一个新的托管会话';
    document.getElementById('convMetrics').innerHTML = '';
    document.getElementById('conversation').innerHTML =
      '<div class="empty">输入下方消息，开启一个新的托管会话</div>';
    setStatus('');
    updateResumeHint();
    closeDrawer();
    document.getElementById('promptInput').focus();
  }

  async function loadHosted() {
    var res = await api('/api/agent/prompts?limit=200');
    if (!res.ok) return;
    var data = await res.json();
    (data.items || []).forEach(function (p) {
      if (p.claude_session_id) hostedSessions[p.claude_session_id] = true;
    });
    updateResumeHint();
  }

  function setStatus(msg, kind) {
    var el = document.getElementById('composerStatus');
    el.className = 'composer-status' + (kind ? ' ' + kind : '');
    el.textContent = msg || '';
  }

  // Poll a submitted prompt until it settles; once its claude session id is
  // known, jump to that session so telemetry streams in live. A brand-new
  // hosted session isn't in the projected /api/runs list immediately, so keep
  // retrying the jump each poll until the session actually appears.
  async function trackPrompt(id) {
    var jumped = false;
    async function tryJump(sessionId) {
      if (jumped || !sessionId) return;
      if (sessionId === activeSessionId && activeRunId) {
        // Resuming the already-open session: keep the pane (and the optimistic
        // bubbles) intact and just pull this turn's new events incrementally,
        // so we don't replay history or misattribute the placeholder.
        jumped = true;
        pollConversation();
        return;
      }
      await loadSessions();
      var match = null;
      document.querySelectorAll('.session-item').forEach(function (n) {
        var sid = n.querySelector('.sid');
        if (sid && sid.textContent === sessionId) match = n;
      });
      if (match && match.dataset.run) {
        jumped = true;
        selectSession(match.dataset.run);
        showPending();   // survive the jump to the freshly-created session
      }
    }
    for (var i = 0; i < 600; i++) {
      var res = await api('/api/agent/prompts/' + encodeURIComponent(id));
      if (!res.ok) return;
      var p = await res.json();
      if (p.claude_session_id) {
        hostedSessions[p.claude_session_id] = true;
        setStatus('#' + id + ' 运行中 · 会话 ' + p.claude_session_id, 'ok');
        await tryJump(p.claude_session_id);
      }
      if (p.status === 'completed') {
        pendingSend = null;   // settled: no need to re-show on future selects
        setStatus('#' + id + ' 已完成' + (p.num_turns ? ' · ' + p.num_turns + ' 轮' : ''), 'ok');
        // Fast runs can finish before the projector lists the session; keep
        // retrying the jump briefly so the reply still renders on this page.
        for (var k = 0; k < 8 && !jumped; k++) {
          await tryJump(p.claude_session_id);
          if (jumped) break;
          await new Promise(function (r) { setTimeout(r, 1500); });
        }
        // The reply bubble arrives via telemetry (which lags the DB status), so
        // keep the loader until it lands; poll now, and drop the loader after a
        // grace period so it can never hang if telemetry never arrives.
        pollConversation();
        setTimeout(removeLoader, 45000);
        return;
      }
      if (p.status === 'failed') {
        clearPending();
        setStatus('#' + id + ' 执行失败：' + (p.result || p.error || '未知错误'), 'err');
        return;
      }
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
  }

  // ---- Image attachments ----

  var pendingImages = [];   // { media_type, data(base64), url(dataURL) }
  var MAX_IMAGES = 8;
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  function renderThumbs() {
    var el = document.getElementById('thumbs');
    el.innerHTML = pendingImages.map(function (img, i) {
      return '<div class="thumb"><img src="' + img.url + '" alt="">' +
        '<button class="rm" type="button" data-i="' + i + '" title="移除">×</button></div>';
    }).join('');
  }

  function addImageFile(file) {
    if (!file || file.type.indexOf('image/') !== 0) return;
    if (pendingImages.length >= MAX_IMAGES) {
      setStatus('最多添加 ' + MAX_IMAGES + ' 张图片', 'err');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus('单张图片不能超过 5MB', 'err');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var url = String(reader.result);
      var comma = url.indexOf(',');
      pendingImages.push({
        media_type: file.type,
        data: url.slice(comma + 1),   // strip "data:...;base64,"
        url: url
      });
      renderThumbs();
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('attachBtn').addEventListener('click', function () {
    document.getElementById('imgInput').click();
  });
  document.getElementById('imgInput').addEventListener('change', function (e) {
    var files = e.target.files || [];
    for (var i = 0; i < files.length; i++) addImageFile(files[i]);
    e.target.value = '';
  });
  document.getElementById('thumbs').addEventListener('click', function (e) {
    var btn = e.target.closest('.rm');
    if (btn) { pendingImages.splice(Number(btn.dataset.i), 1); renderThumbs(); }
  });

  async function sendPrompt() {
    var input = document.getElementById('promptInput');
    var btn = document.getElementById('sendPrompt');
    var prompt = input.value.trim();
    if (!prompt && !pendingImages.length) return;
    btn.disabled = true;
    setStatus('提交中…');
    var body = { prompt: prompt };
    if (pendingImages.length) {
      body.images = pendingImages.map(function (img) {
        return { media_type: img.media_type, data: img.data };
      });
    }
    if (canResume()) body.resumeSessionId = activeSessionId;

    // Show the message and a loading indicator right away, then clear the
    // composer — the user shouldn't wait for the agent to see what they sent.
    pendingSend = { text: prompt, images: pendingImages.map(function (img) {
      return { url: img.url };
    }) };
    input.value = '';
    pendingImages = [];
    renderThumbs();
    autosize(input);
    showPending();

    try {
      var res = await api('/api/agent/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 401) { clearPending(); onUnauthorized(); return; }
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        clearPending();
        setStatus('提交失败：' + (err.error || res.status), 'err');
        return;
      }
      var row = await res.json();
      setStatus('#' + row.id + ' 已提交，等待会话建立…', 'ok');
      trackPrompt(row.id);
    } catch (e) {
      clearPending();
      setStatus('提交失败：' + e, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  function autosize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  var promptInput = document.getElementById('promptInput');
  promptInput.addEventListener('input', function () { autosize(promptInput); });
  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
  });
  promptInput.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var handled = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
        var file = items[i].getAsFile();
        if (file) { addImageFile(file); handled = true; }
      }
    }
    if (handled) e.preventDefault();   // don't paste base64 text into the box
  });
  document.getElementById('sendPrompt').addEventListener('click', sendPrompt);

  document.getElementById('statusFilter').addEventListener('change', loadSessions);
  document.getElementById('refresh').addEventListener('click', loadSessions);
  document.getElementById('newChat').addEventListener('click', startNewChat);
  document.getElementById('sessionList').addEventListener('click', function (e) {
    var del = e.target.closest('.session-del');
    if (del && del.dataset.run) { e.stopPropagation(); deleteSession(del.dataset.run); return; }
    var item = e.target.closest('.session-item');
    if (item && item.dataset.run) selectSession(item.dataset.run);
  });
  document.getElementById('menuBtn').addEventListener('click', openDrawer);
  document.getElementById('scrim').addEventListener('click', closeDrawer);

  // ---- Token gate ----
  function showGate(msg) {
    document.getElementById('gateMsg').textContent = msg || '';
    document.getElementById('tokenGate').style.display = 'flex';
    document.getElementById('gateInput').focus();
  }
  function hideGate() { document.getElementById('tokenGate').style.display = 'none'; }

  async function submitToken() {
    var v = document.getElementById('gateInput').value.trim();
    if (!v) return;
    document.getElementById('gateMsg').textContent = '';
    var res = await fetch('/api/auth/me', { headers: { authorization: 'Bearer ' + v } });
    if (res.status === 401) {
      document.getElementById('gateMsg').textContent = 'Token 无效，请检查后重试。';
      return;
    }
    try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {}
    token = v;
    document.getElementById('gateInput').value = '';
    hideGate();
    start();
  }
  document.getElementById('gateBtn').addEventListener('click', submitToken);
  document.getElementById('gateInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitToken(); }
  });

  // ---- Boot ----
  async function start() {
    var me = await api('/api/auth/me');
    if (me.status === 401) { onUnauthorized(); return; }
    await loadHosted();
    await loadSessions();
    if (listTimer) clearInterval(listTimer);
    listTimer = setInterval(loadSessions, 5000);
  }

  // When auth is disabled server-side there is no token to enter, so boot
  // straight into the app; otherwise require a token first.
  if (!AUTH_ENABLED || token) { start(); } else { showGate(); }

  // ---- PWA service worker ----
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
</script>
</body></html>`;

const MANIFEST = JSON.stringify({
  name: "Agent Gateway",
  short_name: "AgentGW",
  description: "Claude Code 会话观测与远程控制",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0f1115",
  theme_color: "#0f1115",
  orientation: "any",
  icons: [
    { src: "/icon-180.png", sizes: "180x180", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ]
});

// Cache the app shell + icons; never cache /api/ so data stays live.
const SERVICE_WORKER = `
const CACHE = 'ag-shell-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/icon-180.png', '/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/api/') === 0) return;   // always hit network for data
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('/'); });
    })
  );
});
`;

const ICON_180 = Buffer.from(ICON_180_PNG_BASE64, "base64");
const ICON_512 = Buffer.from(ICON_512_PNG_BASE64, "base64");

export async function registerWeb(app: FastifyInstance): Promise<void> {
  // The shell carries no secrets; all data is gated by the Bearer token on
  // /api/*. The front-end holds the token (localStorage) and renders a login
  // gate when it is missing or rejected — this is what makes the PWA usable on
  // a phone without pasting the token into the URL every time.
  app.get("/", async (_request, reply) =>
    reply.type("text/html").send(renderHome(config.AUTH_ENABLED))
  );

  app.get("/manifest.webmanifest", async (_request, reply) =>
    reply.type("application/manifest+json").send(MANIFEST)
  );

  app.get("/sw.js", async (_request, reply) =>
    reply
      .type("text/javascript")
      .header("cache-control", "no-cache")
      .send(SERVICE_WORKER)
  );

  app.get("/icon-180.png", async (_request, reply) =>
    reply
      .type("image/png")
      .header("cache-control", "public, max-age=604800")
      .send(ICON_180)
  );

  app.get("/icon-512.png", async (_request, reply) =>
    reply
      .type("image/png")
      .header("cache-control", "public, max-age=604800")
      .send(ICON_512)
  );
}
