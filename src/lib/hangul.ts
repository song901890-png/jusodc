const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** '네이버' → 'ㄴㅇㅂ'. 한글 음절이 아닌 글자는 그대로 둔다. */
export function choseong(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    out += code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }
  return out;
}

/** 검색어가 초성으로만 이뤄졌는지 */
export function isChoseongQuery(q: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(q);
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}
