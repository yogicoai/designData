/* 선 아이콘 (24×24, stroke 1.8, 둥근 끝) — 예전 3D 그라데이션 아이콘을 대체 (B+ 디자인, 2026-11-17)
   이름은 예전 것과 같게 둬서 화면 코드는 그대로 쓴다 */
const clipboard = '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9.5 3h5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13l2 2 4-4"/>';
const inbox = '<path d="M4 13.5l2.4-7.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.3L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13.5h4.5l1.2 2.2h4.6l1.2-2.2H20"/>';
const calendar = '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>';
const folder = '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.4a1.5 1.5 0 0 1 1.2.6L12 7.5h6a2.5 2.5 0 0 1 2.5 2.5v7.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z"/>';
const user = '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>';
const target = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>';
const layers = '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>';
const doc = '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>';
const chat = '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>';
const check = '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8 5.7-5.8"/>';
const search = '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>';
const image = '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5-8.5 9"/>';
const lock = '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>';
const close = '<path d="M6 6l12 12M18 6L6 18"/>';
const team = '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14a6 6 0 0 1 3.5 5.5"/>';

export const ICONS = {
  clipboard, inbox, calendar, folder, user, target, layers, doc, chat, check, search, image, lock, close, team,
  idcard: user,
  shield: check,
  magnifier: search,
  st_done: image,
  st_progress: clipboard,
  st_review: search,
  st_hold: clipboard,
};
