/**
 * Word wrapping for monospaced screenplay text.
 *
 * Returns line ranges into the original string so callers can map inline
 * formatting back onto each line. Breaks only at spaces; the spaces at a break
 * are dropped; trailing spaces never count towards the width; a "\n" (soft
 * return) forces a break; a word longer than the line is broken hard.
 */
export interface LineRange {
  start: number;
  end: number;
}

export function wrap(text: string, width: number): LineRange[] {
  const out: LineRange[] = [];
  const w = Math.max(1, width);
  let paraStart = 0;
  for (;;) {
    const nl = text.indexOf('\n', paraStart);
    const paraEnd = nl < 0 ? text.length : nl;
    wrapSegment(text, paraStart, paraEnd, w, out);
    if (nl < 0) break;
    paraStart = nl + 1;
  }
  return out;
}

function wrapSegment(text: string, from: number, to: number, w: number, out: LineRange[]): void {
  let start = from;
  if (start >= to) {
    out.push({ start, end: start });
    return;
  }
  while (start < to) {
    // Visible end: ignore trailing spaces.
    let lineEnd = Math.min(start + w, to);
    if (trimEnd(text, start, to) - start <= w) {
      out.push({ start, end: trimEnd(text, start, to) });
      return;
    }
    // Find the last space at or before start + w (a space exactly at the width is a valid break).
    let brk = -1;
    for (let i = Math.min(start + w, to - 1); i > start; i--) {
      if (text[i] === ' ') {
        brk = i;
        break;
      }
    }
    if (brk < 0) {
      // Single word longer than the line: hard break.
      out.push({ start, end: lineEnd });
      start = lineEnd;
    } else {
      out.push({ start, end: trimEnd(text, start, brk) });
      start = brk;
      lineEnd = start;
    }
    while (start < to && text[start] === ' ') start++;
  }
}

function trimEnd(text: string, start: number, end: number): number {
  let e = end;
  while (e > start && text[e - 1] === ' ') e--;
  return e;
}

/**
 * Offsets just after each sentence end (".", "?" or "!", plus any closing
 * quotes/brackets) that is followed by a space. These are the places Fade In
 * will split a paragraph across pages when "break on sentences" is on.
 */
export function sentenceBreaks(text: string): number[] {
  const out: number[] = [];
  const re = /[.?!]+["'”’)\]]*(?= )/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m.index + m[0].length);
  return out;
}
