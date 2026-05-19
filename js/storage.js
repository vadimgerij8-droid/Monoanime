const Storage = {
    getBookmarksLocal() {
        try { return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]'); } catch { return []; }
    },
    saveBookmarksLocal(arr) {
        localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr));
    },

    async getBookmarks() {
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            const snap = await getDoc(ref);
            if (snap.exists() && snap.data().bookmarks) {
                return snap.data().bookmarks;
            }
            return [];
        }
        return this.getBookmarksLocal();
    },

    async saveBookmarks(arr) {
        this.saveBookmarksLocal(arr);
        updateBadge();
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            await setDoc(ref, { bookmarks: arr }, { merge: true });
        }
    },

    getHistoryLocal() {
        try { return JSON.parse(localStorage.getItem('mono_anime_history') || '[]'); } catch { return []; }
    },
    saveHistoryLocal(arr) {
        localStorage.setItem('mono_anime_history', JSON.stringify(arr));
    },

    async getHistory() {
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            const snap = await getDoc(ref);
            if (snap.exists() && snap.data().history) {
                return snap.data().history;
            }
            return [];
        }
        return this.getHistoryLocal();
    },

    async addHistory(anime) {
        if (!anime || !anime.mal_id) return;
        const historyItem = {
            mal_id: anime.mal_id,
            title: anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url: anime.url || '',
            score: anime.score,
            year: anime.year,
            timestamp: Date.now()
        };
        const local = this.getHistoryLocal().filter(h => h.mal_id !== anime.mal_id);
        local.unshift(historyItem);
        this.saveHistoryLocal(local.slice(0, 50));

        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            const snap = await getDoc(ref);
            let historyArr = [];
            if (snap.exists() && snap.data().history) {
                historyArr = snap.data().history.filter(h => h.mal_id !== anime.mal_id);
            }
            historyArr.unshift(historyItem);
            await setDoc(ref, { history: historyArr.slice(0, 50) }, { merge: true });
        }
    },

    async clearHistory() {
        localStorage.setItem('mono_anime_history', '[]');
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            await setDoc(ref, { history: [] }, { merge: true });
        }
    },

    getWatchedEpisodesLocal() {
        try { return JSON.parse(localStorage.getItem('mono_anime_watched') || '{}'); } catch { return {}; }
    },
    saveWatchedEpisodesLocal(obj) {
        localStorage.setItem('mono_anime_watched', JSON.stringify(obj));
    },

    async getWatchedEpisodes(animeMalId) {
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            const snap = await getDoc(ref);
            const data = snap.data()?.watchedEpisodes || {};
            return data[animeMalId] || 0;
        }
        const local = this.getWatchedEpisodesLocal();
        return local[animeMalId] || 0;
    },

    async incrementWatched(animeMalId) {
        const local = this.getWatchedEpisodesLocal();
        local[animeMalId] = (local[animeMalId] || 0) + 1;
        this.saveWatchedEpisodesLocal(local);

        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            await updateDoc(ref, {
                [`watchedEpisodes.${animeMalId}`]: increment(1)
            });
        }
    },

    getVideoProgressLocal() {
        try { return JSON.parse(localStorage.getItem('mono_anime_video_progress') || '{}'); } catch { return {}; }
    },
    saveVideoProgressLocal(obj) {
        localStorage.setItem('mono_anime_video_progress', JSON.stringify(obj));
    },

    async getVideoProgress(animeMalId, episode) {
        const key = `${animeMalId}_${episode}`;
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            const snap = await getDoc(ref);
            const data = snap.data()?.videoProgress || {};
            return data[key] || 0;
        }
        const local = this.getVideoProgressLocal();
        return local[key] || 0;
    },

    async saveVideoProgress(animeMalId, episode, currentTime) {
        const key = `${animeMalId}_${episode}`;
        const local = this.getVideoProgressLocal();
        local[key] = currentTime;
        this.saveVideoProgressLocal(local);

        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            await setDoc(ref, { videoProgress: { [key]: currentTime } }, { merge: true });
        }
    },

    getTheme() {
        return localStorage.getItem('mono_anime_theme') || 'light';
    },
    setTheme(theme) {
        localStorage.setItem('mono_anime_theme', theme);
        applyTheme(theme);
        if (window.currentFirebaseUser) {
            const ref = doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
            setDoc(ref, { theme }, { merge: true });
        }
    }
};

async function updateBadge() {
    const badge = document.getElementById('bookmarkBadge');
    if (!badge) return;
    const count = (await Storage.getBookmarks()).length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
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
    const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
}
