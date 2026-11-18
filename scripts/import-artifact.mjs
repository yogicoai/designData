/* 아티팩트(claude.ai) 시절 데이터 옮기기
   seed/artifact-export.json + seed/assets/<예전 이미지 id>.<확장자> → Mongo + 드롭박스(또는 이 PC 드롭박스 폴더/개발용 폴더)

   npm run import:artifact            이미 있는 요청은 건너뜀
   npm run import:artifact -- --force 이미 있는 요청도 지우고 다시 넣음 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

try { process.loadEnvFile('.env.local'); } catch {}

const { getDb, nowIso } = await import('../lib/server/db.js');
const { store, tempPath, pickFolder, ensureRequestFolders, describe } = await import('../lib/server/storage/index.js');
const { attachFiles, removeRequestFiles, writeRequestDoc } = await import('../lib/server/requests.js');
const { cleanHtml } = await import('../lib/server/sanitize.js');
const { kstToday } = await import('../lib/shared/dates.js');

const force = process.argv.includes('--force');
const root = process.cwd();
const seed = JSON.parse(await fs.readFile(path.join(root, 'seed', 'artifact-export.json'), 'utf8'));
const assetDir = path.join(root, 'seed', 'assets');
const TYPE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

const db = await getDb();
const st = store();
console.log(`DB: ${db.databaseName} · 저장소: ${describe()}`);

/* 예전 이미지 한 장 → 새 파일 id */
const assetFiles = await fs.readdir(assetDir).catch(() => []);
async function importAsset(oldId, role, by) {
  const fname = assetFiles.find((f) => f.startsWith(oldId + '.'));
  if (!fname) { console.warn(`  ! 이미지 없음: ${oldId} (seed/assets 에 넣어 주세요)`); return null; }
  const type = TYPE[path.extname(fname).toLowerCase()] || 'image/png';
  const buf = await fs.readFile(path.join(assetDir, fname));
  const id = crypto.randomBytes(12).toString('hex');
  const p = tempPath(id, type, kstToday().slice(0, 7));
  await st.putBytes(p, buf);
  await db.collection('files').insertOne({
    _id: id, name: 'image' + path.extname(fname), type, size: buf.length, role,
    storage: st.kind, path: p, by, requestId: null, uploaded: true, createdAt: nowIso(), legacyId: oldId,
  });
  return id;
}

/* 1) 요청자 명단 */
if (seed.roster?.people?.length) {
  await db.collection('roster').replaceOne({ _id: 'list' }, { people: seed.roster.people, updatedAt: nowIso() }, { upsert: true });
  console.log(`명단 ${seed.roster.people.length}명 저장`);
}

/* 2) 디자인팀 처리 정보 (요청서 워드에 같이 들어가도록 먼저) */
for (const { id, data } of seed.reviews || []) {
  await db.collection('reviews').replaceOne({ _id: id }, { ...data, updatedAt: data.updatedAt || nowIso() }, { upsert: true });
  console.log(`회신 ${id} 저장 (${data.status} · ${data.designer || '미배정'})`);
}

/* 3) 요청서 */
for (const { id, data } of seed.requests || []) {
  const exists = await db.collection('requests').findOne({ _id: id });
  if (exists && !force) { console.log(`- ${data.no} 이미 있음 → 건너뜀`); continue; }
  if (exists) {
    await removeRequestFiles(db, exists);
    await db.collection('requests').deleteOne({ _id: id });
  }
  const by = 'artifact:' + (data.by || '');
  const refImages = [];
  for (const old of data.refImages || []) { const nid = await importAsset(old, 'ref', by); if (nid) refImages.push(nid); }
  let planHtml = data.planHtml || '';
  for (const m of [...planHtml.matchAll(/\/_blob\/([A-Za-z0-9]{16,64})/g)]) {
    const nid = await importAsset(m[1], 'plan', by);
    planHtml = planHtml.replaceAll(`/_blob/${m[1]}`, nid ? `/api/files/${nid}` : '');
  }
  const doc = { ...data, _id: id, by, planHtml: cleanHtml(planHtml), refImages, updatedAt: data.withdrawnAt || data.editedAt || data.createdAt || nowIso() };
  delete doc.id;
  doc.folder = await pickFolder(db, doc);
  await db.collection('requests').insertOne(doc);
  await ensureRequestFolders(doc.folder);
  await attachFiles(db, doc, { uid: null, isAdmin: true });
  await writeRequestDoc(db, id);
  console.log(`+ ${data.no} ${data.title}\n  → ${doc.folder}`);
}

console.log('끝');
process.exit(0);
