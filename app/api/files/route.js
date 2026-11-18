import crypto from 'node:crypto';
import { after } from 'next/server';
import { getDb, nowIso } from '@/lib/server/db';
import { getSession, json, fail, handle } from '@/lib/server/auth';
import { store, tempPath } from '@/lib/server/storage';
import { cleanupTemp } from '@/lib/server/requests';
import { IMG_TYPES, MAX_IMG_BYTES } from '@/lib/shared/constants';
import { kstToday } from '@/lib/shared/dates';

/* 이미지 올리기 1단계: 자리 만들기 → { id, upload }
   upload.direct 면 브라우저가 upload.url(드롭박스 임시 업로드 주소)로 바로 올리고,
   아니면 /api/files/<id>/content 로 올린다. 그다음 /commit. */
export const POST = handle(async (req) => {
  const session = await getSession();
  const b = await req.json().catch(() => ({}));
  if (!IMG_TYPES.includes(b.type)) return fail('bad_type', 'PNG, JPG, GIF, WEBP 이미지만 올릴 수 있어요.');
  if (!(b.size > 0) || b.size > MAX_IMG_BYTES) return fail('too_large', '20MB 이하 이미지만 올릴 수 있어요.');
  const role = b.role === 'plan' ? 'plan' : 'ref';
  const db = await getDb();
  const st = store();
  const id = crypto.randomBytes(12).toString('hex');
  const path = tempPath(id, b.type, kstToday().slice(0, 7));
  await db.collection('files').insertOne({
    _id: id, name: String(b.name || 'image').slice(0, 120), type: b.type, size: b.size, role,
    storage: st.kind, path, by: session.uid, requestId: null, uploaded: false, createdAt: nowIso(),
  });
  let upload;
  try { upload = await st.uploadTarget(path); } catch (e) { console.error('[files] 업로드 주소 실패', e?.message); upload = { direct: false }; }
  after(() => cleanupTemp(db).catch(() => {}));
  return json(session, { id, upload });
});
