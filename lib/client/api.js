/* 브라우저 → API 호출 헬퍼 */
import { IMG_TYPES, MAX_IMG_BYTES } from '../shared/constants.js';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

async function toError(res) {
  let body = null;
  try { body = await res.json(); } catch {}
  return new ApiError(body?.code || 'http_' + res.status, body?.message || '요청을 처리하지 못했어요.', res.status);
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    signal,
    cache: 'no-store',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  return res.json();
}

/* 이미지 한 장 올리기 → 파일 id.
   드롭박스 모드면 브라우저가 드롭박스 임시 업로드 주소로 직접 올리고(서버 용량 제한 회피),
   막히면 서버를 거쳐 올린다. 마지막에 commit 으로 서버가 확인한다. */
export async function uploadImage(file, role) {
  if (!IMG_TYPES.includes(file.type)) throw new ApiError('bad_type', 'PNG, JPG, GIF, WEBP 이미지만 올릴 수 있어요.');
  if (file.size > MAX_IMG_BYTES) throw new ApiError('too_large', '20MB 이하 이미지만 올릴 수 있어요.');
  const { id, upload } = await api('/api/files', { method: 'POST', body: { name: file.name || 'image', type: file.type, size: file.size, role } });
  let sent = false;
  if (upload?.direct && upload.url) {
    try {
      const r = await fetch(upload.url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
      sent = r.ok;
    } catch {
      // 응답만 못 읽었고(CORS 등) 실제로는 올라갔을 수 있으니 먼저 확인
      try { await api(`/api/files/${id}/commit`, { method: 'POST' }); return id; } catch {}
    }
  }
  if (!sent) {
    const r = await fetch(`/api/files/${id}/content`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    if (!r.ok) throw await toError(r);
  }
  await api(`/api/files/${id}/commit`, { method: 'POST' });
  return id;
}

export const deleteFile = (id) => api(`/api/files/${id}`, { method: 'DELETE' }).catch(() => {});

/* 결과물(완성본) 한 개 올리기 — 디자인팀. 드롭박스면 브라우저가 직접, 아니면 서버 경유(큰 파일도 흘려서 저장) */
export async function uploadResult(reqId, round, file) {
  const { upload, rel } = await api(`/api/requests/${reqId}/results`, { method: 'POST', body: { round, name: file.name, size: file.size } });
  const viaServer = async () => {
    const r = await fetch(`/api/requests/${reqId}/results/content?p=${encodeURIComponent(rel)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    if (!r.ok) throw await toError(r);
  };
  // 드롭박스에 보일 때까지 서버가 잠깐 기다려 줌 → 바로 다시 읽는 목록에 빠지지 않게
  const confirm = () => api(`/api/requests/${reqId}/results/confirm`, { method: 'POST', body: { rel } });
  if (upload?.direct && upload.url) {
    let sent = false;
    try {
      const r = await fetch(upload.url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
      sent = r.ok;
    } catch {
      // 응답만 못 읽었을 수 있으니(CORS 등) 실제로 올라갔는지 먼저 확인 (같은 파일이 두 번 들어가지 않게)
      try { await confirm(); return rel; } catch {}
    }
    if (sent) {
      await confirm();
      return rel;
    }
    await viaServer();
    return rel;
  }
  await viaServer();
  return rel;
}

/* 엑셀·워드 받기 */
export async function downloadExport(body, filename) {
  const res = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await toError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
