# 링크디시 (jusodc.com)

공식 사이트 주소를 분야별로 모아 매일 접속을 점검하는 주소모음·링크모음 사이트입니다.
Astro 정적 사이트로, 빌드 결과(`dist/`)를 어떤 정적 호스팅에도 올릴 수 있습니다.

## 실행

```bash
npm install
npm run icons      # public/ 에 PNG 아이콘·og.png 생성 (favicon.svg 를 바꿨을 때만 다시 실행)
npm run dev        # http://localhost:4321
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 미리보기
npm run check:links  # 모든 사이트 접속 점검 → src/data/status*.json 갱신
```

## 구조

| 경로 | 내용 |
|---|---|
| `src/config.ts` | 브랜드명·도메인·문의 메일·홈 Title/Meta. **브랜드나 도메인은 여기서만 바꿉니다.** |
| `src/data/categories.json` | 12개 분야 (slug, 이름, 소개, 이용 팁) |
| `src/data/sites.json` | 등록 사이트 (id, 이름, URL, 공식 도메인, 분야, 운영사, 별칭) |
| `src/data/status.json`, `status-log.json` | 자동 점검 결과·변경 기록 (스크립트가 갱신) |
| `src/pages/` | 홈 `/`, 분야 허브 `/c/{slug}/`, 확인기 `/check/`, 점검 기록 `/status/`, 소개 `/about/`, 개인정보 `/privacy/` |
| `src/lib/checker.ts` | 공식 주소 확인기 (도메인 일치·유사 철자 판별, 브라우저에서만 동작) |
| `src/scripts/app.ts` | 초성 검색, 즐겨찾기·최근 방문, 분야 탭, 홈 화면 추가 안내, 서비스 워커 등록 |
| `public/sw.js` | 오프라인 캐시 (배포 후 내용 바꾸면 `VERSION` 올리기) |
| `.github/workflows/check-links.yml` | 매일 06:00 KST 링크 점검 → 바뀌면 커밋 → Git 연동 배포가 재빌드 |

## 사이트 추가·수정

1. `src/data/sites.json` 에 항목 추가 — `domain` 은 운영사 공지·앱 마켓 개발자 웹사이트 등으로 **직접 확인한 공식 도메인**.
2. 별칭(`aliases`)에 영문 이름·흔한 검색어를 넣으면 상단 검색에 걸립니다.
3. `npm run check:links` 로 접속 확인 후 커밋.

등록 기준: 운영 주체가 확인되는 공식 사이트만. 불법 복제물·도박·성인·무단 중계 사이트, 차단을 피해 주소를 바꾸는 사이트는 싣지 않습니다.

## 출시 전 체크리스트

- [ ] `sites.json` 의 모든 URL·도메인·운영사를 사람이 한 번씩 열어 확인 (초안 데이터입니다)
- [ ] `src/config.ts` 의 `email` 을 실제 문의 메일로, `sameAs` 에 블로그·브런치 등 공식 채널 추가
- [ ] jusodc.com 도메인 등록 → 호스팅(Cloudflare Pages 권장) 연결, `www` → 루트 301
- [ ] Google Search Console·네이버 서치어드바이저 등록, `https://jusodc.com/sitemap-index.xml` 제출
- [ ] GitHub 저장소에 올리고 Actions 의 “매일 링크 점검” 수동 실행으로 첫 점검
- [ ] 개인정보 안내(`/privacy/`)를 통계 도구 도입 여부에 맞게 갱신

## 배포 (Cloudflare Workers 정적 자산)

```bash
npm run build && npx wrangler deploy
```

- 설정: `wrangler.jsonc` — `dist/` 를 정적 자산으로 올리고 `jusodc.com`, `www.jusodc.com` 커스텀 도메인 연결, workers.dev 주소는 꺼 둠.
- `worker/index.js` — http→https, www→루트, `/경로` → `/경로/` 를 301 한 번으로 정리한 뒤 정적 파일 응답.
- 모든 요청이 Worker 를 거치므로(`run_worker_first`) 무료 플랜 기준 하루 10만 요청 한도를 넘으면 유료 플랜 필요.
