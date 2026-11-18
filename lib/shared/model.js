/* 요청서(r) + 디자인팀 회신(rv)에서 화면이 쓰는 값을 뽑는 헬퍼 */
import { SMAP, LEGACY } from './constants.js';
import { fmt, fmtMeet } from './dates.js';
import { formOf } from './forms.js';

export const statusOf = (r, rv) => {
  if (!r) return 'review';
  if (r.withdrawn) return 'withdrawn';
  const s = rv?.status || 'review';
  return LEGACY[s] || s;
};
export const statusLabel = (s) => (SMAP[s] || { label: '철회' }).label;
export const liveOf = (r, rv) => rv?.live || r?.live || '';
export const startOf = (r, rv) => rv?.start || r?.requestDate || '';
export const draftOf = (r, rv) => rv?.draft || r?.draft || '';
/* 접힌 요청(취소·철회) — 목록 기본 보기와 일정표에서 빠짐 */
export const isDropped = (s) => s === 'cancel' || s === 'withdrawn';
export const isOpenStatus = (s) => s !== 'done' && !isDropped(s);
/* 담당자: 디자인팀이 정한 사람 > 요청할 때 고른 팀의 담당자 */
export const assigneeOf = (r, rv) => rv?.designer || r?.assignee || '';

export const chList = (r) => (r.channels || []).map((c) => (c === '기타' && r.channelEtc ? '기타(' + r.channelEtc + ')' : c));

/* Flow 공유용 요약 */
export function shareText(r, rv = {}) {
  const s = statusOf(r, rv);
  const who = assigneeOf(r, rv);
  return [
    `[${r.team || "디자인"} 요청] ${r.no} ${r.title}`,
    r.team ? `· 요청 팀: ${r.team}${who ? ` (담당 ${who})` : ''}` : null,
    `· 요청: ${r.dept} / ${r.name} (${r.requestDate})`,
    `· 유형: ${r.type}${r.channels?.length ? ' / ' + chList(r).join(', ') : ''}`,
    r.place ? `· ${formOf(r.team).place?.label || '설치 장소'}: ${r.place}` : null,
    r.items?.length ? `· ${formOf(r.team).items.label}: ${r.items.map((x) => `${x.kind} ${x.qty}개${x.size ? ' (' + x.size + ')' : ''}`).join(', ')}` : null,
    `· ${formOf(r.team).goal.label}: ${r.goal}`,
    `· ${formOf(r.team).draft.short}: ${fmt(draftOf(r, rv))} / ${formOf(r.team).live.short}: ${fmt(liveOf(r, rv))}`,
    `· 상태: ${statusLabel(s)}${who ? ' / 담당 ' + who : ''}`,
    rv.meeting ? `· 미팅: ${fmtMeet(rv.meeting)}` : null,
    rv.note ? `· 디자인팀 메모: ${rv.note}` : null,
    r.files ? `· 자료: ${r.files.replace(/\n/g, ' ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export const safeName = (s) =>
  String(s || '')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
