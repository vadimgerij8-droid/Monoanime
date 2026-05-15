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

    // ==================== PLAYERJS PARSER ====================

    function fixJsonLikeString(str) {
        let fixed = str
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
            .replace(/'/g, '"')
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
            .replace(/\\x([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ');
        return fixed;
    }

    function extractPlayerJSConfig(text) {
        const patterns = [
            /new\s+Playerjs\s*\(\s*({[\s\S]*?})\s*\)/i,
            /Playerjs\s*\(\s*({[\s\S]*?})\s*\)/i,
            /player\s*=\s*new\s+Playerjs\s*\(\s*({[\s\S]*?})\s*\)/i,
            /var\s+player\s*=\s*new\s+Playerjs\s*\(\s*({[\s\S]*?})\s*\)/i,
            /playerjs\s*\(\s*({[\s\S]*?})\s*\)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    const fixed = fixJsonLikeString(match[1]);
                    return JSON.parse(fixed);
                } catch (e) {
                    console.warn('PlayerJS parse failed, trying alternative:', e.message);
                    const fileMatch = match[1].match(/["']?file["']?\s*:\s*(\[[\s\S]*?\]|["'][^"']+["'])/);
                    if (fileMatch) {
                        try {
                            const fixed = fixJsonLikeString(fileMatch[1]);
                            return { file: JSON.parse(fixed) };
                        } catch (e2) {
                            const url = fileMatch[1].replace(/["']/g, '').trim();
                            if (url) return { file: url };
                        }
                    }
                }
            }
        }
        return null;
    }

    // Допоміжні функції для нового парсера
    function extractSeasonNumber(title) {
        const match = title.match(/сезон\s*(\d+)|season\s*(\d+)/i);
        return match ? (match[1] || match[2]) : '1';
    }

    function extractEpisodeNumber(str) {
        const match = str.match(/[ЕеEp\.]*(?:пізод|pisode|p\.)?[\s-]*(\d+)|(\d+)[\s]*(?:серія|ep|series)?/i);
        return match ? (match[1] || match[2]) : '1';
    }

    function extractQuality(str) {
        const qMatch = str.match(/(\d{3,4})p/);
        return qMatch ? qMatch[1] + 'p' : '';
    }

    /** @param {string} currentDub - назва озвучки, що передається з батьківського рівня */
    function parseEpisodeItem(ep, seasonNum = '1', currentDub = '', results = []) {
        if (!ep) return results;

        const episodeTitle = ep.title || ep.name || 'Епізод';
        const epNum = extractEpisodeNumber(episodeTitle);

        // Якщо file – масив (різні озвучки)
        if (Array.isArray(ep.file)) {
            ep.file.forEach((dubItem, idx) => {
                const dubTitle = dubItem.title || dubItem.name || `Озвучка ${idx + 1}`;
                const dubFile = dubItem.file || dubItem.url || dubItem;
                if (typeof dubFile === 'string' && (
                    dubFile.startsWith('http') || 
                    /\.(m3u8|mp4|mkv|avi|webm|txt|php)/i.test(dubFile)
                )) {
                    results.push({
                        title: episodeTitle,
                        season: seasonNum,
                        episode: epNum,
                        dub: currentDub || dubTitle || 'Основна озвучка',
                        file: dubFile,
                        poster: ep.poster || dubItem.poster || '',
                        subtitle: ep.subtitle || dubItem.subtitle || '',
                        id: ep.id || '',
                        quality: extractQuality(dubTitle + ' ' + dubFile)
                    });
                }
            });
            return results;
        }

        // Один файл
        if (typeof ep.file === 'string' && (
            ep.file.startsWith('http') || 
            /\.(m3u8|mp4|mkv|avi|webm|txt|php)/i.test(ep.file)
        )) {
            results.push({
                title: episodeTitle,
                season: seasonNum,
                episode: epNum,
                dub: currentDub || 'Основна озвучка',
                file: ep.file,
                poster: ep.poster || '',
                subtitle: ep.subtitle || '',
                id: ep.id || '',
                quality: extractQuality(episodeTitle + ' ' + ep.file)
            });
        }

        return results;
    }

    // ==================== ГОЛОВНА ЗМІНА: ПЕРЕПИСАНА parsePlaylistItem ====================
    function parsePlaylistItem(item, parentTitle = '', currentDub = '', results = []) {
        if (!item) return results;

        // Якщо є масив folder – це або сезони, або дубляжі, або серії
        if (item.folder && Array.isArray(item.folder)) {
            item.folder.forEach(child => {
                const childTitle = (child.title || child.name || '').toLowerCase();

                // 🟢 Нова структурна перевірка: чи є цей рівень озвучкою
                // Озвучка – це коли всі дочірні елементи або мають file, або самі є папками з folder
                const looksLikeDub =
                    child.folder &&
                    child.folder.every(f =>
                        f.file ||
                        (f.folder && Array.isArray(f.folder))
                    );

                // Якщо це окремий рівень озвучки
                if (looksLikeDub && child.folder) {
                    // Рекурсивно обробляємо вміст, передаючи назву дубляжу
                    if (Array.isArray(child.folder)) {
                        child.folder.forEach(grandchild => {
                            parsePlaylistItem(grandchild, parentTitle, child.title, results);
                        });
                    }
                } else if (child.folder && Array.isArray(child.folder)) {
                    // Звичайна структура: сезони або серії
                    // 🟢 Виправлена перевірка на сезони (безпечний доступ)
                    const firstGrand = child.folder?.[0];
                    const isSeasonStructure =
                        firstGrand &&
                        firstGrand.folder &&
                        Array.isArray(firstGrand.folder);

                    if (isSeasonStructure) {
                        // Це рівень сезонів
                        child.folder.forEach(season => {
                            const seasonTitle = season.title || season.name || parentTitle;
                            const seasonNum = extractSeasonNumber(seasonTitle);
                            if (season.folder && Array.isArray(season.folder)) {
                                season.folder.forEach(ep => {
                                    parseEpisodeItem(ep, seasonNum, currentDub, results);
                                });
                            }
                        });
                    } else {
                        // Плоский список серій (без сезонів)
                        const seasonNum = extractSeasonNumber(child.title || parentTitle);
                        child.folder.forEach(ep => {
                            parseEpisodeItem(ep, seasonNum, currentDub, results);
                        });
                    }
                } else if (child.file) {
                    // Безпосередній епізод
                    parseEpisodeItem(child, extractSeasonNumber(parentTitle), currentDub, results);
                }
            });
            return results;
        }

        // Якщо це вкладений плейлист (playlist)
        if (item.playlist && Array.isArray(item.playlist)) {
            item.playlist.forEach(pl => parsePlaylistItem(pl, parentTitle, currentDub, results));
            return results;
        }

        // Якщо це безпосередньо епізод (є file)
        if (item.file) {
            parseEpisodeItem(item, parentTitle, currentDub, results);
        }

        return results;
    }

    // Витягування прямого посилання для moonanime.art
    function extractFileFromMoonAnime(html) {
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            const fileMatch = match[1].match(/(?:file|src)\s*:\s*["']([^"']+\.m3u8)["']/);
            if (fileMatch) return fileMatch[1];
        }
        return null;
    }

    function extractSourcesFromText(text) {
        console.log('=== EXTRACTING SOURCES ===');
        const sources = [];

        // 1. PlayerJS конфіг
        const playerConfig = extractPlayerJSConfig(text);
        if (playerConfig) {
            console.log('PLAYERJS CONFIG:', playerConfig);
            if (playerConfig.file) {
                if (Array.isArray(playerConfig.file)) {
                    playerConfig.file.forEach((item, idx) => {
                        parsePlaylistItem(item, '', '', sources);
                    });
                } else if (typeof playerConfig.file === 'string') {
                    sources.push({
                        title: 'Епізод 1',
                        season: '1',
                        episode: '1',
                        dub: 'Основна озвучка',
                        file: playerConfig.file,
                        poster: '',
                        id: '',
                        quality: extractQuality(playerConfig.file)
                    });
                }
            }

            if (playerConfig.playlist && Array.isArray(playerConfig.playlist)) {
                playerConfig.playlist.forEach(item => {
                    parsePlaylistItem(item, '', '', sources);
                });
            }
        }

        // 2. Прямий плейліст
        const playlistMatches = text.matchAll(/["']?playlist["']?\s*:\s*(\[[\s\S]{0,15000}?\])(?=\s*[,}])/g);
        for (const match of playlistMatches) {
            try {
                const fixed = fixJsonLikeString(match[1]);
                const playlist = JSON.parse(fixed);
                if (Array.isArray(playlist)) {
                    playlist.forEach(item => {
                        parsePlaylistItem(item, '', '', sources);
                    });
                }
            } catch (e) {
                console.warn('Direct playlist parse failed:', e.message);
            }
        }

        // 3. Файли масив
        const fileMatches = text.matchAll(/["']?file["']?\s*:\s*(\[[\s\S]{0,15000}?\])(?=\s*[,}])/g);
        for (const match of fileMatches) {
            try {
                const fixed = fixJsonLikeString(match[1]);
                const files = JSON.parse(fixed);
                if (Array.isArray(files)) {
                    files.forEach(item => {
                        parseEpisodeItem(item, '1', '', sources);
                    });
                }
            } catch (e) {
                console.warn('Direct file parse failed:', e.message);
            }
        }

        // 4. Пряме посилання на відео (розширений regex)
        const directUrls = text.matchAll(/https?:\/\/[^\s'"<>]+\.(m3u8|mp4|mkv|avi|webm|txt|php)/g);
        for (const match of directUrls) {
            const url = match[0];
            if (!sources.some(s => s.file === url)) {
                sources.push({
                    title: 'Епізод',
                    season: '1',
                    episode: '1',
                    dub: 'Основна озвучка',
                    file: url,
                    poster: '',
                    id: '',
                    quality: extractQuality(url)
                });
            }
        }

        console.log('TOTAL SOURCES:', sources);
        return sources;
    }

    async function resolveNestedIframe(doc, depth = 0) {
        if (depth > 3) {
            console.warn('Max iframe depth reached');
            return null;
        }

        const iframe = safeQuery('iframe[src], iframe[data-src]', doc);
        if (!iframe) return null;

        let src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
        if (!src) return null;

        if (src.startsWith('//')) src = 'https:' + src;
        if (!src.startsWith('http')) src = ANIMEUA_BASE + src;

        console.log(`Resolving iframe (depth ${depth}):`, src);

        try {
            const nestedDoc = await fetchUA(src);
            const nestedIframe = safeQuery('iframe[src], iframe[data-src]', nestedDoc);
            if (nestedIframe) {
                return resolveNestedIframe(nestedDoc, depth + 1);
            }
            return nestedDoc;
        } catch (e) {
            console.error('Iframe error:', e);
            return null;
        }
    }

    async function extractPlayerIframeUrl(doc) {
        const selectors = [
            '.video-responsive iframe',
            '.player-responsive iframe',
            '#player iframe',
            'iframe[src*="kodik"]',
            'iframe[src*="alloha"]',
            'iframe[src*="player"]',
            'iframe[src*="video"]',
            'iframe[src*="stream"]'
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
        for (const s of scripts) {
            const patterns = [
                /(?:playerUrl|iframeUrl|src)\s*=\s*['"]([^'"]+)['"]/,
                /['"]file['"]\s*:\s*['"]([^'"]+)['"]/,
                /url\s*:\s*['"]([^'"]+)['"]/
            ];
            for (const pattern of patterns) {
                const match = s.textContent.match(pattern);
                if (match) {
                    let url = match[1];
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!url.startsWith('http')) url = ANIMEUA_BASE + url;
                    return url;
                }
            }
        }

        return null;
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

        const playerUrl = await extractPlayerIframeUrl(doc);
        let episodes = [];

        if (playerUrl) {
            try {
                let playerDoc = await fetchUA(playerUrl);
                let text = playerDoc.body?.innerHTML || '';

                const nestedDoc = await resolveNestedIframe(playerDoc);
                if (nestedDoc) {
                    text = nestedDoc.body?.innerHTML || '';
                }

                // Перевірка moonanime.art
                const isMoon = text.includes('moonanime.art') || (nestedDoc?.location?.href?.includes('moonanime.art'));
                if (isMoon) {
                    const moonFile = extractFileFromMoonAnime(text);
                    if (moonFile) {
                        episodes = [{
                            title: 'Серія 1',
                            season: '1',
                            episode: '1',
                            dub: 'Основна озвучка',
                            file: moonFile,
                            poster: '',
                            id: '',
                            quality: extractQuality(moonFile)
                        }];
                    }
                }

                // Якщо moon не знайдено, використовуємо загальний парсинг
                if (episodes.length === 0) {
                    let allSources = extractSourcesFromText(text);

                    if (!allSources.length && nestedDoc) {
                        const scripts = safeQueryAll('script:not([src])', nestedDoc);
                        for (const s of scripts) {
                            const scriptSources = extractSourcesFromText(s.textContent);
                            if (scriptSources.length) {
                                allSources.push(...scriptSources);
                            }
                        }
                    }

                    if (!allSources.length) {
                        const scripts = safeQueryAll('script:not([src])', playerDoc);
                        for (const s of scripts) {
                            const scriptSources = extractSourcesFromText(s.textContent);
                            if (scriptSources.length) {
                                allSources.push(...scriptSources);
                            }
                        }
                    }

                    console.log('FINAL EPISODES:', allSources);
                    episodes = allSources;
                }
            } catch (e) {
                console.error('Episode parsing error:', e);
            }
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

    // ==================== VIDEO PLAYER ====================

    let hlsInstance = null;
    function destroyHls() { if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; } }

    function loadVideo(url) {
        destroyHls();
        DOM.mainVideoPlayer.pause();
        DOM.mainVideoPlayer.removeAttribute('src');
        DOM.mainVideoPlayer.load();
        if (!url) { showToast('❌ Немає URL відео'); return; }
        const finalUrl = getProxyUrl(url);
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
            hlsInstance.loadSource(finalUrl);
            hlsInstance.attachMedia(DOM.mainVideoPlayer);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => DOM.mainVideoPlayer.play().catch(() => {}));
            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: hlsInstance.startLoad(); break;
                        case Hls.ErrorTypes.MEDIA_ERROR: hlsInstance.recoverMediaError(); break;
                        default: destroyHls();
                    }
                }
            });
        } else if (DOM.mainVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            DOM.mainVideoPlayer.src = finalUrl;
            DOM.mainVideoPlayer.addEventListener('loadedmetadata', () => DOM.mainVideoPlayer.play().catch(() => {}));
        } else {
            DOM.mainVideoPlayer.src = finalUrl;
            DOM.mainVideoPlayer.play().catch(() => {});
        }
    }

    function playEpisode(title, file) {
        if (!file) { showToast('❌ Немає файлу'); return; }
        DOM.playerModalTitle.textContent = title;
        DOM.playerModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadVideo(file);
    }

    // ==================== UI ====================

    let currentTab = 'main', currentPage = 1, totalPages = 1, currentList = [], currentSearchQuery = '', currentGenreSlug = null;

    function renderCards(list) {
        if (!list || !list.length) {
            DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-film"></i> Нічого не знайдено</div>';
            DOM.paginationRow.innerHTML = '';
            return;
        }
        const bookmarkedIds = new Set(Storage.getBookmarks().map(b => b.mal_id));
        DOM.animeContainer.innerHTML = list.map(anime => {
            const img = anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/300x420?text=No+Image';
            const isBm = bookmarkedIds.has(anime.mal_id);
            return `<div class="anime-card" data-id="${anime.mal_id}" data-url="${anime.url || ''}">
                <div class="card-img"><img src="${img}" alt="${anime.title}" loading="lazy">
                    <div class="card-actions-overlay">
                        <button class="card-action-btn bookmark-btn ${isBm ? 'bookmarked' : ''}" data-id="${anime.mal_id}"><i class="fas fa-star"></i></button>
                        <button class="card-action-btn play-btn" data-id="${anime.mal_id}"><i class="fas fa-play"></i></button>
                    </div>
                </div>
                <div class="card-info"><h3>${anime.title.length > 45 ? anime.title.slice(0, 42) + '…' : anime.title}</h3></div>
            </div>`;
        }).join('');

        DOM.animeContainer.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                if (card.dataset.url) openDetailModal(card.dataset.url);
            });
        });
        DOM.animeContainer.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const anime = currentList.find(a => a.mal_id === parseInt(btn.dataset.id));
                if (anime) toggleBookmark(anime);
            });
        });
        DOM.animeContainer.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const anime = currentList.find(a => a.mal_id === parseInt(btn.dataset.id));
                if (anime && anime.url) { Storage.addHistory(anime); openDetailModal(anime.url); }
            });
        });
        renderPagination();
    }

    function renderPagination() {
        if (totalPages <= 1) { DOM.paginationRow.innerHTML = ''; return; }
        let html = `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        const start = Math.max(1, currentPage - 2), end = Math.min(totalPages, currentPage + 2);
        if (start > 1) html += '<span>…</span>';
        for (let i = start; i <= end; i++) html += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
        if (end < totalPages) html += '<span>…</span>';
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        DOM.paginationRow.innerHTML = html;
        DOM.paginationRow.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page && page !== currentPage) { currentPage = page; loadContent(); window.scrollTo({ top: 200, behavior: 'smooth' }); }
            });
        });
    }

    function toggleBookmark(anime) {
        const bookmarks = Storage.getBookmarks();
        const idx = bookmarks.findIndex(b => b.mal_id === anime.mal_id);
        if (idx !== -1) { bookmarks.splice(idx, 1); showToast('Видалено з обраного'); }
        else {
            bookmarks.push({ mal_id: anime.mal_id, title: anime.title, image_url: anime.images?.jpg?.large_image_url || '', url: anime.url || '', score: anime.score, year: anime.year });
            showToast('⭐ Додано в обране');
        }
        Storage.saveBookmarks(bookmarks);
        updateBadge();
        if (currentTab === 'bookmarks') loadContent(); else renderCards(currentList);
    }

    // ==================== MODAL WITH SEASON/DUB/EPISODE SELECTORS ====================

    async function openDetailModal(url) {
        DOM.modalTitle.textContent = 'Завантаження...';
        DOM.modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        DOM.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        try {
            const anime = await loadAnimeDetails(url);
            Storage.addHistory(anime);
            DOM.modalTitle.textContent = anime.title;

            // Групуємо за сезоном та озвучкою
            const bySeasonDub = {};
            anime.episodes.forEach(ep => {
                const season = ep.season || '1';
                const dub = ep.dub || 'Основна озвучка';
                if (!bySeasonDub[season]) bySeasonDub[season] = {};
                if (!bySeasonDub[season][dub]) bySeasonDub[season][dub] = [];
                bySeasonDub[season][dub].push(ep);
            });

            // Сортуємо серії
            Object.keys(bySeasonDub).forEach(season => {
                Object.keys(bySeasonDub[season]).forEach(dub => {
                    bySeasonDub[season][dub].sort((a, b) => parseInt(a.episode) - parseInt(b.episode));
                });
            });

            const seasons = Object.keys(bySeasonDub).sort((a, b) => parseInt(a) - parseInt(b));
            const firstSeason = seasons[0] || '1';
            const dubs = Object.keys(bySeasonDub[firstSeason] || {}).sort();
            const firstDub = dubs[0] || 'Основна озвучка';

            const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);

            let episodesHtml = '';
            if (anime.episodes.length > 0) {
                episodesHtml = `
                    <div class="player-controls">
                        <div class="control-group">
                            <div class="select-wrapper">
                                <label>📺 Сезон</label>
                                <select id="seasonSelect" class="styled-select">
                                    ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
                                </select>
                            </div>
                            <div class="select-wrapper">
                                <label>🎙️ Озвучка</label>
                                <select id="dubSelect" class="styled-select">
                                    ${dubs.map(d => `<option value="${d}" ${d === firstDub ? 'selected' : ''}>${d}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div id="episodesContainer" class="episodes-grid"></div>
                    </div>
                `;
            } else {
                episodesHtml = '<p>Серії не знайдено</p>';
            }

            DOM.modalBody.innerHTML = `
                <div class="anime-detail-grid">
                    <div class="detail-poster"><img src="${anime.images.jpg.large_image_url}" alt="${anime.title}"></div>
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
                    <h3 style="margin-bottom: 1rem;">🎬 Перегляд</h3>
                    ${episodesHtml}
                </div>`;

            function renderEpisodes(season, dub) {
                const container = document.getElementById('episodesContainer');
                const eps = bySeasonDub[season]?.[dub] || [];
                
                if (eps.length === 0) {
                    container.innerHTML = '<p style="opacity: 0.6;">Серії не знайдено для цього вибору</p>';
                    return;
                }

                container.innerHTML = eps.map((ep, idx) => `
                    <button class="btn-outline ep-btn ${idx === 0 ? 'active-episode' : ''}" 
                            data-file="${ep.file}" 
                            data-episode="${ep.episode}"
                            title="${ep.title || `Серія ${ep.episode}`}">
                        <span class="ep-number">${ep.episode}</span>
                        ${ep.quality ? `<span class="ep-quality">${ep.quality}</span>` : ''}
                    </button>
                `).join('');

                container.querySelectorAll('.ep-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        container.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active-episode'));
                        this.classList.add('active-episode');
                        const episodeNum = this.dataset.episode;
                        playEpisode(`${anime.title} - Сезон ${season}, Серія ${episodeNum} [${dub}]`, this.dataset.file);
                    });
                });
            }

            const seasonSelect = document.getElementById('seasonSelect');
            const dubSelect = document.getElementById('dubSelect');

            if (seasonSelect && dubSelect) {
                seasonSelect.addEventListener('change', function() {
                    const selectedSeason = this.value;
                    const availableDubs = Object.keys(bySeasonDub[selectedSeason] || {}).sort();
                    
                    dubSelect.innerHTML = availableDubs.map(d => 
                        `<option value="${d}">${d}</option>`
                    ).join('');
                    
                    renderEpisodes(selectedSeason, availableDubs[0] || 'Основна озвучка');
                });

                dubSelect.addEventListener('change', function() {
                    renderEpisodes(seasonSelect.value, this.value);
                });

                renderEpisodes(firstSeason, firstDub);
            }

            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => { 
                toggleBookmark(anime); 
                openDetailModal(url); 
            });

        } catch (err) {
            DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
        }
    }

    function closeModal() { DOM.modal.style.display = 'none'; document.body.style.overflow = ''; }
    function closePlayerModal() { DOM.playerModal.style.display = 'none'; document.body.style.overflow = ''; destroyHls(); }
    function closeProfileModal() { DOM.profileModal.style.display = 'none'; document.body.style.overflow = ''; }

    function openProfileModal() {
        const bookmarks = Storage.getBookmarks(), history = Storage.getHistory();
        document.getElementById('statBookmarks').textContent = bookmarks.length;
        document.getElementById('statHistory').textContent = history.length;
        document.getElementById('statWatched').textContent = history.length;
        document.getElementById('bookmarkList').innerHTML = bookmarks.length ? bookmarks.slice(0,12).map(b => `<div class="bookmark-item" data-url="${b.url}"><img src="${b.image_url}" onerror="this.src='data:image/svg+xml,...'"><span>${b.title}</span></div>`).join('') : '<p>Немає обраних</p>';
        document.getElementById('historyList').innerHTML = history.length ? history.slice(0,12).map(h => `<div class="bookmark-item" data-url="${h.url}"><img src="${h.image_url}" onerror="..."><span>${h.title}</span></div>`).join('') : '<p>Немає історії</p>';
        document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
            item.addEventListener('click', () => { closeProfileModal(); openDetailModal(item.dataset.url); });
        });
        DOM.profileModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    async function loadContent() {
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        DOM.paginationRow.innerHTML = '';
        try {
            if (currentTab === 'bookmarks') { currentList = Storage.getBookmarks(); totalPages = 1; }
            else if (currentTab === 'history') { currentList = Storage.getHistory(); totalPages = 1; }
            else if (currentSearchQuery) { currentList = await searchAnimeUA(currentSearchQuery, currentPage); totalPages = 5; }
            else if (currentGenreSlug) { currentList = await fetchByGenre(currentGenreSlug, currentPage); totalPages = 5; }
            else { currentList = await fetchMainPage(currentPage); totalPages = 5; }
            renderCards(currentList);
        } catch (err) {
            DOM.animeContainer.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
        }
    }

    function resetToMain() {
        currentTab = 'main'; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null;
        DOM.searchInput.value = '';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        document.querySelector('[data-tab="main"]').classList.add('active-tab');
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        const allPill = document.querySelector('.category-pill[data-genre=""]');
        if (allPill) allPill.classList.add('active-pill');
        loadContent();
    }

    async function initGenres() {
        const genres = await fetchGenres();
        DOM.categoryScroll.querySelectorAll('.category-pill').forEach(p => p.remove());
        const allBtn = document.createElement('button');
        allBtn.className = 'category-pill active-pill';
        allBtn.dataset.genre = '';
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
            btn.dataset.genre = genre.slug;
            btn.textContent = genre.name;
            btn.addEventListener('click', () => {
                currentGenreSlug = genre.slug; currentPage = 1; currentSearchQuery = ''; DOM.searchInput.value = '';
                document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
                btn.classList.add('active-pill');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
                document.querySelector('[data-tab="main"]').classList.add('active-tab');
                currentTab = 'main';
                loadContent();
            });
            DOM.categoryScroll.appendChild(btn);
        });
    }

    // Event listeners
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    DOM.profileBtn.addEventListener('click', openProfileModal);
    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.closePlayerBtn.addEventListener('click', closePlayerModal);
    DOM.closeProfileBtn.addEventListener('click', closeProfileModal);
    document.getElementById('logoHome').addEventListener('click', resetToMain);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null; DOM.searchInput.value = '';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
            btn.classList.add('active-tab');
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            const allPill = document.querySelector('.category-pill[data-genre=""]');
            if (allPill) allPill.classList.add('active-pill');
            loadContent();
        });
    });
    DOM.searchInput.addEventListener('input', debounce(() => {
        currentSearchQuery = DOM.searchInput.value.trim(); currentPage = 1; currentGenreSlug = null; currentTab = 'main';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        document.querySelector('[data-tab="main"]').classList.add('active-tab');
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        const allPill = document.querySelector('.category-pill[data-genre=""]');
        if (allPill) allPill.classList.add('active-pill');
        loadContent();
    }, 500));
    window.addEventListener('click', (e) => { if (e.target === DOM.modal) closeModal(); if (e.target === DOM.playerModal) closePlayerModal(); if (e.target === DOM.profileModal) closeProfileModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closePlayerModal(); closeProfileModal(); } });
    document.getElementById('clearHistoryBtn').addEventListener('click', () => { Storage.clearHistory(); openProfileModal(); if (currentTab === 'history') loadContent(); });

    applyTheme(Storage.getTheme());
    updateBadge();
    initGenres().then(() => loadContent());
})();
