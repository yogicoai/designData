'use client';
/* 요청 상세 (오른쪽 서랍) + 디자인팀 처리 — B+ 디자인 */
import { useEffect, useRef, useState } from 'react';
import { H4, Chip, Icon, RefImg, copyText } from './ui';
import MeetPicker from './MeetPicker';
import ResultsPanel from './ResultsPanel';
import { api } from '@/lib/client/api';
import { sanitizeHtml } from '@/lib/client/sanitize';
import { STATUS, ASSIGNEES, LEAD, teamColor } from '@/lib/shared/constants';
import { WD, parse, fmt, fmtDT, fmtMeet, bizDays } from '@/lib/shared/dates';
import { chList, shareText, isOpenStatus } from '@/lib/shared/model';
import { formOf } from '@/lib/shared/forms';

function linkify(txt) {
  return (txt || '').split(/(https?:\/\/[^\s]+)/g).map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener">{p}</a> : p));
}
function KV({ pairs }) {
  const rows = pairs.filter((p) => p[1] && (!Array.isArray(p[1]) || p[1].length));
  return (
    <dl className="kv">
      {rows.map(([k, v, link]) => [<dt key={k + 't'}>{k}</dt>, <dd key={k + 'd'}>{link ? linkify(v) : v}</dd>])}
    </dl>
  );
}

/* 이름 → 동그라미 글자 (박민정 → 민) */
const initial = (name) => (!name ? '' : name.length >= 3 ? name[1] : name[0]);

/* 날짜 한 칸: 11/27 + 금 · 확정 */
function DateCell({ k, d, note, live }) {
  const dt = parse(d);
  return (
    <div className={live ? 'live' : undefined}>
      <div className="k">{k}</div>
      {dt ? (
        <>
          <div className="v">{`${dt.getMonth() + 1}/${dt.getDate()}`}</div>
          <small>{WD[dt.getDay()]}{note ? ` · ${note}` : ''}</small>
        </>
      ) : (
        <>
          <div className="v none">—</div>
          <small>미정</small>
        </>
      )}
    </div>
  );
}

function PlanDoc({ r, onZoom }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (r.planHtml) {
      el.innerHTML = sanitizeHtml(r.planHtml);
      el.querySelectorAll('img').forEach((i) => {
        i.addEventListener('click', () => onZoom(i.src));
        i.addEventListener('error', () => { const s = document.createElement('span'); s.className = 'hint'; s.textContent = '[이미지를 불러올 수 없어요]'; i.replaceWith(s); });
      });
    } else el.textContent = r.plan || '';
  }, [r.planHtml, r.plan, onZoom]);
  return <div ref={ref} className={'doc doc-view doc-panel' + (r.planHtml ? '' : ' plain')} />;
}

function AdminPanel({ r, rv, s, onSaved, toast }) {
  const cfg = formOf(r.team);
  const init = () => ({ status: s, designer: rv.designer || r.assignee || '', start: rv.start || '', draft: rv.draft || r.draft || '', live: rv.live || r.live || '', meeting: rv.meeting || '', note: rv.note || '' });
  const [v, setV] = useState(init);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  /* 다른 사람이 저장한 내용 — 내가 고치는 중이 아닐 때만 따라감 */
  useEffect(() => { if (!dirty) setV(init()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rv.updatedAt, s]);
  const set = (k, val) => { setV((c) => ({ ...c, [k]: val })); setDirty(true); };
  const designers = [...ASSIGNEES, ...(v.designer && !ASSIGNEES.includes(v.designer) ? [v.designer] : [])];

  async function save() {
    if (v.draft && v.live && v.draft > v.live) { toast(`${cfg.draft.short} 날짜는 ${cfg.live.short} 날짜보다 앞이어야 해요.`); return; }
    if (v.status === 'cancel' && !v.note.trim()) { toast('취소 사유를 메모에 적어 주세요. 요청자에게 보여요.'); document.getElementById('a-note')?.focus(); return; }
    setSaving(true);
    try {
      await api(`/api/reviews/${r.id}`, { method: 'PUT', body: { ...v, designer: v.designer.trim(), note: v.note.trim() } });
      setDirty(false);
      toast('저장했어요.');
      onSaved();
    } catch (e) {
      toast(e?.code === 'forbidden' ? '디자인팀(편집자) 권한이 있어야 저장할 수 있어요.' : e?.message || '저장하지 못했어요. 다시 시도해 주세요.');
    } finally { setSaving(false); }
  }

  return (
    <div className="dsec admin">
      <H4 ic="lock">디자인팀 처리<span className="r g">디자인팀만 보여요</span></H4>
      <div className="fields">
        <div className="f"><label htmlFor="a-status">상태</label>
          <select id="a-status" value={v.status} onChange={(e) => set('status', e.target.value)}>{STATUS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select></div>
        <div className="f"><label htmlFor="a-designer">담당자</label>
          <select id="a-designer" value={v.designer} onChange={(e) => set('designer', e.target.value)}>
            <option value="">미배정</option>
            {designers.map((n) => <option key={n} value={n}>{n}</option>)}
          </select></div>
        <div className="f"><label htmlFor="a-start">작업 시작일</label><input id="a-start" type="date" value={v.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div className="f"><label htmlFor="a-draft">{cfg.draft.short} (확정)</label><input id="a-draft" type="date" value={v.draft} onChange={(e) => set('draft', e.target.value)} /></div>
        <div className="f"><label htmlFor="a-live">{cfg.live.short} (확정)</label><input id="a-live" type="date" value={v.live} onChange={(e) => set('live', e.target.value)} /></div>
        <div className="f"><span className="lbl">미팅 일시 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(선택)</span></span>
          <MeetPicker value={v.meeting} onChange={(m) => set('meeting', m)} /></div>
        <div className="f full"><label htmlFor="a-note">메모</label>
          <textarea id="a-note" placeholder={v.status === 'cancel' ? '취소 사유 (요청자에게 보여요). 예: 프로모션 일정이 없어져 요청자와 협의 후 취소' : '요청자에게 보이는 메모. 예: 카피 확정본 받으면 착수합니다'} value={v.note} onChange={(e) => set('note', e.target.value)} /></div>
        <div className="f full" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? '저장 중…' : '디자인팀 정보 저장'}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmBtn({ label, confirm, style, onConfirm }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className="btn danger" style={style} onClick={() => { if (!armed) { setArmed(true); return; } onConfirm(); }}>
      {armed ? confirm : label}
    </button>
  );
}

export default function Drawer({ row, me, onClose, onEdit, onAlert, refresh, toast, onZoom, onExport }) {
  if (!row) return null;
  const { r, rv, s, live, draft, who, team } = row;
  const cfg = formOf(r.team);
  const L = cfg.live.short;
  const n = bizDays(live);
  const isOpen = isOpenStatus(s);
  const canEdit = s !== 'withdrawn' && (me.isAdmin || r.mine);
  const total = (r.items || []).reduce((a, x) => a + (Number(x.qty) || 0), 0);
  const ddayText = n == null || !isOpen ? '' : n < 0 ? `${L} 날짜가 지났어요` : `${L}까지 영업일 ${n}일`;

  async function withdraw() {
    try { await api(`/api/requests/${r.id}`, { method: 'PATCH', body: { action: 'withdraw' } }); toast('요청을 철회했어요.'); refresh(); }
    catch (e) { toast(e?.message || '철회하지 못했어요. 다시 시도해 주세요.'); }
  }
  async function remove() {
    try {
      const j = await api(`/api/requests/${r.id}`, { method: 'DELETE' });
      onClose();
      toast(j?.keptFolder ? '삭제했어요. 결과물이 들어 있는 드롭박스 폴더는 남겨 뒀어요.' : '삭제했어요.');
      refresh();
    } catch { toast('삭제하지 못했어요.'); }
  }

  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="d-title" tabIndex={-1}>
      <div className="dh-bar">
        <span className="no">{r.no}</span>
        <Chip s={s} />
        <button type="button" className="btn ghost icon-btn" aria-label="닫기" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="drawer-head">
        <h3 id="d-title">{r.title}</h3>
        <div className="dh-meta">
          <span>{r.dept} · {r.name}</span>
          <span>{fmt(r.requestDate)} 접수</span>
          {r.editedAt && <span className="ed">{fmtDT(r.editedAt)} 수정됨{r.editedByTeam ? ' (디자인팀)' : ''}</span>}
        </div>
      </div>

      <div className="dsec">
        <H4 ic="calendar">일정{ddayText && <span className={'r' + (n < LEAD ? ' w' : '')}>{ddayText}</span>}</H4>
        <div className="dates">
          <DateCell k="요청" d={r.requestDate} />
          <DateCell k="작업 시작" d={rv.start} note={rv.start ? '확정' : ''} />
          <DateCell k={cfg.draft.short} d={draft} note={rv.draft ? '확정' : draft ? '희망' : ''} />
          <DateCell k={L} d={live} note={rv.live ? '확정' : '희망'} live />
        </div>
        {rv.live && rv.live !== r.live && <p className="d-note">요청자 희망 {L}: {fmt(r.live)}</p>}
      </div>

      {(who || r.team || rv.meeting || rv.note) && (
        <div className="dsec">
          <H4 ic="chat">{rv.designer || rv.meeting || rv.note ? '담당 · 디자인팀 회신' : '담당'}</H4>
          <div className="d-who">
            <span className={'d-av' + (who ? '' : ' none')} style={team ? { '--tc': teamColor(team) } : undefined}>{initial(who) || '?'}</span>
            <div>
              <b>{who || '담당 미배정'}{team && <span className="d-team" style={{ '--tc': teamColor(team) }}>{team}</span>}</b>
              <small>{rv.meeting ? `미팅 ${fmtMeet(rv.meeting)}` : rv.designer || rv.note ? '잡힌 미팅 없음' : '디자인팀이 확인하면 일정과 미팅이 여기에 보여요'}</small>
            </div>
          </div>
          {rv.note && <div className="memo">{rv.note}</div>}
        </div>
      )}

      {!!r.items?.length && (
        <div className="dsec">
          <H4 ic="layers">{cfg.items.label}<span className="r g">{`${r.items.length}종 · 총 ${total}개`}</span></H4>
          <ul className="ditems">
            {r.items.map((x, i) => (
              <li key={i}>
                <div><b>{x.kind}</b><small>{[x.size || '규격 미정', x.note].filter(Boolean).join(' · ')}</small></div>
                <span className="q">{x.qty}개</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(r.planHtml || r.plan) && <div className="dsec"><H4 ic="doc">{cfg.plan.label}</H4><PlanDoc r={r} onZoom={onZoom} /></div>}

      <div className="dsec">
        <H4 ic="target">요청 내용</H4>
        <KV pairs={[['요청 유형', r.type], [cfg.place?.label || '설치 장소', r.place], [cfg.chips?.label || '노출 채널', chList(r).join(', ')], [cfg.goal.label, r.goal], [cfg.target.label, r.target], ['규격 · 수량', r.spec],
          [cfg.copy?.label || '필수 문구', r.copy], ['촉박 사유', r.urgent], ['미팅 희망', r.meet ? '착수 전 미팅 희망' : ''], ['자료 링크', r.files, true]]} />
      </div>

      {(!!r.refImages?.length || r.ref) && (
        <div className="dsec">
          <H4 ic="image">{cfg.refs.short}</H4>
          {!!r.refImages?.length && (
            <div className="thumbs" style={{ marginBottom: r.ref ? 12 : 0 }}>
              {r.refImages.map((id) => <div className="thumb" key={id}><RefImg src={'/api/files/' + id} onZoom={onZoom} /></div>)}
            </div>
          )}
          {r.ref && <div className="memo" style={{ marginTop: 0 }}>{linkify(r.ref)}</div>}
        </div>
      )}

      {s !== 'withdrawn' && <ResultsPanel r={r} s={s} me={me} toast={toast} onZoom={onZoom} onChanged={refresh} />}

      {me.isAdmin && s !== 'withdrawn' && <AdminPanel key={r.id} r={r} rv={rv} s={s} onSaved={refresh} toast={toast} />}

      <div className="actions">
        {canEdit && (
          <button type="button" className="btn primary" onClick={() => {
            if (!me.isAdmin && s === 'progress') { onAlert('수정할 수 없어요', '진행 중인 상태에서는 수정이 불가합니다. 수정사항은 Flow를 통해 남겨주세요.'); return; }
            if (!me.isAdmin && s === 'done') { onAlert('수정할 수 없어요', '완료된 요청은 수정이 불가합니다. 추가 요청은 새 요청서로 남겨주세요.'); return; }
            if (!me.isAdmin && s === 'cancel') { onAlert('수정할 수 없어요', '취소된 요청은 수정할 수 없어요. 다시 진행하려면 담당 팀에 말씀해 주시거나 새 요청서로 남겨주세요.'); return; }
            onEdit(r.id);
          }}>수정</button>
        )}
        <button type="button" className="btn" onClick={() => copyText(shareText(r, rv), toast)}>Flow 공유용 요약 복사</button>
        {me.isAdmin && (
          <>
            <button type="button" className="btn" onClick={() => onExport('docx', [r.id], 'one')}>워드로 받기</button>
            <button type="button" className="btn" onClick={() => onExport('xlsx', [r.id], 'one')}>엑셀로 받기</button>
          </>
        )}
        {s !== 'withdrawn' && r.mine && ['review', 'hold'].includes(s) && (
          <ConfirmBtn key={'w' + r.id} label="요청 철회" confirm="철회하려면 한 번 더 누르세요" onConfirm={withdraw} />
        )}
        {me.isAdmin && <ConfirmBtn key={'d' + r.id} label="요청 삭제" confirm="삭제하면 되돌릴 수 없어요. 한 번 더 누르세요" style={{ marginLeft: 'auto' }} onConfirm={remove} />}
      </div>
    </aside>
  );
}
