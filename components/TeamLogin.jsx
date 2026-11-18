'use client';
/* 디자인팀 로그인 — 숫자 4자리 PIN. 4자리를 다 누르면 바로 확인 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';
import { api } from '@/lib/client/api';

const LEN = 4;

export default function TeamLogin({ onClose, onDone }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onClose]);

  async function submit(code) {
    setBusy(true);
    setMsg('');
    try {
      await api('/api/auth/login', { method: 'POST', body: { password: code } });
      onDone();
    } catch (err) {
      setMsg(err?.message || '로그인하지 못했어요.');
      setShake(true);
      setTimeout(() => setShake(false), 340);
      setPin('');
      setBusy(false);
      setTimeout(() => ref.current?.focus(), 0);
    }
  }

  function onChange(e) {
    if (busy) return;
    const v = e.target.value.replace(/\D/g, '').slice(0, LEN);
    setPin(v);
    if (msg) setMsg('');
    if (v.length === LEN) submit(v);
  }

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="디자인팀 로그인" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal pin-box' + (shake ? ' shake' : '')}>
        <Icon name="lock" size={24} cls="hero" />
        <b>디자인팀 PIN</b>
        <p>숫자 4자리를 입력하면 바로 들어가요.</p>
        <div className="pin-cells" onClick={() => ref.current?.focus()}>
          {Array.from({ length: LEN }, (_, i) => (
            <span key={i} className={'pin-cell' + (i < pin.length ? ' full' : '') + (i === Math.min(pin.length, LEN - 1) && !busy ? ' on' : '')} />
          ))}
          <input
            ref={ref}
            className="pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={LEN}
            aria-label="디자인팀 PIN 4자리"
            value={pin}
            onChange={onChange}
            disabled={busy}
          />
        </div>
        <div className="pin-err" role="alert">{busy ? '확인 중…' : msg}</div>
        <button type="button" className="btn ghost" onClick={onClose}>취소</button>
      </div>
    </div>
  );
}
