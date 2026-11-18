import { getDb } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { listResults } from '@/lib/server/requests';
import { store, join, OUT_DIR, roundName } from '@/lib/server/storage';

/* 다음 차수 폴더 만들기 (디자인팀) — 수정이 들어오면 '2차완성본', '3차완성본' … */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 차수를 만들 수 있어요.', 403);
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id });
  if (!r?.folder) return fail('not_found', '요청 폴더를 찾을 수 없어요.', 404);
  const { latest, rounds } = await listResults(r);
  const cur = rounds.find((g) => g.n === latest);
  if (latest && cur && !cur.files.length) return fail('empty_round', `${roundName(latest)}에 아직 파일이 없어요. 먼저 올린 뒤 다음 차수를 시작해 주세요.`, 409);
  const n = latest + 1;
  await store().mkdir(join(r.folder, OUT_DIR, roundName(n)));
  return json(session, { n, name: roundName(n) });
});
