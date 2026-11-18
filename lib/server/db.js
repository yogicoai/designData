import { MongoClient } from 'mongodb';

/* 컬렉션
   requests : 요청서 (_id = 요청 id)
   reviews  : 디자인팀 처리 정보 (_id = 요청 id)
   roster   : 요청자 명단 (_id = 'list')
   files    : 첨부 이미지 (_id = 24자리 16진수, 저장 위치는 path) */

const g = globalThis;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const e = new Error('MONGODB_URI 가 설정되지 않았어요.');
    e.code = 'no_db';
    throw e;
  }
  if (!g.__drqMongo) {
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    g.__drqMongo = client.connect().then(async (c) => {
      const db = c.db(process.env.MONGODB_DB || 'designdesk');
      await Promise.all([
        db.collection('requests').createIndex({ updatedAt: -1 }),
        db.collection('reviews').createIndex({ updatedAt: -1 }),
        db.collection('files').createIndex({ requestId: 1 }),
        db.collection('login_fails').createIndex({ at: 1 }, { expireAfterSeconds: 3600 }),
      ]).catch(() => {});
      return db;
    });
    g.__drqMongo.catch(() => { g.__drqMongo = null; });
  }
  return g.__drqMongo;
}

export const nowIso = () => new Date().toISOString();

/* _id 를 id 로 바꿔 화면에 넘김 */
export const out = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};
