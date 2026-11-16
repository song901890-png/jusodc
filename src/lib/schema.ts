// JSON-LD 생성 도우미. 화면에 보이는 내용과 같은 것만 넣는다.
import { SITE } from '../config';
import type { Site } from './data';

const abs = (path: string) => new URL(path, SITE.url).href;

export const ORG_ID = `${SITE.url}/#org`;
export const WEBSITE_ID = `${SITE.url}/#website`;

export function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: SITE.nameEn,
    url: `${SITE.url}/`,
    logo: abs('/icon-512.png'),
    email: SITE.email,
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    alternateName: [SITE.nameEn, SITE.domain],
    url: `${SITE.url}/`,
    inLanguage: 'ko-KR',
    publisher: { '@id': ORG_ID },
  };
}

export function itemList(list: Site[], name: string) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: list.length,
    itemListElement: list.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: s.url,
    })),
  };
}

export function collectionPage(opts: {
  path: string;
  name: string;
  description: string;
  list: Site[];
  dateModified?: string | null;
}) {
  return {
    '@type': 'CollectionPage',
    '@id': `${abs(opts.path)}#page`,
    url: abs(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: 'ko-KR',
    isPartOf: { '@id': WEBSITE_ID },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    mainEntity: itemList(opts.list, opts.name),
  };
}

export function webPage(opts: { path: string; name: string; description: string; type?: string }) {
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${abs(opts.path)}#page`,
    url: abs(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: 'ko-KR',
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function article(opts: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    '@type': 'Article',
    '@id': `${abs(opts.path)}#article`,
    mainEntityOfPage: abs(opts.path),
    headline: opts.headline,
    description: opts.description,
    inLanguage: 'ko-KR',
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    image: abs('/og.png'),
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
