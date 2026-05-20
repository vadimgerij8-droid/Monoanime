String.prototype.hashCode = function () {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
        hash = ((hash << 5) - hash) + this.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

function safeQuery(selector, parent = document) {
    try { return parent.querySelector(selector); } catch (e) { return null; }
}

function safeQueryAll(selector, parent = document) {
    try { return Array.from(parent.querySelectorAll(selector)); } catch (e) { return []; }
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function applyTheme(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    const current = localStorage.getItem('mono_anime_theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mono_anime_theme', next);
    applyTheme(next);
}

window.debounce = debounce;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.safeQuery = safeQuery;
window.safeQueryAll = safeQueryAll;
