import fsp from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { store, join, OUT_DIR, safeRel } from '@/lib/server/storage';
import { osPath } from '@/lib/server/storage/local';

const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', zip: 'application/zip',
};
const INLINE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'mov']);

async function target(req, params) {
  const { id } = await params;
  const rel = safeRel(req.nextUrl.searchParams.get('p'));
  if (!rel) return {};
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id }, { projection: { folder: 1 } });
  if (!r?.folder) return {};
  return { p: join(r.folder, OUT_DIR, rel), rel };
}

/* 결과물 파일 보기·받기 (?dl=1 이면 내려받기) */
export const GET = handle(async (req, { params }) => {
  const { p, rel } = await target(req, params);
  if (!p) return fail('not_found', '파일을 찾을 수 없어요.', 404);
  const st = store();
  if (st.kind === 'dropbox') {
    const url = await st.link(p).catch(() => null);
    if (!url) return fail('not_found', '파일을 찾을 수 없어요.', 404);
    const res = NextResponse.redirect(url, 302);
    res.headers.set('Cache-Control', 'private, max-age=600');
    return res;
  }
  const file = osPath(p);
  const s = await fsp.stat(file).catch(() => null);
  if (!s?.isFile()) return fail('not_found', '파일을 찾을 수 없어요.', 404);
  const name = rel.split('/').pop();
  const ext = (name.split('.').pop() || '').toLowerCase();
  const inline = INLINE.has(ext) && req.nextUrl.searchParams.get('dl') !== '1';
  return new NextResponse(Readable.toWeb(createReadStream(file)), {
    headers: {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': String(s.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="file.${ext || 'bin'}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/* 결과물 파일 지우기 (디자인팀) — 잘못 올린 파일 */
export const DELETE = handle(async (req, { params }) => {
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 지울 수 있어요.', 403);
  const { p } = await target(req, params);
  if (!p) return fail('not_found', '파일을 찾을 수 없어요.', 404);
  await store().remove(p);
  return new NextResponse(null, { status: 204 });
});
