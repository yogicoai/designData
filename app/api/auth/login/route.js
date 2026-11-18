import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { checkPassword, setTeamCookie, fail, handle } from '@/lib/server/auth';

/* 디자인팀 로그인 (숫자 4자리 PIN)
   PIN 은 짐작으로 맞히기 쉬워서, 같은 곳(IP)에서 10분 안에 8번 틀리면 10분 동안 막는다 — 서버가 여러 대여도 통하게 DB 에 기록 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;

export const POST = handle(async (req) => {
  if (!process.env.ADMIN_PASSWORD) return fail('no_password', '디자인팀 PIN(ADMIN_PASSWORD)이 설정되지 않았어요.', 503);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const db = await getDb();
  const col = db.collection('login_fails');
  const fails = await col.countDocuments({ ip, at: { $gte: new Date(Date.now() - WINDOW_MS) } });
  if (fails >= MAX_FAILS) return fail('locked', '여러 번 틀려서 잠시 막혔어요. 10분 뒤에 다시 해 주세요.', 429);

  const { password } = await req.json().catch(() => ({}));
  if (!checkPassword(password)) {
    await col.insertOne({ ip, at: new Date() });
    await new Promise((r) => setTimeout(r, 500));
    const left = MAX_FAILS - fails - 1;
    return fail('bad_password', left <= 3 ? `PIN 이 맞지 않아요. ${left}번 더 틀리면 10분 동안 막혀요.` : 'PIN 이 맞지 않아요.', 401);
  }
  await col.deleteMany({ ip });
  return setTeamCookie(NextResponse.json({ ok: true }));
});
