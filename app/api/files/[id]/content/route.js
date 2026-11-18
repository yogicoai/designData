import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { store } from '@/lib/server/storage';
import { MAX_IMG_BYTES } from '@/lib/shared/constants';

/* 이미지 올리기 2단계(서버 경유): 로컬 저장소이거나, 드롭박스 직접 업로드가 막혔을 때 */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const db = await getDb();
  const f = await db.collection('files').findOne({ _id: id });
  if (!f) return fail('not_found', '업로드 자리를 찾을 수 없어요.', 404);
  if (f.by !== session.uid && !session.isAdmin) return fail('forbidden', '이 이미지를 올릴 권한이 없어요.', 403);
  if (f.uploaded) return fail('already', '이미 올린 이미지예요.', 409);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_IMG_BYTES) return fail('too_large', '20MB 이하 이미지만 올릴 수 있어요.', 413);
  await store().putBytes(f.path, buf);
  return new NextResponse(null, { status: 204 });
});
