'use client';
/* 요청 현황 */
import { useState } from 'react';
import { Icon, Chip } from './ui';
import { DEPTS, STATUS_FILTER, LEAD, teamColor } from '@/lib/shared/constants';
import { fmt, bizDays } from '@/lib/shared/dates';
import { isDropped, isOpenStatus, statusLabel } from '@/lib/shared/model';

export function Stats({ rows, pipeFilter, onPick }) {
  const cnt = (k) => rows.filter((x) => x.s === k).length;
  const tile = (key, label) => (
    <button key={key} type="button" className="stat" style={{ '--c': `var(--s-${key})` }} aria-pressed={String(pipeFilter === key)} title={`${label}만 보기`} onClick={() => onPick(key)}>
      <span className="k">{label}</span>
      <span className="v">{cnt(key)}</span>
    </button>
  );
  return <div className="stats">{tile('progress', '진행 중인 요청')}{tile('review', '검토중')}{tile('done', '완료')}{tile('hold', '보류')}</div>;
}

export default function ListView({ rows, loaded, pipeFilter, setPipeFilter, onOpen, go }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [sort, setSort] = useState('live');

  const counts = {};
  for (const x of rows) counts[x.s] = (counts[x.s] || 0) + 1;
  const nLive = rows.filter((x) => !isDropped(x.s)).length;

  const ql = q.trim().toLowerCase();
  let list = rows.filter((x) => {
    const r = x.r;
    if (pipeFilter ? x.s !== pipeFilter : isDropped(x.s)) return false;
    if (dept && r.dept !== dept) return false;
    if (ql && ![r.title, r.name, r.no, r.dept, r.type, r.team, x.who].join(' ').toLowerCase().includes(ql)) return false;
    return true;
  });
  const doneLast = (a, b) => (a.s === 'done') - (b.s === 'done');
  list = [...list].sort(sort === 'new'
    ? (a, b) => (b.r.createdAt || '').localeCompare(a.r.createdAt || '')
    : (a, b) => doneLast(a, b) || (a.live || '9').localeCompare(b.live || '9'));

  return (
    <section id="view-list">
      <Stats rows={rows} pipeFilter={pipeFilter} onPick={(k) => setPipeFilter(pipeFilter === k ? '' : k)} />
      <div className="toolbar">
        <input type="text" placeholder="프로젝트명, 요청자, 요청번호 검색" aria-label="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="l-status" aria-label="상태 필터" value={pipeFilter} onChange={(e) => setPipeFilter(e.target.value)}>
          <option value="">{`상태 전체 (취소·철회 제외) · ${nLive}`}</option>
          {STATUS_FILTER.map((s) => <option key={s.k} value={s.k}>{`${s.label} · ${counts[s.k] || 0}`}</option>)}
        </select>
        <select aria-label="부서 필터" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">전체 부서</option>
          {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="live">라이브 빠른 순</option>
          <option value="new">최근 접수 순</option>
        </select>
      </div>
      <div className="rows">
        {!list.length ? (
          <div className="empty">
            <Icon name={rows.length ? 'search' : 'inbox'} size={28} cls="hero" />
            {rows.length ? (
              <><b>조건에 맞는 요청이 없어요</b>상태·부서를 바꾸거나 검색어를 지워 보세요. 취소·철회된 요청은 상태에서 ‘취소’·‘철회’를 고르면 보여요.</>
            ) : (
              <>
                <b>{loaded ? '아직 접수된 요청이 없어요' : '요청을 불러오는 중이에요'}</b>각 부서가 ‘요청서 작성’ 탭에서 제출하면 여기에 라이브 날짜 순으로 쌓입니다.
                <div style={{ marginTop: 14 }}><button type="button" className="btn primary" onClick={() => go('new')}>첫 요청서 작성하기</button></div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="row head"><span>요청번호</span><span>프로젝트</span><span className="dept">부서 · 요청자</span><span>시안</span><span>라이브</span><span>상태</span><span>담당</span></div>
            {list.map((x) => {
              const { r, rv, s, live, draft, who, team } = x;
              const n = bizDays(live);
              const open = isOpenStatus(s);
              const gone = isDropped(s);
              const late = open && n != null && n < 0;
              const tight = open && n != null && n >= 0 && n < LEAD;
              const needMeet = s === 'review' && r.meet && !rv.meeting;
              return (
                <button key={r.id} type="button" className={'row' + (s === 'done' || gone ? ' done' : '')} onClick={() => onOpen(r.id)}>
                  <span className="no">{r.no || ''}</span>
                  <span className="main" style={{ minWidth: 0 }}>
                    <div className="t">
                      {r.title}
                      {tight && <span className="flag">촉박</span>}
                      {needMeet && <span className="flag m">미팅 희망</span>}
                      {r.editedAt && <span className="flag e">수정됨</span>}
                      {r.results?.round > 0 && <span className="flag ok">{r.results.round}차 완성본</span>}
                    </div>
                    <div className="sub">{[r.type, r.items?.length ? `산출물 ${r.items.length}종` : null].filter(Boolean).join(' · ')}</div>
                  </span>
                  <span className="dept"><div className="dn">{r.dept}</div><div className="sub">{r.name}</div></span>
                  <span className="d d1">{fmt(draft)}<small>시안</small></span>
                  <span className={'d d2' + (late ? ' late' : '')}>
                    {fmt(live)}
                    <small>
                      <span className="dk">{s === 'done' ? '완료' : gone ? statusLabel(s) : late ? '지남' : n != null && n >= 0 ? `영업일 ${n}일` : '라이브'}</span>
                      <span className="mpre">{s === 'done' ? '라이브 완료' : gone ? '라이브' : late ? '라이브 지남' : n != null && n >= 0 ? `라이브 D-${n}` : '라이브'}</span>
                    </small>
                  </span>
                  <span className="chipcell"><Chip s={s} /></span>
                  <span className={'who' + (who ? '' : ' none')}>{who || '미배정'}<small className="mcap">담당</small>{team && <small className="tm" style={{ '--tc': teamColor(team) }}>{team}</small>}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
