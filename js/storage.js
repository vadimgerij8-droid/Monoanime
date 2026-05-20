import {
  cloudGetBookmarks, cloudSaveBookmarks, cloudAddBookmark, cloudRemoveBookmark,
  cloudGetHistory, cloudAddHistory, cloudClearHistory,
  cloudGetProgress, cloudSaveProgress
} from './auth.js';

const Storage = {
  _bookmarksCache: { data: null, timestamp: 0, ttl: 60000 },
  _historyCache: { data: null, timestamp: 0, ttl: 60000 },
  _progressCache: new Map(),

  async getBookmarks() {
    const now = Date.now();
    if (this._bookmarksCache.data && (now - this._bookmarksCache.timestamp) < this._bookmarksCache.ttl) {
      return this._bookmarksCache.data;
    }
    let data;
    if (window.currentUser) {
      data = await cloudGetBookmarks();
    } else {
      data = JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]');
    }
    this._bookmarksCache.data = data;
    this._bookmarksCache.timestamp = now;
    return data;
  },

  async saveBookmarks(arr) {
    this._bookmarksCache.data = null;
    if (window.currentUser) {
      await cloudSaveBookmarks(arr);
    } else {
      localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr));
    }
  },

  async addBookmark(anime) {
    this._bookmarksCache.data = null;
    if (window.currentUser) {
      await cloudAddBookmark(anime);
    } else {
      const bookmarks = await this.getBookmarks();
      if (!bookmarks.some(b => b.mal_id === anime.mal_id)) {
        bookmarks.push(anime);
        localStorage.setItem('mono_anime_bookmarks', JSON.stringify(bookmarks));
      }
    }
  },

  async removeBookmark(mal_id) {
    this._bookmarksCache.data = null;
    if (window.currentUser) {
      await cloudRemoveBookmark(mal_id);
    } else {
      let bookmarks = await this.getBookmarks();
      bookmarks = bookmarks.filter(b => b.mal_id !== mal_id);
      localStorage.setItem('mono_anime_bookmarks', JSON.stringify(bookmarks));
    }
  },

  async getHistory() {
    const now = Date.now();
    if (this._historyCache.data && (now - this._historyCache.timestamp) < this._historyCache.ttl) {
      return this._historyCache.data;
    }
    let data;
    if (window.currentUser) {
      data = await cloudGetHistory();
    } else {
      data = JSON.parse(localStorage.getItem('mono_anime_history') || '[]');
    }
    this._historyCache.data = data;
    this._historyCache.timestamp = now;
    return data;
  },

  async addHistory(anime) {
    this._historyCache.data = null;
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
    this._historyCache.data = null;
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
  },

  async getProgressCached(mal_id) {
    const now = Date.now();
    const cached = this._progressCache.get(mal_id);
    if (cached && (now - cached.timestamp) < 30000) {
      return cached.data;
    }
    const data = await cloudGetProgress(mal_id);
    this._progressCache.set(mal_id, { data, timestamp: now });
    return data;
  },

  async saveProgress(mal_id, season, dub, episode) {
    this._progressCache.delete(mal_id);
    await cloudSaveProgress(mal_id, season, dub, episode);
  },

  clearProgressCache(mal_id) {
    this._progressCache.delete(mal_id);
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
