import { after } from 'next/server';
import { getDb, nowIso } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { cleanRequest, isInvalid, newIds, attachFiles, publicRequest, writeRequestDoc } from '@/lib/server/requests';
import { pickFolder, ensureRequestFolders } from '@/lib/server/storage';

/* 요청서 제출 → 드롭박스에 <월>/<요청일>_<부서>_<프로젝트명>/요청사항 · 결과물/1차완성본 생성 */
export const POST = handle(async (req) => {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  let d;
  try { d = cleanRequest(body); } catch (e) { if (isInvalid(e)) return fail('invalid', e.message); throw e; }
  const db = await getDb();
  const { id, no, requestDate } = newIds();
  const now = nowIso();
  const doc = { _id: id, ...d, no, by: session.uid, createdAt: now, requestDate, updatedAt: now };
  doc.folder = await pickFolder(db, doc);
  await db.collection('requests').insertOne(doc);
  await ensureRequestFolders(doc.folder);
  await attachFiles(db, doc, session);
  after(() => writeRequestDoc(db, id));
  return json(session, { request: publicRequest(doc, session.uid) });
});
