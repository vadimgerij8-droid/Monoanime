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

    // Парсинг каталогу
    function parseCards(doc) {
        const cards = doc.querySelectorAll('.poster');
        if (cards.length) {
            return Array.from(cards).map(card => {
                const linkEl = card.tagName === 'A' ? card : card.querySelector('a');
                const href = linkEl?.getAttribute('href') || '';
                const img = card.querySelector('img');
                const posterSrc = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                const titleEl = card.querySelector('.poster__title') || card.querySelector('h3');
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
        const links = doc.querySelectorAll('a[href*="/anime/"]');
        const unique = new Map();
        links.forEach(a => { if (!unique.has(a.href)) unique.set(a.href, a); });
        return Array.from(unique.values()).map(a => {
            const img = a.querySelector('img');
            const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
            const title = (a.querySelector('.poster__title')?.textContent || a.textContent || '').trim();
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
            const genreLinks = doc.querySelectorAll('.genre-nav a, .genres-list a, a[href*="/genre/"]');
            const genres = Array.from(genreLinks).map(a => {
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

    // ================== НОВА ОБРОБКА ПЛЕЄРІВ ==================
    function extractPlayerIframes(doc) {
        const iframes = [];
        doc.querySelectorAll('iframe[src]').forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src');
            if (!src) return;
            if (src.startsWith('//')) src = 'https:' + src;
            if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
            iframes.push({ url: src, type: detectPlayerType(src) });
        });
        const scripts = doc.querySelectorAll('script:not([src])');
        scripts.forEach(s => {
            const text = s.textContent;
            const match = text.match(/(?:playerUrl|iframeUrl|src)\s*[:=]\s*['"]([^'"]+)['"]/);
            if (match) {
                let url = match[1];
                if (url.startsWith('//')) url = 'https:' + url;
                iframes.push({ url, type: detectPlayerType(url) });
            }
        });
        return iframes;
    }

    function detectPlayerType(url) {
        if (/kodik\.(info|biz|cc|su)/i.test(url)) return 'kodik';
        if (/alloha\.(tv|su|cc)/i.test(url)) return 'alloha';
        return 'unknown';
    }

    function extractKodikToken(html) {
        const match = html.match(/token\s*[:=]\s*['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    }

    async function fetchKodikEpisodes(iframeUrl) {
        const response = await fetch(getProxyUrl(iframeUrl));
        const html = await response.text();
        const token = extractKodikToken(html);
        if (!token) {
            console.warn('Kodik token not found');
            return [];
        }
        const idMatch = iframeUrl.match(/\/(?:serial|seria)\/(\d+)/);
        if (!idMatch) return [];
        const serialId = idMatch[1];
        const apiUrl = `https://kodik.info/api/series/${serialId}?token=${token}`;
        const apiResp = await fetch(getProxyUrl(apiUrl));
        if (!apiResp.ok) return [];
        const data = await apiResp.json();
        return parseKodikApiResponse(data);
    }

    function parseKodikApiResponse(data) {
        const episodes = [];
        // Адаптовано під структуру: data.results.seasons -> { "1": { "Озвучка": [ {episode: 1, url: "..."}, ... ] } }
        const seasons = data.results?.seasons || data.seasons || {};
        for (const [season, dubs] of Object.entries(seasons)) {
            for (const [dub, files] of Object.entries(dubs)) {
                // files може бути масивом або об'єктом з ключами-епізодами
                const episodesList = Array.isArray(files) ? files : Object.values(files);
                episodesList.forEach(file => {
                    episodes.push({
                        title: `${dub} / Сезон ${season} / Серія ${file.episode || file.id}`,
                        season: season,
                        episode: String(file.episode || file.id),
                        file: file.url || file.src || file.file,
                        dub: dub,
                    });
                });
            }
        }
        return episodes;
    }

    async function loadAnimeDetails(animeUrl) {
        const doc = await fetchUA(animeUrl);
        let title = '';
        for (const sel of ['.page__subcol-main h1', '.pmovie__title', 'h1.title', 'h1']) {
            const el = doc.querySelector(sel);
            if (el?.textContent.trim()) { title = el.textContent.trim(); break; }
        }
        let poster = '';
        for (const sel of ['div.page__subcol-side .img-fit-cover img', '.pmovie__poster img', '.anime__poster img']) {
            const el = doc.querySelector(sel);
            if (el) {
                const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
                if (src) { poster = src.startsWith('http') ? src : ANIMEUA_BASE + src; break; }
            }
        }
        const genres = Array.from(doc.querySelectorAll('.pmovie__genres a, .genres a')).map(a => a.textContent.trim()).filter(Boolean);
        const yearEl = doc.querySelector('.pmovie__year, .release-year');
        const yearMatch = (yearEl?.textContent || '').match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        let synopsis = '';
        for (const sel of ['.full-text', '.pmovie__description', '.anime__description']) {
            const el = doc.querySelector(sel);
            if (el?.textContent.trim()) { synopsis = el.textContent.trim(); break; }
        }

        const iframes = extractPlayerIframes(doc);
        let allEpisodes = [];

        for (const iframe of iframes) {
            try {
                if (iframe.type === 'kodik') {
                    const eps = await fetchKodikEpisodes(iframe.url);
                    allEpisodes = allEpisodes.concat(eps);
                } else {
                    // Для невідомих плеєрів – fallback (можна залишити пустим або спробувати старий метод)
                    // Тут можна вставити стару логіку, але вона скоріш за все не спрацює
                }
            } catch (e) {
                console.warn('Помилка обробки плеєра', iframe.url, e);
            }
        }

        // Групування за сезонами та озвучками
        const seasons = {};
        allEpisodes.forEach(ep => {
            const s = ep.season || '1';
            const d = ep.dub || 'UA';
            if (!seasons[s]) seasons[s] = {};
            if (!seasons[s][d]) seasons[s][d] = [];
            seasons[s][d].push(ep);
        });

        return {
            mal_id: animeUrl.hashCode(),
            title,
            images: { jpg: { large_image_url: poster, image_url: poster } },
            genres,
            year,
            synopsis,
            score: null,
            episodes: allEpisodes,
            seasons,
            url: animeUrl,
            from: 'animeua'
        };
    }

    // ================== ПЛЕЄР ==================
    let hlsInstances = new Map();

    function destroyHlsForVideo(videoEl) {
        if (hlsInstances.has(videoEl)) {
            hlsInstances.get(videoEl).destroy();
            hlsInstances.delete(videoEl);
        }
    }

    function loadVideo(url, videoElement) {
        destroyHlsForVideo(videoElement);
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        if (!url) { showToast('❌ Немає URL відео'); return; }
        const finalUrl = getProxyUrl(url);
        if (Hls.isSupported()) {
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
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = finalUrl;
            videoElement.addEventListener('loadedmetadata', () => videoElement.play().catch(() => {}));
        } else {
            videoElement.src = finalUrl;
            videoElement.play().catch(() => {});
        }
    }

    // ================== UI ==================
    let currentTab = 'main', currentPage = 1, totalPages = 1, currentList = [], currentSearchQuery = '', currentGenreSlug = null;
    let currentDetailAnime = null, detailVideoEl = null;

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
                if (anime && anime.url) {
                    Storage.addHistory(anime);
                    openDetailModal(anime.url);
                }
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

    function closeDetailModal() {
        DOM.modal.style.display = 'none';
        document.body.style.overflow = '';
        if (detailVideoEl) {
            destroyHlsForVideo(detailVideoEl);
            detailVideoEl = null;
        }
        currentDetailAnime = null;
    }

    async function openDetailModal(url) {
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
            const seasons = Object.keys(anime.seasons).sort((a, b) => a - b);
            const firstSeason = seasons[0] || '1';
            const dubs = anime.seasons[firstSeason] ? Object.keys(anime.seasons[firstSeason]) : [];
            const firstDub = dubs[0] || '';
            const episodesForFirst = firstDub ? anime.seasons[firstSeason][firstDub] : [];

            const dubOptions = dubs.map(d => `<option value="${d}">${d}</option>`).join('');
            const episodeOptions = episodesForFirst.map(ep => `<option value="${ep.file}" data-episode="${ep.episode}">Еп. ${ep.episode}</option>`).join('');

            DOM.modalBody.innerHTML = `
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
                            <label style="font-weight:600;">📺 Сезон</label>
                            <select id="seasonSelect" class="btn-outline" style="padding:0.4rem 0.8rem;">
                                ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;">🎙 Озвучка</label>
                            <select id="dubSelect" class="btn-outline" style="padding:0.4rem 0.8rem;">${dubOptions}</select>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-weight:600;">🎬 Серія</label>
                            <select id="episodeSelect" class="btn-outline" style="padding:0.4rem 0.8rem;">${episodeOptions}</select>
                        </div>
                        <button id="playSelectedBtn" class="btn-outline"><i class="fas fa-play"></i> Дивитися</button>
                    </div>
                    <div class="player-container" style="margin-top:1rem;">
                        <video id="detailVideoPlayer" controls crossorigin="anonymous"></video>
                    </div>
                </div>
            `;

            detailVideoEl = document.getElementById('detailVideoPlayer');

            function updateEpisodes() {
                const season = document.getElementById('seasonSelect').value;
                const dub = document.getElementById('dubSelect').value;
                const eps = anime.seasons[season]?.[dub] || [];
                const epSelect = document.getElementById('episodeSelect');
                epSelect.innerHTML = eps.map(ep => `<option value="${ep.file}" data-episode="${ep.episode}">Еп. ${ep.episode}</option>`).join('');
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
                const epText = document.getElementById('episodeSelect').selectedOptions[0]?.dataset.episode || '';
                const season = document.getElementById('seasonSelect').value;
                const dub = document.getElementById('dubSelect').value;
                const title = `${anime.title} С${season} / ${dub} / Еп.${epText}`;
                if (file) loadVideo(file, detailVideoEl);
                else showToast('❌ Немає файлу');
            });

            document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
                toggleBookmark(anime);
                const isNowBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
                const btn = document.getElementById('toggleBookmarkBtn');
                if (btn) btn.innerHTML = `<i class="fas fa-star"></i> ${isNowBookmarked ? 'В обраному' : 'Додати в обране'}`;
            });

        } catch (err) {
            DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
        }
    }

    function openProfileModal() {
        const bookmarks = Storage.getBookmarks();
        const history = Storage.getHistory();
        document.getElementById('statBookmarks').textContent = bookmarks.length;
        document.getElementById('statHistory').textContent = history.length;
        document.getElementById('statWatched').textContent = history.length;

        const bmList = document.getElementById('bookmarkList');
        bmList.innerHTML = bookmarks.length
            ? bookmarks.slice(0, 12).map(b => `<div class="bookmark-item" data-url="${b.url || ''}"><img src="${b.image_url}" onerror="this.src='data:image/svg+xml,...'"><span>${b.title}</span></div>`).join('')
            : '<p>Немає обраних</p>';

        const histList = document.getElementById('historyList');
        histList.innerHTML = history.length
            ? history.slice(0, 12).map(h => `<div class="bookmark-item" data-url="${h.url || ''}"><img src="${h.image_url}" onerror="..."><span>${h.title}</span></div>`).join('')
            : '<p>Немає історії</p>';

        document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                DOM.profileModal.style.display = 'none';
                document.body.style.overflow = '';
                if (item.dataset.url) openDetailModal(item.dataset.url);
            });
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

    // Обробники подій
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    DOM.profileBtn.addEventListener('click', openProfileModal);
    DOM.closeModalBtn.addEventListener('click', closeDetailModal);
    DOM.closePlayerBtn.addEventListener('click', () => {
        DOM.playerModal.style.display = 'none';
        document.body.style.overflow = '';
        destroyHlsForVideo(DOM.mainVideoPlayer);
    });
    DOM.closeProfileBtn.addEventListener('click', () => {
        DOM.profileModal.style.display = 'none';
        document.body.style.overflow = '';
    });

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

    window.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeDetailModal();
        if (e.target === DOM.playerModal) {
            DOM.playerModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
        }
        if (e.target === DOM.profileModal) {
            DOM.profileModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            DOM.playerModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
            DOM.profileModal.style.display = 'none';
            document.body.style.overflow = '';
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
