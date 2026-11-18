/* 드롭박스 경로 → 이 PC 폴더.
   DROPBOX_LOCAL_DIR(드롭박스 동기화 폴더 맨 위)가 있으면 그곳, 없으면 ./.data/dropbox (개발용 흉내).
   (주의: Node 24 의 fs.rm/rmSync 는 한글 경로에서 죽는 일이 있어 unlink/rmdir 만 씀) */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const kind = 'local';
export const enabled = () => true;

const base = () => path.resolve(/*turbopackIgnore: true*/ process.env.DROPBOX_LOCAL_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), '.data', 'dropbox'));
export function osPath(p) {
  const parts = String(p).split('/').filter(Boolean);
  if (parts.some((x) => x === '..' || x === '.')) throw new Error('잘못된 경로');
  return path.join(/*turbopackIgnore: true*/ base(), ...parts);
}

export async function uploadTarget() {
  return { direct: false };
}

async function freeName(p) {
  const ext = path.posix.extname(p);
  const stem = p.slice(0, p.length - ext.length);
  let cand = p;
  for (let i = 1; await stat(cand); i++) cand = `${stem} (${i})${ext}`;
  return cand;
}

export async function putBytes(p, buf, { autorename = false } = {}) {
  const dest = autorename ? await freeName(p) : p;
  await fsp.mkdir(path.dirname(osPath(dest)), { recursive: true });
  await fsp.writeFile(osPath(dest), buf);
  return dest;
}

/* 큰 결과물 파일은 메모리에 다 올리지 않고 흘려서 저장 */
export async function putStream(p, webStream, { autorename = false, maxBytes } = {}) {
  const dest = autorename ? await freeName(p) : p;
  const file = osPath(dest);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let n = 0;
  const src = Readable.fromWeb(webStream);
  src.on('data', (c) => { n += c.length; if (maxBytes && n > maxBytes) src.destroy(new Error('too_large')); });
  try {
    await pipeline(src, fs.createWriteStream(file));
  } catch (e) {
    try { await fsp.unlink(file); } catch {}
    throw e;
  }
  return dest;
}

export async function stat(p) {
  try {
    const s = await fsp.stat(osPath(p));
    return s.isFile() ? { size: s.size } : null;
  } catch { return null; }
}

export async function isDir(p) {
  try { return (await fsp.stat(osPath(p))).isDirectory(); } catch { return false; }
}

export async function move(from, to) {
  const dest = await freeName(to);
  await fsp.mkdir(path.dirname(osPath(dest)), { recursive: true });
  await fsp.rename(osPath(from), osPath(dest));
  return dest;
}

export async function mkdir(p) {
  await fsp.mkdir(osPath(p), { recursive: true });
}

/* 폴더 안 목록 (recursive 면 하위까지). rel = 폴더 기준 상대 경로 */
export async function list(dir, { recursive = false } = {}) {
  const out = [];
  async function walk(d, prefix) {
    let ents;
    try { ents = await fsp.readdir(osPath(d), { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const e of ents) {
      if (e.name === 'desktop.ini' || e.name.startsWith('.')) continue;
      const rel = prefix ? prefix + '/' + e.name : e.name;
      const p = d + '/' + e.name;
      if (e.isDirectory()) {
        out.push({ rel, folder: true });
        if (recursive) await walk(p, rel);
      } else if (e.isFile()) {
        const s = await fsp.stat(osPath(p)).catch(() => null);
        out.push({ rel, folder: false, size: s?.size || 0, modified: s?.mtime?.toISOString() || '' });
      }
    }
  }
  await walk(dir, '');
  return out;
}

export async function link() {
  return null;
}

export async function read(p) {
  return fsp.readFile(osPath(p));
}

export function readStream(p) {
  return fs.createReadStream(osPath(p));
}

export async function remove(p) {
  try { await fsp.unlink(osPath(p)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

export async function removeDirIfEmpty(dir) {
  try {
    const p = osPath(dir);
    if (!(await fsp.readdir(p)).filter((n) => n !== 'desktop.ini').length) {
      try { await fsp.unlink(path.join(/*turbopackIgnore: true*/ p, 'desktop.ini')); } catch {}
      await fsp.rmdir(p);
    }
  } catch {}
}

export const describe = () => (process.env.DROPBOX_LOCAL_DIR ? `이 PC 드롭박스 폴더 ${base()}` : `개발용 폴더 ${base()}`);
