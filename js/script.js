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

    // ========== Парсер джерел ==========
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
        const selectors = [
            '.video-responsive iframe', 
            '.player-responsive iframe', 
            '#player iframe', 
            '.pmovie__player iframe',
            'iframe[src]',
            'iframe[data-src]'
        ];
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

        const playerUrls = extractPlayerIframeUrls(doc);
        const allSources = [];
        const seenFiles = new Set();
        
        for (const playerUrl of playerUrls) {
            try {
                let provider = 'Джерело';
                if (playerUrl.includes('ashdi')) provider = 'Ashdi';
                else if (playerUrl.includes('vidmoly')) provider = 'Vidmoly';
                else if (playerUrl.includes('player')) provider = 'Player';

                const playerHtml = await fetchUA(playerUrl);
                const text = playerHtml.body?.innerHTML || '';
                const sources = extractSourcesFromText(text, provider);
                
                sources.forEach(s => {
                    if (!seenFiles.has(s.file)) {
                        seenFiles.add(s.file);
                        allSources.push(s);
                    }
                });
                
                const nestedIframes = safeQueryAll('iframe', playerHtml);
                for (const nested of nestedIframes) {
                    let nestedUrl = nested.getAttribute('src') || nested.getAttribute('data-src');
                    if (nestedUrl && nestedUrl !== 'about:blank') {
                        if (nestedUrl.startsWith('//')) nestedUrl = 'https:' + nestedUrl;
                        if (!nestedUrl.startsWith('http')) nestedUrl = ANIMEUA_BASE + nestedUrl;
                        const nestedHtml = await fetchUA(nestedUrl);
                        const nestedSources = extractSourcesFromText(nestedHtml.body?.innerHTML || '', provider);
                        nestedSources.forEach(s => {
                            if (!seenFiles.has(s.file)) {
                                seenFiles.add(s.file);
                                allSources.push(s);
                            }
                        });
                    }
                }
            } catch (e) { console.warn('Player fetch failed', playerUrl, e); }
        }

        // ----- ГАРАНТОВАНЕ РОЗДІЛЕННЯ ОЗВУЧОК -----
        const episodes = allSources.map((s, idx) => {
            const label = s.label || '';
            const seasonMatch = label.match(/[Сс]езон\s*(\d+)/);
            const seasonNum = seasonMatch ? seasonMatch[1] : '1';
            
            const epMatch = label.match(/(\d+)\s*[Сс]ері[яіяа]|[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
            const episode = epMatch ? (epMatch[1] || epMatch[2] || epMatch[3]) : String(idx + 1);
            
            // Визначаємо озвучку більш агресивно
            let dub = label
                .replace(/[Сс]езон\s*\d+/g, '')
                .replace(/[Ее]п\.?\s*\d+|[Сс]ері[яіяа]\s*\d+|\d+\s*[Сс]ері[яіяа]/g, '')
                .replace(/\[\d+p\]/g, '')
                .replace(/\//g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (!dub || dub.length < 2) dub = s.provider || 'UA';
            
            const uniqueDubKey = `${dub} (${s.provider})`;

            return {
                title: label || `Серія ${idx+1}`,
                season: seasonNum,
                episode,
                file: s.file,
                dub: uniqueDubKey,
                quality: label.match(/\[(\d+p)\]/)?.[1] || ''
            };
        }).filter(ep => ep.file);

        // ----- ФІЛЬТРАЦІЯ ТА СОРТУВАННЯ -----
        const seasons = {};
        const addedEpisodes = new Set();
        episodes.forEach(ep => {
            const s = ep.season || '1';
            const d = ep.dub || 'UA';
            const uniqueKey = `${s}_${d}_${ep.episode}`;
            if (addedEpisodes.has(uniqueKey)) return;
            addedEpisodes.add(uniqueKey);
            if (!seasons[s]) seasons[s] = {};
            if (!seasons[s][d]) {
                seasons[s][d] = [];
            }
            seasons[s][d].push(ep);
        });

        Object.keys(seasons).forEach(season => {
            Object.keys(seasons[season]).forEach(dub => {
                seasons[season][dub].sort((a, b) => {
                    return Number(a.episode) - Number(b.episode);
                });
            });
        });

        return {
            mal_id: animeUrl.hashCode(),
            title,
            images: { jpg: { large_image_url: poster, image_url: poster } },
            genres,
            year,
            synopsis,
            episodes,
            seasons,
            url: animeUrl,
            from: 'animeua'
        };
    }

    let hlsInstances = new Map();
    function destroyHlsForVideo(videoEl) {
        if (hlsInstances.has(videoEl)) {
            hlsInstances.get(videoEl).destroy();
            hlsInstances.delete(videoEl);
        }
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
        } else {
            videoElement.src = finalUrl;
            videoElement.play().catch(() => {});
        }
    }

    let currentTab = 'main', currentPage = 1, currentSearchQuery = '', currentGenreSlug = null, currentList = [], currentDetailAnime = null;

    function renderCards(list) {
        if (!DOM.animeContainer) return;
        if (!list.length) {
            DOM.animeContainer.innerHTML = '<div class="loader">Нічого не знайдено</div>';
            return;
        }
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

        DOM.animeContainer.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', () => openDetailModal(card.dataset.url));
        });
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
            
            const seasons = Object.keys(anime.seasons).sort((a,b) => a - b);
            const firstSeason = seasons[0] || '1';
            const dubs = anime.seasons[firstSeason] ? Object.keys(anime.seasons[firstSeason]) : [];
            const firstDub = dubs[0] || '';
            const episodesForFirst = firstDub ? anime.seasons[firstSeason][firstDub] : [];
            
            const html = `
                <div class="anime-detail-grid">
                    <div class="detail-poster"><img src="${anime.images.jpg.large_image_url}" alt="${anime.title}"></div>
                    <div class="detail-info">
                        <div><span class="tag"><i class="fas fa-calendar"></i> ${anime.year || '—'}</span><span class="tag"><i class="fas fa-film"></i> ${anime.episodes.length} еп.</span></div>
                        <div style="margin:0.5rem 0">${anime.genres.map(g => `<span class="tag">${g}</span>`).join('') || '<span class="tag">—</span>'}</div>
                        <p class="synopsis">${(anime.synopsis || 'Опис відсутній.').slice(0, 500)}</p>
                        <button class="btn-outline" id="toggleBookmarkBtn"><i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}</button>
                    </div>
                </div>
                <div style="margin-top:1.5rem;">
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Сезон</label>
                            <select id="seasonSelect" class="btn-outline" style="padding:0.4rem 0.8rem;">
                                ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Озвучка</label>
                            <select id="dubSelect" class="btn-outline" style="padding:0.4rem 0.8rem; max-width: 250px;">
                                ${dubs.map(d => `<option value="${d}">${d}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;"> Серія</label>
                            <select id="episodeSelect" class="btn-outline" style="padding:0.4rem 0.8rem;">
                                ${episodesForFirst.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('')}
                            </select>
                        </div>
                        <button id="playSelectedBtn" class="btn-outline"><i class="fas fa-play"></i> Дивитися</button>
                    </div>
                    <div class="player-container" style="margin-top:1rem;">
                        <video id="detailVideoPlayer" controls crossorigin="anonymous" style="width:100%; border-radius:8px; background:#000;"></video>
                    </div>
                </div>
            `;

            DOM.modalBody.innerHTML = html;
            const detailVideoEl = document.getElementById('detailVideoPlayer');

            function updateEpisodes() {
                const season = document.getElementById('seasonSelect').value;
                const dub = document.getElementById('dubSelect').value;
                const eps = anime.seasons[season]?.[dub] || [];
                const epSelect = document.getElementById('episodeSelect');
                epSelect.innerHTML = eps.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('');
            }

            document.getElementById('seasonSelect').addEventListener('change', function() {
                const season = this.value;
                const dubs = anime.seasons[season] ? Object.keys(anime.seasons[season]) : [];
                const dubSelect = document.getElementById('dubSelect');
                dubSelect.innerHTML = dubs.map(d => `<option value="${d}">${d}</option>`).join('');
                updateEpisodes();
            });

            document.getElementById('dubSelect').addEventListener('change', updateEpisodes);

            document.getElementById('playSelectedBtn').addEventListener('click', () => {
                const file = document.getElementById('episodeSelect').value;
                if (file) loadVideo(file, detailVideoEl);
                else showToast('❌ Немає файлу');
            });

            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
                let b = Storage.getBookmarks();
                const idx = b.findIndex(x => x.mal_id === anime.mal_id);
                if (idx > -1) { b.splice(idx, 1); showToast('Видалено з обраного'); }
                else { b.push(anime); showToast('Додано в обране'); }
                Storage.saveBookmarks(b);
                updateBadge();
                const isNowBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
                document.getElementById('toggleBookmarkBtn').innerHTML = `<i class="fas fa-star"></i> ${isNowBookmarked ? 'В обраному' : 'Додати в обране'}`;
            });

        } catch (err) {
            DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
        }
    }

    if (DOM.closeModalBtn) DOM.closeModalBtn.addEventListener('click', closeDetailModal);
    if (DOM.closePlayerBtn) DOM.closePlayerBtn.addEventListener('click', () => {
        DOM.playerModal.style.display = 'none';
        document.body.style.overflow = '';
        destroyHlsForVideo(DOM.mainVideoPlayer);
    });
    if (DOM.closeProfileBtn) DOM.closeProfileBtn.addEventListener('click', () => {
        DOM.profileModal.style.display = 'none';
        document.body.style.overflow = '';
    });

    function openProfileModal() {
        if (!DOM.profileModal) return;
        const bookmarks = Storage.getBookmarks(), history = Storage.getHistory();
        document.getElementById('statBookmarks').textContent = bookmarks.length;
        document.getElementById('statHistory').textContent = history.length;
        document.getElementById('statWatched').textContent = history.length;
        
        document.getElementById('bookmarkList').innerHTML = bookmarks.length ? bookmarks.slice(0,12).map(b => `<div class="bookmark-item" data-url="${b.url}"><img src="${b.image_url}"><span>${b.title}</span></div>`).join('') : '<p>Немає обраних</p>';
        document.getElementById('historyList').innerHTML = history.length ? history.slice(0,12).map(h => `<div class="bookmark-item" data-url="${h.url}"><img src="${h.image_url}"><span>${h.title}</span></div>`).join('') : '<p>Історія порожня</p>';
        
        document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
            item.addEventListener('click', () => { 
                DOM.profileModal.style.display = 'none';
                document.body.style.overflow = '';
                openDetailModal(item.dataset.url); 
            });
        });
        DOM.profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    async function loadContent() {
        if (!DOM.animeContainer) return;
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        if (DOM.paginationRow) DOM.paginationRow.innerHTML = '';
        try {
            if (currentTab === 'bookmarks') { currentList = Storage.getBookmarks(); }
            else if (currentTab === 'history') { currentList = Storage.getHistory(); }
            else if (currentSearchQuery) { currentList = await searchAnimeUA(currentSearchQuery, currentPage); }
            else if (currentGenreSlug) { currentList = await fetchByGenre(currentGenreSlug, currentPage); }
            else { currentList = await fetchMainPage(currentPage); }
            renderCards(currentList);
        } catch (err) {
            DOM.animeContainer.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
        }
    }

    function resetToMain() {
        currentTab = 'main'; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null;
        if (DOM.searchInput) DOM.searchInput.value = '';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        const mainTab = document.querySelector('[data-tab="main"]');
        if (mainTab) mainTab.classList.add('active-tab');
        loadContent();
    }

    async function initGenres() {
        if (!DOM.categoryScroll) return;
        const genres = await fetchGenres();
        DOM.categoryScroll.querySelectorAll('.category-pill').forEach(p => p.remove());
        const allBtn = document.createElement('button');
        allBtn.className = 'category-pill active-pill';
        allBtn.textContent = 'Усі';
        allBtn.addEventListener('click', () => {
            currentGenreSlug = null; currentPage = 1;
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
                currentGenreSlug = genre.slug; currentPage = 1; currentSearchQuery = ''; if (DOM.searchInput) DOM.searchInput.value = '';
                document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
                btn.classList.add('active-pill');
                loadContent();
            });
            DOM.categoryScroll.appendChild(btn);
        });
    }

    if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    if (DOM.profileBtn) DOM.profileBtn.addEventListener('click', openProfileModal);
    if (document.getElementById('logoHome')) document.getElementById('logoHome').addEventListener('click', resetToMain);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null; if (DOM.searchInput) DOM.searchInput.value = '';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
            btn.classList.add('active-tab');
            loadContent();
        });
    });

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(() => {
            currentSearchQuery = DOM.searchInput.value.trim(); currentPage = 1; currentGenreSlug = null; currentTab = 'main';
            loadContent();
        }, 500));
    }

    window.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeDetailModal();
        if (e.target === DOM.playerModal || e.target === DOM.profileModal) {
            e.target.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            if (DOM.playerModal) DOM.playerModal.style.display = 'none';
            if (DOM.profileModal) DOM.profileModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
        }
    });

    if (document.getElementById('clearHistoryBtn')) {
        document.getElementById('clearHistoryBtn').addEventListener('click', () => { 
            Storage.clearHistory(); openProfileModal(); if (currentTab === 'history') loadContent(); 
        });
    }

    applyTheme(Storage.getTheme());
    updateBadge();
    initGenres().then(() => loadContent());
})();
