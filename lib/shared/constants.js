/* 디자인 요청 데스크 — 원본 아티팩트의 상수를 그대로 옮김 */

export const DEPTS = ['마케팅디자인', '온라인고객지원팀', '영업', '경영지원', '임원']; // 'MD·상품기획' → '온라인고객지원팀' (11-17) · 'CS' 없앰 → 온라인고객지원팀과 같이 감 (11-18)
export const TYPES = ['기획전·이벤트 페이지', '배너·AD·SNS콘텐츠', '상세페이지', '인쇄물(POP·리플렛 등)', '영상·모션', '기타'];
export const CHANNELS = ['자사몰', '스마트스토어', '오픈마켓', '인스타그램', '오프라인 매장', 'B2B·제안서', '기타'];

/* 담당 팀이 처리 화면에서 고르는 상태. '취소'(11-18 추가) = 진행 중에라도 담당 팀이 접은 요청 — 사유는 메모에.
   요청자가 검토중·보류일 때 직접 거둔 요청은 '철회'(withdrawn, 이 목록 밖 · 요청서에 표시). */
export const STATUS = [
  { k: 'review', label: '검토중' },
  { k: 'progress', label: '진행중' },
  { k: 'done', label: '완료' },
  { k: 'hold', label: '보류' },
  { k: 'cancel', label: '취소' },
];
export const SMAP = Object.fromEntries(STATUS.map((s) => [s.k, s]));
/* 목록 '상태' 고르기 — 철회까지 전부 (건수 0 이어도 늘 보임) */
export const STATUS_FILTER = [...STATUS, { k: 'withdrawn', label: '철회' }];
/* 예전 상태값 → 현재 4단계 */
export const LEGACY = { new: 'review', meeting: 'progress', draft: 'progress', revise: 'progress' };

/* 요청할 팀 (요청서 STEP 0, 사용자 지정 2026-11-17) — 고르면 그 팀 담당자에게 일정이 잡힘.
   디자인팀이 처리 화면에서 담당자를 바꾸면 그 값이 우선 */
export const TEAMS = [
  { k: '디자인', person: '박민정', color: '#3FA6D3' },
  { k: 'VMD', person: '김성경', color: '#22A05B' }, // 11-18 사용자: 팀 색 차이 크게 → 파랑 · 초록 · 빨강
  { k: '개발', person: '이승환', color: '#E5484D' },
];
export const TEAM_MAP = Object.fromEntries(TEAMS.map((t) => [t.k, t]));
export const NO_TEAM_COLOR = '#B0B8C1';
/* 일정표 색: 고른 팀 > 담당자가 속한 팀 > 회색 */
export function teamOf(r, who) {
  if (r?.team && TEAM_MAP[r.team]) return r.team;
  return TEAMS.find((t) => t.person === who)?.k || '';
}
export const teamColor = (k) => TEAM_MAP[k]?.color || NO_TEAM_COLOR;
/* 디자인팀 처리에서 고를 수 있는 담당자 — 팀 담당 3명 + 원본에 있던 박선화 */
export const ASSIGNEES = ['박민정', '김성경', '이승환', '박선화'];

/* 디자인팀 기본 소요 기간 (영업일) */
export const LEAD = 5;

export const KINDS = [
  { k: '이벤트·기획전 페이지', size: 'PC 1200px / 모바일 860px' },
  { k: '상세페이지', size: '가로 860px' },
  { k: '인스타그램 피드', size: '1080×1350 (4:5)' },
  { k: '인스타그램 스토리·릴스', size: '1080×1920 (9:16)' },
  { k: '자사몰 메인 배너', size: 'PC 1920×600 / 모바일 750×900' },
  { k: '외부몰 배너', size: '채널 가이드 링크 첨부' },
  { k: '썸네일', size: '1000×1000' },
  { k: '카카오·문자 이미지', size: '800×400' },
  { k: '인쇄물(POP·리플렛)', size: 'A4 / A3' },
  { k: '영상·모션', size: '1080×1920 · 15초' },
  { k: '기타', size: '' },
];
export const KMAP = Object.fromEntries(KINDS.map((x) => [x.k, x]));
export const QUICK = ['이벤트·기획전 페이지', '상세페이지', '인스타그램 피드', '인스타그램 스토리·릴스', '자사몰 메인 배너', '외부몰 배너', '썸네일'];

export const COPY_TPL = '메인 타이틀: \n서브 타이틀: \n기간: \n혜택·가격: \n유의사항: ';
export const COPY_EX = '예시)\n메인 타이틀: 연말 단 한 번, 최대 50% 할인\n서브 타이틀: 올해 가장 사랑받은 제품을 특별한 가격에\n기간: 2026.12.01(화) ~ 12.07(월)';
export const PLAN_TPL = '<h3>기획 배경</h3><p>왜 이 작업이 필요한지 적어 주세요.</p><h3>페이지·콘텐츠 구성</h3><ol><li>인트로 (메인 비주얼)</li><li>혜택 소개</li><li>제품 라인업</li><li>유의사항</li></ol><h3>강조 포인트</h3><ul><li>가장 크게 보여야 하는 것</li></ul><h3>프로모션 조건</h3><p>기간, 대상, 쿠폰·사은품 조건</p>';

/* 이미지 첨부 */
export const MAX_IMG = 20;
export const MAX_IMG_BYTES = 20 * 1024 * 1024;
export const IMG_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/* 문서 보관 탭 */
export const SCOPES = [
  { k: 'done', label: '완료', file: '완료', ok: (s) => s === 'done' },
  { k: 'open', label: '진행 중', file: '진행중', ok: (s) => s === 'review' || s === 'progress' },
  { k: 'stop', label: '보류 · 취소', file: '보류취소', ok: (s) => s === 'hold' || s === 'cancel' || s === 'withdrawn' },
  { k: 'all', label: '전체', file: '전체', ok: () => true },
];

/* 이미지 주소: /api/files/<24자리 16진수> */
export const FILE_SRC_RE = /^\/api\/files\/[a-f0-9]{24}$/;
export const fileIdsIn = (html) => [...String(html || '').matchAll(/\/api\/files\/([a-f0-9]{24})/g)].map((m) => m[1]);
