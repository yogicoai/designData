import { getDb } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { statSettled } from '@/lib/server/storage';

/* 이미지 올리기 3단계: 저장소에 실제로 들어갔는지 확인 (드롭박스 직접 올리기는 보일 때까지 잠깐 기다림) */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const db = await getDb();
  const f = await db.collection('files').findOne({ _id: id });
  if (!f) return fail('not_found', '업로드 자리를 찾을 수 없어요.', 404);
  if (f.by !== session.uid && !session.isAdmin) return fail('forbidden', '권한이 없어요.', 403);
  const s = await statSettled(f.path);
  if (!s) return fail('missing', '이미지가 저장소에 올라가지 않았어요. 다시 시도해 주세요.', 409);
  await db.collection('files').updateOne({ _id: id }, { $set: { uploaded: true, size: s.size } });
  return json(session, { id });
});
