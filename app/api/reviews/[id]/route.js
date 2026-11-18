import { after } from 'next/server';
import { getDb, nowIso } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { cleanReview, isInvalid, writeRequestDoc } from '@/lib/server/requests';

/* 디자인팀 처리 정보 저장 (상태·담당·확정 일정·미팅·메모) */
export const PUT = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀(편집자) 권한이 있어야 저장할 수 있어요.', 403);
  let d;
  try { d = cleanReview(await req.json().catch(() => ({}))); } catch (e) { if (isInvalid(e)) return fail('invalid', e.message); throw e; }
  const db = await getDb();
  if (!(await db.collection('requests').findOne({ _id: id }, { projection: { _id: 1 } }))) return fail('not_found', '요청서를 찾을 수 없어요.', 404);
  const doc = { ...d, updatedAt: nowIso() };
  await db.collection('reviews').replaceOne({ _id: id }, doc, { upsert: true });
  after(() => writeRequestDoc(db, id));
  return json(session, { review: doc });
});
