/* 드롭박스 연결 — 리프레시 토큰 발급 (한 번만 하면 됨)

   준비 (https://www.dropbox.com/developers/apps , 이 PC 드롭박스와 같은 회사 계정으로)
     1) Create app → Scoped access → Full Dropbox → 이름 (예: yogibo-design-desk)
     2) Permissions 탭: files.metadata.read · files.metadata.write · files.content.read · files.content.write · sharing.read · sharing.write 체크 → Submit
     3) Settings 탭 › OAuth 2 › Redirect URIs 에 http://localhost:7299/callback 추가 (Add)
     4) Settings 탭의 App key · App secret 을 .env.local 의 DROPBOX_APP_KEY · DROPBOX_APP_SECRET 에 넣고 저장

   실행
     npm run dropbox:auth             → 브라우저에서 http://localhost:7299 열기 → [허용]
     npm run dropbox:auth -- --check  → 지금 .env.local 의 토큰으로 연결 확인만 (토큰은 안 바꿈)
     리디렉트 주소 없이: npm run dropbox:auth -- --manual (주소 출력) → 허용 뒤 npm run dropbox:auth -- <코드>

   연결 확인
     1단계 (통과해야 .env.local 의 DROPBOX_REFRESH_TOKEN 을 채움) = 권한 · 계정(팀 스페이스) · DROPBOX_ROOT 폴더 · 파일 올리기
     2단계 (문제가 있어도 토큰은 저장하고 알려만 줌) = 임시 업로드 주소(브라우저 직접 올리기 · CORS · 들어간 위치) · 옮기기 · 받기 · 목록
     시험 파일은 <루트>/_연결시험_… 에 만들고 지움. 팀 스페이스면 개인 폴더 쪽에 남은 시험 폴더도 정리.
   토큰·비밀값은 화면에 찍지 않는다. */
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';

const ENV = '.env.local';
const PORT = 7299;
const REDIRECT = `http://localhost:${PORT}/callback`;
// sharing.* = 이미지·결과물 '드롭박스 링크 복사' (11-18 추가)
const NEED = ['files.metadata.read', 'files.metadata.write', 'files.content.read', 'files.content.write', 'sharing.read', 'sharing.write'];
const DEFAULT_ROOT = '/2026_요기코퍼레이션_온라인·마케팅·디자인/03_디자인/11_디자인요청 데스크';
const WAIT_MIN = 60;
const ORIGIN = 'http://localhost:7200';
const TEST_PREFIX = '_연결시험_';

/* ---------- .env.local ---------- */
function settings() {
  let e = {};
  try { e = parseEnv(fs.readFileSync(ENV, 'utf8')); } catch {}
  let root = String(e.DROPBOX_ROOT || DEFAULT_ROOT).trim().replace(/\\/g, '/');
  if (!root.startsWith('/')) root = '/' + root;
  return {
    key: String(e.DROPBOX_APP_KEY || '').trim(),
    secret: String(e.DROPBOX_APP_SECRET || '').trim(),
    refresh: String(e.DROPBOX_REFRESH_TOKEN || '').trim(),
    root: root.replace(/\/+$/, ''),
  };
}

function saveToken(token) {
  const line = 'DROPBOX_REFRESH_TOKEN=' + token;
  const env = fs.readFileSync(ENV, 'utf8');
  const re = /^DROPBOX_REFRESH_TOKEN=.*$/m;
  fs.writeFileSync(ENV, re.test(env) ? env.replace(re, () => line) : env.replace(/\s*$/, '') + '\n' + line + '\n');
}

/* ---------- 드롭박스 호출 ---------- */
class Fail extends Error {
  constructor(step, message, hint = '') {
    super(message);
    this.step = step;
    this.hint = hint;
  }
}
const SCOPE_HINT = 'App Console 의 Permissions 탭에서 체크하고 Submit 을 누른 뒤, 다시 허용해 주세요.';

/* Dropbox-API-Arg 헤더는 ASCII 만 허용 → 한글은 \uXXXX 로 */
const asciiJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const stamp = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const why = (e) => e?.summary || e?.message || String(e);

async function oauth(s, body) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(s.key + ':' + s.secret).toString('base64') },
    body,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const hint = j.error === 'invalid_client' ? '.env.local 의 DROPBOX_APP_KEY · DROPBOX_APP_SECRET 이 App Console Settings 탭 값과 같은지 확인해 주세요.'
      : j.error === 'invalid_grant' ? '허용 코드(또는 토큰)가 만료·취소됐어요. 다시 허용해 주세요.'
      : '';
    throw new Fail('토큰 받기', j.error_description || j.error || 'HTTP ' + res.status, hint);
  }
  return j;
}
const tokenFromCode = (s, code, redirect) => oauth(s, new URLSearchParams({ code, grant_type: 'authorization_code', ...(redirect ? { redirect_uri: redirect } : {}) }));
const tokenFromRefresh = (s) => oauth(s, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refresh }));

function client(token, pathRoot) {
  const auth = { authorization: 'Bearer ' + token, ...(pathRoot ? { 'Dropbox-API-Path-Root': pathRoot } : {}) };
  const failOf = async (what, res) => {
    let t = '', j = null;
    try { t = await res.text(); j = JSON.parse(t); } catch {}
    return Object.assign(new Error(what), { status: res.status, summary: j?.error_summary || t.slice(0, 200) || 'HTTP ' + res.status, scope: j?.error?.required_scope });
  };
  return {
    async rpc(ep, body) {
      const res = await fetch('https://api.dropboxapi.com/2/' + ep, {
        method: 'POST',
        headers: body == null ? auth : { ...auth, 'content-type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw await failOf(ep, res);
      return res.json();
    },
    async upload(path, data) {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/octet-stream', 'Dropbox-API-Arg': asciiJson({ path, mode: 'add', autorename: true, mute: true }) },
        body: data,
      });
      if (!res.ok) throw await failOf('files/upload', res);
      return res.json();
    },
  };
}

/* 한 단계 실행 — 드롭박스 오류를 알아듣기 쉬운 말로 */
async function step(name, fn, hintOf) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Fail) throw e;
    if (e.scope || /missing_scope/.test(e.summary || '')) throw new Fail(name, `권한이 빠졌어요 (${e.scope || 'missing_scope'})`, SCOPE_HINT);
    throw new Fail(name, why(e), (hintOf && hintOf(e)) || '');
  }
}

const isFile = async (c, p) => {
  try { return (await c.rpc('files/get_metadata', { path: p }))['.tag'] === 'file'; } catch { return false; }
};

/* 브라우저(7200 화면)가 임시 업로드 주소로 바로 올릴 수 있는지 — 사전 요청(preflight)만 보냄 */
async function corsCheck(link) {
  try {
    const res = await fetch(link, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    const allow = res.headers.get('access-control-allow-origin');
    return res.status < 300 && (allow === '*' || allow === ORIGIN);
  } catch {
    return false;
  }
}

/* ---------- 연결 확인 ---------- */
async function prepare(tok, s) {
  if (tok.scope) {
    const got = String(tok.scope).split(/\s+/);
    const miss = NEED.filter((x) => !got.includes(x));
    if (miss.length) throw new Fail('권한(Permissions)', '빠진 권한: ' + miss.join(', '), SCOPE_HINT);
  }
  const acc = await step('계정 확인', () => client(tok.access_token, null).rpc('users/get_current_account', null));
  const ri = acc.root_info || {};
  const rootNs = ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id ? ri.root_namespace_id : null;
  return {
    s,
    rootNs,
    dbx: client(tok.access_token, rootNs ? JSON.stringify({ '.tag': 'root', root: rootNs }) : null), // 팀 스페이스 맨 위 기준
    home: client(tok.access_token, null), // 개인 폴더 기준
    test: `${s.root}/${TEST_PREFIX}${stamp()}`,
    made: false,
    out: { name: acc.name?.display_name || '', email: acc.email || '', team: acc.team?.name || '', teamSpace: !!rootNs, root: s.root, cors: null, tempLink: '', issues: [], cleaned: [], leftover: '', saved: false },
  };
}

/* 1단계 — 폴더가 보이고 파일을 올릴 수 있어야 함 */
async function basic(ctx) {
  const { dbx, s } = ctx;
  const meta = await step('요청 데스크 폴더', () => dbx.rpc('files/get_metadata', { path: s.root }), (e) =>
    /not_found/.test(e.summary || '') ? `이 계정에서는 ${s.root} 폴더가 안 보여요. 이 PC 드롭박스와 같은 계정으로 허용했는지, .env.local 의 DROPBOX_ROOT 가 맞는지 확인해 주세요.` : '');
  if (meta['.tag'] !== 'folder') throw new Fail('요청 데스크 폴더', `${s.root} 가 폴더가 아니에요.`);
  await step('쓰기 (파일 올리기)', () => dbx.upload(`${ctx.test}/연결시험.txt`, Buffer.from('디자인 요청 데스크 연결 시험 — 곧 지워져요\n')), (e) =>
    /no_write_permission|insufficient_space|disallowed/.test(e.summary || '') ? '이 계정은 이 폴더에 쓸 수 없어요. 편집 권한이 있는 계정으로 허용해 주세요.' : '');
  ctx.made = true;
}

/* 2단계 — 앱이 쓰는 나머지 동작. 문제는 out.issues 에 모음 */
async function extra(ctx) {
  const { dbx, home, test, out } = ctx;
  const issue = (m) => out.issues.push(m);
  try {
    const target = `${test}/브라우저직접.txt`;
    // 앱과 똑같이: 일반 경로 + Path-Root 헤더 (11-18 확인: 팀 폴더로 들어감, 응답 뒤 0.3~0.5초 지나야 보임)
    const { link } = await dbx.rpc('files/get_temporary_upload_link', { commit_info: { path: target, mode: 'add', autorename: true, mute: true }, duration: 600 });
    out.cors = await corsCheck(link);
    if (!out.cors) issue('브라우저에서 바로 올리기(CORS)가 막혀 있어요');
    const put = await fetch(link, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('direct\n') });
    if (!put.ok) {
      issue(`임시 업로드 주소로 올리기 실패 (HTTP ${put.status})`);
    } else {
      for (let i = 0; i < 5 && !out.tempLink; i++) {
        if (i) await sleep(700);
        if (await isFile(dbx, target)) out.tempLink = '팀 폴더';
      }
      if (!out.tempLink && ctx.rootNs && (await isFile(home, target))) out.tempLink = '개인 폴더';
      if (out.tempLink !== '팀 폴더') issue(out.tempLink ? '임시 업로드 주소로 올린 파일이 팀 폴더가 아니라 개인 폴더로 들어갔어요' : '임시 업로드 주소로 올린 파일을 찾지 못했어요');
    }
  } catch (e) {
    issue('임시 업로드 주소: ' + why(e));
  }
  try {
    await dbx.rpc('files/move_v2', { from_path: `${test}/연결시험.txt`, to_path: `${test}/옮김/연결시험.txt`, autorename: true });
    const { link: dl } = await dbx.rpc('files/get_temporary_link', { path: `${test}/옮김/연결시험.txt` });
    if (!(await fetch(dl).then((r) => r.text())).includes('연결 시험')) issue('받은 파일 내용이 올린 것과 달라요');
    // 하위까지 목록은 첫 장에 다 안 올 때가 많음 → 다음 장(cursor)까지 읽어야 함
    let ls = await dbx.rpc('files/list_folder', { path: test, recursive: true });
    out.listed = ls.entries.filter((x) => x['.tag'] === 'file').length;
    while (ls.has_more) {
      ls = await dbx.rpc('files/list_folder/continue', { cursor: ls.cursor });
      out.listed += ls.entries.filter((x) => x['.tag'] === 'file').length;
    }
    const want = out.tempLink === '팀 폴더' ? 2 : 1;
    if (out.listed !== want) issue(`시험 폴더 목록에 파일이 ${out.listed}개 보여요 (${want}개여야 해요)`);
  } catch (e) {
    issue('옮기기 · 받기 · 목록: ' + why(e));
  }
}

/* 시험 폴더 지우기 — 팀 쪽 + (팀 스페이스면) 개인 폴더 쪽에 생긴 같은 경로의 시험 폴더와, 그 때문에 생긴 빈 상위 폴더 */
async function cleanup(ctx) {
  const { out } = ctx;
  if (ctx.made) {
    try { await ctx.dbx.rpc('files/delete_v2', { path: ctx.test }); } catch (e) { if (!/not_found/.test(e.summary || '')) out.leftover = ctx.test; }
  }
  if (!ctx.rootNs) return;
  let ls;
  try { ls = await ctx.home.rpc('files/list_folder', { path: ctx.s.root, limit: 2000 }); } catch { return; }
  for (const e of ls.entries) {
    if (e['.tag'] !== 'folder' || !e.name.startsWith(TEST_PREFIX)) continue;
    try { await ctx.home.rpc('files/delete_v2', { path: e.path_lower }); out.cleaned.push('개인 폴더' + e.path_display); } catch {}
  }
  const parts = ctx.s.root.split('/').filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const p = '/' + parts.slice(0, i).join('/');
    try {
      if ((await ctx.home.rpc('files/list_folder', { path: p, limit: 1 })).entries.length) break;
      await ctx.home.rpc('files/delete_v2', { path: p });
      out.cleaned.push('개인 폴더' + p + ' (빈 폴더)');
    } catch {
      break;
    }
  }
}

async function connect(tok, s, { save }) {
  const ctx = await prepare(tok, s);
  try {
    await basic(ctx);
    if (save) {
      saveToken(tok.refresh_token);
      ctx.out.saved = true;
    }
    await extra(ctx);
  } finally {
    await cleanup(ctx);
  }
  return ctx.out;
}

/* ---------- 결과 보여주기 (토큰·비밀값·이메일은 콘솔에 안 찍음) ---------- */
function report(r) {
  console.log(`\n연결됨: ${r.name}${r.team ? ` · 팀 ${r.team}` : ''} · ${r.teamSpace ? '팀 스페이스 맨 위 기준 경로' : '개인 공간 기준 경로'}`);
  console.log(`요청 데스크 폴더 · 파일 올리기: 확인 (${r.root})`);
  console.log(`임시 업로드 주소: ${r.tempLink || '-'} · CORS: ${r.cors == null ? '-' : r.cors ? '확인' : '막힘'} · 시험 폴더 파일 수: ${r.listed ?? '-'}`);
  if (r.issues.length) console.log('문제:\n' + r.issues.map((x) => '  - ' + x).join('\n'));
  if (r.cleaned.length) console.log('정리한 시험 폴더:\n' + r.cleaned.map((x) => '  - ' + x).join('\n'));
  if (r.leftover) console.log('못 지운 시험 폴더: ' + r.leftover);
  console.log(r.saved ? '.env.local 의 DROPBOX_REFRESH_TOKEN 을 채웠어요.\n' : '');
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(res, status, title, body, tone = 'info') {
  const dot = tone === 'ok' ? '#20B08A' : tone === 'bad' ? '#E5534B' : '#3FA6D3';
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>드롭박스 연결</title>
<style>body{margin:0;background:#fff;color:#1d2433;font:16px/1.65 Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
main{max-width:600px;margin:12vh auto;padding:0 16px}h1{font-size:22px;margin:0 0 14px;display:flex;align-items:center;gap:10px}
h1 i{width:10px;height:10px;border-radius:50%;background:${dot};flex:none}ul{padding-left:20px;margin:0 0 14px}li{margin:4px 0}
code{background:#f2f4f7;padding:1px 6px;border-radius:6px;font-size:14px}a{color:#3FA6D3}.muted{color:#6b7280;font-size:14px}</style></head>
<body><main><h1><i></i>${esc(title)}</h1>${body}</main></body></html>`);
}

function resultHtml(r) {
  const li = (t) => `<li>${t}</li>`;
  return `<ul>
${li(`계정: ${esc(r.name)}${r.email ? ` (${esc(r.email)})` : ''}${r.team ? ` · 팀 ${esc(r.team)}` : ''}`)}
${li(`경로 기준: ${r.teamSpace ? '팀 스페이스 맨 위' : '개인 공간'}`)}
${li('요청 데스크 폴더 · 파일 올리기: 확인')}
${r.issues.map((x) => li(`<b>확인 필요</b> — ${esc(x)}`)).join('\n')}
</ul><p><code>.env.local</code> 의 <code>DROPBOX_REFRESH_TOKEN</code> 을 채웠어요.${r.issues.length ? ' 남은 문제는 Claude 가 이어서 고칠게요 — 다시 허용하실 필요는 없어요.' : ''} 이 창은 닫으셔도 돼요.</p>`;
}

/* ---------- 실행 ---------- */
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail('연결', why(e));
    console.error(`\n실패 — ${f.step}: ${f.message}${f.hint ? `\n  → ${f.hint}` : ''}\n`);
    process.exitCode = 1;
  }
}

function needKeys(s) {
  if (s.key && s.secret) return true;
  console.error('.env.local 에 DROPBOX_APP_KEY 와 DROPBOX_APP_SECRET 을 먼저 넣어 주세요.');
  process.exitCode = 1;
  return false;
}

async function serve() {
  const state = crypto.randomBytes(16).toString('hex');
  let busy = false;
  let finished = false;

  const handler = async (req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname === '/') {
      const s = settings();
      if (!s.key || !s.secret) {
        return page(res, 200, 'App key · App secret 이 아직 없어요',
          `<p><code>.env.local</code> 의 <code>DROPBOX_APP_KEY=</code> · <code>DROPBOX_APP_SECRET=</code> 뒤에 붙여넣고 저장한 다음, 이 페이지를 새로고침해 주세요.</p>
<p class="muted">값은 드롭박스 App Console › 내 앱 › Settings 탭에 있어요 (App secret 은 Show 를 눌러야 보여요).</p>`);
      }
      const q = new URLSearchParams({ client_id: s.key, response_type: 'code', token_access_type: 'offline', redirect_uri: REDIRECT, state });
      res.writeHead(302, { location: 'https://www.dropbox.com/oauth2/authorize?' + q, 'cache-control': 'no-store' });
      return res.end();
    }
    if (u.pathname !== '/callback') {
      res.writeHead(404);
      return res.end();
    }
    if (finished) return page(res, 200, '이미 연결을 마쳤어요', '<p>이 창은 닫으셔도 돼요.</p>', 'ok');
    if (u.searchParams.get('state') !== state) return page(res, 400, '주소가 맞지 않아요', '<p><a href="/">처음부터 다시</a> 해 주세요.</p>', 'bad');
    const err = u.searchParams.get('error');
    if (err) {
      console.log(`허용하지 않음: ${err}`);
      return page(res, 200, '허용하지 않았어요', `<p class="muted">${esc(u.searchParams.get('error_description') || err)}</p><p><a href="/">다시 하기</a></p>`, 'bad');
    }
    if (busy) return page(res, 409, '확인하는 중이에요', '<p>잠시 뒤 새로고침해 주세요.</p>');
    busy = true;
    try {
      const s = settings();
      const tok = await tokenFromCode(s, u.searchParams.get('code') || '', REDIRECT);
      const r = await connect(tok, s, { save: true });
      finished = true;
      page(res, 200, r.issues.length ? '드롭박스 연결은 됐어요' : '드롭박스 연결을 마쳤어요', resultHtml(r), r.issues.length ? 'info' : 'ok');
      report(r);
      setTimeout(() => process.exit(0), 500);
    } catch (e) {
      const f = e instanceof Fail ? e : new Fail('연결', why(e));
      console.log(`실패 — ${f.step}: ${f.message}${f.hint ? ` → ${f.hint}` : ''}`);
      page(res, 200, '연결하지 못했어요',
        `<p><b>${esc(f.step)}</b>: ${esc(f.message)}</p>${f.hint ? `<p>${esc(f.hint)}</p>` : ''}
<p>고친 뒤 <a href="/">여기</a>를 눌러 다시 허용하면 돼요. <span class="muted">(.env.local 은 바꾸지 않았어요)</span></p>`, 'bad');
    } finally {
      busy = false;
    }
  };

  // localhost 가 IPv4·IPv6 어느 쪽으로 풀려도 받도록 둘 다 (루프백만 — 방화벽 창 안 뜸)
  for (const host of ['127.0.0.1', '::1']) {
    await new Promise((resolve) => {
      const srv = http.createServer((req, res) => { handler(req, res).catch(() => { try { res.end(); } catch {} }); });
      srv.once('error', (e) => {
        if (host === '127.0.0.1') {
          console.error(e.code === 'EADDRINUSE' ? `${PORT} 포트를 이미 쓰고 있어요 (도우미가 벌써 켜져 있나 확인해 주세요).` : `도우미를 켜지 못했어요: ${e.message}`);
          process.exit(1);
        }
        resolve();
      });
      srv.listen(PORT, host, resolve);
    });
  }
  console.log(`\n드롭박스 연결 도우미가 켜졌어요 (${WAIT_MIN}분 동안 기다림)`);
  console.log(`  1) 브라우저에서  http://localhost:${PORT}  를 열고 [허용]을 눌러 주세요.`);
  console.log(`  2) App Console › Settings › Redirect URIs 에  ${REDIRECT}  가 있어야 해요.\n`);
  setTimeout(() => {
    console.log(`${WAIT_MIN}분 동안 허용이 없어 끝냈어요. 다시: npm run dropbox:auth`);
    process.exit(2);
  }, WAIT_MIN * 60_000);
}

const arg = process.argv[2] || '';
if (arg === '--check') {
  const s = settings();
  if (!s.refresh) {
    console.error('.env.local 에 DROPBOX_REFRESH_TOKEN 이 없어요. 먼저 npm run dropbox:auth 로 연결해 주세요.');
    process.exitCode = 1;
  } else if (needKeys(s)) {
    await run(async () => report(await connect(await tokenFromRefresh(s), s, { save: false })));
  }
} else if (arg === '--manual') {
  const s = settings();
  if (needKeys(s)) {
    const q = new URLSearchParams({ client_id: s.key, response_type: 'code', token_access_type: 'offline' });
    console.log(`\n아래 주소를 열고 [허용]을 누른 뒤, 나온 코드로  npm run dropbox:auth -- <코드>\n\n  https://www.dropbox.com/oauth2/authorize?${q}\n`);
  }
} else if (arg && !arg.startsWith('-')) {
  const s = settings();
  if (needKeys(s)) await run(async () => report(await connect(await tokenFromCode(s, arg, null), s, { save: true })));
} else {
  await serve();
}
