// 공식 주소 확인기 — 브라우저에서만 동작하고 입력값을 어디에도 보내거나 저장하지 않는다.

export type IndexItem = { id: string; n: string; u: string; d: string; h: string; c: string; x?: string[] };

export type Verdict =
  | { kind: 'official'; site: IndexItem; host: string; domain: string; warnings: string[] }
  | { kind: 'lookalike'; site: IndexItem; host: string; reason: string; warnings: string[] }
  | { kind: 'unknown'; host: string; warnings: string[] }
  | { kind: 'invalid'; message: string };

function parse(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

// 도메인의 핵심 이름: 'www.kbstar.com' → 'kbstar', 'hometax.go.kr' → 'hometax'
function coreLabel(host: string): string {
  const parts = host.replace(/^(www|m)\./, '').split('.');
  const second = new Set(['co', 'go', 'or', 'ne', 'ac', 're', 'pe', 'com', 'net', 'org']);
  if (parts.length >= 3 && second.has(parts.at(-2)!)) return parts.at(-3)!;
  return parts.length >= 2 ? parts.at(-2)! : parts[0];
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

// 자주 쓰이는 글자 바꿔치기 (0↔o, 1↔l, rn↔m 등)
function deconfuse(s: string): string {
  return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/[1i|]/g, 'l').replace(/5/g, 's');
}

export function check(input: string, index: IndexItem[]): Verdict {
  const url = parse(input);
  if (!url || !url.hostname.includes('.')) {
    return { kind: 'invalid', message: '주소 형식이 아닙니다. 예: https://www.naver.com' };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const warnings: string[] = [];
  if (url.protocol === 'http:') warnings.push('암호화되지 않은 http 주소입니다. 로그인·결제를 하지 마세요.');
  if (url.username || url.password || input.includes('@')) warnings.push("주소에 '@'가 들어 있습니다. '@' 앞부분은 무시되고 뒤쪽 주소로 이동하는 속임수일 수 있습니다.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) warnings.push('도메인 대신 IP 숫자 주소입니다. 공식 서비스는 보통 IP 주소를 쓰지 않습니다.');
  if (host.split('.').some((p) => p.startsWith('xn--'))) warnings.push('국제화 도메인(xn--)입니다. 영문과 비슷하게 생긴 다른 문자일 수 있습니다.');

  // 1) 공식 도메인과 일치 — 호스트가 정확히 같은 항목을 우선
  const exact = index.find((s) => s.h === host || s.h === `www.${host}`);
  const byDomain =
    exact ?? index.find((s) => matchesDomain(host, s.d) || (s.x ?? []).some((d) => matchesDomain(host, d)));
  if (byDomain) {
    const domain = [byDomain.d, ...(byDomain.x ?? [])].find((d) => matchesDomain(host, d)) ?? byDomain.d;
    return { kind: 'official', site: byDomain, host, domain, warnings };
  }

  // 2) 유사 도메인 — 공식 이름을 포함하거나 철자 1~2자 차이
  const core = coreLabel(host);
  const coreFixed = deconfuse(core);
  for (const s of index) {
    const official = coreLabel(s.d);
    if (official.length < 4) continue;
    if (host.includes(official)) {
      return { kind: 'lookalike', site: s, host, reason: `공식 이름 '${official}'이 들어 있지만 공식 도메인(${s.d})이 아닙니다.`, warnings };
    }
    const dist = Math.min(editDistance(core, official), editDistance(coreFixed, official));
    if (dist > 0 && dist <= (official.length >= 7 ? 2 : 1)) {
      return { kind: 'lookalike', site: s, host, reason: `공식 도메인(${s.d})과 철자가 ${dist}자 다릅니다.`, warnings };
    }
  }
  return { kind: 'unknown', host, warnings };
}
