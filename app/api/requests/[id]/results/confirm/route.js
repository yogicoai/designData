import { getDb } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { join, OUT_DIR, safeRel, statSettled } from '@/lib/server/storage';

/* 결과물 올리기 3단계 (드롭박스 직접 올리기 뒤, 디자인팀) — { rel } 파일이 드롭박스에 보일 때까지 잠깐 기다림.
   임시 업로드 주소는 응답 뒤 조금 지나야 파일이 보여서, 바로 목록을 읽으면 방금 올린 파일이 빠질 수 있음 */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 결과물을 올릴 수 있어요.', 403);
  const b = await req.json().catch(() => ({}));
  const rel = safeRel(b.rel);
  if (!rel) return fail('invalid', '파일 위치가 올바르지 않아요.');
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id }, { projection: { folder: 1 } });
  if (!r?.folder) return fail('not_found', '요청 폴더를 찾을 수 없어요.', 404);
  const s = await statSettled(join(r.folder, OUT_DIR, rel));
  if (!s) return fail('missing', '파일이 아직 드롭박스에 보이지 않아요. 잠시 뒤 새로고침해 주세요.', 409);
  return json(session, { rel, size: s.size });
});
