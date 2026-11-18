'use client';
/* 요청자 명단 (디자인팀만 수정) — 한 줄에 한 명: 이름 직급 (부서) */
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from './ui';
import { DEPTS } from '@/lib/shared/constants';

function parseRoster(text) {
  const ok = [], bad = [];
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const m = l.match(/^(\S+)\s+(\S+?)\s*\(\s*(.+?)\s*\)$/);
    if (m && DEPTS.includes(m[3])) ok.push({ name: m[1], title: m[2], team: m[3] });
    else bad.push(l);
  });
  return { ok, bad };
}

export default function RosterEditor({ roster, onClose, onSaved, toast }) {
  const [text, setText] = useState(() => roster.map((p) => `${p.name} ${p.title} (${p.team})`).join('\n'));
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const { ok, bad } = parseRoster(text);
    if (bad.length) { setMsg(`형식이나 부서 이름이 맞지 않는 줄이 있어요: ${bad.slice(0, 3).join(' / ')}`); return; }
    setSaving(true);
    try {
      await api('/api/roster', { method: 'PUT', body: { people: ok } });
      toast(`명단 ${ok.length}명을 저장했어요.`);
      onSaved();
      onClose();
    } catch (e) {
      setMsg(e?.code === 'forbidden' ? '저장하지 못했어요. 디자인팀(편집자) 권한이 필요해요.' : e?.message || '저장하지 못했어요.');
      setSaving(false);
    }
  }

  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="d-title">
      <div className="dh-bar">
        <b id="d-title">요청자 명단</b>
        <button type="button" className="btn ghost icon-btn" aria-label="닫기" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="drawer-head">
        <div className="dh-meta">요청서의 요청자 칸에서 고를 수 있는 사람 목록</div>
      </div>
      <div className="dsec">
        <div className="f">
          <label htmlFor="roster-text">한 줄에 한 명 · 이름 직급 (부서)</label>
          <textarea id="roster-text" style={{ minHeight: 360, fontFamily: 'var(--font-mono)', fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} />
          <span className="hint">{`예: 홍길동 대리 (영업). 부서는 다음 중 하나로 적어 주세요: ${DEPTS.join(', ')}`}</span>
          {msg && <div className="hint" style={{ color: 'var(--warn)' }}>{msg}</div>}
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" disabled={saving} onClick={save}>명단 저장</button>
        <button type="button" className="btn ghost" onClick={onClose}>취소</button>
      </div>
    </aside>
  );
}
