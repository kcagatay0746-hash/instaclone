// Minimal CSS selector engine for the test DOM (tag, .class, #id, [attr=v], :first/:last-child, >, space).

function parseCompound(str) {
  const out = { tag: null, classes: [], id: null, attrs: [], pseudos: [] };
  for (const m of str.matchAll(/([.#]?[\w-]+|\[[^\]]+\]|:[\w-]+)/g)) {
    const tok = m[0];
    if (tok.startsWith('.')) out.classes.push(tok.slice(1));
    else if (tok.startsWith('#')) out.id = tok.slice(1);
    else if (tok.startsWith('[')) {
      const body = tok.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq === -1) out.attrs.push({ name: body, value: null });
      else out.attrs.push({ name: body.slice(0, eq).trim(), value: body.slice(eq + 1).trim().replace(/^["']|["']$/g, '') });
    } else if (tok.startsWith(':')) out.pseudos.push(tok.slice(1));
    else out.tag = tok.toLowerCase();
  }
  return out;
}

function matchCompound(el, compound) {
  if (compound.tag && el.tagName !== compound.tag) return false;
  if (compound.id && el.id !== compound.id) return false;
  for (const c of compound.classes) if (!el.classList.contains(c)) return false;
  for (const a of compound.attrs) {
    const v = el.getAttribute(a.name);
    if (v === null) return false;
    if (a.value !== null && v !== a.value) return false;
  }
  for (const p of compound.pseudos) {
    const sibs = el.parent ? el.parent.children.filter((c) => c.tagName) : [el];
    if (p === 'last-child' && sibs[sibs.length - 1] !== el) return false;
    if (p === 'first-child' && sibs[0] !== el) return false;
  }
  return true;
}

// Splits a selector into tokens, keeping quoted attribute values intact
// (e.g. [aria-label="Sesli ara"] must stay a single token).
function tokenize(part) {
  const tokens = [];
  let cur = '';
  let inBracket = false;
  let quote = null;
  for (const ch of part.trim()) {
    if (inBracket) {
      cur += ch;
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ']') {
        inBracket = false;
      }
      continue;
    }
    if (ch === '[') {
      inBracket = true;
      cur += ch;
      continue;
    }
    if (ch === '>') {
      if (cur.trim()) tokens.push(cur.trim());
      cur = '';
      tokens.push('>');
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.trim()) {
        tokens.push(cur.trim());
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens;
}

function parseSelector(sel) {
  return sel.split(',').map((part) => {
    const tokens = tokenize(part);
    const steps = [];
    let combinator = null;
    for (const t of tokens) {
      if (t === '>') {
        combinator = '>';
        continue;
      }
      steps.push({ compound: parseCompound(t), combinator: combinator || ' ' });
      combinator = null;
    }
    return steps;
  });
}

export function matches(el, sel) {
  return parseSelector(sel).some((steps) => {
    if (!steps.length) return false;
    if (!matchCompound(el, steps[steps.length - 1].compound)) return false;
    let node = el;
    for (let i = steps.length - 1; i > 0; i--) {
      const step = steps[i];
      let parent = node.parent;
      if (step.combinator === '>') {
        if (!parent || !matchCompound(parent, steps[i - 1].compound)) return false;
        node = parent;
      } else {
        let found = null;
        while (parent) {
          if (matchCompound(parent, steps[i - 1].compound)) { found = parent; break; }
          parent = parent.parent;
        }
        if (!found) return false;
        node = found;
      }
    }
    return true;
  });
}

export class ClassList {
  constructor(el) { this.el = el; }
  get set() { return new Set((this.el.getAttribute('class') || '').split(/\s+/).filter(Boolean)); }
  write(set) { this.el.setAttribute('class', [...set].join(' ')); }
  add(...names) { const s = this.set; names.forEach((n) => s.add(n)); this.write(s); }
  remove(...names) { const s = this.set; names.forEach((n) => s.delete(n)); this.write(s); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const s = this.set;
    const on = force === undefined ? !s.has(name) : !!force;
    if (on) s.add(name); else s.delete(name);
    this.write(s);
    return on;
  }
  get length() { return this.set.size; }
}
