import {
  cloudGetBookmarks, cloudSaveBookmarks,
  cloudAddHistory, cloudClearHistory,
  cloudGetProgress, cloudSaveProgress
} from './auth.js';

const KEYS = {
  bookmarks: 'mono_anime_bookmarks',
  history:   'mono_anime_history',
  theme:     'mono_anime_theme',
};

const Storage = {

  // --- BOOKMARKS ---
  async getBookmarks() {
    const local = JSON.parse(localStorage.getItem(KEYS.bookmarks) || '[]');
    if (window.currentUser && local.length === 0) {
      // Якщо локально порожньо — спробуємо хмару один раз
      try {
        const cloud = await Promise.race([
          cloudGetBookmarks(),
          new Promise(r => setTimeout(() => r([]), 4000))
        ]);
        if (cloud.length) {
          localStorage.setItem(KEYS.bookmarks, JSON.stringify(cloud));
          return cloud;
        }
      } catch(e) { console.warn('getBookmarks cloud error', e); }
    }
    return local;
  },

  async addBookmark(anime) {
    const bm = JSON.parse(localStorage.getItem(KEYS.bookmarks) || '[]');
    if (bm.some(b => b.mal_id === anime.mal_id)) return;
    const entry = {
      mal_id: anime.mal_id, title: anime.title || '',
      url: anime.url || '',
      image_url: anime.images?.jpg?.large_image_url || '',
      score: anime.score ?? null, year: anime.year ?? null,
    };
    bm.unshift(entry);
    localStorage.setItem(KEYS.bookmarks, JSON.stringify(bm));
    if (window.currentUser) cloudSaveBookmarks(bm).catch(console.warn);
  },

  async removeBookmark(malId) {
    const bm = JSON.parse(localStorage.getItem(KEYS.bookmarks) || '[]');
    const updated = bm.filter(b => b.mal_id !== malId);
    localStorage.setItem(KEYS.bookmarks, JSON.stringify(updated));
    if (window.currentUser) cloudSaveBookmarks(updated).catch(console.warn);
  },

  // --- HISTORY ---
  async getHistory() {
    return JSON.parse(localStorage.getItem(KEYS.history) || '[]');
  },

  async addHistory(anime) {
    if (!anime?.mal_id) return;
    const hist = JSON.parse(localStorage.getItem(KEYS.history) || '[]');
    const filtered = hist.filter(h => h.mal_id !== anime.mal_id);
    filtered.unshift({
      mal_id: anime.mal_id, title: anime.title || '',
      image_url: anime.images?.jpg?.large_image_url || '',
      url: anime.url || '', score: anime.score ?? null,
      year: anime.year ?? null, timestamp: Date.now()
    });
    const newHist = filtered.slice(0, 50);
    localStorage.setItem(KEYS.history, JSON.stringify(newHist));
    // фонова синхронізація
    if (window.currentUser) cloudAddHistory(anime).catch(console.warn);
  },

  async clearHistory() {
    localStorage.setItem(KEYS.history, '[]');
    if (window.currentUser) cloudClearHistory().catch(console.warn);
  },

  // --- THEME ---
  getTheme() { return localStorage.getItem(KEYS.theme) || 'light'; },
  setTheme(theme) { localStorage.setItem(KEYS.theme, theme); }
};

window.updateBadge = async () => {
  const badge = document.getElementById('bookmarkBadge');
  if (!badge) return;
  const bm = await Storage.getBookmarks();
  badge.textContent = bm.length;
  badge.style.display = bm.length > 0 ? 'flex' : 'none';
};

export default Storage;
