import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 홈 폴더에도 package-lock.json 이 있어서 루트를 이 폴더로 못 박음.
// turbopack.root 와 outputFileTracingRoot 는 '같은 값'이어야 함 — 다르면(끝의 '/' 하나라도) Vercel 빌드가 경고하고
// 서버 함수에 실어 갈 파일 추적이 어긋나 /api/state 등이 불러오다 죽었음 (11-18)
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
  // sharp(네이티브)·exceljs 는 번들하지 않고 node_modules 에서 씀.
  // sanitize-html 은 번들에 넣음 — 최신판(2.18)이 ESM 전용 htmlparser2 를 require 해서, 밖에 두면 서버 Node 버전·파일 추적에 따라 불러오다 죽을 수 있음
  serverExternalPackages: ['exceljs', 'sharp'],
};

export default nextConfig;
