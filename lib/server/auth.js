import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/* 접속자 구분
   - drq_uid  : 브라우저마다 하나씩 주는 익명 id (요청서 작성자 = 이 id). 본인 요청서 수정·철회에 씀.
   - drq_team : 디자인팀 로그인 쿠키 (ADMIN_PASSWORD 로 발급, SESSION_SECRET 으로 서명). */

const UID = 'drq_uid';
const TEAM = 'drq_team';
const YEAR = 60 * 60 * 24 * 365;
const TEAM_AGE = 60 * 60 * 24 * 30;

const secret = () => process.env.SESSION_SECRET || 'drq-dev-secret-change-me';
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

function verifyTeam(token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const good = sign('team:' + exp);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return false;
  return Number(exp) > Date.now() / 1000;
}

export async function getSession() {
  const jar = await cookies();
  let uid = jar.get(UID)?.value || '';
  let fresh = false;
  if (!/^u[a-f0-9]{20}$/.test(uid)) {
    uid = 'u' + crypto.randomBytes(10).toString('hex');
    fresh = true;
  }
  return { uid, fresh, isAdmin: verifyTeam(jar.get(TEAM)?.value) };
}

const cookieOpts = (maxAge) => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge });

/* 처음 온 브라우저면 uid 쿠키를 심어서 응답 */
export function withSession(session, res) {
  if (session.fresh) res.cookies.set(UID, session.uid, cookieOpts(YEAR));
  return res;
}

export function json(session, data, init) {
  return withSession(session, NextResponse.json(data, init));
}

export function fail(code, message, status = 400) {
  return NextResponse.json({ code, message }, { status });
}

export function checkPassword(pw) {
  const want = process.env.ADMIN_PASSWORD || '';
  if (!want) return false;
  const a = Buffer.from(String(pw || ''));
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function setTeamCookie(res) {
  const exp = Math.floor(Date.now() / 1000) + TEAM_AGE;
  res.cookies.set(TEAM, exp + '.' + sign('team:' + exp), cookieOpts(TEAM_AGE));
  return res;
}

export function clearTeamCookie(res) {
  res.cookies.set(TEAM, '', cookieOpts(0));
  return res;
}

/* 라우트 공통 오류 처리 */
export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e?.code === 'no_db') return fail('no_db', 'DB 연결 정보가 없어요. .env.local 의 MONGODB_URI 를 확인해 주세요.', 503);
      console.error('[api]', req.method, req.nextUrl?.pathname, e);
      return fail('server', '서버에서 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', 500);
    }
  };
}
