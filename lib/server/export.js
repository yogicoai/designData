/* 문서 보관 — 엑셀(목록·산출물 2시트) / 워드(표지 + 요청서 한 건씩, 이미지 포함) */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';
import { fileIdsIn } from '../shared/constants.js';
import { fmtMeet, kstToday } from '../shared/dates.js';
import { statusOf, statusLabel, liveOf, draftOf, chList, assigneeOf } from '../shared/model.js';
import { formOf } from '../shared/forms.js';
import { store } from './storage/index.js';

/* 서버는 UTC 라서 수정·철회 시각은 한국 시간으로 */
const fmtDT = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
};

const XCOLS = ['요청번호', '상태', '요청 팀', '부서', '요청자', '프로젝트명', '요청 유형', '노출 채널', '산출물 요약', '목표 및 목적', '타깃', '요청일', '작업 시작일', '시안 공유일', '라이브 날짜', '담당자', '미팅 일시', '디자인팀 메모', '필수 문구·카피', '기획안 내용', '자료 링크', '레퍼런스 설명', '레퍼런스 이미지', '촉박 사유', '최종 수정', '철회일'];
const XW = [16, 8, 8, 14, 12, 32, 18, 24, 32, 36, 22, 12, 12, 12, 12, 12, 22, 30, 36, 60, 32, 32, 16, 24, 14, 14];

function xRow(r, rv = {}) {
  return [r.no || '', statusLabel(statusOf(r, rv)), r.team || '', r.dept || '', r.name || '', r.title || '', r.type || '', chList(r).join(', '),
    (r.items || []).map((x) => `${x.kind} ${x.qty}개`).join(', '), r.goal || '', r.target || '', r.requestDate || '', rv.start || '', draftOf(r, rv) || '', liveOf(r, rv) || '',
    assigneeOf(r, rv), fmtMeet(rv.meeting || ''), rv.note || '', r.copy || '', r.plan || '', r.files || '', r.ref || '',
    (r.refImages || []).length ? `${r.refImages.length}장 (워드 파일·페이지에서 확인)` : '', r.urgent || '', r.editedAt ? fmtDT(r.editedAt) : '', r.withdrawnAt ? fmtDT(r.withdrawnAt) : ''];
}

function styleHead(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FB' } };
}

export async function buildXlsx(list) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('요청 목록');
  ws.addRow(XCOLS);
  for (const { r, rv } of list) ws.addRow(xRow(r, rv));
  XW.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: XCOLS.length } };
  styleHead(ws);

  const ws2 = wb.addWorksheet('산출물');
  ws2.addRow(['요청번호', '프로젝트명', '종류', '규격', '수량', '비고']);
  for (const { r } of list) for (const x of r.items || []) ws2.addRow([r.no || '', r.title || '', x.kind || '', x.size || '', Number(x.qty) || 1, x.note || '']);
  [16, 32, 22, 28, 6, 26].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
  styleHead(ws2);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- 워드: 요청서 HTML + 이미지를 웹 보관 형식(MHT)으로 묶어 .docx(altChunk) 안에 넣음 → Word 가 열 때 변환 ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl2 = (s) => esc(s).replace(/\n/g, '<br>');
const IMGBASE = 'file:///C:/drq/';

async function imgPart(f) {
  try {
    let buf = await store().read(f.path);
    let type = f.type;
    const meta = await sharp(buf, { animated: false }).metadata();
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(type)) {
      buf = await sharp(buf).png().toBuffer();
      type = 'image/png';
    }
    const k = Math.min(1, 560 / (meta.width || 560));
    return { name: f._id + (type === 'image/jpeg' ? '.jpg' : type === 'image/gif' ? '.gif' : '.png'), type, buf, w: Math.round((meta.width || 560) * k), h: Math.round((meta.pageHeight || meta.height || 400) * k) };
  } catch (e) {
    console.error('[export] 이미지 읽기 실패', f._id, e?.message);
    return null;
  }
}

function reqHtml(r, rv = {}, imgs) {
  const lab = statusLabel(statusOf(r, rv));
  const img = (aid) => { const p = imgs.get(aid); return p ? `<img src="${IMGBASE}${p.name}" width="${p.w}" height="${p.h}">` : '<p class="muted">[이미지를 불러오지 못했어요]</p>'; };
  const row = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');
  let plan = r.planHtml || nl2(r.plan || '');
  plan = plan.replace(/<img[^>]*src="\/api\/files\/([a-f0-9]{24})"[^>]*>/g, (m, aid) => img(aid))
    .replace(/<mark>/g, '<span style="background:#ffe680;mso-highlight:yellow">').replace(/<\/mark>/g, '</span>');
  const sec = (t, body) => (body ? `<h2>${t}</h2>${body}` : '');
  const items = (r.items || []).length
    ? `<table class="grid"><tr><th>종류</th><th>규격</th><th>수량</th><th>비고</th></tr>${r.items.map((x) => `<tr><td>${esc(x.kind)}</td><td>${esc(x.size || '')}</td><td class="c">${esc(x.qty)}</td><td>${esc(x.note || '')}</td></tr>`).join('')}</table>`
    : '';
  return `<p class="no">${esc(r.no || '')} · <span class="st">${lab}</span>${r.withdrawnAt ? ` · 철회 ${esc(fmtDT(r.withdrawnAt))}` : ''}${r.editedAt ? ` · 최종 수정 ${esc(fmtDT(r.editedAt))}` : ''}</p>
<h1>${esc(r.title)}</h1>
<table class="info">${row('요청 팀', esc(r.team))}${row('요청 부서 · 요청자', esc(`${r.dept || ''} · ${r.name || ''}`))}${row('요청 유형', esc(r.type))}${row(formOf(r.team).place?.label || '설치 장소', esc(r.place))}${row(formOf(r.team).chips?.label || '노출 채널', esc(chList(r).join(', ')))}${row('담당자', esc(assigneeOf(r, rv) || '미배정'))}${row('목표 및 목적', nl2(r.goal))}${row('타깃', esc(r.target))}${row('촉박 사유', nl2(r.urgent))}${row('미팅', esc(fmtMeet(rv.meeting || '')))}</table>
<h2>일정</h2><table class="grid"><tr><th>요청일</th><th>작업 시작일</th><th>시안 공유일</th><th>라이브</th></tr><tr><td class="c">${esc(r.requestDate || '')}</td><td class="c">${esc(rv.start || '—')}</td><td class="c">${esc(draftOf(r, rv) || '—')}</td><td class="c"><b>${esc(liveOf(r, rv) || '—')}</b></td></tr></table>
${sec('산출물', items)}${sec('기획안 내용', plan ? `<div class="plan">${plan}</div>` : '')}${sec('필수 문구 · 카피', r.copy ? `<p>${nl2(r.copy)}</p>` : '')}
${sec('레퍼런스', (r.refImages || []).map(img).join(' ') + (r.ref ? `<p>${nl2(r.ref)}</p>` : ''))}${sec('자료 링크', r.files ? `<p>${nl2(r.files)}</p>` : '')}${sec('디자인팀 메모', rv.note ? `<p>${nl2(rv.note)}</p>` : '')}`;
}

const DOC_CSS = `body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:10pt;color:#1a1f2b;line-height:1.5}
h1{font-size:17pt;margin:2pt 0 10pt}h2{font-size:12pt;color:#1C7DAA;border-bottom:1pt solid #CDE8F4;padding-bottom:2pt;margin:16pt 0 6pt}
.no{font-size:9pt;color:#5b6578;margin:0}.st{font-weight:bold;color:#1a1f2b}.muted{color:#8a93a6}
table{border-collapse:collapse;width:100%;margin:4pt 0}th,td{border:1pt solid #c4cad6;padding:4pt 6pt;vertical-align:top;text-align:left;font-size:9.5pt}
th{background:#eef2fb;font-weight:bold}table.info th{width:24%}td.c{text-align:center}
.plan p{margin:0 0 3pt}.plan h2{font-size:13pt;color:#1a1f2b;border:0;margin:8pt 0 3pt}.plan h3{font-size:11pt;margin:6pt 0 2pt}
.plan blockquote{border-left:3pt solid #c4cad6;margin:4pt 0;padding-left:8pt;color:#5b6578}mark{background:#ffe680}
font[size="1"]{font-size:8pt}font[size="2"]{font-size:9pt}font[size="3"]{font-size:10pt}font[size="4"]{font-size:12.5pt}font[size="5"]{font-size:16pt}
.cover td,.cover th{font-size:9pt}`;

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/.{76}/g, '$&\r\n');
function toMht(html, parts) {
  const B = '----=_DRQ_' + Date.now().toString(36);
  let out = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${IMGBASE}doc.htm\r\n\r\n${b64(Buffer.from(html, 'utf8'))}\r\n`;
  for (const p of parts) out += `--${B}\r\nContent-Type: ${p.type}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${IMGBASE}${p.name}\r\n\r\n${b64(p.buf)}\r\n`;
  return out + `--${B}--\r\n`;
}

/* list: [{r, rv}], files: Map(id → files 문서), cover: {title, sub} | null(한 건) */
export async function buildDocx(list, files, cover) {
  const imgs = new Map();
  for (const { r } of list) {
    for (const aid of [...(r.refImages || []), ...fileIdsIn(r.planHtml)]) {
      if (imgs.has(aid) || !files.has(aid)) continue;
      const p = await imgPart(files.get(aid));
      if (p) imgs.set(aid, p);
    }
  }
  const today = kstToday();
  let body = '';
  if (cover) {
    body += `<h1>${esc(cover.title)}</h1><p class="no">${esc(cover.sub)} · ${list.length}건 · 출력일 ${today}</p>
<table class="grid cover"><tr><th>요청번호</th><th>프로젝트</th><th>부서 · 요청자</th><th>담당</th><th>라이브</th><th>상태</th></tr>${list.map(({ r, rv = {} }) => `<tr><td>${esc(r.no)}</td><td>${esc(r.title)}</td><td>${esc(r.dept)} · ${esc(r.name)}</td><td>${esc(assigneeOf(r, rv) || '미배정')}</td><td>${esc(liveOf(r, rv))}</td><td>${statusLabel(statusOf(r, rv))}</td></tr>`).join('')}</table>`;
  }
  list.forEach(({ r, rv }, i) => {
    body += (cover || i > 0 ? '<br clear="all" style="page-break-before:always">' : '') + reqHtml(r, rv || {}, imgs);
  });
  body += `<p class="no" style="margin-top:18pt">디자인 요청 데스크에서 ${today}에 출력</p>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${DOC_CSS}</style></head><body>${body}</body></html>`;

  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="mht" ContentType="message/rfc822"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.mht"/></Relationships>');
  z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:altChunk r:id="htmlChunk"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>');
  z.file('word/afchunk.mht', toMht(html, [...imgs.values()]));
  return z.generateAsync({ type: 'nodebuffer' });
}
