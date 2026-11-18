import { getDb } from '@/lib/server/db';
import { getSession, fail, handle } from '@/lib/server/auth';
import { join, OUT_DIR, safeRel } from '@/lib/server/storage';
import { linkResponse } from '@/lib/server/share';

/* 결과물 파일의 드롭박스 공유 링크 — { rel } (요청자도 결과물은 볼 수 있으니 같이 허용) */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const b = await req.json().catch(() => ({}));
  const rel = safeRel(b.rel);
  if (!rel) return fail('invalid', '파일 위치가 올바르지 않아요.');
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id }, { projection: { folder: 1 } });
  if (!r?.folder) return fail('not_found', '요청 폴더를 찾을 수 없어요.', 404);
  return linkResponse(session, join(r.folder, OUT_DIR, rel));
});
