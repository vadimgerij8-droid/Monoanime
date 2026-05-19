String.prototype.hashCode = function () {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    hash = ((hash << 5) - hash) + this.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export function safeQuery(selector, parent = document) {
  try { return parent.querySelector(selector); } catch (e) { return null; }
}

export function safeQueryAll(selector, parent = document) {
  try { return Array.from(parent.querySelectorAll(selector)); } catch (e) { return []; }
}

export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
