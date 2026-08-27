import type { FastifyInstance } from "fastify";

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0f1115; color: #e6e8eb; min-height: 100vh;
  }
  a { color: #6ea8fe; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px; }
  .card {
    background: #171a21; border: 1px solid #262b34; border-radius: 12px;
    padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,.3);
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #9aa4b2; font-size: 13px; }
  label { display: block; font-size: 13px; color: #9aa4b2; margin: 14px 0 6px; }
  input {
    width: 100%; padding: 10px 12px; border-radius: 8px;
    border: 1px solid #2c323d; background: #0f1115; color: #e6e8eb; font-size: 15px;
  }
  button {
    margin-top: 18px; padding: 10px 16px; border: 0; border-radius: 8px;
    background: #3b82f6; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button.secondary { background: #2c323d; }
  button:disabled { opacity: .6; cursor: default; }
  .err { color: #f87171; font-size: 13px; margin-top: 12px; min-height: 18px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 18px; }
  .stat { background: #0f1115; border: 1px solid #262b34; border-radius: 10px; padding: 14px; }
  .stat .k { font-size: 12px; color: #9aa4b2; }
  .stat .v { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .login-wrap { max-width: 380px; margin: 10vh auto 0; }
`;

const LOGIN_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Gateway · Sign in</title><style>${PAGE_STYLE}</style>
</head><body><div class="wrap login-wrap"><div class="card">
  <h1>Agent Gateway</h1>
  <p class="muted">Sign in to continue</p>
  <form id="f">
    <label for="u">Username</label>
    <input id="u" name="username" autocomplete="username" autofocus required>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <button id="b" type="submit">Sign in</button>
    <div class="err" id="e"></div>
  </form>
</div></div>
<script>
  const f = document.getElementById('f'), e = document.getElementById('e'), b = document.getElementById('b');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault(); e.textContent = ''; b.disabled = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: f.username.value, password: f.password.value })
      });
      if (res.ok) { location.href = '/'; return; }
      const data = await res.json().catch(() => ({}));
      e.textContent = data.error === 'invalid_credentials' ? 'Invalid username or password.' : 'Sign-in failed.';
    } catch { e.textContent = 'Network error.'; }
    b.disabled = false;
  });
</script>
</body></html>`;

const HOME_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Gateway</title><style>${PAGE_STYLE}</style>
</head><body><div class="wrap"><div class="card">
  <div class="row">
    <div>
      <h1>Agent Gateway</h1>
      <p class="muted">Signed in as <b id="who">…</b></p>
    </div>
    <button class="secondary" id="logout" type="button">Log out</button>
  </div>
  <div class="grid" id="stats"></div>
  <p class="muted" style="margin-top:18px">
    API: <a href="/api/stats">/api/stats</a> · <a href="/api/runs">/api/runs</a> · <a href="/health">/health</a>
  </p>
</div></div>
<script>
  async function boot() {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ user: null }));
    if (!me.user) { location.href = '/login'; return; }
    document.getElementById('who').textContent = me.user.username;
    try {
      const s = await fetch('/api/stats', { credentials: 'same-origin' }).then(r => r.json());
      const fields = [
        ['Total runs', s.total_runs], ['Running', s.running], ['Waiting', s.waiting],
        ['Failed', s.failed], ['Input tokens', s.input_tokens], ['Output tokens', s.output_tokens],
        ['Est. cost (USD)', s.estimated_cost_usd]
      ];
      document.getElementById('stats').innerHTML = fields.map(
        ([k, v]) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + (v ?? '—') + '</div></div>'
      ).join('');
    } catch {}
  }
  document.getElementById('logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.href = '/login';
  });
  boot();
</script>
</body></html>`;

export async function registerWeb(app: FastifyInstance): Promise<void> {
  app.get("/login", async (_request, reply) => {
    return reply.type("text/html").send(LOGIN_HTML);
  });
  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(HOME_HTML);
  });
}
