// Tiny DOM implementation used only by the UI smoke tests (no dependencies).
import { matches, ClassList } from './dom-selector.mjs';

export class Event {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
    this.defaultPrevented = false;
    this.target = init.target || null;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
}

class Node {
  constructor() {
    this.parent = null;
    this.children = [];
  }
  get childNodes() { return this.children; }
  get parentElement() { return this.parent && this.parent.tagName ? this.parent : null; }
  get firstElementChild() { return this.children.find((c) => c.tagName) || null; }
  get lastElementChild() { return [...this.children].reverse().find((c) => c.tagName) || null; }
  append(...nodes) {
    for (const n of nodes.flat(Infinity)) {
      const node = n instanceof Node ? n : new TextNode(String(n));
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }
  appendChild(n) { this.append(n); return n; }
  prepend(...nodes) {
    for (const n of nodes.reverse()) {
      const node = n instanceof Node ? n : new TextNode(String(n));
      node.parent = this;
      this.children.unshift(node);
    }
  }
  replaceChildren(...nodes) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
  }
  contains(n) {
    let cur = n;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parent;
    }
    return false;
  }
  *walk() {
    for (const c of this.children) {
      if (c.tagName) {
        yield c;
        yield* c.walk();
      }
    }
  }
  querySelectorAll(sel) {
    const out = [];
    for (const el of this.walk()) if (matches(el, sel)) out.push(el);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  addEventListener(type, fn) {
    this._listeners ||= {};
    (this._listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    if (!this._listeners || !this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
  }
  dispatchEvent(evt) {
    evt.target ||= this;
    let node = this;
    while (node) {
      for (const fn of (node._listeners && node._listeners[evt.type]) || []) fn(evt);
      node = node.parent;
    }
    return !evt.defaultPrevented;
  }
  click() { this.dispatchEvent(new Event('click', { target: this })); }
}

class TextNode extends Node {
  constructor(text) {
    super();
    this.text = String(text);
  }
  get textContent() { return this.text; }
  set textContent(v) { this.text = String(v); }
}

class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = String(tag).toLowerCase();
    this.attributes = new Map();
    this.classList = new ClassList(this);
    this.style = {};
    this._innerHTML = '';
    this.value = '';
    this.disabled = false;
    this.dataset = new Proxy({}, {
      get: (_, k) => this.getAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ?? undefined,
      set: (_, k, v) => {
        this.setAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, String(v));
        return true;
      },
    });
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = String(v); this.children = []; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'value') this.value = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.replaceChildren(new TextNode(v)); }
  get offsetWidth() { return 200; }
  get offsetHeight() { return 120; }
  getBoundingClientRect() { return { top: 10, left: 10, right: 210, bottom: 130, width: 200, height: 120 }; }
  closest(sel) {
    let node = this;
    while (node) {
      if (node.tagName && matches(node, sel)) return node;
      node = node.parent;
    }
    return null;
  }
  matches(sel) { return matches(this, sel); }
  focus() { this.ownerDocument.activeElement = this; }
  select() {}
  set scrollTop(v) { this._scrollTop = v; }
  get scrollTop() { return this._scrollTop || 0; }
  get scrollHeight() { return 500; }
}

class Document extends Node {
  constructor() {
    super();
    this.documentElement = new Element('html');
    this.head = new Element('head');
    this.body = new Element('body');
    this.body.parent = this.documentElement;
    this.documentElement.append(this.head, this.body);
    this.activeElement = null;
  }
  createElement(tag) { const el = new Element(tag); el.ownerDocument = this; return el; }
  createTextNode(text) { const t = new TextNode(text); t.ownerDocument = this; return t; }
  createDocumentFragment() { const f = new Element('#fragment'); f.ownerDocument = this; return f; }
  getElementById(id) {
    for (const el of this.body.walk()) if (el.id === id) return el;
    return null;
  }
  querySelector(sel) {
    return this.body.querySelector(sel) || (matches(this.documentElement, sel) ? this.documentElement : null);
  }
  querySelectorAll(sel) {
    const out = this.body.querySelectorAll(sel);
    if (matches(this.documentElement, sel)) out.unshift(this.documentElement);
    return out;
  }
}

export { Node, Element, TextNode };

export function installDom(globals) {
  const document = new Document();
  const location = { hash: '#/feed', origin: 'http://localhost:3000', replace(h) { this.hash = h; } };
  const listeners = {};
  const window = {
    document,
    location,
    localStorage: globals.localStorage,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    dispatchEvent(evt) {
      evt.target ||= window;
      for (const fn of listeners[evt.type] || []) fn(evt);
      return true;
    },
    innerWidth: 1280,
    innerHeight: 900,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    Event,
    HashChangeEvent: Event,
  };
  Object.assign(globals, {
    document,
    window,
    location,
    getComputedStyle: () => ({ width: '0px', height: '0px', getPropertyValue: () => '' }),
    Image: class {
      constructor() { this.complete = true; this.width = 800; this.height = 800; }
      set src(v) { this._src = v; }
      get src() { return this._src; }
      decode() { return Promise.resolve(); }
      addEventListener() {}
    },
    URL: Object.assign(Object.create(URL), { createObjectURL: () => 'blob:preview', revokeObjectURL() {} }),
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    EventSource: class {
      constructor() { this.listeners = {}; }
      addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
      close() {}
    },
    Node,
    Element,
    TextNode,
    HashChangeEvent: Event,
    Event,
    requestAnimationFrame: window.requestAnimationFrame,
    console,
  });
  return { document, window };
}

