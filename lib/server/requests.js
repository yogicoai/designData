/* 요청서 검증 · 첨부 이미지 정리 · 드롭박스 요청 폴더 관리 */
import crypto from 'node:crypto';
import { DEPTS, LEAD, STATUS, MAX_IMG, TEAM_MAP, fileIdsIn } from '../shared/constants.js';
import { formOf } from '../shared/forms.js';
import { josa } from '../shared/josa.js';
import { bizDays, kstToday } from '../shared/dates.js';
import { cleanHtml } from './sanitize.js';
import { store, join, REQ_DIR, OUT_DIR, ROUND_RE, attachName, requestDocName } from './storage/index.js';
import { buildDocx } from './export.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v) => (DATE_RE.test(String(v || '')) ? String(v) : '');

class Invalid extends Error {
  constructor(message) { super(message); this.code = 'invalid'; }
}
export const isInvalid = (e) => e?.code === 'invalid';

/* 요청서 본문 검증 — 화면의 검사 규칙과 같음(항목은 팀별 양식). orig 가 있으면 수정 */
export function cleanRequest(body, orig) {
  const b = body || {};
  const cfg = formOf(str(b.team, 20));
  const d = {
    team: str(b.team, 20),
    place: cfg.place ? str(b.place, 200) : '',
    dept: str(b.dept, 40),
    name: str(b.name, 60),
    title: str(b.title, 200),
    type: str(b.type, 60),
    channels: cfg.chips ? (Array.isArray(b.channels) ? b.channels : []).filter((c) => cfg.chips.options.includes(c)) : [],
    channelEtc: str(b.channelEtc, 100),
    goal: str(b.goal, 3000),
    target: str(b.target, 300),
    plan: str(b.plan, 60000),
    planHtml: cleanHtml(String(b.planHtml || '').slice(0, 2_000_000)),
    copy: cfg.copy ? str(b.copy, 6000) : '',
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 50).map((x) => ({
      kind: str(x?.kind, 60),
      size: str(x?.size, 120),
      qty: Math.min(99, Math.max(1, parseInt(x?.qty) || 1)),
      note: str(x?.note, 300),
    })).filter((x) => x.kind),
    refImages: [...new Set((Array.isArray(b.refImages) ? b.refImages : []).filter((x) => /^[a-f0-9]{24}$/.test(x)))].slice(0, MAX_IMG),
    draft: date(b.draft),
    live: date(b.live),
    urgent: str(b.urgent, 2000),
    meet: !!b.meet,
    files: str(b.files, 4000),
    ref: str(b.ref, 4000),
  };
  if (!TEAM_MAP[d.team]) throw new Invalid('요청할 팀(디자인 · VMD · 개발)을 골라 주세요.');
  d.assignee = TEAM_MAP[d.team].person; // 고른 팀의 담당자 — 디자인팀이 처리 화면에서 바꾸면 그쪽이 우선
  if (!DEPTS.includes(d.dept)) throw new Invalid('요청 부서를 선택해 주세요.');
  if (!d.name) throw new Invalid('요청자를 선택해 주세요.');
  if (!d.title) throw new Invalid('프로젝트명을 적어 주세요.');
  if (!cfg.types.includes(d.type)) throw new Invalid('요청 유형을 하나 골라 주세요.');
  if (cfg.place && !d.place) throw new Invalid(`${josa(cfg.place.label, '을')} 적어 주세요.`);
  if (!d.goal) throw new Invalid(`${josa(cfg.goal.label, '을')} 적어 주세요.`);
  if (!d.plan) throw new Invalid(`${josa(cfg.plan.label, '을')} 적어 주세요.`);
  if (!d.items.length) throw new Invalid(`${josa(cfg.items.label, '을')} 하나 이상 추가해 주세요.`);
  if (d.items.some((x) => !cfg.kmap[x.kind])) throw new Invalid(`${cfg.items.label} 종류가 올바르지 않아요.`);
  if (d.channels.includes('기타') && !d.channelEtc) throw new Invalid(`기타 ${cfg.chips?.label || ''} 이름을 적어 주세요.`);
  if (!d.channels.includes('기타')) d.channelEtc = '';
  if (!d.live) throw new Invalid(`${josa(cfg.live.label, '을')} 골라 주세요.`);
  const liveChanged = !orig || d.live !== orig.live;
  if (liveChanged && d.live < kstToday()) throw new Invalid(`${cfg.live.short} 날짜는 오늘 이후로 골라 주세요.`);
  if (d.draft && d.draft > d.live) throw new Invalid(`${josa(cfg.draft.label, '은')} ${cfg.live.short} 날짜보다 앞이어야 해요.`);
  const n = bizDays(d.live);
  if (liveChanged && n != null && n >= 0 && n < LEAD && !d.urgent) throw new Invalid('일정이 촉박한 이유를 적어 주세요.');
  return d;
}

export function cleanReview(b) {
  const keys = STATUS.map((s) => s.k);
  const meeting = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(b?.meeting || '')) ? b.meeting : '';
  const d = {
    status: keys.includes(b?.status) ? b.status : 'review',
    // designer = 담당자 (필드 이름은 원본 그대로)
    designer: str(b?.designer, 40),
    start: date(b?.start),
    draft: date(b?.draft),
    live: date(b?.live),
    meeting,
    note: str(b?.note, 3000),
  };
  if (d.draft && d.live && d.draft > d.live) throw new Invalid('시안일은 라이브 날짜보다 앞이어야 해요.');
  if (d.status === 'cancel' && !d.note) throw new Invalid('취소 사유를 메모에 적어 주세요. 요청자에게 보여요.');
  return d;
}

export function newIds() {
  const now = new Date();
  const id = 'r' + now.getTime().toString(36) + crypto.randomBytes(3).toString('hex').slice(0, 4);
  const t = kstToday();
  const rand = Array.from(crypto.randomBytes(3), (x) => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x % 36]).join('');
  const no = 'DR-' + t.slice(2, 4) + t.slice(5, 7) + t.slice(8, 10) + '-' + rand;
  return { id, no, requestDate: t };
}

/* 요청서가 쓰는 이미지들을 요청 폴더의 '요청사항'으로 옮기고 이름을 붙임 (기획안_01, 레퍼런스_01 …).
   옮기기에 실패해도 임시 위치에서 그대로 보이므로 요청 저장은 막지 않는다. */
export async function attachFiles(db, r, { uid, isAdmin }) {
  const order = [...new Set([...fileIdsIn(r.planHtml), ...(r.refImages || [])])];
  if (!order.length || !r.folder) return;
  const st = store();
  const dir = join(r.folder, REQ_DIR);
  const files = (await db.collection('files').find({ _id: { $in: order } }).toArray()).sort((a, b) => order.indexOf(a._id) - order.indexOf(b._id));
  const seq = { plan: 0, ref: 0 };
  for (const f of await db.collection('files').find({ requestId: r._id }, { projection: { role: 1, seq: 1 } }).toArray()) {
    seq[f.role] = Math.max(seq[f.role] || 0, f.seq || 0);
  }
  for (const f of files) {
    if (!f.uploaded) continue;
    if (f.requestId && f.requestId !== r._id) continue;
    if (!f.requestId && f.by !== uid && !isAdmin) continue;
    if (f.requestId === r._id && f.path.startsWith(dir + '/')) continue;
    const role = (r.refImages || []).includes(f._id) ? 'ref' : 'plan';
    const n = (seq[role] = (seq[role] || 0) + 1);
    let p = f.path;
    try { p = await st.move(f.path, join(dir, attachName(role, n, f.name, f.type))); } catch (e) { console.error('[files] 이동 실패', f._id, e?.message); }
    await db.collection('files').updateOne({ _id: f._id }, { $set: { requestId: r._id, role, seq: n, path: p } });
  }
}

/* 요청사항 폴더에 요청서(워드)를 최신 내용으로 저장 — 드롭박스 버전 기록에 예전 내용도 남는다 */
export async function writeRequestDoc(db, id) {
  try {
    const r = await db.collection('requests').findOne({ _id: id });
    if (!r?.folder) return;
    const rv = (await db.collection('reviews').findOne({ _id: id })) || {};
    const ids = [...(r.refImages || []), ...fileIdsIn(r.planHtml)];
    const files = new Map((await db.collection('files').find({ _id: { $in: ids }, uploaded: true }).toArray()).map((f) => [f._id, f]));
    const buf = await buildDocx([{ r, rv }], files, null);
    await store().putBytes(join(r.folder, REQ_DIR, requestDocName(r)), buf);
  } catch (e) {
    console.error('[files] 요청서 저장 실패', id, e?.message);
  }
}

/* 요청 삭제: 첨부 이미지·요청서는 지우고, 디자인팀 결과물이 있으면 폴더는 남김 */
export async function removeRequestFiles(db, r) {
  const st = store();
  const files = await db.collection('files').find({ requestId: r._id }).toArray();
  for (const f of files) {
    try { await st.remove(f.path); } catch (e) { console.error('[files] 삭제 실패', f._id, e?.message); }
  }
  await db.collection('files').deleteMany({ requestId: r._id });
  if (!r.folder) return { kept: false };
  try { await st.remove(join(r.folder, REQ_DIR, requestDocName(r))); } catch {}
  const out = join(r.folder, OUT_DIR);
  let kept = false;
  try {
    const ents = await st.list(out, { recursive: true });
    kept = ents.some((e) => !e.folder);
    if (!kept) {
      for (const e of ents.filter((x) => x.folder).sort((a, b) => b.rel.length - a.rel.length)) await st.removeDirIfEmpty(join(out, e.rel));
    }
  } catch {}
  await st.removeDirIfEmpty(out);
  await st.removeDirIfEmpty(join(r.folder, REQ_DIR));
  await st.removeDirIfEmpty(r.folder);
  return { kept };
}

/* 결과물 목록 (드롭박스 폴더를 그대로 읽음 — 디자이너가 폴더에 직접 넣은 파일도 보임) */
const IMG_EXT = /\.(png|jpe?g|gif|webp)$/i;
export async function listResults(r) {
  if (!r.folder) return { rounds: [], latest: 0 };
  const out = join(r.folder, OUT_DIR);
  const ents = await store().list(out, { recursive: true });
  const groups = new Map();
  const group = (name) => {
    if (!groups.has(name)) { const m = name.match(ROUND_RE); groups.set(name, { name, n: m ? Number(m[1]) : null, files: [] }); }
    return groups.get(name);
  };
  for (const e of ents) {
    const seg = e.rel.split('/');
    if (e.folder) { if (seg.length === 1) group(seg[0]); continue; }
    const g = seg.length === 1 ? group('') : group(seg[0]);
    g.files.push({ p: e.rel, name: seg.length === 1 ? seg[0] : seg.slice(1).join('/'), size: e.size || 0, modified: e.modified || '', image: IMG_EXT.test(e.rel) });
  }
  const rounds = [...groups.values()]
    .map((g) => ({ ...g, files: g.files.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })) }))
    .sort((a, b) => (b.n ?? -1) - (a.n ?? -1) || a.name.localeCompare(b.name, 'ko'));
  const latest = Math.max(0, ...rounds.filter((g) => g.n).map((g) => g.n));
  return { rounds, latest };
}

/* 목록에 띄울 요약 (몇 차 완성본까지 올라왔는지) — 바뀌었을 때만 저장 */
export async function saveResultSummary(db, r, res) {
  const withFiles = res.rounds.filter((g) => g.files.length);
  const summary = { round: Math.max(0, ...withFiles.filter((g) => g.n).map((g) => g.n)), count: withFiles.reduce((s, g) => s + g.files.length, 0) };
  const cur = r.results || {};
  if (cur.round === summary.round && cur.count === summary.count) return;
  await db.collection('requests').updateOne({ _id: r._id }, { $set: { results: { ...summary, at: new Date().toISOString() }, updatedAt: new Date().toISOString() } });
}

/* 화면으로 보낼 때: 작성자 id 대신 '내 요청인지'만 */
export function publicRequest(r, uid) {
  const { _id, by, editedBy, folder, ...rest } = r;
  return { id: _id, ...rest, mine: !!uid && by === uid, hasFolder: !!folder };
}

/* 제출 전 올렸다가 버려진 이미지 정리 (14일 지난 것, 6시간에 한 번) */
const g = globalThis;
export async function cleanupTemp(db) {
  if (g.__drqCleanAt && Date.now() - g.__drqCleanAt < 6 * 3600_000) return;
  g.__drqCleanAt = Date.now();
  const old = new Date(Date.now() - 14 * 86400_000).toISOString();
  const stale = await db.collection('files').find({ requestId: null, createdAt: { $lt: old } }).limit(200).toArray();
  for (const f of stale) {
    try { await store().remove(f.path); } catch {}
    await db.collection('files').deleteOne({ _id: f._id });
  }
  if (stale.length) console.log(`[files] 임시 업로드 ${stale.length}건 정리`);
}
