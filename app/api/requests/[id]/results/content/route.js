import { getDb } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { store, join, OUT_DIR, safeRel } from '@/lib/server/storage';

export const maxDuration = 300;

/* 결과물 올리기 2단계(서버 경유, 디자인팀) — 로컬·이 PC 드롭박스 폴더는 흘려서 저장, 드롭박스 API 는 직접 업로드가 막혔을 때만 */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 결과물을 올릴 수 있어요.', 403);
  const rel = safeRel(req.nextUrl.searchParams.get('p'));
  if (!rel || rel.split('/').length !== 2) return fail('invalid', '올릴 위치가 올바르지 않아요.');
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id }, { projection: { folder: 1 } });
  if (!r?.folder) return fail('not_found', '요청 폴더를 찾을 수 없어요.', 404);
  const st = store();
  const p = join(r.folder, OUT_DIR, rel);
  let saved;
  try {
    if (st.putStream) saved = await st.putStream(p, req.body, { autorename: true, maxBytes: 2 * 1024 * 1024 * 1024 });
    else {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.length > st.DIRECT_MAX) return fail('too_large', '파일이 너무 커요. 드롭박스 폴더에 직접 넣어 주세요.', 413);
      saved = await st.putBytes(p, buf, { autorename: true });
    }
  } catch (e) {
    if (e?.message === 'too_large') return fail('too_large', '파일이 너무 커요. 드롭박스 폴더에 직접 넣어 주세요.', 413);
    throw e;
  }
  return json(session, { saved });
});
