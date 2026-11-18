import { getSession, json, fail, handle } from '@/lib/server/auth';
import { store, rootPath } from '@/lib/server/storage';
import * as dropbox from '@/lib/server/storage/dropbox';

export const dynamic = 'force-dynamic';

/* 연결 상태 (디자인팀) — 저장 방식 · 드롭박스 환경변수가 들어왔는지 · 토큰 · 계정 · 요청 데스크 폴더.
   배포 서버에서 이미지가 안 올라갈 때 원인을 바로 보려고 (11-18). 비밀값 자체는 내보내지 않음 */
export const GET = handle(async () => {
  const session = await getSession();
  if (!session.isAdmin) return fail('forbidden', '디자인팀만 볼 수 있어요.', 403);
  const raw = (k) => String(process.env[k] || '');
  const look = (k) => ({ length: dropbox.envv(k).length, cleaned: raw(k) !== dropbox.envv(k) });
  const st = store();
  return json(session, {
    storage: st.kind,
    root: rootPath(),
    env: {
      DROPBOX_APP_KEY: look('DROPBOX_APP_KEY'),
      DROPBOX_APP_SECRET: look('DROPBOX_APP_SECRET'),
      DROPBOX_REFRESH_TOKEN: look('DROPBOX_REFRESH_TOKEN'),
      DROPBOX_ROOT: look('DROPBOX_ROOT'),
      DROPBOX_MODE: dropbox.envv('DROPBOX_MODE'),
      DROPBOX_LOCAL_DIR: !!raw('DROPBOX_LOCAL_DIR'),
    },
    dropbox: dropbox.enabled() ? await dropbox.diagnose(rootPath()) : '드롭박스 키 3개(APP_KEY·APP_SECRET·REFRESH_TOKEN)가 다 있지 않아요',
  });
});
