/* 리치 텍스트 정리 (브라우저 전용) — 허용 목록 기반.
   Word·한글에서 붙여 넣은 서식을 편집기 형식으로 바꾸고, 표시 전에도 한 번 더 거친다.
   서버는 lib/server/sanitize.js 로 같은 허용 목록을 다시 강제한다. */
import { FILE_SRC_RE } from '../shared/constants.js';

const RT_DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'META', 'LINK', 'SVG', 'MATH', 'NOSCRIPT', 'TITLE', 'HEAD', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO', 'CANVAS']);
const RT_MAP = {
  B: 'STRONG', STRONG: 'STRONG', I: 'EM', EM: 'EM', U: 'U', S: 'S', STRIKE: 'S', DEL: 'S',
  H1: 'H2', H2: 'H2', H3: 'H3', H4: 'H3', H5: 'H3', H6: 'H3',
  P: 'P', DIV: 'P', UL: 'UL', OL: 'OL', LI: 'LI', BLOCKQUOTE: 'BLOCKQUOTE', A: 'A', MARK: 'MARK', HR: 'HR', BR: 'BR', IMG: 'IMG',
  TABLE: 'TABLE', THEAD: 'THEAD', TBODY: 'TBODY', TFOOT: 'TBODY', TR: 'TR', TH: 'TH', TD: 'TD', COLGROUP: 'COLGROUP', COL: 'COL',
};

export function sanitizeHtml(html) {
  if (typeof window === 'undefined') return '';
  const src = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body;
  const out = document.implementation.createHTMLDocument('');
  const walk = (from, to) => {
    for (const n of [...from.childNodes]) {
      if (n.nodeType === 3) { to.append(out.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (RT_DROP.has(tag)) continue;
      let t = RT_MAP[tag], cls = null;
      if (!t && (tag === 'SPAN' || tag === 'FONT')) {
        const st = n.getAttribute('style') || '';
        const bg = st.match(/background(-color)?\s*:\s*([^;]+)/i);
        const fw = st.match(/font-weight\s*:\s*(bold|[6-9]00)/i);
        // 글자 크기는 브라우저 기본 형식 <font size="1~5">로 보관
        let fs = null;
        if (tag === 'FONT') { const s = parseInt(n.getAttribute('size')); if (s >= 1) fs = String(Math.min(5, s)); }
        const cm = (n.getAttribute('class') || '').match(/\bfs-(s|m|l|xl)\b/);
        if (cm) fs = { s: '2', m: '3', l: '4', xl: '5' }[cm[1]];
        const px = st.match(/font-size\s*:\s*([\d.]+)(px|pt)/i);
        if (!fs && px) {
          const v = parseFloat(px[1]) * (px[2].toLowerCase() === 'pt' ? 1.333 : 1);
          fs = v < 12 ? '1' : v < 14 ? '2' : v < 17 ? null : v < 21 ? '4' : '5';
        }
        if (bg && !/transparent|rgba\(0, 0, 0, 0\)|white|#fff\b|rgb\(255, 255, 255\)/i.test(bg[2])) t = 'MARK';
        else if (fs) { t = 'FONT'; cls = fs; }
        else if (fw) t = 'STRONG';
      }
      if (!t) { walk(n, to); continue; }
      const el = out.createElement(t);
      if (cls) el.setAttribute('size', cls);
      if (t === 'TD' || t === 'TH') for (const a of ['colspan', 'rowspan']) { const v = n.getAttribute(a); if (v && /^\d{1,2}$/.test(v)) el.setAttribute(a, v); }
      if (t === 'A') {
        const href = n.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) { walk(n, to); continue; }
        el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener');
      }
      if (t === 'IMG') {
        const s = n.getAttribute('src') || '';
        if (!FILE_SRC_RE.test(s)) continue;
        el.setAttribute('src', s); el.setAttribute('alt', '기획안 이미지'); to.append(el); continue;
      }
      if (t === 'COL') {
        const w = (n.getAttribute('style') || '').match(/width\s*:\s*([\d.]{1,6})%/);
        if (w) el.style.width = w[1] + '%';
        to.append(el); continue;
      }
      if (t === 'HR' || t === 'BR') { to.append(el); continue; }
      walk(n, el); to.append(el);
    }
  };
  const root = out.createElement('div');
  walk(src, root);
  return root.innerHTML;
}
