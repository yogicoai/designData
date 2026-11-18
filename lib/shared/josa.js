/* 한국어 조사 — 팀마다 라벨이 달라서(예: '업로드(라이브) 날짜를' / '오픈(배포) 희망일을') 앞 낱말 받침에 맞춰 붙인다.
   괄호 보충은 건너뛰고 그 앞 낱말 기준('업로드(라이브)' → '업로드'). 한글로 안 끝나면 '을(를)'처럼 둘 다. */
const PAIRS = { 을: ['을', '를'], 를: ['을', '를'], 은: ['은', '는'], 는: ['은', '는'], 이: ['이', '가'], 가: ['이', '가'] };

export function josa(word, p) {
  const [withB, noB] = PAIRS[p] || [p, p];
  const s = String(word ?? '');
  const base = s.replace(/(\s*\([^()]*\))+\s*$/u, '').trimEnd();
  const c = base.charCodeAt(base.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return s + ((c - 0xac00) % 28 ? withB : noB);
  return `${s}${withB}(${noB})`;
}
