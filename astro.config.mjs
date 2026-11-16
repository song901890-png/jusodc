import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 매일 점검 결과로 내용이 실제로 바뀌는 페이지(홈·분야·점검 기록)에만 lastmod 를 넣는다.
// 소개·개인정보처럼 점검과 무관한 페이지에 날짜를 붙이면 신선도 신호가 부정확해진다.
const { checkedAt } = JSON.parse(readFileSync(new URL('./src/data/status.json', import.meta.url), 'utf8'));
const LIVE_PAGES = /^https:\/\/[^/]+\/(?:$|c\/[^/]+\/$|status\/$)/;

// 도메인을 바꾸면 src/config.ts 와 이 값을 함께 바꾼다.
export default defineConfig({
  site: 'https://jusodc.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // 페이지가 작아서 CSS를 HTML에 인라인한다 (요청 수 감소).
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
      serialize: (item) => (checkedAt && LIVE_PAGES.test(item.url) ? { ...item, lastmod: checkedAt } : item),
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
