import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { store } from '@/lib/server/storage';

/* 이미지 보기 — 드롭박스면 임시 링크로 넘기고(드롭박스가 '받기'로 내려주지만 <img> 에선 그냥 보임), 로컬이면 바로 내려줌.
   ?dl=1 = 내려받기 (로컬은 attachment + 저장된 파일 이름) */
export const GET = handle(async (req, { params }) => {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return fail('not_found', '이미지를 찾을 수 없어요.', 404);
  const db = await getDb();
  const f = await db.collection('files').findOne({ _id: id });
  if (!f || !f.uploaded) return fail('not_found', '이미지를 찾을 수 없어요.', 404);
  const st = store();
  const url = await st.link(f.path);
  if (url) {
    const res = NextResponse.redirect(url, 302);
    res.headers.set('Cache-Control', 'private, max-age=3000');
    return res;
  }
  const buf = await st.read(f.path);
  const dl = req.nextUrl.searchParams.get('dl') === '1';
  const name = f.path.split('/').pop();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': f.type, 'Content-Length': String(buf.length), 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': dl ? 'private, no-store' : 'private, max-age=31536000, immutable',
      ...(dl ? { 'Content-Disposition': `attachment; filename="image.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}` } : {}),
    },
  });
});

/* 빼기 — 아직 요청서에 붙지 않은 내 이미지, 또는 디자인팀 */
export const DELETE = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const db = await getDb();
  const f = await db.collection('files').findOne({ _id: id });
  if (!f) return new NextResponse(null, { status: 204 });
  const ok = session.isAdmin || (!f.requestId && f.by === session.uid);
  if (!ok) return fail('forbidden', '이 이미지를 뺄 권한이 없어요.', 403);
  try { await store().remove(f.path); } catch (e) { console.error('[files] 삭제 실패', id, e?.message); }
  await db.collection('files').deleteOne({ _id: id });
  return new NextResponse(null, { status: 204 });
});
