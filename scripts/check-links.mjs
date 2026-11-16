// 등록된 모든 사이트에 접속해 상태를 기록한다.  실행: npm run check:links
// 결과: src/data/status.json (최신 결과), src/data/status-log.json (상태가 바뀐 기록, 최신 200건)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = (p) => fileURLToPath(new URL(`../src/data/${p}`, import.meta.url));
const sites = JSON.parse(await readFile(file('sites.json'), 'utf8'));
const prev = JSON.parse(await readFile(file('status.json'), 'utf8'));
const log = JSON.parse(await readFile(file('status-log.json'), 'utf8'));

const TIMEOUT = 15_000;
const CONCURRENCY = 8;
const UA =
  'Mozilla/5.0 (compatible; LinkDC-LinkCheck/1.0; +https://jusodc.com/status/) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

// 자동 접속 거절로 보는 응답 코드 (예: 페이스북은 봇에게 400 을 준다)
const BLOCKED_CODES = [400, 401, 403, 406, 429, 451];
// 일시적 실패를 다시 확인하는 대기 시간 (ms)
const RETRY_DELAYS = [10_000, 30_000];
// 이 횟수만큼 연속(매일) 실패해야 '연결 안 됨' 으로 공개한다. 그 전에는 이전 상태를 유지.
const FAILS_TO_PUBLISH = 2;

const inDomain = (host, site) =>
  [site.domain, ...(site.altDomains ?? [])].some((d) => host === d || host.endsWith(`.${d}`));

async function probe(site) {
  const t0 = Date.now();
  const attempt = async (method) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      return await fetch(site.url, {
        method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8', 'accept-language': 'ko-KR,ko;q=0.9' },
      });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let res = await attempt('HEAD');
    // HEAD 를 거부하는 서버가 많아 GET 으로 다시 확인
    if (res.status === 405 || res.status === 501 || res.status >= 400) {
      res.body?.cancel?.();
      res = await attempt('GET');
    }
    res.body?.cancel?.();
    const ms = Date.now() - t0;
    const finalUrl = res.url || site.url;
    const finalHost = new URL(finalUrl).hostname;
    const code = res.status;
    let state;
    if (!inDomain(finalHost, site)) state = 'moved';
    else if (code < 400) state = 'ok';
    // 서버가 응답은 했지만 자동 접속을 거절한 경우 (봇 차단·지역 차단). 사람이 열면 대부분 정상.
    else if (BLOCKED_CODES.includes(code)) state = 'restricted';
    else state = 'error';
    return { state, code, ms, ...(finalUrl !== site.url ? { finalUrl } : {}) };
  } catch (err) {
    return { state: 'error', ms: Date.now() - t0, note: err?.name === 'AbortError' ? 'timeout' : String(err?.cause?.code ?? err?.message ?? err) };
  }
}

const results = {};
const queue = [...sites];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const site = queue.shift();
      const r = await probe(site);
      results[site.id] = r;
      const mark = { ok: '✓', restricted: '○', moved: '→', error: '✗' }[r.state];
      console.log(`${mark} ${site.id.padEnd(18)} ${String(r.code ?? '-').padEnd(4)} ${r.ms}ms ${r.finalUrl ?? r.note ?? ''}`);
    }
  }),
);

// 일시적 오류(DNS·시간 초과·5xx)를 줄이려고 실패한 곳은 간격을 늘려 가며 다시 확인
for (const [i, delay] of RETRY_DELAYS.entries()) {
  const failed = sites.filter((s) => results[s.id].state === 'error');
  if (!failed.length) break;
  console.log(`\n재확인 ${i + 1}차 ${failed.length}곳 (${delay / 1000}초 뒤)…`);
  await new Promise((r) => setTimeout(r, delay));
  for (const site of failed) {
    const r = await probe(site);
    if (r.state !== 'error') results[site.id] = r;
    console.log(`  ${site.id.padEnd(18)} → ${r.state} ${r.code ?? r.note ?? ''}`);
  }
}

// 연속 실패 횟수를 세고, 하루 실패만으로는 공개 상태를 '연결 안 됨' 으로 바꾸지 않는다.
// (첫 점검처럼 이전 기록이 없으면 그대로 '연결 안 됨')
for (const s of sites) {
  const r = results[s.id];
  const before = prev.results?.[s.id];
  if (r.state !== 'error') continue;
  r.fails = (before?.fails ?? 0) + 1;
  const hadGoodState = before && before.state !== 'error' && before.state !== 'unknown';
  if (r.fails < FAILS_TO_PUBLISH && hadGoodState) {
    console.log(`  ${s.id.padEnd(18)} 실패 ${r.fails}회 — 이전 상태(${before.state}) 유지`);
    const { fails: _f, ...kept } = before;
    results[s.id] = { ...kept, fails: r.fails, note: r.note };
  }
}

// 상태 변경 기록
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const changes = [];
for (const s of sites) {
  const from = prev.results?.[s.id]?.state ?? 'unknown';
  const to = results[s.id].state;
  // 첫 점검(unknown→…)에서 정상인 경우는 기록하지 않는다
  if (from !== to && !(from === 'unknown' && (to === 'ok' || to === 'restricted'))) {
    const r = results[s.id];
    changes.push({ date: kst, id: s.id, from, to, ...(r.finalUrl || r.note ? { note: r.finalUrl ?? r.note } : {}) });
  }
}

// 결과 저장 (note 는 기록용이므로 status.json 에서는 뺀다)
const clean = Object.fromEntries(Object.entries(results).map(([id, { note, ...r }]) => [id, r]));
await writeFile(file('status.json'), JSON.stringify({ checkedAt: now.toISOString(), results: clean }, null, 2) + '\n');
await writeFile(file('status-log.json'), JSON.stringify([...changes, ...log].slice(0, 200), null, 2) + '\n');

const count = (st) => Object.values(results).filter((r) => r.state === st).length;
console.log(
  `\n점검 ${sites.length}곳 — 정상 ${count('ok')}, 자동 확인 제한 ${count('restricted')}, 이동 ${count('moved')}, 연결 안 됨 ${count('error')} · 변경 ${changes.length}건`,
);
