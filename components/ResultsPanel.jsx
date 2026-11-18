'use client';
/* 결과물 — 드롭박스 '결과물/1차완성본, 2차완성본 …' 을 차수별로 보여 줌.
   디자인팀은 여기서 올리거나(끌어다 놓기 가능) 드롭박스 폴더에 직접 넣어도 됨. 요청자는 보기·받기만. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { H4, RefImg, copyText } from './ui';
import { api, uploadResult } from '@/lib/client/api';
import { fmtDT } from '@/lib/shared/dates';

const fileUrl = (id, p, dl) => `/api/requests/${id}/results/file?p=${encodeURIComponent(p)}${dl ? '&dl=1' : ''}`;
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : n >= 1024 ? Math.round(n / 1024) + 'KB' : (n || 0) + 'B');

export default function ResultsPanel({ r, s, me, toast, onZoom, onChanged }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const admin = me.isAdmin;

  /* 여러 번 겹쳐 불러올 때 늦게 도착한 예전 응답이 최신 목록을 덮지 않게 — 마지막 요청만 반영 */
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const j = await api(`/api/requests/${r.id}/results`);
      if (my === seq.current) { setData(j); setErr(''); }
    } catch (e) {
      if (my === seq.current) setErr(e?.message || '결과물을 불러오지 못했어요.');
    }
  }, [r.id]);
  useEffect(() => { load(); }, [load, r.results?.at]);

  if (!r.hasFolder) return null;
  const latest = data?.latest || 0;
  const cur = latest || 1;
  const rounds = (data?.rounds || []).filter((g) => admin || g.files.length);

  async function upload(files) {
    if (!files.length || busy) return;
    const max = data?.uploadMax || Infinity;
    const big = files.filter((f) => f.size > max);
    if (big.length) toast(`${big.map((f) => f.name).join(', ')}: 너무 커서 드롭박스 폴더에 직접 넣어 주세요.`);
    const ok = files.filter((f) => f.size <= max);
    let done = 0;
    for (const f of ok) {
      setBusy(`${cur}차완성본에 올리는 중… ${done + 1}/${ok.length} · ${f.name}`);
      try { await uploadResult(r.id, cur, f); done++; } catch (e) { toast(`${f.name}: ${e?.message || '올리지 못했어요.'}`); }
    }
    setBusy('');
    await load();
    onChanged?.();
    if (done) toast(`${cur}차 완성본에 ${done}개 올렸어요.`);
  }
  async function nextRound() {
    try {
      const j = await api(`/api/requests/${r.id}/results/round`, { method: 'POST' });
      toast(`${j.name} 폴더를 만들었어요. 이제 올리는 파일은 ${j.name}에 들어가요.`);
      await load();
    } catch (e) { toast(e?.message || '만들지 못했어요.'); }
  }
  async function del(f) {
    if (!window.confirm(`‘${f.name}’ 파일을 지울까요? (드롭박스 휴지통에서 되살릴 수 있어요)`)) return;
    try { await api(`/api/requests/${r.id}/results/file?p=${encodeURIComponent(f.p)}`, { method: 'DELETE' }); await load(); onChanged?.(); }
    catch (e) { toast(e?.message || '지우지 못했어요.'); }
  }

  const dropProps = admin ? {
    onDragOver: (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setOver(true); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]); },
  } : {};

  return (
    <div className={'dsec results' + (over ? ' over' : '')} {...dropProps}>
      <H4 ic="image">결과물</H4>
      {admin && (
        <div className="res-tools">
          <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => fileRef.current?.click()}>{cur}차 완성본에 파일 올리기</button>
          <button type="button" className="btn sm" disabled={!!busy} onClick={nextRound}>{cur + 1}차 완성본 시작</button>
          {data?.osPath && <button type="button" className="btn sm ghost" onClick={() => copyText(data.osPath, toast, '폴더 경로를 복사했어요. 탐색기 주소창에 붙여 넣으세요.')}>폴더 경로 복사</button>}
          {data?.webUrl && <a className="btn sm ghost" href={data.webUrl} target="_blank" rel="noopener">드롭박스에서 열기</a>}
          <input type="file" multiple hidden ref={fileRef} onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
          <span className="hint">파일을 여기로 끌어다 놓아도 돼요. 수정이 들어오면 ‘{cur + 1}차 완성본 시작’을 누른 뒤 올려 주세요.</span>
        </div>
      )}
      {busy && <div className="hint res-busy">{busy}</div>}
      {err && <div className="hint" style={{ color: 'var(--warn)' }}>{err}</div>}
      {!data && !err && <div className="hint">불러오는 중…</div>}
      {data && !rounds.length && <div className="hint">{admin ? '아직 결과물 폴더가 없어요.' : '디자인팀이 완성본을 올리면 여기에서 볼 수 있어요.'}</div>}
      {rounds.map((g) => {
        const imgs = g.files.filter((f) => f.image);
        const others = g.files.filter((f) => !f.image);
        const last = g.files.reduce((m, f) => (f.modified > m ? f.modified : m), '');
        const isLatest = g.n && g.n === latest && g.files.length > 0;
        return (
          <div className="res-round" key={g.name || '_loose'}>
            <div className="res-head">
              <b>{g.name || '결과물 (차수 폴더 밖)'}</b>
              {isLatest && <span className="chip" style={{ '--c': s === 'done' ? 'var(--s-done)' : 'var(--s-progress)' }}>{s === 'done' ? '최종' : '최신'}</span>}
              <span className="hint">{g.files.length ? `파일 ${g.files.length}개${last ? ' · ' + fmtDT(last) : ''}` : '비어 있음'}</span>
            </div>
            {!!imgs.length && (
              <div className="thumbs">
                {imgs.map((f) => (
                  <div className="thumb" key={f.p} title={f.name}>
                    <RefImg src={fileUrl(r.id, f.p)} onZoom={onZoom} />
                    {admin && <button type="button" className="x" aria-label={`${f.name} 지우기`} onClick={() => del(f)}>✕</button>}
                  </div>
                ))}
              </div>
            )}
            {!!others.length && (
              <ul className="res-files">
                {others.map((f) => (
                  <li key={f.p}>
                    <a href={fileUrl(r.id, f.p, true)} target="_blank" rel="noopener">{f.name}</a>
                    <span className="mono">{fmtSize(f.size)}</span>
                    {admin && <button type="button" className="x" aria-label={`${f.name} 지우기`} onClick={() => del(f)}>✕</button>}
                  </li>
                ))}
              </ul>
            )}
            {!!imgs.length && (
              <div className="res-dl">
                {imgs.map((f) => <a key={f.p} href={fileUrl(r.id, f.p, true)} target="_blank" rel="noopener">{f.name}</a>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
