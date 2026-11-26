/**
 * Small, dependency-free XML parser and serializer, sufficient for screenplay
 * formats (Open Screenplay Format, Final Draft FDX). Not a validating parser.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function encodeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function encodeAttr(s: string): string {
  return encodeText(s).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

export function parseXml(src: string): XmlElement {
  let i = 0;
  const root: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const top = () => stack[stack.length - 1];
  if (src.charCodeAt(0) === 0xfeff) i = 1;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      pushText(src.slice(i));
      break;
    }
    if (lt > i) pushText(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      top().children.push(src.slice(lt + 9, end < 0 ? src.length : end));
      i = end < 0 ? src.length : end + 3;
    } else if (src[lt + 1] === '?' || src[lt + 1] === '!') {
      const end = src.indexOf('>', lt);
      i = end < 0 ? src.length : end + 1;
    } else if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt);
      const name = src.slice(lt + 2, end).trim();
      // Pop to the matching element (tolerates minor nesting errors).
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      i = end + 1;
    } else {
      const m = /^<([^\s/>]+)/.exec(src.slice(lt, lt + 256));
      if (!m) throw new Error(`Malformed XML near offset ${lt}`);
      const el: XmlElement = { name: m[1], attrs: {}, children: [] };
      let j = lt + m[0].length;
      const attrRe = /\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?)>/y;
      for (;;) {
        attrRe.lastIndex = j;
        const a = attrRe.exec(src);
        if (!a) throw new Error(`Malformed XML attribute near offset ${j}`);
        j = attrRe.lastIndex;
        if (a[1] !== undefined) {
          el.attrs[a[1]] = decodeEntities(a[3] ?? a[4] ?? '');
        } else {
          top().children.push(el);
          if (a[5] !== '/') stack.push(el);
          break;
        }
      }
      i = j;
    }
  }
  const docEl = root.children.find((c): c is XmlElement => typeof c !== 'string');
  if (!docEl) throw new Error('XML has no root element');
  return docEl;

  function pushText(raw: string) {
    if (stack.length > 1) top().children.push(decodeEntities(raw));
  }
}

export function child(el: XmlElement | undefined, name: string): XmlElement | undefined {
  return el?.children.find((c): c is XmlElement => typeof c !== 'string' && c.name === name);
}
export function childrenNamed(el: XmlElement | undefined, name: string): XmlElement[] {
  return (el?.children ?? []).filter((c): c is XmlElement => typeof c !== 'string' && c.name === name);
}
export function elements(el: XmlElement | undefined): XmlElement[] {
  return (el?.children ?? []).filter((c): c is XmlElement => typeof c !== 'string');
}
export function textOf(el: XmlElement | undefined): string {
  if (!el) return '';
  return el.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}

export function serializeXml(el: XmlElement, indent = '', step = '  '): string {
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => ` ${k}="${encodeAttr(v)}"`)
    .join('');
  if (el.children.length === 0) return `${indent}<${el.name}${attrs}/>`;
  const onlyText = el.children.every((c) => typeof c === 'string');
  if (onlyText) return `${indent}<${el.name}${attrs}>${encodeText(el.children.join(''))}</${el.name}>`;
  const inner = el.children
    .map((c) => (typeof c === 'string' ? (c.trim() ? indent + step + encodeText(c) : '') : serializeXml(c, indent + step, step)))
    .filter(Boolean)
    .join('\n');
  return `${indent}<${el.name}${attrs}>\n${inner}\n${indent}</${el.name}>`;
}
