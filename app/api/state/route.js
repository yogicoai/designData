import { getDb } from '@/lib/server/db';
import { getSession, json, handle } from '@/lib/server/auth';
import { publicRequest } from '@/lib/server/requests';
import { store } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

/* 화면 전체 상태 한 번에. ?rev= 가 같으면 바뀐 것 없음만 알려줌 (15초 폴링용) */
export const GET = handle(async (req) => {
  const session = await getSession();
  const db = await getDb();
  const [lastReq, nReq, lastRev, nRev, roster] = await Promise.all([
    db.collection('requests').find({}, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).next(),
    db.collection('requests').countDocuments({}),
    db.collection('reviews').find({}, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).next(),
    db.collection('reviews').countDocuments({}),
    db.collection('roster').findOne({ _id: 'list' }),
  ]);
  const rev = [lastReq?.updatedAt || '', nReq, lastRev?.updatedAt || '', nRev, roster?.updatedAt || '', session.isAdmin ? 'a' : 'u'].join('|');
  const me = {
    uid: session.uid,
    isAdmin: session.isAdmin,
    teamLogin: !!process.env.ADMIN_PASSWORD,
    storage: store().kind,
  };
  if (req.nextUrl.searchParams.get('rev') === rev) return json(session, { rev, me, unchanged: true });

  const [requests, reviews] = await Promise.all([
    db.collection('requests').find({}).toArray(),
    db.collection('reviews').find({}).toArray(),
  ]);
  return json(session, {
    rev,
    me,
    requests: requests.map((r) => publicRequest(r, session.uid)),
    reviews: Object.fromEntries(reviews.map(({ _id, ...rv }) => [_id, rv])),
    roster: roster?.people || [],
  });
});
