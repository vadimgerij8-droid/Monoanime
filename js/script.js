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

    async function extractPlayerIframeUrl(doc) {
        const selectors = [
            '.video-responsive iframe', '.player-responsive iframe', '#player iframe',
            'iframe[src*="kodik"]', 'iframe[src*="alloha"]', 'iframe[src*="player"]'
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
            const match = s.textContent.match(/(?:playerUrl|iframeUrl)\s*=\s*['"]([^'"]+)['"]/);
            if (match) return match[1].startsWith('//') ? 'https:' + match[1] : match[1];
        }
        return null;
    }

    async function resolvePlayerIframe(url, depth = 0) {
        if (!url || depth > 3) return url;
        try {
            const doc = await fetchUA(url);
            const iframe = safeQuery('iframe[src]', doc);
            if (iframe) {
                let src = iframe.getAttribute('src');
                if (src.startsWith('//')) src = 'https:' + src;
                if (!src.startsWith('http')) {
                    try {
                        const base = new URL(url);
                        src = new URL(src, base.origin + base.pathname).href;
                    } catch (e) {
                        src = ANIMEUA_BASE + src;
                    }
                }
                return resolvePlayerIframe(src, depth + 1);
            }
        } catch (e) { console.warn('Recursive iframe fetch error', e); }
        return url;
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
        const initialPlayerUrl = await extractPlayerIframeUrl(doc);
        const playerIframeUrl = initialPlayerUrl ? await resolvePlayerIframe(initialPlayerUrl) : null;
        return {
            mal_id: animeUrl.hashCode(), title,
            images: { jpg: { large_image_url: poster, image_url: poster } },
            genres, year, synopsis, score: null, playerIframeUrl, url: animeUrl, from: 'animeua'
        };
    }

    function getPlayerContainer() {
        let container = document.getElementById('playerIframeContainer');
        if (!container) {
            const videoEl = document.getElementById('mainVideoPlayer');
            if (videoEl) {
                container = document.createElement('div');
                container.id = 'playerIframeContainer';
                container.style.position = 'relative';
                container.style.width = '100%';
                container.style.paddingBottom = '56.25%';
                container.style.background = '#000';
                videoEl.parentNode.replaceChild(container, videoEl);
            } else {
                const modalContent = DOM.playerModal.querySelector('.modal-content') || DOM.playerModal;
                container = document.createElement('div');
                container.id = 'playerIframeContainer';
                container.style.position = 'relative';
                container.style.width = '100%';
                container.style.paddingBottom = '56.25%';
                container.style.background = '#000';
                modalContent.appendChild(container);
            }
        }
        return container;
    }

    function playEpisode(title, iframeUrl) {
        if (!iframeUrl) {
            showToast('❌ Немає URL плеєра');
            return;
        }
        DOM.playerModalTitle.textContent = title;
        DOM.playerModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const container = getPlayerContainer();
        container.innerHTML = '<div class="loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1;"><i class="fas fa-spinner fa-pulse"></i> Завантаження плеєра...</div>';

        const iframe = document.createElement('iframe');
        iframe.src = iframeUrl;
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; fullscreen';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.onload = () => {
            const spinner = container.querySelector('.loader');
            if (spinner) spinner.style.display = 'none';
        };
        iframe.onerror = () => {
            showToast('❌ Помилка завантаження плеєра');
            container.innerHTML = '<div class="loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"><i class="fas fa-exclamation-circle"></i> Помилка завантаження</div>';
        };
        container.appendChild(iframe);
    }

    function closePlayerModal() {
        DOM.playerModal.style.display = 'none';
        document.body.style.overflow = '';
        const container = document.getElementById('playerIframeContainer');
        if (container) container.innerHTML = '';
    }

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

    async function openDetailModal(url) {
        DOM.modalTitle.textContent = 'Завантаження...';
        DOM.modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
        DOM.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        try {
            const anime = await loadAnimeDetails(url);
            Storage.addHistory(anime);
            DOM.modalTitle.textContent = anime.title;
            const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
            DOM.modalBody.innerHTML = `
                <div class="anime-detail-grid">
                    <div class="detail-poster"><img src="${anime.images.jpg.large_image_url}" alt="${anime.title}"></div>
                    <div class="detail-info">
                        <div><span class="tag"><i class="fas fa-calendar"></i> ${anime.year || '—'}</span></div>
                        <div style="margin:0.5rem 0">${anime.genres.map(g => `<span class="tag">${g}</span>`).join('') || '<span class="tag">—</span>'}</div>
                        <p class="synopsis">${(anime.synopsis || 'Опис відсутній.').slice(0, 500)}</p>
                        <button class="btn-outline" id="toggleBookmarkBtn"><i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}</button>
                        ${anime.playerIframeUrl ? `<button class="btn-outline" id="watchBtn"><i class="fas fa-play"></i> Дивитися онлайн</button>` : '<p style="color:#ff6b6b;">⚠️ Плеєр не знайдено</p>'}
                    </div>
                </div>`;
            document.getElementById('toggleBookmarkBtn')?.addEventListener('click', () => { toggleBookmark(anime); openDetailModal(url); });
            const watchBtn = document.getElementById('watchBtn');
            if (watchBtn) {
                watchBtn.addEventListener('click', () => playEpisode(anime.title, anime.playerIframeUrl));
            }
        } catch (err) {
            DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
        }
    }

    function closeModal() { DOM.modal.style.display = 'none'; document.body.style.overflow = ''; }

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
