(function() {
    const PROXY_URL = 'https://monoanime.animegran8.workers.dev';
    const ANIMEUA_BASE = 'https://animeua.club';

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

    async function fetchGenres() {
        try {
            const doc = await fetchUA(ANIMEUA_BASE);
            const genreLinks = safeQueryAll('.genre-nav a, .genres-list a, a[href*="/genre/"]', doc);
            const genres = genreLinks.map(a => {
                const href = a.getAttribute('href');
                const slug = href.match(/\/genre\/([^/]+)/)?.[1] || '';
                const name = a.textContent.trim();
                return { slug, name };
            }).filter(g => g.slug && g.name);
            return [...new Map(genres.map(g => [g.slug, g])).values()].slice(0, 25);
        } catch (e) {
            return [
                { slug: '1', name: 'Action' }, { slug: '2', name: 'Adventure' },
                { slug: '3', name: 'Comedy' }, { slug: '4', name: 'Drama' },
                { slug: '5', name: 'Fantasy' }, { slug: '6', name: 'Horror' },
                { slug: '7', name: 'Romance' }, { slug: '8', name: 'Sci-Fi' }
            ];
        }
    }

    function extractSourcesFromText(text, providerName = '') {
        const sources = [];
        const jsonMatch = text.match(/file\s*:\s*(\[[\s\S]+?\]|'[\s\S]+?'|"[\s\S]+?")/i) || 
                          text.match(/playlist\s*:\s*(\[[\s\S]+?\])/i);
        
        if (jsonMatch) {
            try {
                let rawData = jsonMatch[1].trim();
                if ((rawData.startsWith("'") && rawData.endsWith("'")) || (rawData.startsWith('"') && rawData.endsWith('"'))) {
                    rawData = rawData.slice(1, -1);
                }
                const cleanJson = rawData.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                const arr = JSON.parse(cleanJson);
                
                const walk = (items, dub = '') => {
                    items.forEach(item => {
                        if (item.folder || item.playlist) {
                            walk(item.folder || item.playlist, item.title || dub);
                        } else if (item.file) {
                            sources.push({
                                label: (dub ? dub + ' / ' : '') + (item.title || 'Озвучка'),
                                file: item.file,
                                provider: providerName
                            });
                        }
                    });
                };
                
                if (Array.isArray(arr)) walk(arr);
                else if (arr.file) sources.push({ label: arr.title || 'Озвучка', file: arr.file, provider: providerName });
            } catch (e) { console.warn('Помилка парсингу JSON озвучок'); }
        }

        if (sources.length === 0) {
            const urlMatches = [...text.matchAll(/https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/g)];
            urlMatches.forEach(m => {
                if (!sources.some(s => s.file === m[0])) {
                    sources.push({ label: 'Потік', file: m[0], provider: providerName });
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
        return [...new Set(urls)];
    }

    async function loadAnimeDetails(animeUrl) {
        const doc = await fetchUA(animeUrl);
        let title = safeQuery('h1', doc)?.textContent.trim() || 'Без назви';
        let poster = '';
        const img = safeQuery('.pmovie__poster img, .img-fit-cover img', doc);
        if (img) {
            const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
            poster = src.startsWith('http') ? src : ANIMEUA_BASE + src;
        }
        const genres = safeQueryAll('.pmovie__genres a, .genres a', doc).map(a => a.textContent.trim()).filter(Boolean);
        const yearMatch = (safeQuery('.pmovie__year', doc)?.textContent || '').match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        const synopsis = safeQuery('.full-text, .pmovie__description', doc)?.textContent.trim() || '';

        const playerUrls = extractPlayerIframeUrls(doc);
        const allSources = [];
        const seenFiles = new Set();
        
        for (const playerUrl of playerUrls) {
            try {
                let provider = playerUrl.includes('ashdi') ? 'Ashdi' : (playerUrl.includes('vidmoly') ? 'Vidmoly' : 'Player');
                const playerHtml = await fetchUA(playerUrl);
                const sources = extractSourcesFromText(playerHtml.body?.innerHTML || '', provider);
                sources.forEach(s => {
                    if (!seenFiles.has(s.file)) {
                        seenFiles.add(s.file);
                        allSources.push(s);
                    }
                });
            } catch (e) {}
        }

        // ----- ПРАВИЛЬНЕ ГРУПУВАННЯ -----
        const seasons = {};
        allSources.forEach((s, idx) => {
            const label = s.label || '';
            const seasonMatch = label.match(/[Сс]езон\s*(\d+)/);
            const seasonNum = seasonMatch ? seasonMatch[1] : '1';
            const epMatch = label.match(/(\d+)\s*[Сс]ері[яіяа]|[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
            const episode = epMatch ? (epMatch[1] || epMatch[2] || epMatch[3]) : String(idx + 1);
            
            let dubName = label
                .replace(/[Сс]езон\s*\d+/g, '')
                .replace(/[Ее]п\.?\s*\d+|[Сс]ері[яіяа]\s*\d+|\d+\s*[Сс]ері[яіяа]/g, '')
                .replace(/\[\d+p\]/g, '')
                .replace(/\//g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (!dubName || dubName.length < 2) dubName = 'Озвучка';
            const finalDubKey = `${dubName} [${s.provider}]`;

            if (!seasons[seasonNum]) seasons[seasonNum] = {};
            if (!seasons[seasonNum][finalDubKey]) seasons[seasonNum][finalDubKey] = [];
            seasons[seasonNum][finalDubKey].push({ episode, file: s.file, title: label });
        });

        return {
            mal_id: animeUrl.hashCode(),
            title,
            images: { jpg: { large_image_url: poster } },
            genres, year, synopsis, seasons, url: animeUrl, from: 'animeua'
        };
    }

    let hlsInstances = new Map();
    function destroyHlsForVideo(videoEl) {
        if (hlsInstances.has(videoEl)) {
            hlsInstances.get(videoEl).destroy();
            hlsInstances.delete(videoEl);
        }
    }

    function loadVideo(url, videoElement) {
        if (!videoElement || !url) return;
        destroyHlsForVideo(videoElement);
        const finalUrl = getProxyUrl(url);
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls();
            hlsInstances.set(videoElement, hls);
            hls.loadSource(finalUrl);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play().catch(() => {}));
        } else {
            videoElement.src = finalUrl;
            videoElement.play().catch(() => {});
        }
    }

    function closeDetailModal() {
        if (DOM.modal) {
            DOM.modal.style.display = 'none';
            document.body.style.overflow = '';
            const v = document.getElementById('detailVideoPlayer');
            if (v) { v.pause(); destroyHlsForVideo(v); }
        }
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
            DOM.modalTitle.textContent = anime.title;
            const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
            
            const seasonKeys = Object.keys(anime.seasons).sort((a,b) => a - b);
            const firstSeason = seasonKeys[0] || '1';
            const dubKeys = Object.keys(anime.seasons[firstSeason] || {}).sort();
            const firstDub = dubKeys[0] || '';
            const episodes = firstDub ? anime.seasons[firstSeason][firstDub] : [];

            DOM.modalBody.innerHTML = `
                <div class="anime-detail-content">
                    <div class="anime-detail-grid">
                        <div class="detail-poster"><img src="${anime.images.jpg.large_image_url}"></div>
                        <div class="detail-info">
                            <div style="margin-bottom:0.5rem;">
                                <span class="tag"><i class="fas fa-calendar"></i> ${anime.year || '—'}</span>
                            </div>
                            <p class="synopsis">${anime.synopsis.slice(0, 400)}...</p>
                            <button class="btn-outline" id="toggleBookmarkBtn"><i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}</button>
                        </div>
                    </div>
                    <div class="player-controls" style="margin-top:1.5rem; display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Сезон</label>
                            <select id="seasonSelect" class="btn-outline">${seasonKeys.map(s => `<option value="${s}">Сезон ${s}</option>`).join('')}</select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Озвучка</label>
                            <select id="dubSelect" class="btn-outline" style="max-width:250px;">${dubKeys.map(d => `<option value="${d}">${d}</option>`).join('')}</select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Серія</label>
                            <select id="episodeSelect" class="btn-outline">${episodes.map(e => `<option value="${e.file}">Еп. ${e.episode}</option>`).join('')}</select>
                        </div>
                        <button id="playBtn" class="btn-outline"><i class="fas fa-play"></i> Дивитися</button>
                    </div>
                    <video id="detailVideoPlayer" controls style="width:100%; margin-top:1rem; border-radius:8px; background:#000;"></video>
                </div>
            `;

            const seasonSelect = document.getElementById('seasonSelect');
            const dubSelect = document.getElementById('dubSelect');
            const epSelect = document.getElementById('episodeSelect');
            const videoEl = document.getElementById('detailVideoPlayer');

            function updateDubs() {
                const s = seasonSelect.value;
                const dubs = Object.keys(anime.seasons[s] || {}).sort();
                dubSelect.innerHTML = dubs.map(d => `<option value="${d}">${d}</option>`).join('');
                updateEps();
            }

            function updateEps() {
                const s = seasonSelect.value;
                const d = dubSelect.value;
                const eps = anime.seasons[s]?.[d] || [];
                epSelect.innerHTML = eps.map(e => `<option value="${e.file}">Еп. ${e.episode}</option>`).join('');
            }

            seasonSelect.addEventListener('change', updateDubs);
            dubSelect.addEventListener('change', updateEps);
            document.getElementById('playBtn').addEventListener('click', () => {
                const file = epSelect.value;
                if (file) loadVideo(file, videoEl);
                else showToast('❌ Немає файлу');
            });
            
            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
                let b = Storage.getBookmarks();
                const idx = b.findIndex(x => x.mal_id === anime.mal_id);
                if (idx > -1) { b.splice(idx, 1); showToast('Видалено'); }
                else { b.push(anime); showToast('Додано'); }
                Storage.saveBookmarks(b);
                updateBadge();
                document.getElementById('toggleBookmarkBtn').innerHTML = `<i class="fas fa-star"></i> ${Storage.getBookmarks().some(x => x.mal_id === anime.mal_id) ? 'В обраному' : 'Додати'}`;
            });

        } catch (e) { DOM.modalBody.innerHTML = 'Помилка завантаження'; }
    }

    function renderCards(list) {
        if (!DOM.animeContainer) return;
        DOM.animeContainer.innerHTML = list.map(a => `
            <div class="anime-card" data-url="${a.url}">
                <div class="anime-poster"><img src="${a.images.jpg.large_image_url}"></div>
                <div class="anime-info"><div class="anime-title">${a.title}</div></div>
            </div>
        `).join('');
        DOM.animeContainer.querySelectorAll('.anime-card').forEach(c => {
            c.addEventListener('click', () => openDetailModal(c.dataset.url));
        });
    }

    async function loadContent() {
        if (!DOM.animeContainer) return;
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        try {
            let list = [];
            if (currentTab === 'bookmarks') list = Storage.getBookmarks();
            else if (currentTab === 'history') list = Storage.getHistory();
            else if (currentSearchQuery) list = await searchAnimeUA(currentSearchQuery, currentPage);
            else if (currentGenreSlug) list = await fetchByGenre(currentGenreSlug, currentPage);
            else list = await fetchMainPage(currentPage);
            renderCards(list);
        } catch (e) { DOM.animeContainer.innerHTML = 'Помилка'; }
    }

    let currentTab = 'main', currentPage = 1, currentSearchQuery = '', currentGenreSlug = null;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
            btn.classList.add('active-tab');
            loadContent();
        });
    });

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(() => {
            currentSearchQuery = DOM.searchInput.value.trim(); currentPage = 1; loadContent();
        }, 500));
    }

    async function initGenres() {
        if (!DOM.categoryScroll) return;
        const genres = await fetchGenres();
        DOM.categoryScroll.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.className = 'category-pill active-pill';
        allBtn.textContent = 'Усі';
        allBtn.onclick = () => {
            currentGenreSlug = null; currentPage = 1;
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            allBtn.classList.add('active-pill');
            loadContent();
        };
        DOM.categoryScroll.appendChild(allBtn);
        genres.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'category-pill';
            btn.textContent = g.name;
            btn.onclick = () => {
                currentGenreSlug = g.slug; currentPage = 1;
                document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
                btn.classList.add('active-pill');
                loadContent();
            };
            DOM.categoryScroll.appendChild(btn);
        });
    }

    if (DOM.closeModalBtn) DOM.closeModalBtn.addEventListener('click', closeDetailModal);
    if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    
    applyTheme(Storage.getTheme());
    updateBadge();
    initGenres().then(() => loadContent());
})();
