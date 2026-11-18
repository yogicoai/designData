import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { buildXlsx, buildDocx } from '@/lib/server/export';
import { fileIdsIn } from '@/lib/shared/constants';

export const maxDuration = 60;

/* 엑셀·워드 받기 (디자인팀) — { format, ids, cover?: {title, sub}, filename } */
export const POST = handle(async (req) => {
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 받을 수 있어요.', 403);
  const b = await req.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => typeof x === 'string').slice(0, 500);
  if (!ids.length) return fail('invalid', '받을 요청이 없어요.');
  const db = await getDb();
  const [reqs, revs] = await Promise.all([
    db.collection('requests').find({ _id: { $in: ids } }).toArray(),
    db.collection('reviews').find({ _id: { $in: ids } }).toArray(),
  ]);
  const rmap = new Map(reqs.map((r) => [r._id, r]));
  const vmap = new Map(revs.map((v) => [v._id, v]));
  const list = ids.filter((id) => rmap.has(id)).map((id) => ({ r: rmap.get(id), rv: vmap.get(id) || {} }));

  let buf, type;
  if (b.format === 'xlsx') {
    buf = await buildXlsx(list);
    type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (b.format === 'docx') {
    const fids = [...new Set(list.flatMap(({ r }) => [...(r.refImages || []), ...fileIdsIn(r.planHtml)]))];
    const files = new Map((await db.collection('files').find({ _id: { $in: fids }, uploaded: true }).toArray()).map((f) => [f._id, f]));
    const cover = b.cover?.title ? { title: String(b.cover.title).slice(0, 200), sub: String(b.cover.sub || '').slice(0, 200) } : null;
    buf = await buildDocx(list, files, cover);
    type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else {
    return fail('invalid', '형식은 xlsx 또는 docx 만 돼요.');
  }
  const name = String(b.filename || 'export').replace(/[\\/:*?"<>|\r\n]+/g, ' ').slice(0, 150);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(buf.length),
      'Content-Disposition': `attachment; filename="export.${b.format}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
});
