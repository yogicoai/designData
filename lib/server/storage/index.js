/* 이미지·결과물 저장소
   모든 경로는 '드롭박스 경로' 하나로 다룬다 (팀 스페이스 맨 위 기준, '/'로 시작).
     예) /2026_요기코퍼레이션_온라인·마케팅·디자인/03_디자인/11_디자인요청 데스크/2026-11-17_연말 기획전/요청사항/레퍼런스_01.png
   이 경로에 닿는 방법만 셋 중 하나:
     1. 드롭박스 API      — DROPBOX_APP_KEY·SECRET·REFRESH_TOKEN 이 있을 때 (배포 서버)
     2. 이 PC 드롭박스 폴더 — DROPBOX_LOCAL_DIR (예: C:\Users\Yogibo Design\Yogicorporation Dropbox) 에 직접 쓰면 드롭박스 앱이 동기화
     3. 개발용 흉내 폴더    — 둘 다 없으면 ./.data/dropbox 에 같은 구조로

   요청 폴더 구조
     <DROPBOX_ROOT>/_임시업로드/YYYY-MM/<파일id>.png        ← 제출 전에 올린 이미지 (제출하면 옮김, 14일 지나면 정리)
     <DROPBOX_ROOT>/<요청일>_<프로젝트명>/요청사항/…          ← 요청서에 넣은 이미지
     <DROPBOX_ROOT>/<요청일>_<프로젝트명>/결과물/1차완성본/…   ← 디자인팀 완성본 (수정마다 2차·3차…) */
import path from 'node:path';
import * as dropbox from './dropbox.js';
import * as local from './local.js';
import { safeName } from '../../shared/model.js';

/* DROPBOX_MODE: local → 키가 있어도 이 PC 폴더(DROPBOX_LOCAL_DIR 또는 .data/dropbox) · api → 드롭박스 API · 비우면 키가 있으면 API */
export function store() {
  const mode = String(process.env.DROPBOX_MODE || '').trim().toLowerCase();
  if (mode === 'local') return local;
  if (mode === 'api' && !dropbox.enabled()) throw new Error('DROPBOX_MODE=api 인데 DROPBOX_APP_KEY · DROPBOX_APP_SECRET · DROPBOX_REFRESH_TOKEN 이 다 있지 않아요.');
  return dropbox.enabled() ? dropbox : local;
}

const DEFAULT_ROOT = '/2026_요기코퍼레이션_온라인·마케팅·디자인/03_디자인/11_디자인요청 데스크';
export function rootPath() {
  let r = (process.env.DROPBOX_ROOT || DEFAULT_ROOT).trim().replace(/\\/g, '/');
  if (!r.startsWith('/')) r = '/' + r;
  return r.replace(/\/+$/, '');
}
export const join = (...p) => path.posix.join(...p);

/* 드롭박스 임시 업로드 주소로 올린 파일은 응답 뒤 0.3~0.5초쯤 지나야 보임(11-18 측정) → 잠깐 기다리며 다시 봄 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function statSettled(p, wait = 8000) {
  const st = store();
  let s = await st.stat(p);
  for (const t0 = Date.now(); !s && st.kind === 'dropbox' && Date.now() - t0 < wait; ) {
    await sleep(400);
    s = await st.stat(p);
  }
  return s;
}

export const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
export const REQ_DIR = '요청사항';
export const OUT_DIR = '결과물';
export const roundName = (n) => `${n}차완성본`;
export const ROUND_RE = /^(\d{1,3})\s*차\s*완성본$/;

export const tempPath = (id, type, month) => join(rootPath(), '_임시업로드', month, `${id}.${EXT[type] || 'bin'}`);

/* 요청 폴더: <월>/<요청일>_<부서>_<프로젝트명>  (같은 이름이 있으면 ' (2)' …)
   월별 묶음이 싫으면 BY_MONTH 를 false 로 — 루트 바로 아래에 요청 폴더가 생김 */
const BY_MONTH = true;
export async function pickFolder(db, r) {
  const month = (r.requestDate || '').slice(0, 7) || '미분류';
  const name = [r.requestDate, safeName(r.dept), safeName(r.title).slice(0, 60)].filter(Boolean).join('_') || r.no;
  const base = BY_MONTH ? join(rootPath(), month, name) : join(rootPath(), name);
  // DB 에 같은 폴더를 쓰는 요청이 있거나, 드롭박스에 이미 폴더가 있으면(삭제된 요청의 결과물 폴더 등) 다음 번호
  const st = store();
  const taken = async (p) => !!(await db.collection('requests').findOne({ folder: p }, { projection: { _id: 1 } })) || (await st.isDir(p).catch(() => false));
  let cand = base;
  for (let i = 2; await taken(cand); i++) cand = `${base} (${i})`;
  return cand;
}
export const requestDocName = (r) => `요청서_${r.no}.docx`;

/* 접수 때 빈 폴더까지 만들어 둠: 요청사항 / 결과물/1차완성본 */
export async function ensureRequestFolders(folder) {
  const st = store();
  for (const p of [join(folder, REQ_DIR), join(folder, OUT_DIR, roundName(1))]) {
    try { await st.mkdir(p); } catch (e) { console.error('[storage] 폴더 만들기 실패', p, e?.message); }
  }
}

/* 요청사항 안 이름: 기획안_01.png / 레퍼런스_02_원본이름.png */
const GENERIC = /^(image|images|img|이미지|clipboard|blob|unnamed|붙여넣은 이미지|스크린샷|screenshot)(\s*\(\d+\))?$/i;
export function attachName(role, seq, name, type) {
  const ext = EXT[type] || 'bin';
  const stem = safeName(String(name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '')).replace(/^\.+/, '');
  const head = `${role === 'ref' ? '레퍼런스' : '기획안'}_${String(seq).padStart(2, '0')}`;
  return stem && !GENERIC.test(stem) ? `${head}_${stem.slice(0, 40)}.${ext}` : `${head}.${ext}`;
}

/* 결과물로 올리는 파일 이름은 디자이너가 붙인 그대로 (위험한 글자만 바꿈) */
export function uploadName(name) {
  const n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 150);
  return n || 'file';
}

/* 결과물 폴더 안 상대 경로 검사: '1차완성본/PC/main.jpg' */
export function safeRel(rel) {
  const s = String(rel || '');
  if (!s || s.length > 500 || s.startsWith('/') || s.includes('\\')) return null;
  const parts = s.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return null;
  return s;
}

/* 관리자에게 보여 줄 폴더 위치 */
export function folderLinks(folder) {
  const webUrl = 'https://www.dropbox.com/home' + folder.split('/').map(encodeURIComponent).join('/');
  const base = process.env.DROPBOX_LOCAL_DIR;
  const osPath = base ? path.join(base, ...folder.split('/').filter(Boolean)) : store() === local ? local.osPath(folder) : null;
  return { webUrl, osPath };
}

export const describe = () => `${store().describe()} · 루트 ${rootPath()}`;
