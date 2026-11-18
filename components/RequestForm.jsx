'use client';
/* 요청서 작성 · 수정 — STEP 0(팀) + STEP 1~5. 항목은 팀별 양식(lib/shared/forms.js)을 따른다 */
import { useCallback, useEffect, useRef, useState } from 'react';
import RichEditor from './RichEditor';
import { Icon, RefImg, copyText } from './ui';
import { api, uploadImage, deleteFile } from '@/lib/client/api';
import { store, ME_KEY, DRAFT_KEY } from '@/lib/client/store';
import { TEAMS, DEPTS, LEAD, MAX_IMG, IMG_TYPES, MAX_IMG_BYTES, fileIdsIn } from '@/lib/shared/constants';
import { formOf } from '@/lib/shared/forms';
import { josa } from '@/lib/shared/josa';
import { bizDays, todayStr, pad } from '@/lib/shared/dates';
import { shareText } from '@/lib/shared/model';

const EMPTY = { team: '', place: '', dept: '', name: '', etc: false, title: '', type: '', channels: [], channelEtc: '', goal: '', target: '', copy: '', draft: '', live: '', urgent: '', meet: false, files: '', ref: '' };
const TEXT_KEYS = ['place', 'title', 'channelEtc', 'goal', 'target', 'copy', 'draft', 'live', 'urgent', 'files', 'ref'];
const ERR_ORDER = ['f-team', 'f-dept', 'f-name', 'f-title', 'f-type', 'f-place', 'f-channel-etc', 'f-goal', 'f-plan', 'items', 'f-draft', 'f-live', 'f-urgent'];
const personLabel = (p) => `${p.name} ${p.title}`;
let keySeq = 0;
const nextKey = () => 'k' + ++keySeq;

/* 마지막으로 제출한 이름·부서로 요청자 칸 채우기 */
function withMe(f) {
  if (f.name) return f;
  const me = store.get(ME_KEY);
  if (!me?.name || !DEPTS.includes(me.dept)) return f;
  if (f.dept && f.dept !== me.dept) return f;
  return { ...f, dept: me.dept, name: me.name, etc: false };
}

function fromData(d) {
  const f = { ...EMPTY };
  if (DEPTS.includes(d.dept)) f.dept = d.dept;
  f.name = d.name || '';
  for (const k of TEXT_KEYS) if (d[k] != null) f[k] = String(d[k]);
  f.team = TEAMS.some((t) => t.k === d.team) ? d.team : '';
  const cfg = formOf(f.team);
  f.type = cfg.types.includes(d.type) ? d.type : '';
  f.channels = cfg.chips ? (d.channels || []).filter((c) => cfg.chips.options.includes(c)) : [];
  f.meet = !!d.meet;
  return f;
}

export default function RequestForm({ active, roster, editing, onCancelEdit, onEditSaved, onSubmitted, toast, setBanner, onZoom, go, home }) {
  const [f, setF] = useState(EMPTY);
  const [items, setItems] = useState([]);
  const [refImgs, setRefImgs] = useState([]);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { no, request }
  const edRef = useRef(null);
  const ready = useRef(false);
  /* 지금 칸에 들어 있는 내용이 누구 것인지: undefined=아직 안 채움, null=새 요청서, 'r..'=그 요청 수정 중.
     수정 저장 직후 editing 이 null 로 바뀌는 순간에도 수정 내용이 새 요청 임시저장을 덮지 않게 한다. */
  const formFor = useRef(undefined);
  const formRef = useRef(null);
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);

  const cfg = formOf(f.team);
  const deptList = roster.filter((p) => p.team === f.dept);
  const inList = deptList.some((p) => personLabel(p) === f.name);
  const showEtc = !!f.dept && (f.etc || (!!f.name && !inList));
  const nameSelVal = showEtc ? '__etc' : inList ? f.name : '';

  /* 입력값 → 저장할 요청서 본문 */
  const readForm = useCallback(() => {
    const ed = edRef.current;
    return {
      team: f.team, place: cfg.place ? f.place.trim() : '', dept: f.dept, name: f.name.trim(), title: f.title.trim(), type: f.type,
      channels: cfg.chips ? f.channels : [], channelEtc: cfg.chips ? f.channelEtc.trim() : '',
      goal: f.goal.trim(), target: f.target.trim(), plan: ed ? ed.getText() : '', planHtml: ed ? ed.getHtml() : '', copy: cfg.copy ? f.copy.trim() : '',
      items: items.map((x) => ({ kind: x.kind, size: (x.size || '').trim(), qty: Number(x.qty) || 1, note: (x.note || '').trim() })),
      refImages: refImgs.filter((x) => x.id).map((x) => x.id),
      draft: f.draft, live: f.live, urgent: f.urgent.trim(), meet: f.meet, files: f.files.trim(), ref: f.ref.trim(),
    };
  }, [f, items, refImgs, cfg]);

  const saveDraft = useCallback(() => {
    if (!ready.current || formFor.current !== null) return;
    store.set(DRAFT_KEY, readForm());
  }, [readForm]);

  useEffect(() => { saveDraft(); }, [saveDraft]);

  function fill(d) {
    setF(fromData(d));
    setItems((d.items || []).map((x) => ({ ...x, _k: nextKey() })));
    setRefImgs((d.refImages || []).map((id) => ({ key: id, id })));
    const ed = edRef.current;
    if (d.planHtml) ed.setHtml(d.planHtml);
    else if (d.plan) ed.setPlain(d.plan);
    else ed.clear();
  }
  function clearAll() {
    setF(EMPTY); setItems([]); setRefImgs([]); setErrs({});
    edRef.current?.clear();
  }

  /* 처음 열 때 · 수정 시작/끝날 때 */
  useEffect(() => {
    ready.current = false;
    if (editing) {
      setDone(null);
      clearAll();
      fill(editing.orig);
      formFor.current = editing.id;
      window.scrollTo(0, 0);
    } else {
      clearAll();
      const s = store.get(DRAFT_KEY);
      if (s) { fill(s); setF(withMe(fromData(s))); } else setF(withMe(EMPTY));
      formFor.current = null;
    }
    const t = setTimeout(() => { ready.current = true; }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  /* 로고(첫 화면) — 접수 완료 화면에 있었으면 빈 작성 화면으로 (쓰던 임시저장은 그대로) */
  useEffect(() => { if (home) setDone(null); }, [home]);

  const set = (k, v) => { setF((cur) => ({ ...cur, [k]: v })); if (Object.keys(errs).length) setErrs({}); };

  /* 팀을 바꾸면 그 팀 양식으로 — 새 팀에 없는 유형·채널은 비우고, 산출물은 종류만 다시 고르게 */
  function changeTeam(team) {
    const next = formOf(team);
    setF((cur) => ({
      ...cur, team,
      type: next.types.includes(cur.type) ? cur.type : '',
      channels: next.chips ? cur.channels.filter((x) => next.chips.options.includes(x)) : [],
    }));
    const bad = items.filter((x) => x.kind && !next.kmap[x.kind]);
    if (bad.length) {
      setItems((cur) => cur.map((x) => (x.kind && !next.kmap[x.kind] ? { ...x, kind: '' } : x)));
      toast(`팀마다 ${next.items.label} 종류가 달라요. 비워진 줄은 종류를 다시 골라 주세요.`);
    }
    setErrs({});
  }

  /* ---------- 산출물 ---------- */
  function addItem(k) {
    const key = nextKey();
    setItems((cur) => [...cur, { _k: key, kind: k, size: cfg.kmap[k]?.size || '', qty: 1, note: '' }]);
    setTimeout(() => document.getElementById((k ? 'it-qty-' : 'it-kind-') + key)?.focus(), 0);
  }
  const setItem = (key, patch) => setItems((cur) => cur.map((x) => (x._k === key ? { ...x, ...patch } : x)));
  const total = items.reduce((s, x) => s + (Number(x.qty) || 0), 0);

  /* ---------- 레퍼런스 이미지 ---------- */
  async function addFiles(files) {
    const ok = files.filter((x) => IMG_TYPES.includes(x.type));
    if (ok.length < files.length) toast('PNG, JPG, GIF, WEBP 이미지만 올릴 수 있어요.');
    const room = MAX_IMG - refImgs.length;
    if (room <= 0) { toast(`이미지는 최대 ${MAX_IMG}장까지예요.`); return; }
    if (ok.length > room) toast(`최대 ${MAX_IMG}장이라 ${room}장만 올립니다.`);
    for (const file of ok.slice(0, room)) {
      if (file.size > MAX_IMG_BYTES) { toast(`${file.name}: 20MB를 넘어서 올릴 수 없어요.`); continue; }
      const key = nextKey();
      const local = URL.createObjectURL(file);
      setRefImgs((cur) => [...cur, { key, id: null, local, busy: true }]);
      try {
        const id = await uploadImage(file, 'ref');
        setRefImgs((cur) => cur.map((x) => (x.key === key ? { ...x, id, busy: false } : x)));
      } catch (e) {
        setRefImgs((cur) => cur.filter((x) => x.key !== key));
        toast(e?.code === 'too_large' ? '파일이 너무 커요 (20MB 이하).' : e?.message && e.code !== 'server' ? e.message : '이미지를 올리지 못했어요. 다시 시도해 주세요.');
      }
    }
  }
  function removeImg(x) {
    setRefImgs((cur) => cur.filter((y) => y.key !== x.key));
    if (!editing && x.id) deleteFile(x.id);
  }

  /* 화면 캡처 붙여 넣기 (편집기 밖) */
  useEffect(() => {
    if (!active || done) return;
    const onPaste = (e) => {
      if (e.defaultPrevented) return;
      const imgs = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/'));
      if (!imgs.length) return;
      e.preventDefault();
      addFiles(imgs);
      document.getElementById('drop')?.scrollIntoView({ block: 'center' });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  /* ---------- 일정 안내 ---------- */
  const n = bizDays(f.live);
  const tight = n != null && n < LEAD;
  const L = cfg.live.short;
  const leadText = n == null
    ? `${L} 날짜를 고르면 남은 영업일을 알려드려요. 기본 소요 기간은 영업일 기준 ${LEAD}일입니다.`
    : n < 0 ? `${L} 날짜가 이미 지났습니다. 날짜를 다시 확인해 주세요.`
    : tight ? `${L}까지 영업일 ${n}일 남았습니다. 기본 소요 기간(${LEAD}일)보다 짧아 일정 조율이 필요할 수 있어요. 촉박한 이유를 적어 주세요.`
    : `${L}까지 영업일 ${n}일 남았습니다. 기본 소요 기간(${LEAD}일) 안에 들어와요.`;

  /* ---------- 제출 ---------- */
  async function onSubmit(e) {
    e.preventDefault();
    const d = readForm();
    const bad = {};
    if (!d.team) bad['f-team'] = '요청할 팀을 골라 주세요.';
    if (!d.dept) bad['f-dept'] = '부서를 선택해 주세요.';
    if (!d.name) bad['f-name'] = showEtc ? '이름과 직급을 적어 주세요.' : '요청자를 선택해 주세요.';
    if (!d.title) bad['f-title'] = '프로젝트명을 적어 주세요.';
    if (!d.type) bad['f-type'] = '요청 유형을 하나 골라 주세요.';
    if (cfg.place && !d.place) bad['f-place'] = `${josa(cfg.place.label, '을')} 적어 주세요.`;
    if (!d.goal) bad['f-goal'] = `${josa(cfg.goal.label, '을')} 적어 주세요.`;
    if (!d.plan) bad['f-plan'] = `${josa(cfg.plan.label, '을')} 적어 주세요.`;
    if (!d.items.length) bad.items = `${josa(cfg.items.label, '을')} 하나 이상 추가해 주세요.`;
    else if (d.items.some((x) => !x.kind)) bad.items = '종류를 고르지 않은 줄이 있어요.';
    if (d.channels.includes('기타') && !d.channelEtc) bad['f-channel-etc'] = `기타 ${cfg.chips?.label || ''} 이름을 적어 주세요.`;
    if (!d.channels.includes('기타')) d.channelEtc = '';
    if (refImgs.some((x) => x.busy) || edRef.current?.busy()) { toast('이미지를 올리는 중이에요. 끝나면 다시 제출해 주세요.'); return; }
    d.items = d.items.filter((x) => x.kind);
    const liveChanged = !editing || d.live !== editing.orig.live;
    if (!d.live) bad['f-live'] = `${josa(cfg.live.label, '을')} 골라 주세요.`;
    else if (liveChanged && d.live < todayStr()) bad['f-live'] = '오늘 이후 날짜를 골라 주세요.';
    if (d.draft && d.live && d.draft > d.live) bad['f-draft'] = `${josa(cfg.draft.label, '은')} ${cfg.live.short} 날짜보다 앞이어야 해요.`;
    const bn = bizDays(d.live);
    if (liveChanged && bn != null && bn >= 0 && bn < LEAD && !d.urgent) bad['f-urgent'] = '촉박한 이유를 적어 주세요.';
    if (Object.keys(bad).length) {
      setErrs(bad);
      const first = ERR_ORDER.find((k) => bad[k]);
      setTimeout(() => { const el = document.getElementById(first); el?.scrollIntoView({ block: 'center' }); el?.focus?.(); }, 0);
      return;
    }
    setBusy(true);
    setBanner('');
    try {
      if (editing) {
        await api(`/api/requests/${editing.id}`, { method: 'PATCH', body: { action: 'edit', data: d } });
        toast('수정 내용을 저장했어요.');
        onEditSaved(editing.id);
      } else {
        const { request } = await api('/api/requests', { method: 'POST', body: d });
        store.set(ME_KEY, { name: d.name, dept: d.dept });
        store.del(DRAFT_KEY);
        ready.current = false;
        clearAll();
        setF(withMe(EMPTY));
        setTimeout(() => { ready.current = true; }, 0);
        setDone({ no: request.no, request });
        onSubmitted(request);
        window.scrollTo(0, 0);
      }
    } catch (err) {
      if (err?.code === 'invalid' || err?.code === 'forbidden') setBanner(err.message);
      else if (err?.code === 'no_db') setBanner(err.message);
      else setBanner(editing ? '저장하지 못했어요. 잠시 후 다시 시도해 주세요. 고친 내용은 화면에 그대로 있어요.' : '제출하지 못했어요. 잠시 후 다시 시도해 주세요. 작성한 내용은 그대로 남아 있습니다.');
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    if (editing) { onCancelEdit(); return; }
    [...refImgs.map((x) => x.id), ...fileIdsIn(edRef.current?.getHtml())].forEach((id) => id && deleteFile(id));
    store.del(DRAFT_KEY);
    clearAll();
    setF(withMe(EMPTY));
  }

  const F = ({ id, cls = '', children }) => <div className={'f' + (cls ? ' ' + cls : '') + (errs[id] ? ' invalid' : '')}>{children}{errs[id] && <span className="err">{errs[id]}</span>}</div>;

  return (
    <section id="view-new" hidden={!active}>
      <div className="intro">
        <h2>{`${f.team || '디자인'} 요청서${editing ? ' 수정' : ''}`}</h2>
        <p>{cfg.intro.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}요청별 상태는 ‘요청 현황’에서 볼 수 있어요.</p>
      </div>
      {editing && (
        <div className="editbar">
          <span><b>{editing.orig.no}</b> 요청서를 수정하고 있어요. 저장하면 디자인팀 화면에 ‘수정됨’ 표시가 붙습니다.</span>
          <button type="button" className="btn" onClick={onCancelEdit}>수정 취소</button>
        </div>
      )}
      <form ref={formRef} className="ticket" noValidate onSubmit={onSubmit} hidden={!!done}>
        <div className="ticket-head"><span>요청번호 · 제출 시 발급</span><span>요청일 {todayStr()}</span></div>

        <fieldset>
          <legend><div className="sec-title"><span className="step">0</span>요청할 팀<small>디자인 · VMD · 개발 중 어디에 맡길지</small></div></legend>
          <div className="fields">
            {F({ id: 'f-team', children: (<>
              <label htmlFor="f-team">어느 팀에 요청하나요?<span className="req">*</span></label>
              <select id="f-team" value={f.team} onChange={(e) => changeTeam(e.target.value)}>
                <option value="">선택</option>
                {TEAMS.map((t) => {
                  const p = roster.find((x) => x.name === t.person);
                  return <option key={t.k} value={t.k}>{`${t.k} — ${t.person}${p ? ' ' + p.title : ''}`}</option>;
                })}
              </select>
              <span className="hint">고른 팀 담당자에게 일정이 잡히고, 아래 항목도 그 팀에 맞게 바뀌어요</span>
            </>) })}
          </div>
        </fieldset>

        <fieldset>
          <legend><div className="sec-title"><span className="step">1</span>요청 기본 정보<small>누가, 어떤 작업을 요청하는지</small></div></legend>
          <div className="fields">
            {F({ id: 'f-dept', children: (<>
              <label htmlFor="f-dept">요청 부서<span className="req">*</span></label>
              <select id="f-dept" value={f.dept} onChange={(e) => {
                const dept = e.target.value;
                setF((cur) => {
                  const list = roster.filter((p) => p.team === dept);
                  const keep = cur.etc || list.some((p) => personLabel(p) === cur.name) || (cur.name && !roster.some((p) => personLabel(p) === cur.name));
                  return { ...cur, dept, name: keep ? cur.name : '', etc: keep ? cur.etc : false };
                });
                setErrs({});
              }}>
                <option value="">선택</option>
                {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </>) })}
            {F({ id: 'f-name', children: (<>
              <label htmlFor="f-name">요청자<span className="req">*</span></label>
              <select id="f-name" value={nameSelVal} disabled={!f.dept} onChange={(e) => {
                const v = e.target.value;
                if (v === '__etc') { setF((cur) => ({ ...cur, etc: true, name: inList ? '' : cur.name })); setTimeout(() => document.getElementById('f-name-etc')?.focus(), 0); }
                else setF((cur) => ({ ...cur, etc: false, name: v }));
                setErrs({});
              }}>
                <option value="">{f.dept ? '이름 선택' : '부서를 먼저 선택하세요'}</option>
                {deptList.map((p) => <option key={personLabel(p)} value={personLabel(p)}>{personLabel(p)}</option>)}
                {f.dept && <option value="__etc">목록에 없음 (직접 입력)</option>}
              </select>
              <input type="text" id="f-name-etc" placeholder="이름 직급 (예: 홍길동 대리)" hidden={!showEtc} value={showEtc ? f.name : ''} onChange={(e) => setF((cur) => ({ ...cur, etc: true, name: e.target.value }))} />
            </>) })}
            {F({ id: 'f-title', cls: 'full', children: (<>
              <label htmlFor="f-title">프로젝트명<span className="req">*</span></label>
              <input type="text" id="f-title" placeholder={cfg.titlePh} value={f.title} onChange={(e) => set('title', e.target.value)} />
            </>) })}
            {F({ id: 'f-type', cls: 'full', children: (<>
              <span className="lbl">요청 유형<span className="req" style={{ color: 'var(--warn)' }}>*</span></span>
              <div className="chips" id="f-type" role="radiogroup" aria-label="요청 유형" tabIndex={-1}>
                {cfg.types.map((t, i) => (
                  <label key={t}><input type="radio" name="type" value={t} id={'f-type-' + i} checked={f.type === t} onChange={() => set('type', t)} /><span>{t}</span></label>
                ))}
              </div>
            </>) })}
            {cfg.place && F({ id: 'f-place', cls: 'full', children: (<>
              <label htmlFor="f-place">{cfg.place.label}<span className="req">*</span></label>
              <input type="text" id="f-place" placeholder={cfg.place.ph} value={f.place} onChange={(e) => set('place', e.target.value)} />
            </>) })}
            {cfg.chips && F({ id: 'f-channel-etc', cls: 'full', children: (<>
              <span className="lbl">{cfg.chips.label}</span>
              <div className="chips" id="f-channel" aria-label={cfg.chips.label}>
                {cfg.chips.options.map((t, i) => (
                  <label key={t}><input type="checkbox" name="channel" value={t} id={'f-ch-' + i} checked={f.channels.includes(t)} onChange={(e) => {
                    const on = e.target.checked;
                    setF((cur) => ({ ...cur, channels: on ? [...cur.channels, t] : cur.channels.filter((c) => c !== t) }));
                    if (t === '기타' && on) setTimeout(() => document.getElementById('f-channel-etc')?.focus(), 0);
                  }} /><span>{t}</span></label>
                ))}
              </div>
              <input type="text" id="f-channel-etc" placeholder={cfg.chips.etcPh} hidden={!f.channels.includes('기타')} value={f.channelEtc} onChange={(e) => set('channelEtc', e.target.value)} />
            </>) })}
          </div>
        </fieldset>

        <fieldset>
          <legend><div className="sec-title"><span className="step">2</span>{cfg.step2.title}<small>{cfg.step2.sub}</small></div></legend>
          <div className="fields">
            {F({ id: 'f-goal', cls: 'full', children: (<>
              <label htmlFor="f-goal">{cfg.goal.label}<span className="req">*</span></label>
              <textarea id="f-goal" placeholder={cfg.goal.ph} value={f.goal} onChange={(e) => set('goal', e.target.value)} />
            </>) })}
            <div className="f full"><label htmlFor="f-target">{cfg.target.label}</label>
              <input type="text" id="f-target" placeholder={cfg.target.ph} value={f.target} onChange={(e) => set('target', e.target.value)} /></div>
            <div className={'f full' + (errs['f-plan'] ? ' invalid' : '')}>
              <div className="f-row"><span className="lbl" id="plan-lbl">{cfg.plan.label}<span className="req" style={{ color: 'var(--warn)' }}>*</span></span>
                <button type="button" className="linkbtn" onClick={() => edRef.current?.appendTemplate(cfg.plan.tpl)}>{cfg.plan.tplBtn}</button></div>
              <RichEditor
                ref={edRef}
                toast={toast}
                onZoom={onZoom}
                onChange={() => { saveDraft(); if (errs['f-plan']) setErrs({}); }}
                placeholder={cfg.plan.ph}
              />
              {errs['f-plan'] && <span className="err">{errs['f-plan']}</span>}
            </div>
            {cfg.copy && <div className="f full"><div className="f-row"><label htmlFor="f-copy">{cfg.copy.label}</label>
                <button type="button" className="linkbtn" onClick={() => {
                  const v = f.copy.trim() ? f.copy.replace(/\s*$/, '') + '\n\n' + cfg.copy.tpl : cfg.copy.tpl;
                  set('copy', v);
                  setTimeout(() => { const t = document.getElementById('f-copy'); t?.focus(); t?.setSelectionRange(7, 7); }, 0);
                }}>항목 양식 넣기</button></div>
              <textarea id="f-copy" style={{ minHeight: 110 }} placeholder={cfg.copy.ph} value={f.copy} onChange={(e) => set('copy', e.target.value)} />
              <span className="hint">{cfg.copy.hint}</span></div>}
          </div>
        </fieldset>

        <fieldset>
          <legend><div className="sec-title"><span className="step">3</span>{cfg.step3.title}<small>{cfg.step3.sub}</small></div></legend>
          <div className="fields">
            <div className="f full"><span className="lbl">빠르게 추가</span>
              <div className="quick">
                {cfg.quick.map((k) => <button key={k} type="button" onClick={() => addItem(k)}>+ {k}</button>)}
                <button type="button" onClick={() => addItem('')}>+ 직접 입력</button>
              </div></div>
            <div className={'f full' + (errs.items ? ' invalid' : '')} id="items-field">
              <div className="f-row"><span className="lbl">{cfg.items.label}<span className="req" style={{ color: 'var(--warn)' }}>*</span></span>
                <span className="items-sum">{items.length ? `${items.length}종 · 총 ${total}개` : ''}</span></div>
              <div className="items" id="items" tabIndex={-1}>
                {!items.length ? (
                  <div className="items-empty">{cfg.items.empty}</div>
                ) : (
                  <>
                    <div className="it head"><span>#</span><span>종류</span><span>{cfg.items.size}</span><span>수량</span><span>비고</span><span /></div>
                    {items.map((it, i) => (
                      <div className="it" key={it._k}>
                        <span className="idx">{pad(i + 1)}</span>
                        <select id={'it-kind-' + it._k} className="k" aria-label={`${i + 1}번 종류`} value={it.kind} onChange={(e) => {
                          const kind = e.target.value;
                          const prev = cfg.kmap[it.kind]?.size || '';
                          setItem(it._k, { kind, ...(!it.size || it.size === prev ? { size: cfg.kmap[kind]?.size || '' } : {}) });
                          setErrs({});
                        }}>
                          <option value="">종류 선택</option>
                          {cfg.kinds.map((x) => <option key={x.k} value={x.k}>{x.k}</option>)}
                        </select>
                        <input type="text" className="sz" placeholder={cfg.items.size} aria-label={`${i + 1}번 ${cfg.items.size}`} value={it.size || ''} onChange={(e) => setItem(it._k, { size: e.target.value })} />
                        <input type="number" id={'it-qty-' + it._k} className="qty" min="1" max="99" aria-label={`${i + 1}번 수량`} value={it.qty} onChange={(e) => setItem(it._k, { qty: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })} />
                        <input type="text" className="nt" placeholder={cfg.items.notePh} aria-label={`${i + 1}번 비고`} value={it.note || ''} onChange={(e) => setItem(it._k, { note: e.target.value })} />
                        <button type="button" className="x" aria-label={`${i + 1}번 삭제`} onClick={() => setItems((cur) => cur.filter((x) => x._k !== it._k))}>✕</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <span className="hint">{cfg.items.hint}</span>
              {errs.items && <span className="err">{errs.items}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend><div className="sec-title"><span className="step">4</span>일정<small>{cfg.step4.sub}</small></div></legend>
          <div className="fields">
            {F({ id: 'f-draft', children: (<>
              <label htmlFor="f-draft">{cfg.draft.label}</label>
              <input type="date" id="f-draft" value={f.draft} onChange={(e) => set('draft', e.target.value)} /><span className="hint">{cfg.draft.hint}</span>
            </>) })}
            {F({ id: 'f-live', children: (<>
              <label htmlFor="f-live">{cfg.live.label}<span className="req">*</span></label>
              <input type="date" id="f-live" value={f.live} onChange={(e) => set('live', e.target.value)} /><span className="hint">{cfg.live.hint}</span>
            </>) })}
            <div className={'lead' + (tight ? ' tight' : '')}>{leadText}</div>
            {tight && F({ id: 'f-urgent', cls: 'full', children: (<>
              <label htmlFor="f-urgent">일정이 촉박한 이유<span className="req">*</span></label>
              <textarea id="f-urgent" placeholder="예: 협력사 일정 변경으로 오픈일이 당겨짐" value={f.urgent} onChange={(e) => set('urgent', e.target.value)} />
            </>) })}
            <div className="f full"><label className="check"><input type="checkbox" checked={f.meet} onChange={(e) => set('meet', e.target.checked)} /> {cfg.meet}</label></div>
          </div>
        </fieldset>

        <fieldset>
          <legend><div className="sec-title"><span className="step">5</span>자료<small>{cfg.step5.sub}</small></div></legend>
          <div className="fields">
            <div className="f full"><label htmlFor="f-files">기획안 · 원본 자료 링크</label>
              <textarea id="f-files" style={{ minHeight: 64 }} placeholder={cfg.filesPh} value={f.files} onChange={(e) => set('files', e.target.value)} /></div>
            <div className="f full"><span className="lbl">{cfg.refs.label}</span>
              {cfg.refs.note && <p className="refs-note" id="refs-note">{cfg.refs.note}</p>}
              <div
                className={'drop' + (over ? ' over' : '')}
                id="drop"
                tabIndex={0}
                role="button"
                aria-label={`${cfg.refs.label} 첨부`}
                aria-describedby={cfg.refs.note ? 'refs-note' : undefined}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); addFiles([...e.dataTransfer.files]); }}
              >
                <b>이미지를 끌어다 놓거나 눌러서 선택</b><br />캡처한 화면은 Ctrl+V로 바로 붙여 넣을 수 있어요 · PNG, JPG, GIF, WEBP · 장당 20MB, 최대 {MAX_IMG}장
              </div>
              <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
              <div className="thumbs">
                {refImgs.map((x) => (
                  <div className="thumb" key={x.key}>
                    <RefImg src={x.local || '/api/files/' + x.id} onZoom={onZoom} />
                    {x.busy ? <span className="busy">올리는 중…</span> : <button type="button" className="x" aria-label="이미지 빼기" onClick={() => removeImg(x)}>✕</button>}
                  </div>
                ))}
              </div></div>
            <div className="f full"><label htmlFor="f-ref">{cfg.refs.desc}</label>
              <textarea id="f-ref" style={{ minHeight: 64 }} placeholder={cfg.refPh} value={f.ref} onChange={(e) => set('ref', e.target.value)} /></div>
          </div>
        </fieldset>

        <div className="submit-bar">
          {!editing && <span className="note">작성 중인 내용은 이 브라우저에 임시 저장됩니다.</span>}
          {editing && <span className="note" />}
          {!editing && <button type="button" className="btn ghost" onClick={resetForm}>비우기</button>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? (editing ? '저장 중…' : '제출 중…') : editing ? '수정 저장' : '요청서 제출'}
          </button>
        </div>
      </form>

      {done && (
        <div className="ticket done-card">
          <Icon name="check" size={30} cls="hero" />
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>요청서가 접수되었습니다</div>
          <div className="no">{done.no}</div>
          <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '46ch' }}>담당자가 확인 후 일정을 정하면 ‘요청 현황’에 표시됩니다. Flow에도 공유하려면 아래 버튼으로 요약을 복사해 붙여 주세요.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={() => copyText(shareText(done.request, {}), toast)}>Flow 공유용 요약 복사</button>
            <button type="button" className="btn" onClick={() => { setDone(null); go('list'); }}>요청 현황 보기</button>
            <button type="button" className="btn primary" onClick={() => setDone(null)}>새 요청서 작성</button>
          </div>
        </div>
      )}
    </section>
  );
}
