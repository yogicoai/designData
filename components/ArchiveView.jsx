'use client';
/* 문서 보관 (디자인팀 전용) — 달마다 엑셀(목록)·워드(요청서 전체) */
import { useState } from 'react';
import { Icon, Chip } from './ui';
import { SCOPES } from '@/lib/shared/constants';
import { pad, fmt, monthKey, firstOfMonth } from '@/lib/shared/dates';

export default function ArchiveView({ rows, onOpen, onExport }) {
  const [amonth, setAmonth] = useState(() => firstOfMonth());
  const [basis, setBasis] = useState('live');
  const [scope, setScope] = useState('done');
  const [sel, setSel] = useState(() => new Set());

  const mk = monthKey(amonth);
  const idsFor = (k) => {
    const ok = SCOPES.find((x) => x.k === k).ok;
    return rows.filter((x) => ok(x.s) && ((basis === 'req' ? x.r.requestDate : x.live) || '').slice(0, 7) === mk)
      .sort((a, b) => (a.live || '').localeCompare(b.live || ''));
  };
  const list = idsFor(scope);
  const live = new Set(list.map((x) => x.r.id));
  const picked = [...sel].filter((id) => live.has(id));
  const n = picked.length;
  const moveMonth = (d) => { setAmonth(new Date(amonth.getFullYear(), amonth.getMonth() + d, 1)); setSel(new Set()); };

  const targets = () => (n ? [list.filter((x) => sel.has(x.r.id)).map((x) => x.r.id), 'sel'] : [list.map((x) => x.r.id), 'month']);
  const meta = { amonth, scope, basis };

  return (
    <section id="view-archive">
      <div className="arch-intro"><h2>문서 보관</h2><p>디자인팀만 보이는 화면이에요. 달마다 요청서를 엑셀(목록)이나 워드(요청서 전체 내용)로 받아 보관하세요. 줄마다 개별로도 받을 수 있어요.</p></div>
      <div className="arch-head">
        <div className="month-nav">
          <button type="button" className="btn" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
          <h2 className="mono">{`${amonth.getFullYear()}.${pad(amonth.getMonth() + 1)}`}</h2>
          <button type="button" className="btn" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
        </div>
        <div className="arch-opts">
          <select aria-label="월 기준" value={basis} onChange={(e) => { setBasis(e.target.value); setSel(new Set()); }}>
            <option value="live">라이브 날짜 기준</option>
            <option value="req">요청일 기준</option>
          </select>
        </div>
      </div>
      <div className="seg arch-tabs" role="tablist" aria-label="보관할 요청 종류">
        {SCOPES.map((x) => (
          <button key={x.k} type="button" role="tab" aria-selected={String(scope === x.k)} aria-pressed={String(scope === x.k)} onClick={() => { setScope(x.k); setSel(new Set()); }}>
            {x.label}<span className="mono acnt">{idsFor(x.k).length}</span>
          </button>
        ))}
      </div>
      <div className="arch-bar">
        <label className="check" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={n > 0 && n === list.length}
            ref={(el) => { if (el) el.indeterminate = n > 0 && n < list.length; }}
            onChange={(e) => setSel(e.target.checked ? new Set(list.map((x) => x.r.id)) : new Set())}
          />{' '}
          <span>{n ? `${list.length}건 중 ${n}건 선택` : `${list.length}건`}</span>
        </label>
        <div className="arch-btns">
          <button type="button" className="btn" disabled={!list.length} onClick={() => { const [ids, k] = targets(); onExport('xlsx', ids, k, meta); }}>{n ? `선택 ${n}건 엑셀로 받기` : '이 달 엑셀로 받기'}</button>
          <button type="button" className="btn primary" disabled={!list.length} onClick={() => { const [ids, k] = targets(); onExport('docx', ids, k, meta); }}>{n ? `선택 ${n}건 워드로 받기` : '이 달 워드로 받기'}</button>
        </div>
      </div>
      <div className="arows">
        {!list.length ? (
          <div className="empty">
            <Icon name="folder" size={28} cls="hero" />
            <b>{`이 달에 ${SCOPES.find((x) => x.k === scope).label} 요청이 없어요`}</b>위에서 달이나 기준(라이브/요청일), 탭을 바꿔 보세요.
          </div>
        ) : (
          <>
            <div className="arow head"><span /><span>요청번호</span><span>프로젝트</span><span>부서 · 요청자</span><span>라이브</span><span>상태</span><span>담당</span><span>개별 받기</span></div>
            {list.map(({ r, rv, s, live: lv, who }) => (
              <div className="arow" key={r.id}>
                <input type="checkbox" aria-label={`${r.title} 선택`} checked={sel.has(r.id)} onChange={(e) => {
                  const next = new Set(sel);
                  e.target.checked ? next.add(r.id) : next.delete(r.id);
                  setSel(next);
                }} />
                <span className="no">{r.no || ''}</span>
                <button type="button" className="at" onClick={() => onOpen(r.id)}>{r.title}</button>
                <span className="ad"><b>{r.dept}</b> <span>{r.name}</span></span>
                <span className="mono">{fmt(lv)}</span>
                <span><Chip s={s} /></span>
                <span className={'who' + (who ? '' : ' none')}>{who || '미배정'}</span>
                <span className="abtns">
                  <button type="button" className="btn sm" onClick={() => onExport('docx', [r.id], 'one')}>워드</button>
                  <button type="button" className="btn sm" onClick={() => onExport('xlsx', [r.id], 'one')}>엑셀</button>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
      <p className="gnote">엑셀은 ‘요청 목록’과 ‘산출물’ 두 시트로, 워드는 표지(목록) 뒤에 요청서 한 건씩 페이지를 나눠 담아요. 기획안 이미지와 레퍼런스 이미지도 워드에 함께 들어가요. 체크한 요청이 있으면 체크한 것만 받아요.</p>
    </section>
  );
}
