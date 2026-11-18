import { after } from 'next/server';
import { getDb, nowIso } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { cleanRequest, isInvalid, attachFiles, removeRequestFiles, publicRequest, writeRequestDoc } from '@/lib/server/requests';
import { statusOf } from '@/lib/shared/model';
import { pickFolder, ensureRequestFolders } from '@/lib/server/storage';

/* 수정 { action:'edit', data } · 철회 { action:'withdraw' } */
export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id });
  if (!r) return fail('not_found', '요청서를 찾을 수 없어요.', 404);
  const rv = await db.collection('reviews').findOne({ _id: id });
  const s = statusOf(r, rv);
  const body = await req.json().catch(() => ({}));
  const mine = r.by === session.uid;

  if (body.action === 'withdraw') {
    if (!mine) return fail('forbidden', '본인이 쓴 요청서만 철회할 수 있어요.', 403);
    if (!['review', 'hold'].includes(s)) return fail('forbidden', '검토중·보류 상태에서만 철회할 수 있어요.', 403);
    const now = nowIso();
    await db.collection('requests').updateOne({ _id: id }, { $set: { withdrawn: true, withdrawnAt: now, updatedAt: now } });
    after(() => writeRequestDoc(db, id));
    return json(session, { ok: true });
  }

  if (body.action === 'edit') {
    if (s === 'withdrawn') return fail('forbidden', '철회된 요청서는 수정할 수 없어요.', 403);
    if (!session.isAdmin && !mine) return fail('forbidden', '이 요청서를 수정할 권한이 없어요. 본인이 쓴 요청서만 수정할 수 있어요.', 403);
    if (!session.isAdmin && s === 'progress') return fail('forbidden', '진행 중인 상태에서는 수정이 불가합니다. 수정사항은 Flow를 통해 남겨주세요.', 403);
    if (!session.isAdmin && s === 'done') return fail('forbidden', '완료된 요청은 수정이 불가합니다. 추가 요청은 새 요청서로 남겨주세요.', 403);
    if (!session.isAdmin && s === 'cancel') return fail('forbidden', '취소된 요청은 수정할 수 없어요. 다시 진행하려면 담당 팀에 말씀해 주시거나 새 요청서로 남겨주세요.', 403);
    let d;
    try { d = cleanRequest(body.data, r); } catch (e) { if (isInvalid(e)) return fail('invalid', e.message); throw e; }
    const now = nowIso();
    const set = { ...d, editedAt: now, editedBy: session.uid, editedByTeam: !!(session.isAdmin && !mine), updatedAt: now };
    if (!r.folder) set.folder = await pickFolder(db, r); // 폴더 이름은 처음 접수 때 것을 유지 (제목을 고쳐도 바꾸지 않음)
    await db.collection('requests').updateOne({ _id: id }, { $set: set });
    const next = { ...r, ...set };
    if (set.folder) await ensureRequestFolders(set.folder);
    await attachFiles(db, next, session);
    after(() => writeRequestDoc(db, id));
    return json(session, { request: publicRequest(next, session.uid) });
  }

  return fail('bad_action', '알 수 없는 요청이에요.');
});

/* 삭제 (디자인팀) — 첨부 이미지·요청서는 지우고, 결과물이 있으면 드롭박스 폴더는 남김 */
export const DELETE = handle(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 삭제할 수 있어요.', 403);
  const db = await getDb();
  const r = await db.collection('requests').findOne({ _id: id });
  if (!r) return fail('not_found', '요청서를 찾을 수 없어요.', 404);
  await db.collection('requests').deleteOne({ _id: id });
  await db.collection('reviews').deleteOne({ _id: id });
  const { kept } = await removeRequestFiles(db, r);
  return json(session, { ok: true, keptFolder: kept });
});
