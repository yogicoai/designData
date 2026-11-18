'use client';
/* 기획안 편집기 — 원본 아티팩트의 contentEditable 편집기를 그대로 옮김
   (글자 크기 5단계 · 굵게/기울임/밑줄/취소선 · 형광펜 · 목록 · 인용 · 구분선 · 표(열 너비 끌기) · 링크 · 이미지) */
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/client/sanitize';
import { uploadImage } from '@/lib/client/api';
import { PLAN_TPL } from '@/lib/shared/constants';

const FS = [['1', '매우 작게'], ['2', '작게'], ['3', '보통'], ['4', '크게'], ['5', '매우 크게']];
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function RichEditor({ ref, onChange, toast, onZoom, placeholder }) {
  const edRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const linkRef = useRef(null);
  const savedRange = useRef(null);
  const busy = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [tb, setTb] = useState({});
  const [inTable, setInTable] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { left, top, r, c }

  const ED = () => edRef.current;
  const saveSel = () => {
    const s = getSelection();
    if (s.rangeCount && ED().contains(s.getRangeAt(0).commonAncestorContainer)) savedRange.current = s.getRangeAt(0).cloneRange();
  };
  const restoreSel = () => {
    const ed = ED();
    ed.focus();
    const r = savedRange.current;
    if (r && ed.contains(r.commonAncestorContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  };
  const syncEmpty = () => {
    const ed = ED();
    ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('img,hr,li,table'));
  };
  const curBlock = () => { try { return (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch { return ''; } };
  const markAncestor = () => {
    const s = getSelection();
    let n = s.anchorNode;
    while (n && n !== ED()) { if (n.nodeName === 'MARK') return n; n = n.parentNode; }
    return null;
  };
  const cellOfSel = () => {
    const s = getSelection();
    let n = s.anchorNode;
    while (n && n !== ED()) { if (n.nodeName === 'TD' || n.nodeName === 'TH') return n; n = n.parentNode; }
    return null;
  };

  function updateTb() {
    const ed = ED();
    if (!ed) return;
    const inEd = document.activeElement === ed;
    const next = {};
    if (inEd) {
      try {
        const blk = curBlock();
        next.fs = String(Math.min(5, parseInt(document.queryCommandValue('fontSize')) || 3));
        next.bold = document.queryCommandState('bold');
        next.italic = document.queryCommandState('italic');
        next.underline = document.queryCommandState('underline');
        next.strike = document.queryCommandState('strikeThrough');
        next.ul = document.queryCommandState('insertUnorderedList');
        next.ol = document.queryCommandState('insertOrderedList');
        next.bq = blk === 'blockquote';
        next.mark = !!markAncestor();
      } catch {}
    }
    setTb(next);
    setInTable(inEd && !!cellOfSel());
  }
  function edChanged() { syncEmpty(); onChangeRef.current?.(); updateTb(); }
  function exec(cmd, val) { ED().focus(); document.execCommand(cmd, false, val); edChanged(); }
  const toggleBlock = (tag) => exec('formatBlock', curBlock() === tag && tag !== 'p' ? '<p>' : '<' + tag + '>');

  function toggleMark() {
    const m = markAncestor();
    if (m) { m.replaceWith(...m.childNodes); edChanged(); return; }
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) { toast('형광펜을 칠할 글자를 먼저 선택하세요.'); return; }
    const tmp = document.createElement('div');
    tmp.append(s.getRangeAt(0).cloneContents());
    exec('insertHTML', '<mark>' + sanitizeHtml(tmp.innerHTML).replace(/<\/?(p|h2|h3|blockquote|ul|ol|li)>/g, ' ') + '</mark>');
  }
  function openLink() {
    saveSel();
    if (!savedRange.current || savedRange.current.collapsed) { toast('링크를 걸 글자를 먼저 선택하세요.'); return; }
    setLinkOpen(true);
    setTimeout(() => { if (linkRef.current) { linkRef.current.value = ''; linkRef.current.focus(); } }, 0);
  }
  function applyLink() {
    let u = (linkRef.current?.value || '').trim();
    setLinkOpen(false);
    if (!u) { restoreSel(); return; }
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    restoreSel();
    exec('createLink', u);
  }
  function cancelLink() { setLinkOpen(false); restoreSel(); }

  async function insertImages(files) {
    for (const f of files.filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type))) {
      if (f.size > 20 * 1024 * 1024) { toast('20MB 이하 이미지만 넣을 수 있어요.'); continue; }
      busy.current++;
      toast('이미지 올리는 중…');
      try {
        const id = await uploadImage(f, 'plan');
        restoreSel();
        exec('insertHTML', `<img src="/api/files/${id}" alt="기획안 이미지"><p><br></p>`);
        saveSel();
      } catch (e) {
        toast(e?.message && e.code !== 'server' ? e.message : '이미지를 넣지 못했어요. 다시 시도해 주세요.');
      } finally { busy.current--; }
    }
  }

  /* 표 */
  function openTablePicker(btn) {
    saveSel();
    if (picker) { setPicker(null); return; }
    const wrap = wrapRef.current;
    setPicker({
      left: Math.max(0, Math.min(btn.offsetLeft, wrap.clientWidth - 230)),
      top: btn.offsetTop + btn.offsetHeight + 4,
      r: 0, c: 0,
    });
  }
  function insertTable(r, c) {
    setPicker(null);
    const row = '<tr>' + '<td><br></td>'.repeat(c) + '</tr>';
    const cg = '<colgroup>' + `<col style="width:${(100 / c).toFixed(2)}%">`.repeat(c) + '</colgroup>';
    restoreSel();
    // 커서가 표 안에 있으면 표 안에 표가 들어가지 않게 그 표 바로 뒤로 옮김
    const inCell = cellOfSel();
    if (inCell) {
      const t = inCell.closest('table');
      let after = t.nextElementSibling;
      if (!after || after.nodeName !== 'P') { after = document.createElement('p'); after.innerHTML = '<br>'; t.after(after); }
      const rg = document.createRange(); rg.selectNodeContents(after); rg.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    }
    toast(`${r}행 × ${c}열 표를 넣었어요`);
    exec('insertHTML', `<table data-new="1">${cg}<tbody>${row.repeat(r)}</tbody></table><p><br></p>`);
    // 넣자마자 첫 칸에서 바로 입력하도록 커서를 옮김
    const t = ED().querySelector('table[data-new]');
    if (t) {
      t.removeAttribute('data-new');
      const cell = t.querySelector('td,th');
      if (cell) {
        const rg = document.createRange(); rg.selectNodeContents(cell); rg.collapse(true);
        const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
        saveSel();
        updateTb();
      }
    }
  }
  const colCount = (table) => Math.max(0, ...[...table.rows].map((r) => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)));
  function resetCols(table) {
    table.querySelectorAll('colgroup').forEach((c) => c.remove());
    const n = colCount(table);
    if (!n) return;
    const cg = document.createElement('colgroup');
    for (let i = 0; i < n; i++) { const c = document.createElement('col'); c.style.width = (100 / n).toFixed(2) + '%'; cg.append(c); }
    table.prepend(cg);
  }
  function ensureCols(table) {
    const cols = table.querySelectorAll('colgroup col');
    if (cols.length !== colCount(table) || [...cols].some((c) => !/%$/.test(c.style.width))) resetCols(table);
    return [...table.querySelectorAll('colgroup col')];
  }
  function tableOp(op) {
    const cell = cellOfSel();
    if (!cell) return;
    const tr = cell.parentNode, table = cell.closest('table'), idx = cell.cellIndex;
    if (op === 'row') {
      const n = document.createElement('tr');
      for (let i = 0; i < tr.cells.length; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; n.append(td); }
      if (tr.parentNode.nodeName === 'THEAD') { const tb = table.tBodies[0] || table.createTBody(); tb.prepend(n); } else tr.after(n);
    }
    if (op === 'col') for (const row of table.rows) {
      const ref = row.cells[Math.min(idx, row.cells.length - 1)];
      const c = document.createElement(ref && ref.nodeName === 'TH' ? 'th' : 'td');
      c.innerHTML = '<br>';
      ref ? ref.after(c) : row.append(c);
    }
    if (op === 'delrow') { if (table.rows.length <= 1) table.remove(); else tr.remove(); }
    if (op === 'delcol') { if (tr.cells.length <= 1) table.remove(); else for (const row of [...table.rows]) if (row.cells[idx]) row.deleteCell(idx); }
    if (op === 'del') table.remove();
    if ((op === 'col' || op === 'delcol') && table.isConnected) resetCols(table);
    edChanged();
  }

  /* 열 경계 끌어서 너비 조절 — 표는 항상 입력 영역 폭(100%) */
  const hover = useRef(null);
  const drag = useRef(null);
  function onEdMouseMove(e) {
    if (drag.current) return;
    const ed = ED();
    const cell = e.target.closest?.('td,th');
    hover.current = null;
    if (cell && ed.contains(cell)) {
      const r = cell.getBoundingClientRect(), row = cell.parentNode;
      if (e.clientX > r.right - 7 && cell !== row.cells[row.cells.length - 1]) hover.current = cell;
      else if (e.clientX < r.left + 7 && cell.cellIndex > 0) hover.current = row.cells[cell.cellIndex - 1];
    }
    ed.classList.toggle('col-resize', !!hover.current);
  }
  function onEdMouseDown(e) {
    const h = hover.current;
    if (!h) return;
    e.preventDefault();
    const table = h.closest('table'), cols = ensureCols(table);
    let i = 0;
    for (const c of h.parentNode.cells) { if (c === h) break; i += c.colSpan || 1; }
    i += (h.colSpan || 1) - 1;
    if (!cols[i + 1]) return;
    drag.current = { cols, i, w1: parseFloat(cols[i].style.width), w2: parseFloat(cols[i + 1].style.width), x: e.clientX, tw: table.getBoundingClientRect().width };
    document.body.classList.add('dragging-col');
  }

  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
    try { document.execCommand('styleWithCSS', false, false); } catch {}
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const delta = ((e.clientX - d.x) / d.tw) * 100, min = 6;
      const a = Math.min(Math.max(d.w1 + delta, min), d.w1 + d.w2 - min);
      d.cols[d.i].style.width = a.toFixed(2) + '%';
      d.cols[d.i + 1].style.width = (d.w1 + d.w2 - a).toFixed(2) + '%';
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.classList.remove('dragging-col');
      edChanged();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 표 크기 고르는 창 바깥을 누르면 닫기 */
  useEffect(() => {
    if (!picker) return;
    const close = (e) => {
      if (!e.target.closest?.('.tblpick') && !e.target.closest?.('[data-k="table"]')) setPicker(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [picker]);

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const cell = cellOfSel();
    if (!cell) return;
    e.preventDefault();
    const table = cell.closest('table');
    let cells = [...table.querySelectorAll('th,td')];
    const i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
    if (i >= cells.length) { tableOp('row'); cells = [...table.querySelectorAll('th,td')]; }
    const next = cells[Math.max(0, i)];
    if (!next) return;
    const r = document.createRange(); r.selectNodeContents(next); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    updateTb();
  }
  function onPaste(e) {
    const cd = e.clipboardData;
    if (!cd) return;
    e.stopPropagation();
    e.preventDefault();
    const imgs = [...cd.files].filter((f) => f.type.startsWith('image/'));
    if (imgs.length) { saveSel(); insertImages(imgs); return; }
    const html = cd.getData('text/html');
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, cd.getData('text/plain'));
    edChanged();
  }
  function onDrop(e) {
    const imgs = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    e.stopPropagation();
    const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (r) savedRange.current = r;
    insertImages(imgs);
  }

  useImperativeHandle(ref, () => ({
    getHtml: () => sanitizeHtml(ED().innerHTML),
    getText: () => ED().innerText.trim(),
    setHtml(html) { ED().innerHTML = html ? sanitizeHtml(html) : ''; syncEmpty(); },
    setPlain(text) { ED().innerHTML = String(text || '').split('\n').map((l) => `<p>${l ? escHtml(l) : '<br>'}</p>`).join(''); syncEmpty(); },
    clear() { ED().innerHTML = ''; syncEmpty(); setLinkOpen(false); },
    busy: () => busy.current > 0,
    appendTemplate(tpl = PLAN_TPL) {
      const ed = ED();
      ed.innerHTML = ed.textContent.trim() || ed.querySelector('img') ? ed.innerHTML + tpl : tpl;
      edChanged();
      ed.focus();
    },
  }));

  const defs = [
    ...FS.map(([n, l]) => ({ k: 'fs' + n, label: l, title: `글자 크기: ${l}`, on: tb.fs === n, run: () => exec('fontSize', n) })),
    'sep',
    { k: 'b', label: 'B', css: { fontWeight: 700 }, title: '굵게 (Ctrl+B)', on: tb.bold, run: () => exec('bold') },
    { k: 'i', label: 'I', css: { fontStyle: 'italic' }, title: '기울임 (Ctrl+I)', on: tb.italic, run: () => exec('italic') },
    { k: 'u', label: 'U', css: { textDecoration: 'underline' }, title: '밑줄 (Ctrl+U)', on: tb.underline, run: () => exec('underline') },
    { k: 's', label: 'S', css: { textDecoration: 'line-through' }, title: '취소선', on: tb.strike, run: () => exec('strikeThrough') },
    { k: 'mark', label: '형광펜', on: tb.mark, run: toggleMark },
    'sep',
    { k: 'ul', label: '• 목록', on: tb.ul, run: () => exec('insertUnorderedList') },
    { k: 'ol', label: '1. 목록', on: tb.ol, run: () => exec('insertOrderedList') },
    { k: 'bq', label: '인용', on: tb.bq, run: () => toggleBlock('blockquote') },
    { k: 'hr', label: '구분선', run: () => exec('insertHorizontalRule') },
    { k: 'table', label: '표', run: openTablePicker },
    'sep',
    { k: 'link', label: '링크', run: openLink },
    { k: 'img', label: '이미지', run: () => { saveSel(); fileRef.current?.click(); } },
  ];

  return (
    <>
      <div className="editor-wrap" ref={wrapRef}>
        <div className="tb" role="toolbar" aria-label="서식">
          {defs.map((d, i) =>
            d === 'sep' ? (
              <span key={'sep' + i} className="sep" aria-hidden="true" />
            ) : (
              <button
                key={d.k}
                type="button"
                title={d.title || d.label}
                style={d.css}
                aria-pressed={String(!!d.on)}
                data-k={d.k}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (document.activeElement !== ED() && !['img', 'link', 'table'].includes(d.k)) restoreSel();
                  d.run(e.currentTarget);
                }}
              >
                {d.label}
              </button>
            ),
          )}
          {inTable && (
            <div className="tb-table">
              <span className="tt-lbl">표</span>
              {[['row', '행 추가'], ['col', '열 추가'], ['delrow', '행 삭제'], ['delcol', '열 삭제'], ['del', '표 삭제']].map(([op, l]) => (
                <button key={op} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp(op)}>{l}</button>
              ))}
            </div>
          )}
        </div>
        {linkOpen && (
          <div className="linkbar">
            <input
              type="url"
              ref={linkRef}
              placeholder="https:// 링크 주소"
              aria-label="링크 주소"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelLink(); }
              }}
            />
            <button type="button" className="btn" onClick={applyLink}>적용</button>
            <button type="button" className="btn ghost" onClick={cancelLink}>취소</button>
          </div>
        )}
        <div
          ref={edRef}
          id="f-plan"
          className="editor doc is-empty"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby="plan-lbl"
          data-ph={placeholder}
          onInput={edChanged}
          onKeyUp={() => { saveSel(); updateTb(); }}
          onMouseUp={() => { saveSel(); updateTb(); }}
          onFocus={updateTb}
          onBlur={() => { saveSel(); setTimeout(updateTb, 0); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }}
          onDrop={onDrop}
          onMouseMove={onEdMouseMove}
          onMouseDown={onEdMouseDown}
          onClick={(e) => { if (e.target.tagName === 'IMG') onZoom?.(e.target.src); }}
        />
        {picker && (
          <div className="tblpick" role="dialog" aria-label="표 크기 선택" style={{ left: picker.left, top: picker.top }}>
            <div className="tp-grid">
              {Array.from({ length: 6 }, (_, ri) =>
                Array.from({ length: 8 }, (_, ci) => {
                  const r = ri + 1, c = ci + 1;
                  return (
                    <button
                      key={r + '-' + c}
                      type="button"
                      aria-label={`${r}행 ${c}열`}
                      className={r <= picker.r && c <= picker.c ? 'on' : undefined}
                      onMouseEnter={() => setPicker((p) => ({ ...p, r, c }))}
                      onFocus={() => setPicker((p) => ({ ...p, r, c }))}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTable(r, c)}
                    />
                  );
                }),
              )}
            </div>
            <div className="tp-lbl">{picker.r ? `${picker.r}행 × ${picker.c}열` : '표 크기 선택'}</div>
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileRef}
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        hidden
        onChange={(e) => { insertImages([...e.target.files]); e.target.value = ''; }}
      />
    </>
  );
}
