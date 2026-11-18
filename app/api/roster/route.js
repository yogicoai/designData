import { getDb, nowIso } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { DEPTS } from '@/lib/shared/constants';

/* 요청자 명단 저장 (디자인팀) */
export const PUT = handle(async (req) => {
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀(편집자) 권한이 필요해요.', 403);
  const { people } = await req.json().catch(() => ({}));
  if (!Array.isArray(people) || people.length > 1000) return fail('invalid', '명단 형식이 올바르지 않아요.');
  const clean = people.map((p) => ({ name: String(p?.name || '').trim().slice(0, 30), title: String(p?.title || '').trim().slice(0, 20), team: String(p?.team || '') }));
  if (clean.some((p) => !p.name || !p.title || !DEPTS.includes(p.team))) return fail('invalid', '이름·직급·부서가 빠졌거나 부서 이름이 맞지 않는 줄이 있어요.');
  const db = await getDb();
  const updatedAt = nowIso();
  await db.collection('roster').replaceOne({ _id: 'list' }, { people: clean, updatedAt }, { upsert: true });
  return json(session, { people: clean, updatedAt });
});
