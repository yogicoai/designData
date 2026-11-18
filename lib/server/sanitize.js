import sanitize from 'sanitize-html';
import { FILE_SRC_RE } from '../shared/constants.js';

/* 기획안 HTML 허용 목록 — 브라우저 쪽 sanitizeHtml 과 같은 범위를 서버에서 강제 */
const OPTS = {
  allowedTags: ['strong', 'em', 'u', 's', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'blockquote', 'a', 'mark', 'hr', 'br', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'font'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    col: ['style'],
    font: ['size'],
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowedStyles: { col: { width: [/^\d{1,3}(\.\d{1,3})?%$/] } },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName: 'a', attribs: /^https?:\/\//i.test(attribs.href || '') ? { href: attribs.href, target: '_blank', rel: 'noopener' } : {} }),
    font: (tagName, attribs) => ({ tagName: 'font', attribs: /^[1-5]$/.test(attribs.size || '') ? { size: attribs.size } : {} }),
    th: (tagName, attribs) => ({ tagName, attribs: spans(attribs) }),
    td: (tagName, attribs) => ({ tagName, attribs: spans(attribs) }),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !FILE_SRC_RE.test(frame.attribs.src || ''),
};

function spans(a) {
  const o = {};
  for (const k of ['colspan', 'rowspan']) if (/^\d{1,2}$/.test(a[k] || '')) o[k] = a[k];
  return o;
}

export const cleanHtml = (html) => sanitize(String(html || ''), OPTS);
