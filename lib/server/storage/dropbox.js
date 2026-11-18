/* 드롭박스 API — 리프레시 토큰으로 접근 토큰을 받아 씀.
   팀 계정이면 팀 스페이스(root namespace) 기준으로 경로를 해석한다. 경로는 '/'로 시작하는 드롭박스 경로 그대로. */

import path from 'node:path';

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

export const kind = 'dropbox';
/* 환경변수 — 배포 화면에 붙여 넣다 따라온 앞뒤 공백·줄바꿈·따옴표는 떼고 읽음 */
export const envv = (k) => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
export const enabled = () => !!(envv('DROPBOX_APP_KEY') && envv('DROPBOX_APP_SECRET') && envv('DROPBOX_REFRESH_TOKEN'));
/* 브라우저가 임시 업로드 주소로 한 번에 올릴 수 있는 크기 */
export const DIRECT_MAX = 150 * 1024 * 1024;

const g = globalThis;
g.__drqDbx ||= { token: null, exp: 0, pathRoot: undefined };
const S = g.__drqDbx;

/* Dropbox-API-Arg 헤더는 ASCII 만 허용 → 한글은 \uXXXX 로 */
const asciiJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

class DropboxError extends Error {
  constructor(status, summary) {
    super(`Dropbox ${status}: ${summary}`);
    this.status = status;
    this.summary = summary || '';
  }
}

async function token() {
  if (S.token && Date.now() < S.exp - 60_000) return S.token;
  const basic = Buffer.from(envv('DROPBOX_APP_KEY') + ':' + envv('DROPBOX_APP_SECRET')).toString('base64');
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + basic },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: envv('DROPBOX_REFRESH_TOKEN') }),
  });
  if (!res.ok) throw new DropboxError(res.status, await res.text());
  const j = await res.json();
  S.token = j.access_token;
  S.exp = Date.now() + (j.expires_in || 14400) * 1000;
  return S.token;
}

async function pathRootHeader() {
  if (S.pathRoot !== undefined) return S.pathRoot;
  const acc = await rpc('users/get_current_account', null, { noRoot: true });
  const ri = acc.root_info || {};
  S.pathRoot = ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id
    ? JSON.stringify({ '.tag': 'root', root: ri.root_namespace_id })
    : null;
  return S.pathRoot;
}

async function headers(extra = {}, noRoot = false) {
  const h = { authorization: 'Bearer ' + (await token()), ...extra };
  if (!noRoot) {
    const pr = await pathRootHeader();
    if (pr) h['Dropbox-API-Path-Root'] = pr;
  }
  return h;
}

async function rpc(endpoint, body, { noRoot = false } = {}) {
  const res = await fetch(API + '/' + endpoint, {
    method: 'POST',
    headers: await headers(body == null ? {} : { 'content-type': 'application/json' }, noRoot),
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let summary = '';
    try { summary = (await res.json()).error_summary; } catch { summary = await res.text().catch(() => ''); }
    throw new DropboxError(res.status, summary);
  }
  return res.json();
}

const notFound = (e) => e instanceof DropboxError && /not_found/.test(e.summary);

/* 브라우저가 직접 올릴 임시 업로드 주소 (4시간, 150MB 까지) */
export async function uploadTarget(p, { autorename = false } = {}) {
  const j = await rpc('files/get_temporary_upload_link', {
    commit_info: { path: p, mode: autorename ? 'add' : 'overwrite', autorename, mute: true },
    duration: 14400,
  });
  return { direct: true, url: j.link, max: DIRECT_MAX };
}

export async function putBytes(p, buf, { autorename = false } = {}) {
  const res = await fetch(CONTENT + '/files/upload', {
    method: 'POST',
    headers: await headers({
      'content-type': 'application/octet-stream',
      'Dropbox-API-Arg': asciiJson({ path: p, mode: autorename ? 'add' : 'overwrite', autorename, mute: true }),
    }),
    body: buf,
  });
  if (!res.ok) throw new DropboxError(res.status, await res.text());
  return (await res.json()).path_display || p;
}

export async function stat(p) {
  try {
    const m = await rpc('files/get_metadata', { path: p });
    return m['.tag'] === 'file' ? { size: m.size } : null;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

/* 같은 이름이 있으면 '이름 (1).png' … — 브라우저가 직접 올리기 전에 정해 두어야 올린 뒤 그 경로로 확인할 수 있음 */
export async function freeName(p) {
  const ext = path.posix.extname(p);
  const stem = p.slice(0, p.length - ext.length);
  let cand = p;
  for (let i = 1; await stat(cand); i++) cand = `${stem} (${i})${ext}`;
  return cand;
}

export async function isDir(p) {
  try { return (await rpc('files/get_metadata', { path: p }))['.tag'] === 'folder'; } catch (e) { if (notFound(e)) return false; throw e; }
}

/* 옮기기 — 같은 이름이 있으면 드롭박스가 '이름 (1).png' 로 바꿔 줌. 옮긴 뒤 경로를 돌려줌 */
export async function move(from, to) {
  const j = await rpc('files/move_v2', { from_path: from, to_path: to, autorename: true });
  return j.metadata.path_display;
}

export async function mkdir(p) {
  try { await rpc('files/create_folder_v2', { path: p, autorename: false }); } catch (e) {
    if (!(e instanceof DropboxError && /conflict/.test(e.summary))) throw e;
  }
}

/* 폴더 안 목록 (recursive 면 하위까지). rel = 폴더 기준 상대 경로 */
export async function list(dir, { recursive = false } = {}) {
  const out = [];
  const lower = dir.toLowerCase() + '/';
  let j;
  try { j = await rpc('files/list_folder', { path: dir, recursive, limit: 2000 }); } catch (e) { if (notFound(e)) return out; throw e; }
  for (;;) {
    for (const e of j.entries) {
      if (!e.path_lower?.startsWith(lower)) continue;
      const rel = e.path_display.slice(dir.length + 1);
      if (e['.tag'] === 'folder') out.push({ rel, folder: true });
      else if (e['.tag'] === 'file') out.push({ rel, folder: false, size: e.size, modified: e.server_modified });
    }
    if (!j.has_more) break;
    j = await rpc('files/list_folder/continue', { cursor: j.cursor });
  }
  return out;
}

export async function link(p) {
  const j = await rpc('files/get_temporary_link', { path: p });
  return j.link;
}

export async function read(p) {
  const res = await fetch(CONTENT + '/files/download', {
    method: 'POST',
    headers: await headers({ 'Dropbox-API-Arg': asciiJson({ path: p }) }),
  });
  if (!res.ok) throw new DropboxError(res.status, await res.text());
  return Buffer.from(await res.arrayBuffer());
}

export async function remove(p) {
  try { await rpc('files/delete_v2', { path: p }); } catch (e) { if (!notFound(e)) throw e; }
}

export async function removeDirIfEmpty(dir) {
  try {
    const j = await rpc('files/list_folder', { path: dir, limit: 1 });
    if (!j.entries.length) await remove(dir);
  } catch (e) { if (!notFound(e)) throw e; }
}

export const describe = () => '드롭박스 API';

/* 연결 상태 확인 (/api/health, 디자인팀) — 단계마다 됐는지와 드롭박스 오류 요약만. 비밀값은 안 내보냄 */
export async function diagnose(root) {
  const steps = [];
  const run = async (name, fn) => {
    try { steps.push({ step: name, ok: true, ...(await fn()) }); return true; } catch (e) {
      steps.push({ step: name, ok: false, error: String(e?.summary || e?.message || e).slice(0, 300) });
      return false;
    }
  };
  S.token = null; // 늘 새로 받아 봄
  S.pathRoot = undefined;
  if (!(await run('토큰 받기', async () => { await token(); return {}; }))) return steps;
  if (!(await run('계정', async () => {
    const a = await rpc('users/get_current_account', null, { noRoot: true });
    const ri = a.root_info || {};
    return { name: a.name?.display_name || '', teamSpace: !!(ri.root_namespace_id && ri.root_namespace_id !== ri.home_namespace_id) };
  }))) return steps;
  await run('요청 데스크 폴더', async () => {
    const m = await rpc('files/get_metadata', { path: root });
    if (m['.tag'] !== 'folder') throw new Error(`${root} 가 폴더가 아니에요`);
    return { path: root };
  });
  return steps;
}

/* 시험용 */
export const _t = { asciiJson };
