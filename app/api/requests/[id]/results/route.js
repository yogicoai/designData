import { getDb } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { listResults, saveResultSummary } from '@/lib/server/requests';
import { store, join, OUT_DIR, roundName, uploadName, folderLinks, ensureRequestFolders } from '@/lib/server/storage';

const LOCAL_MAX = 2 * 1024 * 1024 * 1024;

/* 결과물 목록 — 드롭박스 '결과물' 폴더를 그대로 읽음 (직접 넣은 파일도 보임) */
export const GET = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id });
  if (!r) return fail('not_found', '요청서를 찾을 수 없어요.', 404);
  const res = await listResults(r);
  await saveResultSummary(db, r, res);
  const st = store();
  return json(session, {
    ...res,
    uploadMax: st.kind === 'dropbox' ? st.DIRECT_MAX : LOCAL_MAX,
    ...(session.isAdmin && r.folder ? { folder: r.folder, ...folderLinks(r.folder) } : {}),
  });
});

/* 결과물 올리기 1단계 (디자인팀) — { round?: 숫자, name, size } → 업로드 주소 */
export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 결과물을 올릴 수 있어요.', 403);
  const b = await req.json().catch(() => ({}));
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id });
  if (!r?.folder) return fail('not_found', '요청 폴더를 찾을 수 없어요.', 404);
  const n = Math.max(1, Math.min(999, parseInt(b.round) || 1));
  const st = store();
  const size = Number(b.size) || 0;
  const max = st.kind === 'dropbox' ? st.DIRECT_MAX : LOCAL_MAX;
  if (size > max) return fail('too_large', `${Math.round(max / 1024 / 1024)}MB 가 넘는 파일은 드롭박스 폴더에 직접 넣어 주세요. 넣으면 여기에도 보여요.`, 413);
  await ensureRequestFolders(r.folder);
  const out = join(r.folder, OUT_DIR);
  await st.mkdir(join(out, roundName(n)));
  let p = join(out, roundName(n), uploadName(b.name));
  let upload = { direct: false };
  if (st.kind === 'dropbox') {
    try {
      p = await st.freeName(p); // 같은 이름이면 '(1)' — 올린 뒤 /confirm 이 이 경로로 확인
      upload = await st.uploadTarget(p, { autorename: true });
    } catch (e) { console.error('[results] 업로드 주소 실패', e?.message); }
  }
  const rel = p.slice(out.length + 1);
  return json(session, { rel, upload: upload.direct ? upload : { direct: false, url: `/api/requests/${id}/results/content?p=${encodeURIComponent(rel)}` } });
});
