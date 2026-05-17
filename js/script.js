// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGFJnzds6BzKr1hxX8NV0gpfXiaxCEn6M",
  authDomain: "monoanime8.firebaseapp.com",
  projectId: "monoanime8",
  storageBucket: "monoanime8.firebasestorage.app",
  messagingSenderId: "277731716769",
  appId: "1:277731716769:web:cef62b34753bb70a1fcae0",
  measurementId: "G-32V4LC8F6V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

(function() {
    const PROXY_URL = 'https://monoanime.animegran8.workers.dev';
    const ANIMEUA_BASE = 'https://animeua.club';

    // Статична мапа жанрів: назва -> slug
    const GENRE_MAP = {
        "Бойові мистецтва": "boivie",
        "Бойовики": "boyovik",
        "Воєнні": "voenne",
        "Гарем": "garems",
        "Драми": "drama",
        "Детектив": "detektiv",
        "Демони": "demons",
        "Комедії": "komik",
        "Роботи": "meha",
        "Повсякденність": "posyardnevnist",
        "Пригоди": "adventures",
        "Психологічні": "psih",
        "Романтика": "romantik",
        "Надприродні": "weird",
        "Фантастика": "fantastika",
        "Фентезі": "fentezi",
        "Школа": "classes",
        "Еччі": "echhi"
    };

    function getProxyUrl(url) {
        if (!url) { console.warn('getProxyUrl empty'); return null; }
        return PROXY_URL + '?url=' + encodeURIComponent(url);
    }

    String.prototype.hashCode = function() {
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
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    const DOM = {
        animeContainer: document.getElementById('animeContainer'),
        searchInput: document.getElementById('searchInput'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        profileBtn: document.getElementById('profileBtn'),
        bookmarkBadge: document.getElementById('bookmarkBadge'),
        categoryScroll: document.getElementById('categoryScroll'),
        paginationRow: document.getElementById('paginationRow'),
        toast: document.getElementById('toast'),
        modal: document.getElementById('animeModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        playerModal: document.getElementById('playerModal'),
        playerModalTitle: document.getElementById('playerModalTitle'),
        closePlayerBtn: document.getElementById('closePlayerBtn'),
        mainVideoPlayer: document.getElementById('mainVideoPlayer'),
        profileModal: document.getElementById('profileModal'),
        closeProfileBtn: document.getElementById('closeProfileBtn'),
        profileBody: document.getElementById('profileBody')
    };

    function showToast(msg) {
        if (!DOM.toast) return;
        DOM.toast.textContent = msg;
        DOM.toast.classList.add('show');
        clearTimeout(DOM.toast._timeout);
        DOM.toast._timeout = setTimeout(() => DOM.toast.classList.remove('show'), 2200);
    }

    const Storage = {
        getBookmarks() { try { return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]'); } catch { return []; } },
        saveBookmarks(arr) { localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr)); },
        getHistory() { try { return JSON.parse(localStorage.getItem('mono_anime_history') || '[]'); } catch { return []; } },
        addHistory(anime) {
            if (!anime || !anime.mal_id) return;
            const hist = this.getHistory().filter(h => h.mal_id !== anime.mal_id);
            hist.unshift({
                mal_id: anime.mal_id, title: anime.title,
                image_url: anime.images?.jpg?.large_image_url || '',
                url: anime.url || '', score: anime.score, year: anime.year, timestamp: Date.now()
            });
            localStorage.setItem('mono_anime_history', JSON.stringify(hist.slice(0, 50)));
        },
        clearHistory() { localStorage.setItem('mono_anime_history', '[]'); },
        getTheme() { return localStorage.getItem('mono_anime_theme') || 'light'; },
        setTheme(theme) { localStorage.setItem('mono_anime_theme', theme); }
    };

    function updateBadge() {
        if (!DOM.bookmarkBadge) return;
        const count = Storage.getBookmarks().length;
        DOM.bookmarkBadge.textContent = count;
        DOM.bookmarkBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    function toggleTheme() {
        const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
        Storage.setTheme(next);
        applyTheme(next);
    }

    async function fetchUA(url) {
        if (!url) throw new Error('empty url');
        const proxyUrl = getProxyUrl(url);
        const resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error(`status ${resp.status}`);
        const html = await resp.text();
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function parseCards(doc) {
        const cards = safeQueryAll('.poster', doc);
        if (cards.length) {
            return cards.map(card => {
                const linkEl = card.tagName === 'A' ? card : safeQuery('a', card);
                const href = linkEl?.getAttribute('href') || '';
                const img = safeQuery('img', card);
                const posterSrc = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                const titleEl = safeQuery('.poster__title', card) || safeQuery('h3', card);
                const title = (titleEl?.textContent || '').trim() || 'Без назви';
                return {
                    mal_id: href.hashCode(),
                    title,
                    url: href.startsWith('http') ? href : ANIMEUA_BASE + href,
                    images: { jpg: { large_image_url: posterSrc.startsWith('http') ? posterSrc : (posterSrc ? ANIMEUA_BASE + posterSrc : '') } },
                    score: null, year: null, from: 'animeua'
                };
            });
        }
        const links = safeQueryAll('a[href*="/anime/"]', doc);
        const unique = new Map();
        links.forEach(a => { if (!unique.has(a.href)) unique.set(a.href, a); });
        return Array.from(unique.values()).map(a => {
            const img = safeQuery('img', a);
            const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
            const title = (safeQuery('.poster__title', a)?.textContent || a.textContent || '').trim();
            return {
                mal_id: a.href.hashCode(),
                title: title || 'Без назви',
                url: a.href,
                images: { jpg: { large_image_url: src.startsWith('http') ? src : ANIMEUA_BASE + src } },
                score: null, year: null, from: 'animeua'
            };
        });
    }

    async function fetchMainPage(page = 1) {
        const doc = await fetchUA(`${ANIMEUA_BASE}/page/${page}/`);
        return parseCards(doc);
    }

    async function searchAnimeUA(query, page = 1) {
        const doc = await fetchUA(`${ANIMEUA_BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&page=${page}`);
        return parseCards(doc);
    }

    async function fetchByGenre(genreSlug, page = 1) {
        const doc = await fetchUA(`${ANIMEUA_BASE}/genre/${genreSlug}/page/${page}/`);
        return parseCards(doc);
    }

    // ========== НОВА: ТОП 100 ==========
    async function fetchTop100() {
        const doc = await fetchUA(`${ANIMEUA_BASE}/top.html`);
        return parseCards(doc);
    }

    // Нова функція-обробник для кнопки ТОП 100
    async function showTop100() {
        currentTab = 'top100';
        currentPage = 1;
        currentSearchQuery = null;
        currentGenreSlug = null;
        
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження ТОП 100...</div>';
        
        try {
            currentList = await fetchTop100();
            renderCards(currentList);
        } catch (err) {
            DOM.animeContainer.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
        }
    }

    // ========== НОВА: Випадкове аніме ==========
    function openRandomAnime() {
        const randomUrl = `${ANIMEUA_BASE}/index.php?do=rand`;
        openDetailModal(randomUrl);
    }

    // Оновлена функція: повертає жанри зі статичної мапи
    function fetchGenres() {
        return Object.entries(GENRE_MAP)
            .map(([name, slug]) => ({ slug, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    }

    // ========== Оновлений Парсер джерел з групуванням ==========
    function extractSourcesFromText(text, providerName = '') {
        const sources = [];
        const jsonMatch = text.match(/file\s*:\s*(\[[\s\S]+?\]|\'[\s\S]+?\'|\"[\s\S]+?\"|\{[\s\S]+?\})/i) || 
                          text.match(/playlist\s*:\s*(\[[\s\S]+?\])/i);
        
        if (jsonMatch) {
            try {
                let rawData = jsonMatch[1].trim();
                if ((rawData.startsWith("'") && rawData.endsWith("'")) || (rawData.startsWith('"') && rawData.endsWith('"'))) {
                    rawData = rawData.slice(1, -1);
                }
                if (rawData.startsWith('{') && rawData.endsWith('}')) {
                    rawData = `[${rawData}]`;
                }
                const cleanJson = rawData.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                const arr = JSON.parse(cleanJson);
                
                const walk = (items, currentDub = '', currentSeason = '1') => {
                    items.forEach(item => {
                        if (item.folder || item.playlist) {
                            let nextDub = currentDub;
                            let nextSeason = currentSeason;
                            const folderTitle = item.title || '';
                            const seasonMatch = folderTitle.match(/[Сс]езон\s*(\d+)/);
                            if (seasonMatch) {
                                nextSeason = seasonMatch[1];
                                if (folderTitle.trim().toLowerCase() !== `сезон ${nextSeason}`.toLowerCase()) {
                                    nextDub = folderTitle.replace(/[Сс]езон\s*\d+/g, '').replace(/\//g, '').trim() || currentDub;
                                }
                            } else if (folderTitle) {
                                nextDub = folderTitle;
                            }
                            walk(item.folder || item.playlist, nextDub, nextSeason);
                        } else if (item.file) {
                            const episodeTitle = item.title || 'Серія';
                            let finalDub = currentDub || providerName || 'UA';
                            let finalSeason = currentSeason;
                            const epSeasonMatch = episodeTitle.match(/[Сс]езон\s*(\d+)/);
                            if (epSeasonMatch) finalSeason = epSeasonMatch[1];
                            const epNumMatch = episodeTitle.match(/(\d+)\s*[Сс]ері[яіяа]|[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
                            const episodeNumber = epNumMatch ? (epNumMatch[1] || epNumMatch[2] || epNumMatch[3]) : '1';

                            sources.push({
                                label: episodeTitle,
                                file: item.file,
                                provider: providerName,
                                dub: finalDub.trim(),
                                season: finalSeason,
                                episode: episodeNumber
                            });
                        }
                    });
                };
                
                if (Array.isArray(arr)) walk(arr);
                else if (arr.file) sources.push({ label: arr.title || 'Озвучка', file: arr.file, provider: providerName, dub: providerName || 'UA', season: '1', episode: '1' });
            } catch (e) { console.warn('Помилка парсингу JSON озвучок', e); }
        }

        if (sources.length === 0) {
            const urlMatches = [...text.matchAll(/https?:\/\/[^\s\'"<>]+\.m3u8[^\s\'"<>]*/g)];
            urlMatches.forEach((m, idx) => {
                if (!sources.some(s => s.file === m[0])) {
                    sources.push({ label: `Потік ${idx + 1}`, file: m[0], provider: providerName, dub: providerName || 'UA', season: '1', episode: String(idx + 1) });
                }
            });
        }
        return sources;
    }

    function extractPlayerIframeUrls(doc) {
        const selectors = ['.video-responsive iframe', '.player-responsive iframe', '#player iframe', '.pmovie__player iframe', 'iframe[src]', 'iframe[data-src]'];
        const urls = [];
        for (const sel of selectors) {
            safeQueryAll(sel, doc).forEach(el => {
                let src = el.getAttribute('src') || el.getAttribute('data-src');
                if (!src || src === 'about:blank') return;
                if (src.startsWith('//')) src = 'https:' + src;
                if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
                urls.push(src);
            });
        }
        const scripts = safeQueryAll('script:not([src])', doc);
        for (const s of scripts) {
            const matches = s.textContent.matchAll(/(?:playerUrl|iframeUrl|src)\s*[:=]\s*['"]([^'"]+)['"]/g);
            for (const match of matches) {
                let url = match[1];
                if (url.includes('ashdi.vip') || url.includes('vidmoly') || url.includes('player')) {
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!url.startsWith('http')) url = ANIMEUA_BASE + url;
                    urls.push(url);
                }
            }
        }
        return [...new Set(urls)];
    }

    async function loadAnimeDetails(animeUrl) {
        const doc = await fetchUA(animeUrl);
        let title = '';
        for (const sel of ['.page__subcol-main h1', '.pmovie__title', 'h1.title', 'h1']) {
            const el = safeQuery(sel, doc);
            if (el?.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        let poster = '';
        for (const sel of ['div.page__subcol-side .img-fit-cover img', '.pmovie__poster img', '.anime__poster img']) {
            const el = safeQuery(sel, doc);
            if (el) {
                const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
                if (src) { poster = src.startsWith('http') ? src : ANIMEUA_BASE + src; break; }
            }
        }
        const genres = safeQueryAll('.pmovie__genres a, .genres a', doc).map(a => a.textContent.trim()).filter(Boolean);
        const yearEl = safeQuery('.pmovie__year, .release-year', doc);
        const yearMatch = (yearEl?.textContent || '').match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        let synopsis = '';
        for (const sel of ['.full-text', '.pmovie__description', '.anime__description']) {
            const el = safeQuery(sel, doc);
            if (el?.textContent.trim()) { synopsis = el.textContent.trim(); break; }
        }

        // ========== НОВЕ: Парсинг вікового рейтингу ==========
        let rating = '';
        const ratingEl = doc.querySelector('.pmovie__age p, .pmovie__age');
        if (ratingEl) {
            rating = ratingEl.textContent.replace('Рейтинг:', '').trim();
        }

        const playerUrls = extractPlayerIframeUrls(doc);
        const allRawSources = [];
        for (const playerUrl of playerUrls) {
            try {
                let provider = 'Джерело';
                if (playerUrl.includes('ashdi')) provider = 'Ashdi';
                else if (playerUrl.includes('vidmoly')) provider = 'Vidmoly';
                else if (playerUrl.includes('player')) provider = 'Player';
                const playerHtml = await fetchUA(playerUrl);
                const text = playerHtml.body?.innerHTML || '';
                allRawSources.push(...extractSourcesFromText(text, provider));
                const nestedIframes = safeQueryAll('iframe', playerHtml);
                for (const nested of nestedIframes) {
                    let nestedUrl = nested.getAttribute('src') || nested.getAttribute('data-src');
                    if (nestedUrl && nestedUrl !== 'about:blank') {
                        if (nestedUrl.startsWith('//')) nestedUrl = 'https:' + nestedUrl;
                        if (!nestedUrl.startsWith('http')) nestedUrl = ANIMEUA_BASE + nestedUrl;
                        const nestedHtml = await fetchUA(nestedUrl);
                        allRawSources.push(...extractSourcesFromText(nestedHtml.body?.innerHTML || '', provider));
                    }
                }
            } catch (e) { console.warn('Player fetch failed', playerUrl, e); }
        }

        const seasons = {};
        const seenKeys = new Set();
        allRawSources.forEach(s => {
            const seasonNum = s.season || '1';
            const dubName = s.dub || 'UA';
            const episodeNum = s.episode || '1';
            const uniqueKey = `${seasonNum}-${dubName}-${episodeNum}-${s.file}`;
            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                if (!seasons[seasonNum]) seasons[seasonNum] = {};
                if (!seasons[seasonNum][dubName]) seasons[seasonNum][dubName] = [];
                seasons[seasonNum][dubName].push({ title: s.label, season: seasonNum, episode: episodeNum, file: s.file, dub: dubName, provider: s.provider });
            }
        });

        for (const s in seasons) {
            for (const d in seasons[s]) {
                seasons[s][d].sort((a, b) => parseInt(a.episode) - parseInt(b.episode));
            }
        }

        return { 
            mal_id: animeUrl.hashCode(), 
            title, 
            images: { jpg: { large_image_url: poster, image_url: poster } }, 
            genres, 
            year, 
            synopsis, 
            seasons, 
            url: animeUrl, 
            from: 'animeua',
            rating
        };
    }

    let hlsInstances = new Map();
    function destroyHlsForVideo(videoEl) {
        if (hlsInstances.has(videoEl)) { hlsInstances.get(videoEl).destroy(); hlsInstances.delete(videoEl); }
    }

    function loadVideo(url, videoElement = DOM.mainVideoPlayer) {
        if (!videoElement) return;
        destroyHlsForVideo(videoElement);
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        if (!url) { showToast('❌ Немає URL відео'); return; }
        const finalUrl = getProxyUrl(url);
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
            hlsInstances.set(videoElement, hls);
            hls.loadSource(finalUrl);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play().catch(() => {}));
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                        case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                        default: destroyHlsForVideo(videoElement);
                    }
                }
            });
        } else {
            videoElement.src = finalUrl;
            videoElement.play().catch(() => {});
        }
    }

    let currentTab = 'main', currentPage = 1, currentSearchQuery = '', currentGenreSlug = null, currentList = [], currentDetailAnime = null;

    function renderCards(list) {
        if (!DOM.animeContainer) return;
        if (!list.length) { DOM.animeContainer.innerHTML = '<div class="loader">Нічого не знайдено</div>'; return; }
        DOM.animeContainer.innerHTML = list.map(a => `
            <div class="anime-card" data-url="${a.url}">
                <div class="anime-poster">
                    <img src="${a.images.jpg.large_image_url}" alt="${a.title}" loading="lazy">
                </div>
                <div class="anime-info">
                    <div class="anime-title">${a.title}</div>
                    <div class="anime-meta">${a.year || ''} • UA</div>
                </div>
            </div>
        `).join('');
        DOM.animeContainer.querySelectorAll('.anime-card').forEach(card => card.addEventListener('click', () => openDetailModal(card.dataset.url)));
        renderPagination();
    }

    function renderPagination() {
        if (!DOM.paginationRow) return;
        let html = '';
        if (currentPage > 1) html += `<button class="btn-outline" onclick="changePage(${currentPage - 1})">Назад</button>`;
        html += `<span style="margin:0 1rem; font-weight:bold;">Сторінка ${currentPage}</span>`;
        html += `<button class="btn-outline" onclick="changePage(${currentPage + 1})">Вперед</button>`;
        DOM.paginationRow.innerHTML = html;
    }

    window.changePage = (p) => { currentPage = p; window.scrollTo(0,0); loadContent(); };

    function closeDetailModal() {
        if (!DOM.modal) return;
        DOM.modal.style.display = 'none';
        document.body.style.overflow = '';
        const video = document.getElementById('detailVideoPlayer');
        if (video) { video.pause(); destroyHlsForVideo(video); }
    }

    function toggleBookmark(anime) {
        let b = Storage.getBookmarks();
        const idx = b.findIndex(x => x.mal_id === anime.mal_id);
        if (idx > -1) { b.splice(idx, 1); showToast('Видалено з обраного'); }
        else { b.push(anime); showToast('Додано в обране'); }
        Storage.saveBookmarks(b);
        updateBadge();
    }

    async function openDetailModal(url) {
        if (!DOM.modal) return;
        DOM.modalTitle.textContent = 'Завантаження...';
        DOM.modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        DOM.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        try {
            const anime = await loadAnimeDetails(url);
            Storage.addHistory(anime);
            currentDetailAnime = anime;
            DOM.modalTitle.textContent = anime.title;
            const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
            
            const seasons = Object.keys(anime.seasons).sort((a,b) => parseInt(a) - parseInt(b));
            const firstSeason = seasons[0] || '1';
            const dubs = Object.keys(anime.seasons[firstSeason] || {}).sort();
            const firstDub = dubs[0] || '';
            const episodes = firstDub ? anime.seasons[firstSeason][firstDub] : [];
            
            const totalEpisodes = episodes.length;
            
            // Рейтинг (якщо є)
            const ratingTag = anime.rating ? `<span class="tag rating-tag"><i class="fas fa-user-shield"></i> ${anime.rating}</span>` : '';

            const html = `
                <div class="anime-detail-grid">
                    <div class="detail-poster"><img src="${anime.images.jpg.large_image_url}" alt="${anime.title}"></div>
                    <div class="detail-info">
                        <div>
                            <span class="tag"><i class="fas fa-calendar"></i> ${anime.year || '—'}</span>
                            <span class="tag"><i class="fas fa-film"></i> ${totalEpisodes} еп.</span>
                        </div>
                        <div style="margin:0.5rem 0">${anime.genres.map(g => `<span class="tag">${g}</span>`).join('')} ${ratingTag}</div>
                        <div class="synopsis-container">
                            <div class="synopsis" id="synopsisText">${anime.synopsis || 'Опис відсутній.'}</div>
                            <button class="more-btn" id="moreBtn" style="display: none;">більше</button>
                        </div>
                        <button class="btn-outline" id="toggleBookmarkBtn"><i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}</button>
                    </div>
                </div>
                <div style="margin-top:1.5rem;">
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem; background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px;">
                        <div style="display:flex; flex-direction: column; gap: 0.3rem;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: #666;">СЕЗОН</label>
                            <select id="seasonSelect" class="btn-outline" style="padding:0.5rem; min-width: 120px;">
                                ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; flex-direction: column; gap: 0.3rem;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: #666;">ОЗВУЧКА</label>
                            <select id="dubSelect" class="btn-outline" style="padding:0.5rem; min-width: 200px;">
                                ${dubs.map(d => `<option value="${d}" ${d === firstDub ? 'selected' : ''}>${d}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; flex-direction: column; gap: 0.3rem;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: #666;">СЕРІЯ</label>
                            <select id="episodeSelect" class="btn-outline" style="padding:0.5rem; min-width: 100px;">
                                ${episodes.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('')}
                            </select>
                        </div>
                        <button id="playSelectedBtn" class="btn-outline" style="align-self: flex-end; padding: 0.6rem 1.2rem; background: #ff4757; color: white; border: none;"><i class="fas fa-play"></i> ДИВИТИСЯ</button>
                    </div>
                    <div class="player-container" style="margin-top:1rem; background: #000; border-radius: 8px; overflow: hidden; aspect-ratio: 16/9;">
                        <video id="detailVideoPlayer" controls crossorigin="anonymous" style="width:100%; height: 100%;"></video>
                    </div>
                </div>
            `;

            DOM.modalBody.innerHTML = html;
            const detailVideoEl = document.getElementById('detailVideoPlayer');

            const seasonSelect = document.getElementById('seasonSelect');
            const dubSelect = document.getElementById('dubSelect');
            const episodeSelect = document.getElementById('episodeSelect');

            function updateDubs() {
                const s = seasonSelect.value;
                const availableDubs = Object.keys(anime.seasons[s] || {}).sort();
                dubSelect.innerHTML = availableDubs.map(d => `<option value="${d}">${d}</option>`).join('');
                updateEpisodes();
            }

            function updateEpisodes() {
                const s = seasonSelect.value;
                const d = dubSelect.value;
                const availableEps = anime.seasons[s]?.[d] || [];
                episodeSelect.innerHTML = availableEps.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('');
            }

            seasonSelect.addEventListener('change', updateDubs);
            dubSelect.addEventListener('change', updateEpisodes);
            document.getElementById('playSelectedBtn').addEventListener('click', () => {
                const file = episodeSelect.value;
                if (file) loadVideo(file, detailVideoEl);
                else showToast('❌ Немає файлу');
            });
            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
                toggleBookmark(anime);
                const isNow = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
                document.getElementById('toggleBookmarkBtn').innerHTML = `<i class="fas fa-star"></i> ${isNow ? 'В обраному' : 'Додати в обране'}`;
            });

            // Логіка для кнопки «більше»
            const synopsisText = document.getElementById('synopsisText');
            const moreBtn = document.getElementById('moreBtn');
            if (synopsisText && moreBtn) {
                if (synopsisText.scrollHeight > synopsisText.clientHeight) {
                    moreBtn.style.display = 'block';
                }
                moreBtn.addEventListener('click', () => {
                    const isExpanded = synopsisText.classList.toggle('expanded');
                    moreBtn.textContent = isExpanded ? 'менше' : 'більше';
                });
            }

        } catch (err) { DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`; }
    }

    if (DOM.closeModalBtn) DOM.closeModalBtn.addEventListener('click', closeDetailModal);
    if (DOM.closePlayerBtn) DOM.closePlayerBtn.addEventListener('click', () => { DOM.playerModal.style.display = 'none'; document.body.style.overflow = ''; destroyHlsForVideo(DOM.mainVideoPlayer); });
    if (DOM.closeProfileBtn) DOM.closeProfileBtn.addEventListener('click', () => { DOM.profileModal.style.display = 'none'; document.body.style.overflow = ''; });

    // ========== Firebase Auth ==========
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const profileContent = document.getElementById('authContainer');
        if (profileContent && DOM.profileModal.style.display === 'flex') {
            renderAuthSection(profileContent);
        }
    });

    async function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            showToast('Успішний вхід через Google');
        } catch (error) {
            showToast('Помилка входу: ' + error.message);
        }
    }

    async function signUpWithEmail(email, password) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showToast('Реєстрація успішна!');
        } catch (error) {
            showToast('Помилка реєстрації: ' + error.message);
        }
    }

    async function signInWithEmail(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Вхід виконано');
        } catch (error) {
            showToast('Помилка входу: ' + error.message);
        }
    }

    async function logout() {
        await signOut(auth);
        showToast('Ви вийшли з акаунту');
    }

    function renderAuthSection(container) {
        if (currentUser) {
            container.innerHTML = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <img src="${currentUser.photoURL || ''}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;" />
                    <h3 style="margin: 0.5rem 0;">${currentUser.displayName || currentUser.email}</h3>
                    <p style="color: #888; font-size: 0.9rem;">${currentUser.email}</p>
                    <button id="logoutBtn" class="btn-outline" style="margin-top: 0.5rem;"><i class="fas fa-sign-out-alt"></i> Вийти</button>
                </div>
            `;
            document.getElementById('logoutBtn').addEventListener('click', logout);
        } else {
            container.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <button id="googleSignInBtn" class="btn-outline" style="width:100%; margin-bottom: 1rem; background: #4285f4; color: white; border: none;">
                        <i class="fab fa-google"></i> Увійти через Google
                    </button>
                    <div style="border-top: 1px solid #ddd; margin: 1rem 0;"></div>
                    <form id="loginForm" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <input type="email" id="emailInput" placeholder="Email" required style="padding:0.5rem; border-radius:4px; border:1px solid #ccc;" />
                        <input type="password" id="passwordInput" placeholder="Пароль" required style="padding:0.5rem; border-radius:4px; border:1px solid #ccc;" />
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="submit" id="loginBtn" class="btn-outline" style="flex:1;">Увійти</button>
                            <button type="button" id="registerBtn" class="btn-outline" style="flex:1;">Реєстрація</button>
                        </div>
                    </form>
                </div>
            `;
            document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
            document.getElementById('loginForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('emailInput').value.trim();
                const password = document.getElementById('passwordInput').value;
                signInWithEmail(email, password);
            });
            document.getElementById('registerBtn').addEventListener('click', () => {
                const email = document.getElementById('emailInput').value.trim();
                const password = document.getElementById('passwordInput').value;
                if (email && password) {
                    signUpWithEmail(email, password);
                } else {
                    showToast('Заповніть email і пароль');
                }
            });
        }
    }

    // Модифікована функція відкриття профілю
    function openProfileModal() {
        if (!DOM.profileModal) return;
        const bookmarks = Storage.getBookmarks(), history = Storage.getHistory();

        DOM.profileBody.innerHTML = `
            <div id="authContainer"></div>
            <hr style="margin: 1rem 0;" />
            <h3><i class="fas fa-star"></i> Обране</h3>
            <div id="bookmarkList" class="bookmark-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;"></div>
            <h3><i class="fas fa-history"></i> Історія переглядів</h3>
            <div id="historyList" class="bookmark-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
        `;

        const bList = document.getElementById('bookmarkList');
        bList.innerHTML = bookmarks.length 
            ? bookmarks.slice(0,12).map(b => `<div class="bookmark-item" data-url="${b.url}"><img src="${b.image_url}"><span>${b.title}</span></div>`).join('') 
            : '<p>Немає обраних</p>';

        const hList = document.getElementById('historyList');
        hList.innerHTML = history.length 
            ? history.slice(0,12).map(h => `<div class="bookmark-item" data-url="${h.url}"><img src="${h.image_url}"><span>${h.title}</span></div>`).join('') 
            : '<p>Історія порожня</p>';

        document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                DOM.profileModal.style.display = 'none';
                document.body.style.overflow = '';
                openDetailModal(item.dataset.url);
            });
        });

        const authContainer = document.getElementById('authContainer');
        renderAuthSection(authContainer);

        DOM.profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    async function loadContent() {
        if (!DOM.animeContainer) return;
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        try {
            if (currentTab === 'top100') {
                currentList = await fetchTop100();
            } else if (currentSearchQuery) {
                currentList = await searchAnimeUA(currentSearchQuery, currentPage);
            } else if (currentGenreSlug) {
                currentList = await fetchByGenre(currentGenreSlug, currentPage);
            } else {
                currentList = await fetchMainPage(currentPage);
            }
            renderCards(currentList);
        } catch (err) {
            DOM.animeContainer.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
        }
    }

    async function initGenres() {
        if (!DOM.categoryScroll) return;
        const genres = fetchGenres();
        DOM.categoryScroll.querySelectorAll('.category-pill').forEach(p => p.remove());
        const allBtn = document.createElement('button');
        allBtn.className = 'category-pill active-pill';
        allBtn.textContent = 'Усі';
        allBtn.addEventListener('click', () => {
            currentGenreSlug = null;
            currentPage = 1;
            currentTab = 'main';
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            allBtn.classList.add('active-pill');
            loadContent();
        });
        DOM.categoryScroll.appendChild(allBtn);
        genres.forEach(genre => {
            const btn = document.createElement('button');
            btn.className = 'category-pill';
            btn.textContent = genre.name;
            btn.addEventListener('click', () => {
                currentGenreSlug = genre.slug;
                currentPage = 1;
                currentTab = 'main';
                document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
                btn.classList.add('active-pill');
                loadContent();
            });
            DOM.categoryScroll.appendChild(btn);
        });
    }

    // ========== Ініціалізація ==========
    applyTheme(Storage.getTheme());
    updateBadge();

    if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    if (DOM.profileBtn) DOM.profileBtn.addEventListener('click', openProfileModal);
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', debounce(() => {
        currentSearchQuery = DOM.searchInput.value.trim();
        currentPage = 1;
        currentTab = 'main';
        loadContent();
    }, 500));

    const topBtn = document.getElementById('top100Btn');
    const randBtn = document.getElementById('randomBtn');
    if (topBtn) topBtn.addEventListener('click', showTop100);
    if (randBtn) randBtn.addEventListener('click', openRandomAnime);

    window.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeDetailModal();
        if (e.target === DOM.playerModal) { DOM.playerModal.style.display = 'none'; document.body.style.overflow = ''; destroyHlsForVideo(DOM.mainVideoPlayer); }
        if (e.target === DOM.profileModal) { DOM.profileModal.style.display = 'none'; document.body.style.overflow = ''; }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            if (DOM.playerModal) DOM.playerModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
            if (DOM.profileModal) DOM.profileModal.style.display = 'none';
        }
    });

    initGenres().then(() => loadContent());
})();
