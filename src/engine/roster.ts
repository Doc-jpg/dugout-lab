/** Turn a pasted roster line into a player. Handles "12 Owen Tate", "#12 Owen Tate", "Owen Tate", "Tate, Owen", "100 Joe", "Owen Tate 12". */
export function parseRosterLine(line: string): { number?: string; firstName: string; lastName: string } | null {
  let t = line.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  let number: string | undefined;
  let m = /^#?(\d{1,3})\b\s*(.*)$/.exec(t);
  if (m) {
    number = m[1];
    t = m[2].trim();
  } else {
    m = /^(.*?)\s+#?(\d{1,3})$/.exec(t);
    if (m) {
      t = m[1].trim();
      number = m[2];
    }
  }
  if (!t) return null;
  if (t.includes(',')) {
    const [last, first] = t.split(',').map((x) => x.trim());
    return { number, firstName: first || last, lastName: first ? last : '' };
  }
  const parts = t.split(' ');
  return { number, firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : '' };
}

export function parseRoster(text: string) {
  return text.split('\n').map(parseRosterLine).filter((x): x is NonNullable<typeof x> => !!x);
}
