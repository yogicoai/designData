'use client';
import { useEffect, useRef } from 'react';
import { ICONS } from '@/lib/shared/icons';
import { SMAP } from '@/lib/shared/constants';

/* 선 아이콘 — 색은 글자색(currentColor)을 따른다 */
export function Icon({ name, size = 20, cls = '' }) {
  return (
    <span
      className={'ico' + (cls ? ' ' + cls : '')}
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>` }}
    />
  );
}

export const H4 = ({ ic, children }) => (
  <h4>
    <Icon name={ic} size={18} />
    {children}
  </h4>
);

export function Chip({ s }) {
  const st = SMAP[s] || { label: '철회' };
  return <span className="chip" style={{ '--c': `var(--s-${SMAP[s] ? s : 'withdrawn'})` }}>{st.label}</span>;
}

export function Toast({ msg }) {
  return <div className="toast" hidden={!msg}>{msg}</div>;
}

export function AlertBox({ title, msg, onClose }) {
  const okRef = useRef(null);
  useEffect(() => {
    okRef.current?.focus();
    const esc = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return (
    <div className="modal-bg" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <b>{title}</b>
        <p>{msg}</p>
        <button type="button" className="btn primary" ref={okRef} onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

export function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox" role="dialog" aria-label="이미지 크게 보기" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="레퍼런스 이미지" />
    </div>
  );
}

/* 레퍼런스 썸네일용 이미지 — 못 불러오면 안내 문구로 */
export function RefImg({ src, onZoom }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="레퍼런스 이미지"
      loading="lazy"
      onClick={() => onZoom?.(src)}
      onError={(e) => {
        const s = document.createElement('span');
        s.className = 'miss';
        s.textContent = '이미지를 불러올 수 없어요';
        e.currentTarget.replaceWith(s);
      }}
    />
  );
}

/* 클립보드 복사 (막혀 있으면 예전 방식으로 한 번 더) */
export async function copyText(txt, toast, done = '복사했어요. Flow 게시물이나 댓글에 붙여 넣으세요.') {
  try {
    await navigator.clipboard.writeText(txt);
    toast(done);
    return;
  } catch {}
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  toast(ok ? done : '자동 복사가 막혀 있어요. 브라우저 권한을 확인해 주세요.');
}
