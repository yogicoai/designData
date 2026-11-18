import { json, fail } from './auth.js';
import { shareLink } from './storage/index.js';

/* 드롭박스 공유 링크 응답 — 이미지·결과물 링크 API 가 같이 씀 */
export async function linkResponse(session, p) {
  try {
    return json(session, await shareLink(p));
  } catch (e) {
    if (e?.code === 'no_dropbox' || e?.code === 'no_scope') return fail(e.code, e.message, 503);
    if (e?.code === 'not_found') return fail(e.code, e.message, 404);
    throw e;
  }
}
