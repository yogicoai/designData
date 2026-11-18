import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { linkResponse } from '@/lib/server/share';

/* 요청서 이미지의 드롭박스 공유 링크 (보기 권한 있는 누구나 — 이미지 보기와 같음) */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return fail('not_found', '이미지를 찾을 수 없어요.', 404);
  const session = await getSession();
  const db = await getDb();
  const f = await db.collection('files').findOne({ _id: id });
  if (!f || !f.uploaded) return fail('not_found', '이미지를 찾을 수 없어요.', 404);
  return linkResponse(session, f.path);
});
