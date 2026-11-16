import categoriesJson from '../data/categories.json';
import sitesJson from '../data/sites.json';
import statusJson from '../data/status.json';
import logJson from '../data/status-log.json';

export type Category = {
  slug: string;
  name: string;
  short: string;
  intro: string;
  tips: string[];
};

export type Site = {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  operator: string;
  aliases: string[];
  popular?: boolean;
  /** 이전·보조 공식 도메인 (예: 코레일 letskorail.com) */
  altDomains?: string[];
  /** 공식 도메인을 확인한 출처 URL (앱 마켓 개발자 정보, 운영사 공지 등) */
  source?: string;
  /** 사람이 출처와 대조해 확인한 날짜 'YYYY-MM-DD' */
  verifiedAt?: string;
  /** true 이면 확인될 때까지 목록·확인기·구조화 데이터에서 뺀다 (점검 스크립트는 계속 확인) */
  hold?: boolean;
  /** 사람이 브라우저로 정상 확인했지만 자동 점검에는 오류를 주는 사이트 → '자동 확인 제한' 으로 표시 */
  autoCheckBlocked?: boolean;
};

// ok = 정상, restricted = 열리지만 자동 확인 차단(403 등), moved = 다른 도메인으로 이동, error = 연결 실패
export type CheckState = 'ok' | 'restricted' | 'moved' | 'error' | 'unknown';

export type CheckResult = {
  state: CheckState;
  code?: number;
  finalUrl?: string;
  ms?: number;
  /** 연속 실패 횟수 (점검 스크립트가 공개 여부 판단에 사용) */
  fails?: number;
};

export type LogEntry = { date: string; id: string; from: CheckState; to: CheckState; note?: string };

export const categories = categoriesJson as Category[];
// 보류(hold) 항목은 공개하지 않는다. 확인기도 이 목록만 '공식'으로 판정한다.
export const sites = (sitesJson as Site[]).filter((s) => !s.hold);
const status = statusJson as { checkedAt: string | null; results: Record<string, CheckResult> };
export const statusLog = (logJson as LogEntry[]).slice(0, 50);

export const checkedAt = status.checkedAt;

export function stateOf(id: string): CheckState {
  return status.results[id]?.state ?? 'unknown';
}

export function resultOf(id: string): CheckResult {
  return status.results[id] ?? { state: 'unknown' };
}

export function sitesIn(slug: string): Site[] {
  return sites.filter((s) => s.category === slug);
}

export function categoryOf(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function hostOf(url: string): string {
  return new URL(url).hostname;
}

export function displayHost(url: string): string {
  return hostOf(url).replace(/^www\./, '');
}

export const STATE_LABEL: Record<CheckState, string> = {
  ok: '정상',
  restricted: '열림 (자동 확인 제한)',
  moved: '주소 이동',
  error: '연결 안 됨',
  unknown: '점검 전',
};

export function stateCounts() {
  const counts: Record<CheckState, number> = { ok: 0, restricted: 0, moved: 0, error: 0, unknown: 0 };
  for (const s of sites) counts[stateOf(s.id)]++;
  return counts;
}

// 'YYYY-MM-DD' (한국 시간)
export function kstDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// 클라이언트 검색·즐겨찾기·확인기가 쓰는 최소 데이터
export function clientIndex() {
  return sites.map((s) => ({
    id: s.id,
    n: s.name,
    u: s.url,
    d: s.domain,
    h: hostOf(s.url),
    c: s.category,
    a: s.aliases,
    ...(s.altDomains?.length ? { x: s.altDomains } : {}),
    st: stateOf(s.id),
  }));
}
