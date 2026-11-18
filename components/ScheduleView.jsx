'use client';
/* 디자인 일정표 — 달력 / 타임라인 */
import { useEffect, useState } from 'react';
import { Chip } from './ui';
import { TEAMS, SMAP, teamColor } from '@/lib/shared/constants';
import { isDropped } from '@/lib/shared/model';

/* 막대 색 = 요청한 팀 색 (디자인·VMD·개발). 팀·검토중·진행중 모두 같은 모양(선명한 테두리 + 연한 면 — 11-18 피드백), 완료는 회색 ✓, 보류는 흐리게 */
const DONE_COLOR = '#B0B8C1';
const barColor = (x) => (x.s === 'done' ? DONE_COLOR : teamColor(x.team));
const barCls = (x) => (x.s === 'done' ? ' done' : x.s === 'review' ? ' rv' : x.s === 'hold' ? ' hd' : '');
import { WD, pad, ymd, parse, fmt, todayStr, firstOfMonth } from '@/lib/shared/dates';

function Calendar({ month, ids, onOpen, whoSel }) {
  const y = month.getFullYear(), m = month.getMonth(), today = todayStr();
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const start = new Date(y, m, 1 - first.getDay()), end = new Date(y, m + 1, 6 - last.getDay());
  const weeks = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) weeks.push(new Date(d));
  let any = false;

  const weekEls = weeks.map((ws, wi) => {
    const days = [...Array(7)].map((_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
    const dstr = days.map(ymd), wsS = dstr[0], weS = dstr[6];
    const evs = ids.map((x) => { let s = x.start || x.live, e = x.live; if (s > e) s = e; return { x, s, e }; })
      .filter((v) => v.s <= weS && v.e >= wsS)
      .sort((a, b) => a.s.localeCompare(b.s) || b.e.localeCompare(a.e));
    const lanes = [], placed = [];
    for (const ev of evs) {
      const sc = ev.s < wsS ? 0 : dstr.indexOf(ev.s), ec = ev.e > weS ? 6 : dstr.indexOf(ev.e);
      let L = lanes.findIndex((v) => v < sc);
      if (L < 0) { L = lanes.length; lanes.push(-1); }
      lanes[L] = ec;
      placed.push({ ...ev, sc, ec, L });
    }
    if (placed.length) any = true;
    return { days, dstr, wsS, weS, placed, lanes: Math.max(lanes.length, 2), wi };
  });

  return (
    <div className="cal">
      <div className="cal-head">{WD.map((w) => <span key={w}>{w}</span>)}</div>
      {weekEls.map(({ days, dstr, wsS, weS, placed, lanes, wi }) => (
        <div key={wi} className="cal-week" style={{ gridTemplateRows: `26px repeat(${lanes},24px) 8px` }}>
          {days.map((d, i) => (
            <div key={i} className={'cal-day' + (d.getMonth() !== m ? ' out' : '') + (dstr[i] === today ? ' today' : '') + (i === 0 ? ' sun' : '') + (i === 6 ? ' sat c7' : '')} style={{ gridColumn: i + 1 }}>
              <span className="n">{d.getDate()}</span>
            </div>
          ))}
          {placed.map((p) => {
            const { r, s, draft, who } = p.x;
            const dr = draft;
            const showDm = dr && dr >= p.s && dr <= p.e && dr >= wsS && dr <= weS;
            const dc = showDm ? dstr.indexOf(dr) : 0;
            return (
              <button
                key={r.id}
                type="button"
                className={'cbar' + (p.s < wsS ? ' cl' : '') + (p.e > weS ? ' cr' : ' end') + barCls(p.x)}
                style={{ '--c': barColor(p.x), gridColumn: `${p.sc + 1} / ${p.ec + 2}`, gridRow: p.L + 2 }}
                title={`${p.x.team ? '[' + p.x.team + '] ' : ''}${r.title} · ${fmt(p.s)} ~ ${fmt(p.e)} 라이브 · ${who ? '담당 ' + who : '미배정'} · ${SMAP[s]?.label || ''}`}
                onClick={() => onOpen(r.id)}
              >
                <span className="t">{s === 'done' ? '✓ ' + r.title : r.title}</span>
                <span className={'who' + (who ? '' : ' none')}>{s === 'done' ? '완료' : who || '미배정'}</span>
                {showDm && <span className="dm" style={{ left: `${(((dc - p.sc + 0.5) / (p.ec - p.sc + 1)) * 100).toFixed(1)}%` }} />}
              </button>
            );
          })}
          {wi === 0 && !any && <div className="cal-empty">{whoSel ? '이 담당자의 진행 중 작업이 이 달에는 없어요' : '이 달에 잡힌 작업이 없어요'}</div>}
        </div>
      ))}
    </div>
  );
}

function Agenda({ month, ids, onOpen }) {
  const m = month.getMonth();
  const mS = ymd(new Date(month.getFullYear(), m, 1)), mE = ymd(new Date(month.getFullYear(), m + 1, 0));
  const ag = ids.filter((x) => (x.start || x.live) <= mE && x.live >= mS)
    .sort((a, b) => (a.s === 'done') - (b.s === 'done') || a.live.localeCompare(b.live));
  return (
    <div className="agenda">
      <div className="ag-head">{`${m + 1}월 일정 ${ag.length}건`}</div>
      {ag.length ? ag.map((x) => { const { r, s, start, live, draft, who, team } = x; return (
        <button key={r.id} type="button" className={'ag' + (s === 'done' ? ' done' : '')} style={{ '--c': barColor(x) }} onClick={() => onOpen(r.id)}>
          <div className="ag-top"><b>{(s === 'done' ? '✓ ' : '') + r.title}</b><Chip s={s} /></div>
          <div className="ag-meta">
            <span>{`${fmt(start)} → `}<strong>{`${fmt(live)} 라이브`}</strong></span>
            <span>{`${team ? team + ' · ' : ''}담당 ${who || '미배정'}`}</span>
            {draft && <span>{`시안 ${fmt(draft)}`}</span>}
          </div>
        </button>
      ); }) : <div className="ag-empty">이 달에 잡힌 작업이 없어요</div>}
    </div>
  );
}

function Timeline({ month, rows, onOpen }) {
  const [W, setW] = useState(32);
  useEffect(() => {
    const on = () => setW(window.innerWidth < 760 ? 26 : 32);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const y = month.getFullYear(), m = month.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const mStart = ymd(new Date(y, m, 1)), mEnd = ymd(new Date(y, m, days)), today = todayStr();
  const ids = rows.filter((x) => x.start <= mEnd && x.live >= mStart).sort((a, b) => a.start.localeCompare(b.start) || a.live.localeCompare(b.live));
  const dayInfo = [...Array(days)].map((_, i) => { const d = new Date(y, m, i + 1); return { s: ymd(d), we: d.getDay() === 0 || d.getDay() === 6, w: WD[d.getDay()], n: i + 1 }; });
  const idx = (s) => Math.round((parse(s) - new Date(y, m, 1)) / 864e5);
  const cells = dayInfo.map((d) => <div key={d.n} className={'cell' + (d.we ? ' we' : '')} />);
  return (
    <div className="gscroll">
      <div className="g" style={{ '--w': W + 'px' }}>
        <div className="lh">{`요청 ${ids.length}건`}</div>
        <div className="dh">{dayInfo.map((d) => <div key={d.n} className={(d.we ? 'we ' : '') + (d.s === today ? 'td' : '')}><span>{d.n}</span><span>{d.w}</span></div>)}</div>
        {!ids.length && (
          <>
            <div className="lc" style={{ cursor: 'default' }}><span className="s">이 달에 잡힌 작업 없음</span></div>
            <div className="track">{cells}</div>
          </>
        )}
        {ids.map((x) => { const { r, s, start, live, draft, who, team } = x;
          const a = Math.max(0, idx(start)), b = Math.min(days - 1, idx(live));
          return [
            <div key={r.id + 'l'} className="lc" title={r.title} onClick={() => onOpen(r.id)}>
              <span className="t">{r.title}</span><span className="s"><i className="tdot" style={{ '--c': teamColor(team) }} />{`${team || '팀 미지정'} · ${SMAP[s]?.label || ''}`}</span>
            </div>,
            <div key={r.id + 't'} className="track">
              {cells}
              {today >= mStart && today <= mEnd && <div className="tdl" style={{ left: idx(today) * W + W / 2 - 1 }} />}
              <div className={'bar' + (start < mStart ? ' cl' : '') + (live > mEnd ? ' cr' : '') + barCls(x)} style={{ '--c': barColor(x), left: a * W + 2, width: Math.max(1, b - a + 1) * W - 4 }} title={`${r.title} · ${fmt(start)}~${fmt(live)}`} onClick={() => onOpen(r.id)}>
                {s === 'done' ? '✓ ' + r.title + ' · 완료' : r.title + ' · ' + (who || '미배정')}
              </div>
              {draft && draft >= mStart && draft <= mEnd && <div className="mk" style={{ left: idx(draft) * W + W / 2 - 5 }} />}
              {live <= mEnd && <div className="lv" style={{ left: idx(live) * W + W - 14 }} />}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

export default function ScheduleView({ rows, onOpen }) {
  const [mode, setMode] = useState('cal');
  const [month, setMonth] = useState(() => firstOfMonth());
  const [whoSel, setWhoSel] = useState('');
  // 들어올 때는 항상 달력부터 (사용자 요청 11-17) — 타임라인은 그때그때 눌러서 봄
  const pickMode = (m) => setMode(m);

  const whoOk = (x) => { if (!whoSel) return true; return whoSel === '__none' ? !x.who : x.who === whoSel; };
  const teamPeople = TEAMS.map((t) => t.person);
  const others = [...new Set(rows.map((x) => x.who).filter((w) => w && !teamPeople.includes(w)))];
  const ids = rows.filter((x) => !isDropped(x.s) && x.live && whoOk(x));
  const y = month.getFullYear(), m = month.getMonth();

  return (
    <section id="view-schedule">
      <div className="sched-tools">
        <div className="seg" role="group" aria-label="보기 방식">
          <button type="button" aria-pressed={String(mode === 'cal')} onClick={() => pickMode('cal')}>달력</button>
          <button type="button" aria-pressed={String(mode !== 'cal')} onClick={() => pickMode('tl')}>타임라인</button>
        </div>
        <div className="who-wrap"><span className="who-lbl">담당자</span>
          <div className="fchips" role="group" aria-label="담당 디자이너">
            {[['', '전체'], ...TEAMS.map((t) => [t.person, `${t.k} · ${t.person}`, t.color]), ...others.map((n) => [n, n]), ['__none', '미배정']].map(([v, l, col]) => (
              <button key={v || 'all'} type="button" aria-pressed={String(whoSel === v)} onClick={() => setWhoSel(v)}>{col && <i className="tdot" style={{ '--c': col }} />}{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="gantt-bar">
        <div className="gb-side" />
        <div className="month-nav">
          <button type="button" className="btn" aria-label="이전 달" onClick={() => setMonth(new Date(y, m - 1, 1))}>‹</button>
          <h2>{`${y}.${pad(m + 1)}`}</h2>
          <button type="button" className="btn" aria-label="다음 달" onClick={() => setMonth(new Date(y, m + 1, 1))}>›</button>
          <button type="button" className="btn ghost" onClick={() => setMonth(firstOfMonth())}>오늘</button>
        </div>
        <div className="legend">
          {TEAMS.map((t) => <span key={t.k}><i style={{ '--c': t.color }} />{t.k}</span>)}
          <span><i style={{ '--c': DONE_COLOR }} />완료</span>
          <span><i className="dia" />시안</span><span><i className="live" />라이브</span>
        </div>
      </div>
      {mode === 'cal' ? (
        <>
          <Calendar month={month} ids={ids} onOpen={onOpen} whoSel={whoSel} />
          <Agenda month={month} ids={ids} onOpen={onOpen} />
        </>
      ) : (
        <Timeline month={month} rows={ids} onOpen={onOpen} />
      )}
      <p className="gnote">막대는 작업 시작일(디자인팀 확정, 없으면 접수일)부터 라이브 날짜까지이고, 막대가 끝나는 날이 라이브입니다. ◆는 시안 공유일입니다. 막대 색은 요청한 팀(디자인 · VMD · 개발)이고, 모든 팀이 같은 모양(선명한 테두리 · 연한 면)이며, 보류는 흐리게, 완료는 회색 ✓ 막대로 계속 보이며, 취소·철회된 요청만 빠집니다. 막대를 누르면 상세 내용이 열려요.</p>
    </section>
  );
}
