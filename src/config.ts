// 사이트 전역 설정. 브랜드명·도메인은 여기서만 바꾼다.
// (도메인을 바꾸면 astro.config.mjs 의 site 와 public/robots.txt 도 함께 바꾼다.)
export const SITE = {
  name: '링크디시',
  nameEn: 'LinkDC',
  domain: 'jusodc.com',
  url: 'https://jusodc.com',
  email: 'jusodc@gmail.com',
  // TODO: 블로그·브런치 등 공식 채널이 생기면 추가 (Organization.sameAs)
  sameAs: [] as string[],
  // 운영 시작 연도 (고정)
  since: 2026,
  // 빌드 시점의 한국 연도. 매일 재빌드되므로 해가 바뀌면 title·저작권 표기가 자동으로 따라간다.
  year: new Date(Date.now() + 9 * 3600_000).getUTCFullYear(),
  themeColor: '#2754e6',
};

// 홈 Title·Meta. 메인 키워드 '링크모음·주소모음' 은 홈에만 둔다 (분야 페이지는 '○○ 사이트 모음').
// '최신주소'·'우회' 같은 회색 링크사이트 표현은 쓰지 않는다.
export const HOME_META = {
  title: (_n: number) => `링크모음·주소모음 | 공식 사이트만 모은 안전한 링크사이트 - ${SITE.name}`,
  h1: '링크모음·주소모음 — 공식 사이트만 모은 안전한 바로가기',
  description: (n: number, cats: number) =>
    `링크모음·주소모음 ${n}곳을 ${cats}개 분야로 정리했습니다. 공식 사이트만 싣고 매일 접속을 점검해 사칭·불법 사이트 걱정 없이 바로 이동할 수 있어요.`,
};
