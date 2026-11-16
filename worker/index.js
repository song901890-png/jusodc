// 정식 주소 https://jusodc.com/.../ 로 한 번에 301 리다이렉트한 뒤, 나머지는 정적 파일(dist)로 응답한다.
//  - http → https
//  - www.jusodc.com → jusodc.com
//  - /about → /about/ (확장자 없는 경로는 트레일링 슬래시, astro trailingSlash: 'always' 와 일치)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let changed = false;

    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      changed = true;
    }
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      changed = true;
    }
    const last = url.pathname.split('/').pop();
    if (last && !last.includes('.')) {
      url.pathname += '/';
      changed = true;
    }

    if (changed) return Response.redirect(url.toString(), 301);
    return env.ASSETS.fetch(request);
  },
};
