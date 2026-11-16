// sites.json 을 '한 사이트 한 줄, 분야 사이 빈 줄' 형식으로 직렬화한다 (사람이 고치기 쉽게).
export function formatSites(sites) {
  const val = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));
  const line = (s) => `  { ${Object.entries(s).map(([k, v]) => `${JSON.stringify(k)}: ${val(v)}`).join(', ')} }`;
  const out = [];
  sites.forEach((s, i) => {
    if (i > 0 && s.category !== sites[i - 1].category) out.push('');
    out.push(line(s) + (i < sites.length - 1 ? ',' : ''));
  });
  return `[\n${out.join('\n')}\n]\n`;
}
