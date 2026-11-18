/* 날짜 헬퍼 — 문자열은 모두 'YYYY-MM-DD' (요청서·일정 필드) */

export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parse = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
export const fmt = (s) => {
  const d = parse(s);
  return d ? d.getMonth() + 1 + '/' + d.getDate() + '(' + WD[d.getDay()] + ')' : '—';
};

/* 한국 시간 기준 오늘 — 서버(UTC)에서도 같은 날이 나오게 */
export function kstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const todayStr = () => kstToday();

/* 오늘 다음 날부터 target 까지의 평일 수. 지났으면 -1, 오늘이면 0 */
export function bizDays(target) {
  const t = parse(target);
  if (!t) return null;
  const d = parse(todayStr());
  let n = 0;
  if (t <= d) return t < d ? -1 : 0;
  while (d < t) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const fmtDT = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* 미팅 일시 'YYYY-MM-DDTHH:MM' → '11월 12일 (수) 오후 3:00' */
export function fmtMeet(v) {
  if (!v) return '';
  const [d, t] = v.split('T');
  const dt = parse(d);
  if (!dt) return v;
  const [hh, mm] = (t || '00:00').split(':').map(Number);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WD[dt.getDay()]}) ${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${pad(mm)}`;
}

export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const firstOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
