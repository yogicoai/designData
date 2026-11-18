import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 홈 폴더에도 package-lock.json 이 있어서 루트를 이 폴더로 못 박음
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  serverExternalPackages: ['exceljs', 'sharp', 'sanitize-html'],
};

export default nextConfig;
