// public/favicon.svg 로 PNG 아이콘과 OG 이미지를 만든다.  실행: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));
const svg = await readFile(pub('favicon.svg'));

const icon = (size) => sharp(svg, { density: Math.ceil((72 * size) / 32) * 2 }).resize(size, size).png();

await icon(32).toFile(pub('favicon-32.png'));
await icon(180).toFile(pub('apple-touch-icon.png'));
await icon(192).toFile(pub('icon-192.png'));
await icon(512).toFile(pub('icon-512.png'));

// 마스커블: 안전 영역(가운데 80%) 안에 로고가 들어가도록 여백을 둔다
const inner = await sharp(svg, { density: 1200 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2754e6' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(pub('icon-maskable-512.png'));

// OG 이미지 1200×630 (시스템 글꼴로 렌더링되므로 서버 환경마다 모양이 조금 다를 수 있다)
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f7f9"/>
  <rect x="0" y="0" width="1200" height="12" fill="#2754e6"/>
  <g transform="translate(96 150) scale(4)">${svg
    .toString()
    .replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="96" y="390" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="76" font-weight="700" fill="#15181e">주소모음·링크모음</text>
  <text x="96" y="466" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="38" fill="#5b6370">공식 사이트 주소를 분야별로 · 매일 접속 점검</text>
  <text x="96" y="560" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="34" font-weight="700" fill="#2754e6">링크디시 · jusodc.com</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(pub('og.png'));

console.log('아이콘 생성 완료: favicon-32, apple-touch-icon, icon-192/512, icon-maskable-512, og.png');
