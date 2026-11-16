// sites.json 1차 자동 점검표. 사람이 출처와 대조하기 전에 '볼 곳' 을 골라 준다.  실행: npm run verify:sites
// 결과: seo-work/verify/verify-sites.md (표), verify-sites.json (원자료) — 비공개 작업 폴더(.gitignore)
// 이 표의 ⚠ 는 '틀렸다' 가 아니라 '사람이 확인할 것' 이다. 판정은 반드시 공식 출처로 한다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import tls from 'node:tls';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const sites = JSON.parse(await readFile(root('src/data/sites.json'), 'utf8'));

const TIMEOUT = 15_000;
const CONCURRENCY = 6;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const norm = (s) => (s ?? '').toLowerCase().replace(/주식회사|\(주\)|㈜|유한회사|corporation|corp\.?|inc\.?|co\.,?\s*ltd\.?|ltd\.?|llc|[\s.,()·-]/g, '');
const inDomain = (host, site) => [site.domain, ...(site.altDomains ?? [])].some((d) => host === d || host.endsWith(`.${d}`));

function certOf(host) {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 443, servername: host, timeout: TIMEOUT }, () => {
      const c = sock.getPeerCertificate();
      sock.end();
      resolve({ org: c?.subject?.O ?? null, issuer: c?.issuer?.O ?? null, cn: c?.subject?.CN ?? null });
    });
    sock.on('error', (e) => resolve({ error: e.code ?? e.message }));
    sock.on('timeout', () => { sock.destroy(); resolve({ error: 'timeout' }); });
  });
}

async function pageOf(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' } });
    const html = (await res.text()).slice(0, 300_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
    return { code: res.status, finalUrl: res.url, title };
  } catch (e) {
    return { error: e?.name === 'AbortError' ? 'timeout' : String(e?.cause?.code ?? e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

// 확인할 때 열어 볼 출처 링크
function sourcesFor(s) {
  const q = encodeURIComponent(s.name);
  const links = [`[Play 스토어](https://play.google.com/store/search?q=${q}&c=apps)`, `[App Store](https://www.apple.com/kr/search/${q}?src=globalnav)`];
  if (/\.(go|or)\.kr$/.test(s.domain) || s.domain === 'gov.kr') links.unshift('기관 누리집 “기관 소개”');
  return links.join(' · ');
}

async function check(s) {
  const urlHost = new URL(s.url).hostname;
  const [page, cert] = await Promise.all([pageOf(s.url), certOf(urlHost)]);
  const flags = [];
  if (!inDomain(urlHost, s)) flags.push('url 의 도메인이 domain 과 다름');
  if (page.error) flags.push(`접속 실패(${page.error}) — 브라우저로 직접 확인`);
  else {
    const finalHost = new URL(page.finalUrl).hostname;
    if (!inDomain(finalHost, s)) flags.push(`도착 주소가 domain 밖: ${finalHost}`);
    if (page.code >= 400) flags.push(`응답 ${page.code} — 봇 차단인지 브라우저로 확인`);
    const t = norm(page.title);
    const names = [s.name, ...s.aliases].map(norm).filter(Boolean);
    if (page.code < 400 && !names.some((n) => t.includes(n))) flags.push('페이지 제목에 서비스 이름 없음');
  }
  if (!s.operator) flags.push('운영사(operator) 비어 있음');
  if (cert.org) {
    const o = norm(cert.org);
    const keys = [s.operator, s.name, ...s.aliases].map(norm).filter((k) => k.length >= 2);
    if (!keys.some((k) => o.includes(k) || k.includes(o))) flags.push(`인증서 조직명(${cert.org}) ≠ 운영사 — 계열사·CDN인지 확인`);
  }
  if (cert.error) flags.push(`인증서 확인 실패(${cert.error})`);
  return { id: s.id, name: s.name, category: s.category, url: s.url, domain: s.domain, operator: s.operator, page, cert, flags };
}

const results = [];
const queue = [...sites];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const s = queue.shift();
    const r = await check(s);
    results.push(r);
    console.log(`${r.flags.length ? '⚠' : '✓'} ${s.id.padEnd(16)} ${r.flags.join(' / ')}`);
  }
}));

const order = new Map(sites.map((s, i) => [s.id, i]));
results.sort((a, b) => order.get(a.id) - order.get(b.id));
const byId = Object.fromEntries(sites.map((s) => [s.id, s]));
const esc = (v) => String(v ?? '—').replace(/\|/g, '\\|');
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const flagged = results.filter((r) => r.flags.length);

const md = [
  `# sites.json 1차 자동 점검표 (${today})`,
  '',
  `총 ${results.length}곳 · ⚠ ${flagged.length}곳 · ✓ ${results.length - flagged.length}곳`,
  '',
  '⚠ 는 “틀렸다”가 아니라 “사람이 공식 출처로 확인할 것”입니다. ✓ 도 자동 검사만 통과한 것이므로 은행·공공 분야는 출처 확인 후 기록하세요.',
  '결정: **유지**(source·verifiedAt 기록) / **수정** / **보류**(hold: true) / **삭제**',
  '',
  '## ⚠ 확인 필요',
  '',
  '| id | 서비스 | domain | 운영사(현재) | 인증서 조직명 | 페이지 제목 | 확인 이유 | 확인할 출처 | 결정 |',
  '|---|---|---|---|---|---|---|---|---|',
  ...flagged.map((r) => `| ${r.id} | ${esc(r.name)} | ${r.domain} | ${esc(r.operator || '(비어 있음)')} | ${esc(r.cert.org ?? (r.cert.error ? '확인 실패' : 'DV(조직명 없음)'))} | ${esc(r.page.title?.slice(0, 40))} | ${esc(r.flags.join('<br>'))} | ${sourcesFor(byId[r.id])} |  |`),
  '',
  '## ✓ 자동 검사 통과',
  '',
  '| id | 서비스 | domain | 운영사 | 인증서 조직명 | 페이지 제목 | 확인할 출처 | 결정 |',
  '|---|---|---|---|---|---|---|---|',
  ...results.filter((r) => !r.flags.length).map((r) => `| ${r.id} | ${esc(r.name)} | ${r.domain} | ${esc(r.operator)} | ${esc(r.cert.org ?? 'DV(조직명 없음)')} | ${esc(r.page.title?.slice(0, 40))} | ${sourcesFor(byId[r.id])} |  |`),
  '',
];

await mkdir(root('seo-work/verify'), { recursive: true });
await writeFile(root('seo-work/verify/verify-sites.md'), md.join('\n'));
await writeFile(root('seo-work/verify/verify-sites.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n⚠ ${flagged.length} / ${results.length} → seo-work/verify/verify-sites.md`);
