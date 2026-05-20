import {
  cloudGetBookmarks, cloudSaveBookmarks, cloudAddBookmark, cloudRemoveBookmark,
  cloudGetHistory, cloudAddHistory, cloudClearHistory,
  cloudGetProgress, cloudSaveProgress
} from './auth.js';

const Storage = {
  async getBookmarks() {
    if (window.currentUser) {
      return await cloudGetBookmarks();
    }
    return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]');
  },

  async saveBookmarks(arr) {
    if (window.currentUser) {
      await cloudSaveBookmarks(arr);
    } else {
      localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr));
    }
  },

  async getHistory() {
    if (window.currentUser) {
      return await cloudGetHistory();
    }
    return JSON.parse(localStorage.getItem('mono_anime_history') || '[]');
  },

  async addHistory(anime) {
    if (!anime || !anime.mal_id) return;
    if (window.currentUser) {
      await cloudAddHistory(anime);
      return;
    }
    const hist = await this.getHistory();
    const filtered = hist.filter(h => h.mal_id !== anime.mal_id);
    filtered.unshift({
      mal_id: anime.mal_id,
      title: anime.title,
      image_url: anime.images?.jpg?.large_image_url || '',
      url: anime.url || '',
      score: anime.score,
      year: anime.year,
      timestamp: Date.now()
    });
    localStorage.setItem('mono_anime_history', JSON.stringify(filtered.slice(0, 50)));
  },

  async clearHistory() {
    if (window.currentUser) {
      await cloudClearHistory();
    } else {
      localStorage.setItem('mono_anime_history', '[]');
    }
  },

  getTheme() {
    return localStorage.getItem('mono_anime_theme') || 'light';
  },

  setTheme(theme) {
    localStorage.setItem('mono_anime_theme', theme);
  }
};

// Глобальне оновлення бейджа (async)
window.updateBadge = async () => {
  const badge = document.getElementById('bookmarkBadge');
  if (!badge) return;
  const bookmarks = await Storage.getBookmarks();
  const count = bookmarks.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
};

export default Storage;
