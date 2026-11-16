// 링크디시 클라이언트 스크립트: 검색, 즐겨찾기·최근 방문, 분야 탭, 공식 주소 확인기, 홈 화면 추가, 서비스 워커
import { choseong, isChoseongQuery, normalize } from '../lib/hangul';
import { check, type IndexItem } from '../lib/checker';

type Item = IndexItem & { a: string[]; st: string };

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const INDEX: Item[] = (() => {
  try {
    return JSON.parse($('#site-index')?.textContent ?? '[]');
  } catch {
    return [];
  }
})();
const byId = new Map(INDEX.map((s) => [s.id, s]));

/* ---------- 저장소 (사생활 보호 모드 등에서 실패해도 동작) ---------- */
const KEY = { pins: 'jdc:pins', recent: 'jdc:recent', visits: 'jdc:visits', sheet: 'jdc:sheet-dismissed' };
const RECENT_MAX = 12;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 불가 — 무시 */
  }
}

let pins: string[] = load<string[]>(KEY.pins, []).filter((id) => byId.has(id));
let recent: string[] = load<string[]>(KEY.recent, []).filter((id) => byId.has(id));

/* ---------- 즐겨찾기·최근 방문 ---------- */
function syncPinButtons() {
  for (const b of $$<HTMLButtonElement>('[data-pin]')) {
    const on = pins.includes(b.dataset.pin!);
    b.setAttribute('aria-pressed', String(on));
    const name = byId.get(b.dataset.pin!)?.n ?? '';
    b.setAttribute('aria-label', on ? `${name} 즐겨찾기 해제` : `${name} 즐겨찾기에 고정`);
  }
}

function cardFor(id: string): HTMLLIElement | null {
  const src = $<HTMLLIElement>(`#all li.card[data-id="${CSS.escape(id)}"]`) ?? $<HTMLLIElement>(`li.card[data-id="${CSS.escape(id)}"]`);
  if (src) return src.cloneNode(true) as HTMLLIElement;
  const s = byId.get(id);
  if (!s) return null;
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.id = id;
  const a = document.createElement('a');
  a.href = s.u;
  a.target = '_blank';
  a.rel = 'nofollow noopener';
  a.dataset.visit = id;
  const fav = Object.assign(document.createElement('span'), { className: 'fav', textContent: s.n.slice(0, 1) });
  fav.setAttribute('aria-hidden', 'true');
  a.append(
    fav,
    Object.assign(document.createElement('span'), { className: 'name', textContent: s.n }),
    Object.assign(document.createElement('span'), { className: 'host', textContent: s.h.replace(/^www\./, '') }),
  );
  const pin = document.createElement('button');
  pin.className = 'pin';
  pin.type = 'button';
  pin.dataset.pin = id;
  pin.textContent = '★';
  li.append(a, pin);
  return li;
}

function renderMine() {
  const list = $<HTMLUListElement>('[data-mine-list]');
  if (!list) return;
  const ids = [...pins, ...recent.filter((id) => !pins.includes(id))].slice(0, pins.length + RECENT_MAX);
  list.replaceChildren(...ids.map(cardFor).filter((x): x is HTMLLIElement => !!x));
  const empty = $('[data-mine-empty]');
  if (empty) empty.hidden = ids.length > 0;
  syncPinButtons();
}

function togglePin(id: string) {
  pins = pins.includes(id) ? pins.filter((p) => p !== id) : [id, ...pins];
  save(KEY.pins, pins);
  renderMine();
  maybeShowSheet();
}

function recordVisit(id: string) {
  if (!byId.has(id)) return;
  recent = [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_MAX);
  save(KEY.recent, recent);
  // 새 탭으로 열리므로 돌아왔을 때 목록이 갱신돼 있도록 약간 늦춘다
  setTimeout(renderMine, 300);
}

document.addEventListener('click', (e) => {
  const t = e.target as Element;
  const pinBtn = t.closest<HTMLButtonElement>('[data-pin]');
  if (pinBtn) {
    e.preventDefault();
    togglePin(pinBtn.dataset.pin!);
    return;
  }
  const visit = t.closest<HTMLAnchorElement>('[data-visit]');
  if (visit) recordVisit(visit.dataset.visit!);
});
document.addEventListener('auxclick', (e) => {
  const visit = (e.target as Element).closest<HTMLAnchorElement>('[data-visit]');
  if (visit && e.button === 1) recordVisit(visit.dataset.visit!);
});

/* ---------- 홈 분야 탭 (자바스크립트가 없으면 허브 페이지로 이동) ---------- */
function initTabs() {
  const tabs = $$<HTMLAnchorElement>('[data-tabs] a[data-tab]');
  if (!tabs.length) return;
  const sections = $$<HTMLElement>('[data-section]');

  const select = (key: string, scroll: boolean) => {
    for (const a of tabs) {
      if (a.dataset.tab === key) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    for (const s of sections) {
      const k = s.dataset.section!;
      s.hidden = key === 'all' ? false : k !== key;
    }
    if (scroll) {
      const nav = $('.tabs');
      if (nav && nav.getBoundingClientRect().top > 60) return;
      nav?.scrollIntoView({ block: 'start' });
    }
  };

  for (const a of tabs) {
    a.addEventListener('click', (e) => {
      const key = a.dataset.tab!;
      if (key !== 'all' && key !== 'mine' && !$(`[data-section="${CSS.escape(key)}"]`)) return;
      e.preventDefault();
      select(key, true);
      a.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }
}

/* ---------- 상단 검색 (초성 지원) ---------- */
function score(s: Item, q: string): number {
  const name = normalize(s.n);
  if (isChoseongQuery(q)) {
    const cho = choseong(name);
    return cho.startsWith(q) ? 3 : cho.includes(q) ? 1 : 0;
  }
  if (name === q) return 10;
  if (name.startsWith(q)) return 8;
  const host = s.h.replace(/^www\./, '');
  if (host.startsWith(q) || s.d.startsWith(q)) return 7;
  if (s.a.some((a) => normalize(a).startsWith(q))) return 6;
  if (name.includes(q)) return 5;
  if (host.includes(q) || s.a.some((a) => normalize(a).includes(q))) return 3;
  // 한글 일부 + 초성 섞인 입력 (예: '네ㅇ')
  if (choseong(name).startsWith(choseong(q))) return 2;
  return 0;
}

function initSearch() {
  const input = $<HTMLInputElement>('#q');
  const box = $<HTMLUListElement>('#q-results');
  if (!input || !box) return;
  let active = -1;

  const options = () => $$<HTMLAnchorElement>('a[role="option"]', box);
  const close = () => {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const setActive = (i: number) => {
    const opts = options();
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };

  const render = () => {
    const q = normalize(input.value);
    if (!q) return close();
    const hits = INDEX.map((s) => ({ s, sc: score(s, q) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 8);
    if (!hits.length) {
      const li = document.createElement('li');
      li.className = 'muted small';
      li.style.padding = '8px 10px';
      li.textContent = '등록된 사이트가 없습니다. 받은 링크라면 공식 주소 확인기를 써 보세요.';
      box.replaceChildren(li);
    } else {
      box.replaceChildren(
        ...hits.map(({ s }, i) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.id = `q-opt-${i}`;
          a.setAttribute('role', 'option');
          a.setAttribute('aria-selected', 'false');
          a.href = s.u;
          a.target = '_blank';
          a.rel = 'nofollow noopener';
          a.dataset.visit = s.id;
          a.append(
            Object.assign(document.createElement('span'), { textContent: s.n }),
            Object.assign(document.createElement('span'), { className: 'host', textContent: s.h.replace(/^www\./, '') }),
          );
          li.append(a);
          return li;
        }),
      );
    }
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', () => input.value && render());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Enter') {
      const opts = options();
      const target = opts[active] ?? opts[0];
      if (target) {
        e.preventDefault();
        target.click();
        close();
      }
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.search')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
}

/* ---------- 공식 주소 확인기 ---------- */
function initChecker() {
  for (const form of $$<HTMLFormElement>('form[data-checker]')) {
    const input = $<HTMLInputElement>('input', form)!;
    const out = $<HTMLDivElement>('.verdict', form)!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = check(input.value, INDEX);
      const el = (tag: string, text: string) => Object.assign(document.createElement(tag), { textContent: text });
      const nodes: Node[] = [];
      out.className = 'verdict';
      if (v.kind === 'invalid') {
        out.classList.add('warn');
        nodes.push(el('strong', '주소를 다시 확인해 주세요'), el('p', v.message));
      } else if (v.kind === 'official') {
        out.classList.add(v.warnings.length ? 'warn' : 'ok');
        nodes.push(el('strong', `✓ ${v.site.n} 공식 주소와 일치합니다`), el('p', `${v.host} 는 ${v.site.n}의 공식 도메인 ${v.domain} 에 속합니다.`));
      } else if (v.kind === 'lookalike') {
        out.classList.add('bad');
        nodes.push(el('strong', `⚠ 가짜 의심 — ${v.site.n} 공식 주소가 아닙니다`), el('p', `${v.host}: ${v.reason}`));
        const p = document.createElement('p');
        const a = Object.assign(document.createElement('a'), { href: v.site.u, textContent: `${v.site.n} 공식 주소(${v.site.d})로 이동` });
        a.target = '_blank';
        a.rel = 'nofollow noopener';
        a.dataset.visit = v.site.id;
        p.append(a);
        nodes.push(p);
      } else {
        out.classList.add('warn');
        nodes.push(
          el('strong', '목록에 없는 주소입니다'),
          el('p', `${v.host} 는 등록된 공식 도메인이 아닙니다. 보낸 곳이 확실하지 않다면 열지 마세요.`),
        );
      }
      if (v.kind !== 'invalid' && v.warnings.length) {
        const ul = document.createElement('ul');
        ul.append(...v.warnings.map((w) => el('li', w)));
        nodes.push(ul);
      }
      out.replaceChildren(...nodes);
      out.hidden = false;
    });
  }
}

/* ---------- 홈 화면 추가 · 북마크 안내 ---------- */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null;
const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
let sheetShown = false;

function openSheet() {
  const sheet = $('#install-sheet');
  const text = $('#install-sheet-text');
  const installBtn = $<HTMLButtonElement>('[data-sheet-install]');
  if (!sheet || !text || !installBtn) return;
  if (deferred) {
    text.textContent = '링크디시를 홈 화면에 추가하면 앱처럼 한 번에 열 수 있어요.';
    installBtn.hidden = false;
  } else if (isIOS()) {
    text.textContent = '사파리 아래쪽의 공유 버튼(□↑)을 누른 뒤 “홈 화면에 추가”를 선택하세요.';
    installBtn.hidden = true;
  } else if (isMobile()) {
    text.textContent = '브라우저 메뉴(⋮)에서 “홈 화면에 추가”를 선택하세요.';
    installBtn.hidden = true;
  } else {
    const mac = /mac/i.test(navigator.platform);
    text.textContent = `${mac ? '⌘+D' : 'Ctrl+D'}를 누르면 이 주소모음을 북마크할 수 있어요. 브라우저 시작 페이지로 지정해도 좋아요.`;
    installBtn.hidden = true;
  }
  sheet.hidden = false;
  sheetShown = true;
}

function closeSheet() {
  const sheet = $('#install-sheet');
  if (sheet) sheet.hidden = true;
  save(KEY.sheet, true);
}

function maybeShowSheet() {
  if (sheetShown || standalone() || load(KEY.sheet, false)) return;
  const visits = load<number>(KEY.visits, 0);
  if (visits >= 2 || pins.length >= 3) setTimeout(openSheet, 4000);
}

function initInstall() {
  const btn = $<HTMLButtonElement>('#install');
  if (standalone()) {
    if (btn) btn.hidden = true;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (btn) btn.hidden = true;
    closeSheet();
  });
  btn?.addEventListener('click', async () => {
    if (deferred) {
      await deferred.prompt();
      deferred = null;
    } else {
      openSheet();
    }
  });
  $('[data-sheet-close]')?.addEventListener('click', closeSheet);
  $('[data-sheet-install]')?.addEventListener('click', async () => {
    if (deferred) {
      await deferred.prompt();
      deferred = null;
    }
    closeSheet();
  });

  // 세션당 한 번만 방문 수를 센다
  let counted = false;
  try {
    counted = sessionStorage.getItem('jdc:counted') === '1';
    sessionStorage.setItem('jdc:counted', '1');
  } catch {
    /* 무시 */
  }
  if (!counted) save(KEY.visits, load<number>(KEY.visits, 0) + 1);
  maybeShowSheet();
}

/* ---------- 서비스 워커 ---------- */
function initSW() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

renderMine();
syncPinButtons();
initTabs();
initSearch();
initChecker();
initInstall();
initSW();
