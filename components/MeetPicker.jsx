'use client';
/* 미팅 일시 선택: 캘린더 + 오전/오후 + 30분 단위 시간 */
import { useEffect, useRef, useState } from 'react';
import { WD, pad, ymd, parse, fmt, todayStr, fmtMeet } from '@/lib/shared/dates';

const AM = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
const PM = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
const lab = (s) => { const [H, M] = s.split(':').map(Number); return `${H % 12 || 12}:${pad(M)}`; };

export default function MeetPicker({ value, onChange }) {
  const [d0, t0] = value ? value.split('T') : ['', ''];
  const [d, setD] = useState(d0);
  const [t, setT] = useState(t0 || '');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const v = parse(d0) || parse(todayStr()); return new Date(v.getFullYear(), v.getMonth(), 1); });
  const [half, setHalf] = useState(t0 ? (Number(t0.slice(0, 2)) < 12 ? 'am' : 'pm') : 'pm');
  const rootRef = useRef(null);
  const trigRef = useRef(null);
  const val = d ? d + 'T' + (t || '14:00') : '';

  /* 바깥에서 값이 바뀌면(다른 사람이 저장 등) 따라감 */
  useEffect(() => {
    if ((value || '') === val) return;
    const [a, b] = value ? value.split('T') : ['', ''];
    setD(a); setT(b || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const set = (nd, nt) => {
    let tt = nt;
    if (nd && !tt) tt = '14:00';
    setD(nd); setT(tt);
    onChange(nd ? nd + 'T' + tt : '');
  };

  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      trigRef.current?.focus();
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = todayStr();
  const slots = half === 'am' ? AM : PM;

  return (
    <div className="mp-root" ref={rootRef}>
      <button type="button" ref={trigRef} className="mp-trigger" aria-expanded={String(open)} onClick={() => setOpen((o) => !o)}>
        <span className={val ? 'mp-val' : 'mp-val ph'}>{val ? fmtMeet(val) : '잡힌 미팅 없음'}</span>
        <span className="mp-act">{open ? '닫기' : val ? '변경' : '일정 잡기'}</span>
      </button>
      <div className="mp" role="dialog" aria-label="미팅 일시 선택" hidden={!open}>
        {open && (
          <>
            <div className="mp-head">
              <b>{`${y}년 ${m + 1}월`}</b>
              <div className="mp-navs">
                <button type="button" className="mp-nav" aria-label="이전 달" onClick={() => setView(new Date(y, m - 1, 1))}>‹</button>
                <button type="button" className="mp-nav" aria-label="다음 달" onClick={() => setView(new Date(y, m + 1, 1))}>›</button>
              </div>
            </div>
            <div className="mp-grid mp-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="mp-grid">
              {Array.from({ length: first }, (_, i) => <span key={'b' + i} />)}
              {Array.from({ length: days }, (_, i) => {
                const dd = new Date(y, m, i + 1), s = ymd(dd);
                return (
                  <button
                    key={s}
                    type="button"
                    className={'mp-day' + (s === today ? ' today' : '') + (s < today ? ' past' : '') + (dd.getDay() === 0 ? ' sun' : '')}
                    aria-pressed={String(s === d)}
                    aria-label={fmt(s)}
                    onClick={() => set(s, t)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mp-time">
              <div className="seg" role="group" aria-label="오전 오후">
                <button type="button" aria-pressed={String(half === 'am')} onClick={() => setHalf('am')}>오전</button>
                <button type="button" aria-pressed={String(half === 'pm')} onClick={() => setHalf('pm')}>오후</button>
              </div>
              {!d && <span className="hint">날짜를 먼저 고르세요</span>}
            </div>
            <div className="slots">
              {slots.map((s) => (
                <button key={s} type="button" aria-pressed={String(!!d && s === t)} onClick={() => set(d || todayStr(), s)}>{lab(s)}</button>
              ))}
            </div>
            <div className="mp-foot">
              <button type="button" className="btn ghost" onClick={() => set('', '')}>미팅 없음</button>
              <button type="button" className="btn primary" onClick={() => setOpen(false)}>완료</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
