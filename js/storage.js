const BOOKMARKS_KEY = 'mono_anime_bookmarks';
const HISTORY_KEY = 'mono_anime_history';
const THEME_KEY = 'mono_anime_theme';

export const Storage = {
    getBookmarks() {
        try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
    },
    saveBookmarks(arr) {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(arr));
    },
    getHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
    },
    addHistory(anime) {
        if (!anime || !anime.mal_id) return;
        const hist = this.getHistory().filter(h => h.mal_id !== anime.mal_id);
        hist.unshift({
            mal_id: anime.mal_id, title: anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url: anime.url || '', score: anime.score, year: anime.year, timestamp: Date.now()
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
    },
    clearHistory() {
        localStorage.setItem(HISTORY_KEY, '[]');
    },
    getTheme() {
        return localStorage.getItem(THEME_KEY) || 'light';
    },
    setTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
    }
};
