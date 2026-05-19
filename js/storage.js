// js/storage.js — localStorage (fallback для незалогінених користувачів)

const Storage = {
    getBookmarks() {
        try { return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]'); }
        catch { return []; }
    },
    saveBookmarks(arr) {
        localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr));
    },
    getHistory() {
        try { return JSON.parse(localStorage.getItem('mono_anime_history') || '[]'); }
        catch { return []; }
    },
    addHistory(anime) {
        if (!anime || !anime.mal_id) return;
        const hist = this.getHistory().filter(h => h.mal_id !== anime.mal_id);
        hist.unshift({
            mal_id: anime.mal_id,
            title: anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url: anime.url || '',
            score: anime.score,
            year: anime.year,
            timestamp: Date.now()
        });
        localStorage.setItem('mono_anime_history', JSON.stringify(hist.slice(0, 50)));
    },
    clearHistory() {
        localStorage.setItem('mono_anime_history', '[]');
    },
    getTheme() {
        return localStorage.getItem('mono_anime_theme') || 'light';
    },
    setTheme(theme) {
        localStorage.setItem('mono_anime_theme', theme);
    }
};

// ─── Badge ────────────────────────────────────────────────────────────────────
async function updateBadge() {
    const badge = document.getElementById('bookmarkBadge');
    if (!badge) return;

    let count = 0;
    if (window.currentUser) {
        try {
            const { cloudGetBookmarks } = await import('./auth.js');
            const bm = await cloudGetBookmarks();
            count = bm.length;
        } catch {
            count = Storage.getBookmarks().length;
        }
    } else {
        count = Storage.getBookmarks().length;
    }

    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// ─── Theme ────────────────────────────────────────────────────────────────────
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
    const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
    applyTheme(next);
}
