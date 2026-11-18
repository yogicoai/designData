/* localStorage — 비공개 창 등에서 막혀도 화면은 그대로 동작하게 */
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export const ME_KEY = 'drq-me-v1';
export const DRAFT_KEY = 'drq-draft-v1';
export const SCHED_KEY = 'drq-sched';
