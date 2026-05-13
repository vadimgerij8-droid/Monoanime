(function() {
    /* ==================== УТИЛІТИ ==================== */
    const PROXY_URL = 'https://monoanime.animegran8.workers.dev';
    const ANIMEUA_BASE = 'https://animeua.club';

    function getProxyUrl(url) {
        if (!url) {
            console.warn('[MONOANIME] getProxyUrl отримав порожній URL');
            return null;
        }
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
        try {
            if (typeof selector !== 'string' || !selector) return null;
            return parent.querySelector(selector);
        } catch (e) {
            console.warn('[MONOANIME] Invalid selector:', selector, e);
            return null;
        }
    }

    function safeQueryAll(selector, parent = document) {
        try {
            if (typeof selector !== 'string' || !selector) return [];
            return Array.from(parent.querySelectorAll(selector));
        } catch (e) {
            console.warn('[MONOANIME] Invalid selector:', selector, e);
            return [];
        }
    }

    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /* ==================== DOM ==================== */
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
        DOM.toast.textContent = msg;
        DOM.toast.classList.add('show');
        clearTimeout(DOM.toast._timeout);
        DOM.toast._timeout = setTimeout(() => DOM.toast.classList.remove('show'), 2200);
    }

    /* ==================== СХОВИЩЕ ==================== */
    const Storage = {
        getBookmarks() {
            try { return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]'); } catch { return []; }
        },
        saveBookmarks(arr) {
            localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr));
        },
        getHistory() {
            try { return JSON.parse(localStorage.getItem('mono_anime_history') || '[]'); } catch { return []; }
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

    function updateBadge() {
        const count = Storage.getBookmarks().length;
        DOM.bookmarkBadge.textContent = count;
        DOM.bookmarkBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            DOM.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            DOM.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
    function toggleTheme() {
        const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
        Storage.setTheme(next);
        applyTheme(next);
    }

    /* ==================== ANIMEUA ПАРСИНГ ==================== */
    async function fetchUA(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            throw new Error('fetchUA: порожній URL');
        }
        const proxyUrl = getProxyUrl(url);
        if (!proxyUrl) throw new Error('fetchUA: не вдалося створити проксі-URL');
        console.log('[MONOANIME] fetchUA:', url);
        const resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error(`Помилка завантаження: ${resp.status}`);
        const html = await resp.text();
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function parseCards(doc) {
        const cards = safeQueryAll('.poster', doc);
        if (cards.length > 0) {
            return cards.map(card => {
                const linkEl = card.tagName === 'A' ? card : safeQuery('a', card);
                const href = linkEl?.getAttribute('href') || '';
                const img = safeQuery('img', card);
                const posterSrc = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                const titleEl = safeQuery('.poster__title', card) || safeQuery('h3', card) || safeQuery('.title', card);
                const title = (titleEl?.textContent || '').trim() || 'Без назви';
                return {
                    mal_id: href.hashCode(),
                    title: title,
                    url: href.startsWith('http') ? href : ANIMEUA_BASE + href,
                    images: { jpg: { large_image_url: posterSrc.startsWith('http') ? posterSrc : (posterSrc ? ANIMEUA_BASE + posterSrc : '') } },
                    score: null,
                    year: null,
                    from: 'animeua'
                };
            });
        }
        const links = safeQueryAll('a[href*="/anime/"]', doc);
        const unique = new Map();
        links.forEach(a => {
            const href = a.href;
            if (!unique.has(href)) unique.set(href, a);
        });
        return Array.from(unique.values()).map(a => {
            const img = safeQuery('img', a);
            const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
            const title = (safeQuery('.poster__title', a)?.textContent || a.textContent || '').trim();
            return {
                mal_id: a.href.hashCode(),
                title: title || 'Без назви',
                url: a.href,
                images: { jpg: { large_image_url: src.startsWith('http') ? src : ANIMEUA_BASE + src } },
                score: null,
                year: null,
                from: 'animeua'
            };
        });
    }

    async function fetchMainPage(page = 1) {
        const url = `${ANIMEUA_BASE}/page/${page}/`;
        const doc = await fetchUA(url);
        return parseCards(doc);
    }

    async function searchAnimeUA(query, page = 1) {
        const url = `${ANIMEUA_BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&page=${page}`;
        const doc = await fetchUA(url);
        return parseCards(doc);
    }

    async function fetchByGenre(genreSlug, page = 1) {
        const url = `${ANIMEUA_BASE}/genre/${genreSlug}/page/${page}/`;
        const doc = await fetchUA(url);
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
            const unique = [];
            const seen = new Set();
            for (const g of genres) {
                if (!seen.has(g.slug)) {
                    seen.add(g.slug);
                    unique.push(g);
                }
            }
            return unique.slice(0, 25);
        } catch (e) {
            console.warn('[MONOANIME] Не вдалося завантажити жанри:', e);
            return [
                { slug: '1', name: 'Action' },
                { slug: '2', name: 'Adventure' },
                { slug: '3', name: 'Comedy' },
                { slug: '4', name: 'Drama' },
                { slug: '5', name: 'Fantasy' },
                { slug: '6', name: 'Horror' },
                { slug: '7', name: 'Romance' },
                { slug: '8', name: 'Sci-Fi' }
            ];
        }
    }

    /* ==================== ПАРСИНГ ДЕТАЛЬНОЇ СТОРІНКИ ==================== */
    async function loadAnimeDetails(animeUrl) {
        console.log('[MONOANIME] Завантаження деталей:', animeUrl);
        const doc = await fetchUA(animeUrl);

        let title = '';
        for (const sel of ['.page__subcol-main h1', '.pmovie__title', 'h1.title', 'h1']) {
            const el = safeQuery(sel, doc);
            if (el?.textContent.trim()) {
                title = el.textContent.trim();
                break;
            }
        }

        let poster = '';
        for (const sel of ['div.page__subcol-side .img-fit-cover img', '.pmovie__poster img', '.anime__poster img']) {
            const el = safeQuery(sel, doc);
            if (el) {
                const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
                if (src) {
                    poster = src.startsWith('http') ? src : ANIMEUA_BASE + src;
                    break;
                }
            }
        }

        const genres = safeQueryAll('.pmovie__genres a, .genres a', doc).map(a => a.textContent.trim()).filter(Boolean);

        const yearEl = safeQuery('.pmovie__year, .release-year', doc);
        const yearText = yearEl?.textContent || '';
        const yearMatch = yearText.match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;

        let synopsis = '';
        for (const sel of ['.full-text', '.pmovie__description', '.anime__description']) {
            const el = safeQuery(sel, doc);
            if (el?.textContent.trim()) {
                synopsis = el.textContent.trim();
                break;
            }
        }

        const playerUrl = await extractPlayerIframeUrl(doc);
        let episodes = [];
        if (playerUrl) {
            console.log('[MONOANIME] Знайдено плеєр:', playerUrl);
            try {
                const playerHtml = await fetchUA(playerUrl);
                const text = playerHtml.body?.innerHTML || '';
                let allSources = extractSourcesFromText(text);

                if (allSources.length === 0) {
                    const nestedIframe = safeQuery('iframe[src]', playerHtml);
                    if (nestedIframe) {
                        let nestedUrl = nestedIframe.getAttribute('src');
                        if (nestedUrl.startsWith('//')) nestedUrl = 'https:' + nestedUrl;
                        if (!nestedUrl.startsWith('http')) nestedUrl = ANIMEUA_BASE + nestedUrl;
                        console.log('[MONOANIME] Вкладений iframe:', nestedUrl);
                        const nestedHtml = await fetchUA(nestedUrl);
                        const nestedText = nestedHtml.body?.innerHTML || '';
                        allSources = extractSourcesFromText(nestedText);
                    }
                }

                console.log('[MONOANIME] Знайдено джерел:', allSources.length);
                episodes = allSources.map((s, idx) => {
                    const parts = (s.label || '').split('/').map(p => p.trim());
                    const season = (s.label || '').match(/[Сс]езон\s*(\d+)/)?.[1] || '1';
                    const epMatch = (s.label || '').match(/[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
                    const episode = epMatch ? (epMatch[1] || epMatch[2]) : String(idx + 1);
                    return {
                        title: s.label || `Серія ${idx+1}`,
                        season: season,
                        episode: episode,
                        poster: s.poster || poster,
                        file: s.file,
                        dub: parts[0] || 'UA',
                        quality: s.label?.match(/\[(\d+p)\]/)?.[1] || ''
                    };
                }).filter(ep => ep.file);
            } catch (e) {
                console.error('[MONOANIME] Помилка парсингу плеєра:', e);
            }
        } else {
            console.warn('[MONOANIME] Плеєр не знайдено');
        }

        return {
            mal_id: animeUrl.hashCode(),
            title,
            images: { jpg: { large_image_url: poster, image_url: poster } },
            genres,
            year,
            synopsis,
            score: null,
            episodes,
            playerUrl,
            url: animeUrl,
            from: 'animeua'
        };
    }

    async function extractPlayerIframeUrl(doc) {
        const selectors = [
            '.video-responsive iframe',
            '.player-responsive iframe',
            '#player iframe',
            'iframe[src*="kodik"]',
            'iframe[src*="alloha"]',
            'iframe[src*="animeua"]',
            'iframe[src*="player"]'
        ];
        for (const sel of selectors) {
            const el = safeQuery(sel, doc);
            if (el) {
                let src = el.getAttribute('src') || el.getAttribute('data-src');
                if (src) {
                    if (src.startsWith('//')) src = 'https:' + src;
                    if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
                    return src;
                }
            }
        }
        const scripts = safeQueryAll('script:not([src])', doc);
        for (const script of scripts) {
            const text = script.textContent;
            const match = text.match(/(?:playerUrl|iframeUrl)\s*=\s*['"]([^'"]+)['"]/);
            if (match) {
                let url = match[1];
                if (url.startsWith('//')) url = 'https:' + url;
                return url;
            }
            const kodikMatch = text.match(/['"](?:https?:)?\/\/(?:kodik|alloha|tortuga)[^'"]+['"]/);
            if (kodikMatch) {
                let url = kodikMatch[0].replace(/['"]/g, '');
                if (url.startsWith('//')) url = 'https:' + url;
                return url;
            }
        }
        return null;
    }

    function extractSourcesFromText(text) {
        const sources = [];

        const m1 = text.match(/['"]file['"]\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
        if (m1) sources.push({ label: 'm3u8', file: m1[1].trim() });

        const m2 = text.match(/['"]file['"]\s*:\s*(\[[\s\S]{0,8000}?\])/);
        if (m2) {
            try {
                const arr = JSON.parse(m2[1]);
                const walk = (items, dub) => {
                    items.forEach(item => {
                        if (item.folder) {
                            walk(item.folder, item.title || dub);
                        } else if (item.file) {
                            sources.push({
                                label: (dub ? dub + ' / ' : '') + (item.title || ''),
                                file: item.file,
                                poster: item.poster || ''
                            });
                        }
                    });
                };
                walk(arr, '');
            } catch (e) {
                console.warn('[MONOANIME] file JSON parse:', e);
            }
        }

        const m3 = text.match(/sources\s*:\s*(\[[\s\S]{0,5000}?\])/);
        if (m3) {
            try {
                const normalized = m3[1]
                    .replace(/(['"])?([a-zA-Z_$][a-zA-Z0-9_$]*)(['"])?\s*:/g, '"$2":')
                    .replace(/'/g, '"');
                const parsed = JSON.parse(normalized);
                parsed.forEach(s => {
                    if (s.file || s.src) {
                        sources.push({ label: s.label || s.type || 'stream', file: s.file || s.src });
                    }
                });
            } catch (e) {
                console.warn('[MONOANIME] sources parse:', e);
            }
        }

        const urls = text.match(/https?:\/\/[^\s'"<>]+\.(m3u8|mp4)[^\s'"<>]*/g) || [];
        urls.forEach(url => {
            if (!sources.some(s => s.file === url)) {
                sources.push({ label: 'direct', file: url });
            }
        });

        const jwMatch = text.match(/jwplayer\s*\([^)]+\)\s*\.setup\s*\(\s*(\{[\s\S]{0,5000}?\})\s*\)/);
        if (jwMatch) {
            const inner = jwMatch[1].match(/['"]file['"]\s*:\s*['"]([^'"]+)['"]/);
            if (inner) sources.push({ label: 'jwplayer', file: inner[1] });
        }

        return sources;
    }

    /* ==================== ПЛЕЄР ==================== */
    let hlsInstance = null;

    function destroyHls() {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
    }

    function loadVideo(url) {
        destroyHls();

        DOM.mainVideoPlayer.pause();
        DOM.mainVideoPlayer.removeAttribute('src');
        DOM.mainVideoPlayer.load();

        if (!url) {
            showToast('❌ Немає URL відео');
            return;
        }

        const finalUrl = getProxyUrl(url);
        console.log('[VIDEO]', finalUrl);

        if (Hls.isSupported()) {
            hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90
            });

            hlsInstance.loadSource(finalUrl);
            hlsInstance.attachMedia(DOM.mainVideoPlayer);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                DOM.mainVideoPlayer.play().catch(() => {});
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                console.log('HLS ERROR', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('network error -> recover');
                            hlsInstance.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('media error -> recover');
                            hlsInstance.recoverMediaError();
                            break;
                        default:
                            destroyHls();
                            break;
                    }
                }
            });
        } else if (DOM.mainVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            DOM.mainVideoPlayer.src = finalUrl;
            DOM.mainVideoPlayer.addEventListener('loadedmetadata', () => {
                DOM.mainVideoPlayer.play().catch(() => {});
            });
        } else {
            DOM.mainVideoPlayer.src = finalUrl;
            DOM.mainVideoPlayer.play().catch(() => {});
        }
    }

    function playEpisode(title, file) {
        if (!file || typeof file !== 'string' || file.trim() === '') {
            console.warn('[MONOANIME] playEpisode: file порожній');
            showToast('❌ Не вдалося отримати посилання на серію');
            return;
        }
        DOM.playerModalTitle.textContent = title;
        DOM.playerModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadVideo(file);
    }

    /* ==================== UI ==================== */
    let currentTab = 'main';
    let currentPage = 1;
    let totalPages = 1;
    let currentList = [];
    let currentSearchQuery = '';
    let currentGenreSlug = null;

    function renderCards(list) {
        if (!list || list.length === 0) {
            DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-film"></i> Нічого не знайдено</div>';
            DOM.paginationRow.innerHTML = '';
            return;
        }
        const bookmarkedIds = new Set(Storage.getBookmarks().map(b => b.mal_id));
        DOM.animeContainer.innerHTML = list.map(anime => {
            const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'https://via.placeholder.com/300x420?text=No+Image';
            const isBm = bookmarkedIds.has(anime.mal_id);
            return `
            <div class="anime-card" data-id="${anime.mal_id}" data-url="${anime.url || ''}">
                <div class="card-img">
                    <img src="${img}" alt="${anime.title}" loading="lazy">
                    <div class="card-actions-overlay">
                        <button class="card-action-btn bookmark-btn ${isBm ? 'bookmarked' : ''}" data-id="${anime.mal_id}">
                            <i class="fas fa-star"></i>
                        </button>
                        <button class="card-action-btn play-btn" data-id="${anime.mal_id}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
                <div class="card-info">
                    <h3>${anime.title.length > 45 ? anime.title.slice(0, 42) + '…' : anime.title}</h3>
                </div>
            </div>`;
        }).join('');

        DOM.animeContainer.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                const url = card.dataset.url;
                if (url) {
                    openDetailModal(url);
                } else {
                    showToast('❌ Немає посилання на аніме');
                }
            });
        });

        DOM.animeContainer.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const anime = currentList.find(a => a.mal_id === id);
                if (anime) toggleBookmark(anime);
            });
        });

        DOM.animeContainer.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const anime = currentList.find(a => a.mal_id === id);
                if (anime && anime.url) {
                    Storage.addHistory(anime);
                    openDetailModal(anime.url);
                } else {
                    showToast('❌ Не вдалося відкрити аніме');
                }
            });
        });

        renderPagination();
    }

    function renderPagination() {
        if (totalPages <= 1) {
            DOM.paginationRow.innerHTML = '';
            return;
        }
        let html = '';
        html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);
        if (start > 1) html += '<span style="color:var(--text-muted);">…</span>';
        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
        }
        if (end < totalPages) html += '<span style="color:var(--text-muted);">…</span>';
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        DOM.paginationRow.innerHTML = html;

        DOM.paginationRow.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page && page >= 1 && page <= totalPages && page !== currentPage) {
                    currentPage = page;
                    loadContent();
                    window.scrollTo({ top: 200, behavior: 'smooth' });
                }
            });
        });
    }

    function toggleBookmark(anime) {
        const bookmarks = Storage.getBookmarks();
        const index = bookmarks.findIndex(b => b.mal_id === anime.mal_id);
        if (index !== -1) {
            bookmarks.splice(index, 1);
            showToast('Видалено з обраного');
        } else {
            bookmarks.push({
                mal_id: anime.mal_id,
                title: anime.title,
                image_url: anime.images?.jpg?.large_image_url || '',
                url: anime.url || '',
                score: anime.score,
                year: anime.year
            });
            showToast('⭐ Додано в обране');
        }
        Storage.saveBookmarks(bookmarks);
        updateBadge();
        if (currentTab === 'bookmarks') loadContent();
        else renderCards(currentList);
    }

    async function openDetailModal(url) {
        if (!url) {
            showToast('❌ Немає посилання');
            return;
        }
        DOM.modalTitle.textContent = 'Завантаження...';
        DOM.modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження деталей...</div>';
        DOM.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        try {
            const anime = await loadAnimeDetails(url);
            Storage.addHistory(anime);
            DOM.modalTitle.textContent = anime.title;

            const bySeasonDub = {};
            anime.episodes.forEach(ep => {
                const season = ep.season || '1';
                const dub = ep.dub || 'UA';
                if (!bySeasonDub[season]) bySeasonDub[season] = {};
                if (!bySeasonDub[season][dub]) bySeasonDub[season][dub] = [];
                bySeasonDub[season][dub].push(ep);
            });

            let episodesHtml = '';
            for (const [season, dubs] of Object.entries(bySeasonDub)) {
                episodesHtml += `<h4 style="margin-top:1.2rem;">📺 Сезон ${season}</h4>`;
                for (const [dub, eps] of Object.entries(dubs)) {
                    episodesHtml += `<p style="margin:0.5rem 0 0.2rem; font-weight:600;">🎙 ${dub}</p><div style="display:flex;flex-wrap:wrap;gap:0.4rem;">`;
                    eps.forEach(ep => {
                        episodesHtml += `<button class="btn-outline ep-btn" data-file="${ep.file}">Еп.${ep.episode}</button>`;
                    });
                    episodesHtml += `</div>`;
                }
            }

            const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);

            DOM.modalBody.innerHTML = `
                <div class="anime-detail-grid">
                    <div class="detail-poster">
                        <img src="${anime.images.jpg.large_image_url}" alt="${anime.title}">
                    </div>
                    <div class="detail-info">
                        <div>
                            <span class="tag"><i class="fas fa-calendar"></i> ${anime.year || '—'}</span>
                            <span class="tag"><i class="fas fa-film"></i> ${anime.episodes.length} еп.</span>
                        </div>
                        <div style="margin:0.5rem 0">
                            ${anime.genres.map(g => `<span class="tag">${g}</span>`).join('') || '<span class="tag">—</span>'}
                        </div>
                        <p class="synopsis">${(anime.synopsis || 'Опис відсутній.').slice(0, 500)}</p>
                        <button class="btn-outline" id="toggleBookmarkBtn">
                            <i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}
                        </button>
                    </div>
                </div>
                <div style="margin-top:1.5rem;">
                    ${episodesHtml || '<p>Серії не знайдено</p>'}
                </div>
            `;

            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
                toggleBookmark(anime);
                openDetailModal(url);
            });

            DOM.modalBody.querySelectorAll('.ep-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const file = btn.dataset.file;
                    const title = `${anime.title} - Еп.${btn.textContent.replace('Еп.', '')}`;
                    playEpisode(title, file);
                });
            });

        } catch (err) {
            console.error('[MONOANIME] openDetailModal error:', err);
            DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
            showToast('❌ ' + err.message);
        }
    }

    function closeModal() {
        DOM.modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    function closePlayerModal() {
        DOM.playerModal.style.display = 'none';
        document.body.style.overflow = '';
        destroyHls();
        DOM.mainVideoPlayer.pause();
        DOM.mainVideoPlayer.src = '';
    }
    function closeProfileModal() {
        DOM.profileModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function openProfileModal() {
        const bookmarks = Storage.getBookmarks();
        const history = Storage.getHistory();
        document.getElementById('statBookmarks').textContent = bookmarks.length;
        document.getElementById('statHistory').textContent = history.length;
        document.getElementById('statWatched').textContent = history.length;

        const bmList = document.getElementById('bookmarkList');
        bmList.innerHTML = bookmarks.length
            ? bookmarks.slice(0, 12).map(b => `<div class="bookmark-item" data-url="${b.url || ''}"><img src="${b.image_url}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 50%22%3E%3Crect fill=%22%23ccc%22 width=%2236%22 height=%2250%22/%3E%3C/svg%3E'"><span>${b.title}</span></div>`).join('')
            : '<p>Немає обраних</p>';

        const histList = document.getElementById('historyList');
        histList.innerHTML = history.length
            ? history.slice(0, 12).map(h => `<div class="bookmark-item" data-url="${h.url || ''}"><img src="${h.image_url}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 50%22%3E%3Crect fill=%22%23ccc%22 width=%2236%22 height=%2250%22/%3E%3C/svg%3E'"><span>${h.title}</span></div>`).join('')
            : '<p>Немає історії</p>';

        bmList.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.dataset.url;
                if (url) {
                    closeProfileModal();
                    openDetailModal(url);
                }
            });
        });
        histList.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.dataset.url;
                if (url) {
                    closeProfileModal();
                    openDetailModal(url);
                }
            });
        });

        DOM.profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    /* ==================== ЗАВАНТАЖЕННЯ КОНТЕНТУ ==================== */
    async function loadContent() {
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        DOM.paginationRow.innerHTML = '';

        try {
            if (currentTab === 'bookmarks') {
                currentList = Storage.getBookmarks();
                totalPages = 1;
                renderCards(currentList);
                return;
            }
            if (currentTab === 'history') {
                currentList = Storage.getHistory();
                totalPages = 1;
                renderCards(currentList);
                return;
            }

            if (currentSearchQuery) {
                currentList = await searchAnimeUA(currentSearchQuery, currentPage);
                totalPages = 5;
            } else if (currentGenreSlug) {
                currentList = await fetchByGenre(currentGenreSlug, currentPage);
                totalPages = 5;
            } else {
                currentList = await fetchMainPage(currentPage);
                totalPages = 5;
            }

            renderCards(currentList);
        } catch (err) {
            console.error('[MONOANIME] loadContent error:', err);
            DOM.animeContainer.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка завантаження: ${err.message}</div>`;
            showToast('❌ Помилка завантаження');
        }
    }

    function resetToMain() {
        currentTab = 'main';
        currentPage = 1;
        currentSearchQuery = '';
        currentGenreSlug = null;
        DOM.searchInput.value = '';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        document.querySelector('[data-tab="main"]').classList.add('active-tab');
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        const allPill = document.querySelector('.category-pill[data-genre=""]');
        if (allPill) allPill.classList.add('active-pill');
        loadContent();
    }

    /* ==================== ЖАНРИ ==================== */
    async function initGenres() {
        const genres = await fetchGenres();
        const scroll = DOM.categoryScroll;
        const existingPills = scroll.querySelectorAll('.category-pill');
        existingPills.forEach(p => p.remove());

        const allBtn = document.createElement('button');
        allBtn.className = 'category-pill active-pill';
        allBtn.dataset.genre = '';
        allBtn.textContent = 'Усі';
        allBtn.addEventListener('click', () => {
            currentGenreSlug = null;
            currentPage = 1;
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            allBtn.classList.add('active-pill');
            loadContent();
        });
        scroll.appendChild(allBtn);

        genres.forEach(genre => {
            const btn = document.createElement('button');
            btn.className = 'category-pill';
            btn.dataset.genre = genre.slug;
            btn.textContent = genre.name;
            btn.addEventListener('click', () => {
                currentGenreSlug = genre.slug;
                currentPage = 1;
                currentSearchQuery = '';
                DOM.searchInput.value = '';
                document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
                btn.classList.add('active-pill');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
                document.querySelector('[data-tab="main"]').classList.add('active-tab');
                currentTab = 'main';
                loadContent();
            });
            scroll.appendChild(btn);
        });
    }

    /* ==================== ПІДПИСКА НА ПОДІЇ ==================== */
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    DOM.profileBtn.addEventListener('click', openProfileModal);
    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.closePlayerBtn.addEventListener('click', closePlayerModal);
    DOM.closeProfileBtn.addEventListener('click', closeProfileModal);
    document.getElementById('logoHome').addEventListener('click', resetToMain);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            currentTab = tab;
            currentPage = 1;
            currentSearchQuery = '';
            currentGenreSlug = null;
            DOM.searchInput.value = '';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
            btn.classList.add('active-tab');
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            const allPill = document.querySelector('.category-pill[data-genre=""]');
            if (allPill) allPill.classList.add('active-pill');
            loadContent();
        });
    });

    DOM.searchInput.addEventListener('input', debounce(() => {
        currentSearchQuery = DOM.searchInput.value.trim();
        currentPage = 1;
        currentGenreSlug = null;
        currentTab = 'main';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        document.querySelector('[data-tab="main"]').classList.add('active-tab');
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        const allPill = document.querySelector('.category-pill[data-genre=""]');
        if (allPill) allPill.classList.add('active-pill');
        loadContent();
    }, 500));

    window.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeModal();
        if (e.target === DOM.playerModal) closePlayerModal();
        if (e.target === DOM.profileModal) closeProfileModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closePlayerModal();
            closeProfileModal();
        }
    });
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        Storage.clearHistory();
        openProfileModal();
        if (currentTab === 'history') loadContent();
    });

    // Старт
    applyTheme(Storage.getTheme());
    updateBadge();
    initGenres().then(() => loadContent());
})();
