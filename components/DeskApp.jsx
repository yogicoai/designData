'use client';
/* 디자인 요청 데스크 — 상단 탭(작성/현황/일정표/문서 보관) + 상세 서랍 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RequestForm from './RequestForm';
import ListView from './ListView';
import Drawer from './Drawer';
import ScheduleView from './ScheduleView';
import ArchiveView from './ArchiveView';
import RosterEditor from './RosterEditor';
import TeamLogin from './TeamLogin';
import { Icon, Toast, AlertBox, Lightbox } from './ui';
import { api, downloadExport } from '@/lib/client/api';
import { SCOPES, teamOf } from '@/lib/shared/constants';
import { monthKey } from '@/lib/shared/dates';
import { statusOf, liveOf, startOf, draftOf, assigneeOf, safeName, isOpenStatus } from '@/lib/shared/model';

const POLL_MS = 15000;
const VIEWS = ['new', 'list', 'schedule', 'archive'];

export default function DeskApp() {
  const [data, setData] = useState({ loaded: false, requests: [], reviews: {}, roster: [] });
  const [me, setMe] = useState({ uid: '', isAdmin: false, teamLogin: true });
  const [hash, setHash] = useState('');
  const [banner, setBanner] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [openId, setOpenId] = useState(null);
  const [panel, setPanel] = useState(null); // 'roster' | 'login'
  const [editing, setEditing] = useState(null); // { id, orig }
  const [pipeFilter, setPipeFilter] = useState('');
  const [alert, setAlert] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [home, setHome] = useState(0); // 로고 누를 때마다 +1 → 각 화면을 처음 상태로
  const rev = useRef('');
  const toastT = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  /* ---------- 데이터 ---------- */
  const refresh = useCallback(async (force = false) => {
    try {
      const j = await api('/api/state' + (force || !rev.current ? '' : '?rev=' + encodeURIComponent(rev.current)));
      setMe(j.me);
      rev.current = j.rev;
      if (!j.unchanged) setData({ loaded: true, requests: j.requests, reviews: j.reviews, roster: j.roster });
      setBanner((b) => (b.startsWith('요청 데이터') ? '' : b));
    } catch (e) {
      setBanner(e?.code === 'no_db' ? e.message : '요청 데이터를 불러오지 못했어요. 네트워크 상태를 확인해 주세요.');
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  /* ---------- 화면 전환 (#new #list #schedule #archive) ---------- */
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1));
    on();
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const view = VIEWS.includes(hash) && (hash !== 'archive' || me.isAdmin) ? hash : me.isAdmin ? 'list' : 'new';
  const go = useCallback((v) => { location.hash = v; }, []);

  /* 로고 → 첫 화면 (요청자 = 요청서 작성, 디자인팀 = 요청 현황). 열린 창·필터는 닫고 처음 상태로 */
  const goHome = (e) => {
    e.preventDefault();
    if (editing && !window.confirm('수정 중인 내용은 저장되지 않아요. 첫 화면으로 갈까요?')) return;
    setEditing(null);
    setOpenId(null);
    setPanel(null);
    setZoom(null);
    setPipeFilter('');
    setHome((n) => n + 1);
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
    setHash('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rows = useMemo(() => data.requests.map((r) => {
    const rv = data.reviews[r.id] || {};
    const who = assigneeOf(r, rv);
    return { r, rv, s: statusOf(r, rv), live: liveOf(r, rv), start: startOf(r, rv), draft: draftOf(r, rv), who, team: teamOf(r, who) };
  }), [data]);
  const rowMap = useMemo(() => new Map(rows.map((x) => [x.r.id, x])), [rows]);
  const nOpen = rows.filter((x) => isOpenStatus(x.s)).length;

  /* ---------- 서랍 · 단축키 ---------- */
  const openDrawer = useCallback((id) => { setPanel(null); setOpenId(id); }, []);
  const closeDrawer = useCallback(() => { setOpenId(null); setPanel((p) => (p === 'roster' ? null : p)); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoom) { setZoom(null); return; }
      if (openId || panel === 'roster') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoom, openId, panel, closeDrawer]);
  useEffect(() => { if (openId && data.loaded && !rowMap.has(openId)) setOpenId(null); }, [openId, rowMap, data.loaded]);

  /* ---------- 수정 ---------- */
  const startEdit = (id) => {
    const x = rowMap.get(id);
    if (!x) return;
    setOpenId(null);
    setEditing({ id, orig: x.r });
    go('new');
  };
  const cancelEdit = () => {
    const id = editing?.id;
    setEditing(null);
    if (id) { go('list'); setOpenId(id); }
  };
  const editSaved = async (id) => {
    setEditing(null);
    await refresh(true);
    go('list');
    setOpenId(id);
  };

  /* ---------- 엑셀 · 워드 ---------- */
  async function onExport(format, ids, kind, meta) {
    const ext = format;
    let filename, cover = null;
    if (kind === 'one') {
      const r = rowMap.get(ids[0])?.r;
      filename = `디자인요청서_${r?.no || ''}_${safeName(r?.title)}.${ext}`;
    } else {
      const sc = SCOPES.find((x) => x.k === meta.scope);
      filename = `디자인요청_${monthKey(meta.amonth)}_${sc.file}${kind === 'sel' ? `_선택${ids.length}건` : ''}.${ext}`;
      cover = { title: `디자인 요청서 보관 · ${meta.amonth.getFullYear()}년 ${meta.amonth.getMonth() + 1}월 · ${sc.label}`, sub: `${meta.basis === 'req' ? '요청일' : '라이브 날짜'} 기준` };
    }
    toast(format === 'xlsx' ? '엑셀 파일을 만드는 중이에요…' : '워드 파일을 만드는 중이에요… (이미지가 많으면 조금 걸려요)');
    try {
      await downloadExport({ format, ids, cover, filename }, filename);
      toast('파일을 받았어요.');
    } catch (e) {
      toast(e?.message || '파일을 만들지 못했어요.');
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setOpenId(null);
    await refresh(true);
    toast('디자인팀 로그아웃했어요.');
  }

  const openRow = openId ? rowMap.get(openId) : null;
  const tab = (v, ic, label, extra) => (
    <a href={'#' + v} aria-current={view === v ? 'page' : undefined}>
      <Icon name={ic} size={18} />
      {label}
      {extra}
    </a>
  );

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/" onClick={goHome} title="첫 화면으로">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/yogibo-logo.png" alt="Yogibo" width={361} height={144} />
            <span className="brand-div" aria-hidden="true" />
            <h1>디자인 요청 데스크</h1>
          </a>
          <div className="role">
            <span>접속 권한</span>
            <b>{me.isAdmin ? '디자인팀 (편집자)' : '요청자'}</b>
            {me.isAdmin ? (
              <>
                <button type="button" className="btn ghost role-btn" onClick={() => { setOpenId(null); setPanel('roster'); }}>요청자 명단</button>
                <button type="button" className="btn ghost role-btn" onClick={logout}>로그아웃</button>
              </>
            ) : (
              me.teamLogin && <button type="button" className="btn ghost role-btn" onClick={() => setPanel('login')}>디자인팀 로그인</button>
            )}
          </div>
          <nav className="tabs" aria-label="화면 전환">
            {tab('new', 'clipboard', '요청서 작성')}
            {tab('list', 'inbox', '요청 현황', <span className="n mono">{nOpen}</span>)}
            {tab('schedule', 'calendar', '디자인 일정표')}
            {me.isAdmin && tab('archive', 'folder', '문서 보관')}
          </nav>
        </div>
      </header>

      <div className="wrap">
        <div className="banner" hidden={!banner}>{banner}</div>
        <main>
          <RequestForm
            active={view === 'new'}
            roster={data.roster}
            editing={editing}
            onCancelEdit={cancelEdit}
            onEditSaved={editSaved}
            onSubmitted={() => refresh(true)}
            toast={toast}
            setBanner={setBanner}
            onZoom={setZoom}
            go={go}
            home={home}
          />
          {view === 'list' && <ListView key={'l' + home} rows={rows} loaded={data.loaded} pipeFilter={pipeFilter} setPipeFilter={setPipeFilter} onOpen={openDrawer} go={go} />}
          {view === 'schedule' && <ScheduleView key={'s' + home} rows={rows} onOpen={openDrawer} />}
          {view === 'archive' && me.isAdmin && <ArchiveView key={'a' + home} rows={rows} onOpen={openDrawer} onExport={onExport} />}
        </main>
      </div>

      {(openRow || panel === 'roster') && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}>
          {panel === 'roster' ? (
            <RosterEditor roster={data.roster} onClose={closeDrawer} onSaved={() => refresh(true)} toast={toast} />
          ) : (
            <Drawer
              key={openRow.r.id}
              row={openRow}
              me={me}
              onClose={closeDrawer}
              onEdit={startEdit}
              onAlert={(title, msg) => setAlert({ title, msg })}
              refresh={() => refresh(true)}
              toast={toast}
              onZoom={setZoom}
              onExport={onExport}
            />
          )}
        </div>
      )}
      {panel === 'login' && <TeamLogin onClose={() => setPanel(null)} onDone={async () => { setPanel(null); await refresh(true); toast('디자인팀으로 로그인했어요.'); }} />}
      {alert && <AlertBox title={alert.title} msg={alert.msg} onClose={() => setAlert(null)} />}
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
      <Toast msg={toastMsg} />
    </>
  );
}
