(function () {
const PROXY_URL = ‘https://monoanime.animegran8.workers.dev’;
const ANIMEUA_BASE = ‘https://animeua.club’;

```
/* ─── Utils ─────────────────────────────────────────────── */
function hashCode(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getProxyUrl(url) {
    if (!url) { console.warn('getProxyUrl: empty url'); return null; }
    return PROXY_URL + '?url=' + encodeURIComponent(url);
}

function safeQuery(selector, parent = document) {
    try { return parent.querySelector(selector); } catch { return null; }
}

function safeQueryAll(selector, parent = document) {
    try { return Array.from(parent.querySelectorAll(selector)); } catch { return []; }
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* ─── DOM refs ───────────────────────────────────────────── */
const DOM = {
    animeContainer:   document.getElementById('animeContainer'),
    searchInput:      document.getElementById('searchInput'),
    themeToggleBtn:   document.getElementById('themeToggleBtn'),
    profileBtn:       document.getElementById('profileBtn'),
    bookmarkBadge:    document.getElementById('bookmarkBadge'),
    categoryScroll:   document.getElementById('categoryScroll'),
    paginationRow:    document.getElementById('paginationRow'),
    toast:            document.getElementById('toast'),
    modal:            document.getElementById('animeModal'),
    modalTitle:       document.getElementById('modalTitle'),
    modalBody:        document.getElementById('modalBody'),
    closeModalBtn:    document.getElementById('closeModalBtn'),
    playerModal:      document.getElementById('playerModal'),
    playerModalTitle: document.getElementById('playerModalTitle'),
    closePlayerBtn:   document.getElementById('closePlayerBtn'),
    mainVideoPlayer:  document.getElementById('mainVideoPlayer'),
    profileModal:     document.getElementById('profileModal'),
    closeProfileBtn:  document.getElementById('closeProfileBtn'),
    profileBody:      document.getElementById('profileBody'),
};

/* ─── Toast ──────────────────────────────────────────────── */
function showToast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    clearTimeout(DOM.toast._t);
    DOM.toast._t = setTimeout(() => DOM.toast.classList.remove('show'), 2200);
}

/* ─── Storage ────────────────────────────────────────────── */
const Storage = {
    getBookmarks() {
        try { return JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]'); } catch { return []; }
    },
    saveBookmarks(arr) { localStorage.setItem('mono_anime_bookmarks', JSON.stringify(arr)); },
    getHistory() {
        try { return JSON.parse(localStorage.getItem('mono_anime_history') || '[]'); } catch { return []; }
    },
    addHistory(anime) {
        if (!anime?.mal_id) return;
        const hist = this.getHistory().filter(h => h.mal_id !== anime.mal_id);
        hist.unshift({
            mal_id:    anime.mal_id,
            title:     anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url:       anime.url || '',
            score:     anime.score,
            year:      anime.year,
            timestamp: Date.now(),
        });
        localStorage.setItem('mono_anime_history', JSON.stringify(hist.slice(0, 50)));
    },
    clearHistory() { localStorage.setItem('mono_anime_history', '[]'); },
    getTheme()       { return localStorage.getItem('mono_anime_theme') || 'light'; },
    setTheme(theme)  { localStorage.setItem('mono_anime_theme', theme); },
};

/* ─── Theme ──────────────────────────────────────────────── */
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

function updateBadge() {
    const count = Storage.getBookmarks().length;
    DOM.bookmarkBadge.textContent = count;
    DOM.bookmarkBadge.style.display = count > 0 ? 'flex' : 'none';
}

/* ─── Fetch helpers ──────────────────────────────────────── */
// Активний AbortController — скасовуємо попередній запит при новому
let fetchController = null;

async function fetchUA(url) {
    if (!url) throw new Error('empty url');
    const proxyUrl = getProxyUrl(url);
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} для ${url}`);
    const html = await resp.text();
    return new DOMParser().parseFromString(html, 'text/html');
}

/* ─── Парсер карток ──────────────────────────────────────── */
function parseCards(doc) {
    const cards = safeQueryAll('.poster', doc);
    if (cards.length) {
        return cards.map(card => {
            const linkEl = card.tagName === 'A' ? card : safeQuery('a', card);
            const href   = linkEl?.getAttribute('href') || '';
            const img    = safeQuery('img', card);
            const src    = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
            const titleEl = safeQuery('.poster__title', card) || safeQuery('h3', card);
            const title  = (titleEl?.textContent || '').trim() || 'Без назви';
            const fullHref = href.startsWith('http') ? href : ANIMEUA_BASE + href;
            return {
                mal_id: hashCode(fullHref),
                title,
                url:    fullHref,
                images: { jpg: { large_image_url: src.startsWith('http') ? src : (src ? ANIMEUA_BASE + src : '') } },
                score: null, year: null, from: 'animeua',
            };
        });
    }

    // Fallback — шукаємо довільні посилання на аніме
    const links  = safeQueryAll('a[href*="/anime/"]', doc);
    const unique = new Map();
    links.forEach(a => { if (!unique.has(a.href)) unique.set(a.href, a); });
    return Array.from(unique.values()).map(a => {
        const img = safeQuery('img', a);
        const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
        const title = (safeQuery('.poster__title', a)?.textContent || a.textContent || '').trim();
        return {
            mal_id: hashCode(a.href),
            title:  title || 'Без назви',
            url:    a.href,
            images: { jpg: { large_image_url: src.startsWith('http') ? src : ANIMEUA_BASE + src } },
            score: null, year: null, from: 'animeua',
        };
    });
}

/* ─── Джерела сторінок ───────────────────────────────────── */
async function fetchMainPage(page = 1) {
    const doc = await fetchUA(`${ANIMEUA_BASE}/page/${page}/`);
    return parseCards(doc);
}

async function searchAnimeUA(query, page = 1) {
    const doc = await fetchUA(
        `${ANIMEUA_BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&page=${page}`
    );
    return parseCards(doc);
}

async function fetchByGenre(genreSlug, page = 1) {
    const doc = await fetchUA(`${ANIMEUA_BASE}/genre/${genreSlug}/page/${page}/`);
    return parseCards(doc);
}

async function fetchGenres() {
    try {
        const doc        = await fetchUA(ANIMEUA_BASE);
        const genreLinks = safeQueryAll('.genre-nav a, .genres-list a, a[href*="/genre/"]', doc);
        const genres     = genreLinks.map(a => {
            const slug = a.getAttribute('href')?.match(/\/genre\/([^/]+)/)?.[1] || '';
            const name = a.textContent.trim();
            return { slug, name };
        }).filter(g => g.slug && g.name);
        return [...new Map(genres.map(g => [g.slug, g])).values()].slice(0, 25);
    } catch {
        return [
            { slug: '1', name: 'Action' },  { slug: '2', name: 'Adventure' },
            { slug: '3', name: 'Comedy' },  { slug: '4', name: 'Drama' },
            { slug: '5', name: 'Fantasy' }, { slug: '6', name: 'Horror' },
            { slug: '7', name: 'Romance' }, { slug: '8', name: 'Sci-Fi' },
        ];
    }
}

/* ─── ВИПРАВЛЕНО: витяг ВСІХ iframe-плеєрів ─────────────── */
function extractPlayerIframeUrls(doc) {
    const selectors = [
        '.video-responsive iframe',
        '.player-responsive iframe',
        '#player iframe',
        'iframe[src*="kodik"]',
        'iframe[src*="alloha"]',
        'iframe[src*="player"]',
        'iframe[src]',
    ];
    const urls = [];
    for (const sel of selectors) {
        safeQueryAll(sel, doc).forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src');
            if (!src) return;
            if (src.startsWith('//'))    src = 'https:' + src;
            if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
            if (!urls.includes(src))     urls.push(src);
        });
    }
    // Fallback — шукаємо URL у скриптах
    if (!urls.length) {
        safeQueryAll('script:not([src])', doc).forEach(s => {
            const m = s.textContent.match(/(?:playerUrl|iframeUrl|iframe_url)\s*=\s*['"]([^'"]+)['"]/g) || [];
            m.forEach(match => {
                let src = match.match(/['"]([^'"]+)['"]/)?.[1] || '';
                if (!src) return;
                if (src.startsWith('//'))    src = 'https:' + src;
                if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
                if (!urls.includes(src))     urls.push(src);
            });
        });
    }
    return urls;
}

/* ─── ВИПРАВЛЕНО: витяг ВСІХ відео-джерел ───────────────── */
function extractSourcesFromText(text) {
    const sources = [];

    // 1. JSON-масив (найбагатша структура — озвучки/сезони/серії)
    const jsonMatch = text.match(/['"]file['"]\s*:\s*(\[[\s\S]{0,30000}?\])/);
    if (jsonMatch) {
        try {
            const arr = JSON.parse(jsonMatch[1]);
            const walk = (items, dub = '') => {
                items.forEach(item => {
                    if (item.folder) {
                        walk(item.folder, item.title || dub);
                    } else if (item.file) {
                        sources.push({
                            label:  (dub ? dub + ' / ' : '') + (item.title || 'Серія'),
                            file:   item.file,
                            poster: item.poster || '',
                        });
                    }
                });
            };
            walk(arr);
        } catch (e) {
            console.warn('extractSources: JSON.parse failed', e);
        }
    }

    // 2. ВСІ одиночні file: "..." (matchAll — не лише перший)
    const singleMatches = [...text.matchAll(/['"]file['"]\s*:\s*['"]([^'"]+\.(m3u8|mp4)[^'"]*)['"]/g)];
    singleMatches.forEach(m => {
        const url = m[1].trim();
        if (!sources.some(s => s.file === url)) {
            sources.push({ label: 'Потік', file: url, poster: '' });
        }
    });

    // 3. Прямі URL у тексті (резервний варіант)
    const directUrls = [...text.matchAll(/https?:\/\/[^\s'"<>]+\.(m3u8|mp4)[^\s'"<>]*/g)];
    directUrls.forEach(m => {
        const url = m[0];
        if (!sources.some(s => s.file === url)) {
            sources.push({ label: 'Пряме посилання', file: url, poster: '' });
        }
    });

    return sources;
}

/* ─── ВИПРАВЛЕНО: деталі аніме з Promise.all ─────────────── */
async function loadAnimeDetails(animeUrl) {
    if (!animeUrl) throw new Error('URL не вказано');
    const doc = await fetchUA(animeUrl);

    // Заголовок
    let title = '';
    for (const sel of ['.page__subcol-main h1', '.pmovie__title', 'h1.title', 'h1']) {
        const el = safeQuery(sel, doc);
        if (el?.textContent.trim()) { title = el.textContent.trim(); break; }
    }

    // Постер
    let poster = '';
    for (const sel of ['div.page__subcol-side .img-fit-cover img', '.pmovie__poster img', '.anime__poster img']) {
        const el = safeQuery(sel, doc);
        if (el) {
            const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
            if (src) { poster = src.startsWith('http') ? src : ANIMEUA_BASE + src; break; }
        }
    }

    // Жанри, рік, опис
    const genres   = safeQueryAll('.pmovie__genres a, .genres a', doc).map(a => a.textContent.trim()).filter(Boolean);
    const yearEl   = safeQuery('.pmovie__year, .release-year', doc);
    const yearMatch = (yearEl?.textContent || '').match(/\d{4}/);
    const year     = yearMatch ? parseInt(yearMatch[0]) : null;
    let synopsis   = '';
    for (const sel of ['.full-text', '.pmovie__description', '.anime__description']) {
        const el = safeQuery(sel, doc);
        if (el?.textContent.trim()) { synopsis = el.textContent.trim(); break; }
    }

    // ВИПРАВЛЕНО: беремо ВСІ плеєри і паралельно їх завантажуємо
    const playerUrls = extractPlayerIframeUrls(doc);
    let allSources   = [];

    if (playerUrls.length) {
        const results = await Promise.allSettled(
            playerUrls.map(async playerUrl => {
                const playerHtml = await fetchUA(playerUrl);
                let text = playerHtml.body?.innerHTML || '';
                let sources = extractSourcesFromText(text);

                // Якщо джерел немає — шукаємо вкладений iframe
                if (!sources.length) {
                    const nested = safeQuery('iframe[src]', playerHtml);
                    if (nested) {
                        let nestedUrl = nested.getAttribute('src');
                        if (nestedUrl.startsWith('//'))    nestedUrl = 'https:' + nestedUrl;
                        if (!nestedUrl.startsWith('http')) nestedUrl = ANIMEUA_BASE + nestedUrl;
                        const nestedHtml = await fetchUA(nestedUrl);
                        sources = extractSourcesFromText(nestedHtml.body?.innerHTML || '');
                    }
                }
                return sources;
            })
        );

        results.forEach(r => {
            if (r.status === 'fulfilled') allSources.push(...r.value);
        });

        // Прибираємо дублікати по file URL
        const seen = new Set();
        allSources = allSources.filter(s => {
            if (!s.file || seen.has(s.file)) return false;
            seen.add(s.file);
            return true;
        });
    }

    // Формуємо епізоди
    const episodes = allSources.map((s, idx) => {
        const seasonMatch  = (s.label || '').match(/[Сс]езон\s*(\d+)/);
        const episodeMatch = (s.label || '').match(/[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
        const qualityMatch = (s.label || '').match(/\[(\d+p)\]/);
        const parts        = (s.label || '').split('/').map(p => p.trim());
        return {
            title:   s.label || `Серія ${idx + 1}`,
            season:  seasonMatch?.[1] || '1',
            episode: episodeMatch?.[1] || episodeMatch?.[2] || String(idx + 1),
            poster:  s.poster || poster,
            file:    s.file,
            dub:     parts[0] || 'UA',
            quality: qualityMatch?.[1] || '',
        };
    }).filter(ep => ep.file);

    return {
        mal_id:  hashCode(animeUrl),
        title,
        images:  { jpg: { large_image_url: poster, image_url: poster } },
        genres,
        year,
        synopsis,
        score:   null,
        episodes,
        playerUrls,
        url:     animeUrl,
        from:    'animeua',
    };
}

/* ─── HLS / відеоплеєр ───────────────────────────────────── */
let hlsInstance = null;

function destroyHls() {
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    DOM.mainVideoPlayer.pause();
    DOM.mainVideoPlayer.removeAttribute('src');
    DOM.mainVideoPlayer.load();
}

function loadVideo(url) {
    destroyHls();
    if (!url) { showToast('❌ Немає URL відео'); return; }

    const finalUrl = getProxyUrl(url);

    if (Hls.isSupported()) {
        hlsInstance = new Hls({
            enableWorker:   true,
            lowLatencyMode: false,
            backBufferLength: 90,
        });
        hlsInstance.loadSource(finalUrl);
        hlsInstance.attachMedia(DOM.mainVideoPlayer);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            DOM.mainVideoPlayer.play().catch(() => {});
        });
        hlsInstance.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal) return;
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR: hlsInstance.startLoad(); break;
                case Hls.ErrorTypes.MEDIA_ERROR:   hlsInstance.recoverMediaError(); break;
                default: destroyHls(); showToast('❌ Помилка відтворення'); break;
            }
        });
    } else if (DOM.mainVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        DOM.mainVideoPlayer.src = finalUrl;
        DOM.mainVideoPlayer.addEventListener('loadedmetadata', () => {
            DOM.mainVideoPlayer.play().catch(() => {});
        }, { once: true });
    } else {
        DOM.mainVideoPlayer.src = finalUrl;
        DOM.mainVideoPlayer.play().catch(() => {});
    }
}

function playEpisode(title, file) {
    if (!file) { showToast('❌ Немає файлу для відтворення'); return; }
    DOM.playerModalTitle.textContent = title;
    DOM.playerModal.style.display    = 'flex';
    document.body.style.overflow     = 'hidden';
    loadVideo(file);
}

/* ─── Стан додатку ───────────────────────────────────────── */
let currentTab         = 'main';
let currentPage        = 1;
let totalPages         = 1;
let currentList        = [];
let currentSearchQuery = '';
let currentGenreSlug   = null;

/* ─── Рендер карток ──────────────────────────────────────── */
function renderCards(list) {
    if (!list?.length) {
        DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-film"></i> Нічого не знайдено</div>';
        DOM.paginationRow.innerHTML  = '';
        return;
    }

    const bookmarkedIds = new Set(Storage.getBookmarks().map(b => b.mal_id));

    DOM.animeContainer.innerHTML = list.map(anime => {
        const img  = anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/300x420?text=No+Image';
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

    // Кліки по картках
    DOM.animeContainer.querySelectorAll('.anime-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('.card-action-btn')) return;
            if (card.dataset.url) openDetailModal(card.dataset.url);
        });
    });

    // Закладки
    DOM.animeContainer.querySelectorAll('.bookmark-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id    = parseInt(btn.dataset.id);
            const anime = currentList.find(a => a.mal_id === id);
            if (anime) toggleBookmark(anime);
        });
    });

    // Кнопка "Грати"
    DOM.animeContainer.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id    = parseInt(btn.dataset.id);
            const anime = currentList.find(a => a.mal_id === id);
            if (anime?.url) { Storage.addHistory(anime); openDetailModal(anime.url); }
        });
    });

    renderPagination();
}

/* ─── Пагінація ──────────────────────────────────────────── */
function renderPagination() {
    if (totalPages <= 1) { DOM.paginationRow.innerHTML = ''; return; }

    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    let html    = `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i>
                   </button>`;
    if (start > 1)    html += '<span>…</span>';
    for (let i = start; i <= end; i++)
        html += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
    if (end < totalPages) html += '<span>…</span>';
    html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
                 <i class="fas fa-chevron-right"></i>
             </button>`;
    DOM.paginationRow.innerHTML = html;

    DOM.paginationRow.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                loadContent();
                window.scrollTo({ top: 200, behavior: 'smooth' });
            }
        });
    });
}

/* ─── Закладки ───────────────────────────────────────────── */
function toggleBookmark(anime) {
    const bookmarks = Storage.getBookmarks();
    const idx       = bookmarks.findIndex(b => b.mal_id === anime.mal_id);
    if (idx !== -1) {
        bookmarks.splice(idx, 1);
        showToast('Видалено з обраного');
    } else {
        bookmarks.push({
            mal_id:    anime.mal_id,
            title:     anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url:       anime.url || '',
            score:     anime.score,
            year:      anime.year,
        });
        showToast('⭐ Додано в обране');
    }
    Storage.saveBookmarks(bookmarks);
    updateBadge();
    if (currentTab === 'bookmarks') loadContent();
    else renderCards(currentList);
}

/* ─── Модалка деталей ────────────────────────────────────── */
async function openDetailModal(url) {
    DOM.modalTitle.textContent = 'Завантаження...';
    DOM.modalBody.innerHTML    = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
    DOM.modal.style.display    = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const anime = await loadAnimeDetails(url);
        Storage.addHistory(anime);
        DOM.modalTitle.textContent = anime.title;

        // Групуємо по сезону та озвучці
        const bySeasonDub = {};
        anime.episodes.forEach(ep => {
            const s = ep.season || '1';
            const d = ep.dub || 'UA';
            if (!bySeasonDub[s])    bySeasonDub[s]    = {};
            if (!bySeasonDub[s][d]) bySeasonDub[s][d] = [];
            bySeasonDub[s][d].push(ep);
        });

        let episodesHtml = '';
        for (const [season, dubs] of Object.entries(bySeasonDub)) {
            episodesHtml += `<h4 style="margin-top:1.2rem;">📺 Сезон ${season}</h4>`;
            for (const [dub, eps] of Object.entries(dubs)) {
                episodesHtml += `<p style="margin:0.5rem 0 0.2rem;font-weight:600;">🎙 ${dub}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">`;
                eps.forEach(ep =>
                    episodesHtml += `<button class="btn-outline ep-btn" data-file="${ep.file}">Еп.${ep.episode}</button>`
                );
                episodesHtml += '</div>';
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
                ${episodesHtml || '<p>Серії не знайдено. Можливо, відео захищене або сайт змінив структуру.</p>'}
            </div>`;

        document.getElementById('toggleBookmarkBtn').addEventListener('click', () => {
            toggleBookmark(anime);
            openDetailModal(url);
        });

        DOM.modalBody.querySelectorAll('.ep-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const epNum = btn.textContent.replace('Еп.', '').trim();
                playEpisode(`${anime.title} — Еп. ${epNum}`, btn.dataset.file);
            });
        });

    } catch (err) {
        console.error('openDetailModal error:', err);
        DOM.modalBody.innerHTML = `
            <div class="loader">
                <i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}
            </div>`;
    }
}

/* ─── Закриття модалок ───────────────────────────────────── */
function closeModal()        { DOM.modal.style.display        = 'none'; document.body.style.overflow = ''; }
function closePlayerModal()  { DOM.playerModal.style.display  = 'none'; document.body.style.overflow = ''; destroyHls(); }
function closeProfileModal() { DOM.profileModal.style.display = 'none'; document.body.style.overflow = ''; }

/* ─── Профіль ────────────────────────────────────────────── */
function openProfileModal() {
    const bookmarks = Storage.getBookmarks();
    const history   = Storage.getHistory();

    document.getElementById('statBookmarks').textContent = bookmarks.length;
    document.getElementById('statHistory').textContent   = history.length;
    document.getElementById('statWatched').textContent   = history.length;

    const noImg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="56"><rect width="40" height="56" fill="%23333"/></svg>';

    document.getElementById('bookmarkList').innerHTML = bookmarks.length
        ? bookmarks.slice(0, 12).map(b =>
            `<div class="bookmark-item" data-url="${b.url}">
                <img src="${b.image_url}" onerror="this.src='${noImg}'">
                <span>${b.title}</span>
            </div>`).join('')
        : '<p>Немає обраних</p>';

    document.getElementById('historyList').innerHTML = history.length
        ? history.slice(0, 12).map(h =>
            `<div class="bookmark-item" data-url="${h.url}">
                <img src="${h.image_url}" onerror="this.src='${noImg}'">
                <span>${h.title}</span>
            </div>`).join('')
        : '<p>Немає історії</p>';

    document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
        item.addEventListener('click', () => {
            closeProfileModal();
            openDetailModal(item.dataset.url);
        });
    });

    DOM.profileModal.style.display    = 'flex';
    document.body.style.overflow = 'hidden';
}

/* ─── Завантаження контенту ──────────────────────────────── */
async function loadContent() {
    DOM.animeContainer.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
    DOM.paginationRow.innerHTML  = '';
    try {
        if (currentTab === 'bookmarks') {
            currentList = Storage.getBookmarks(); totalPages = 1;
        } else if (currentTab === 'history') {
            currentList = Storage.getHistory(); totalPages = 1;
        } else if (currentSearchQuery) {
            currentList = await searchAnimeUA(currentSearchQuery, currentPage); totalPages = 5;
        } else if (currentGenreSlug) {
            currentList = await fetchByGenre(currentGenreSlug, currentPage); totalPages = 5;
        } else {
            currentList = await fetchMainPage(currentPage); totalPages = 5;
        }
        renderCards(currentList);
    } catch (err) {
        console.error('loadContent error:', err);
        DOM.animeContainer.innerHTML = `
            <div class="loader">
                <i class="fas fa-exclamation-triangle"></i> Помилка завантаження: ${err.message}
            </div>`;
    }
}

/* ─── Скидання до головної ───────────────────────────────── */
function resetToMain() {
    currentTab = 'main'; currentPage = 1; currentSearchQuery = ''; currentGenreSlug = null;
    DOM.searchInput.value = '';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.querySelector('[data-tab="main"]')?.classList.add('active-tab');
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
    document.querySelector('.category-pill[data-genre=""]')?.classList.add('active-pill');
    loadContent();
}

/* ─── Жанри ──────────────────────────────────────────────── */
async function initGenres() {
    const genres = await fetchGenres();
    DOM.categoryScroll.querySelectorAll('.category-pill').forEach(p => p.remove());

    const allBtn = document.createElement('button');
    allBtn.className    = 'category-pill active-pill';
    allBtn.dataset.genre = '';
    allBtn.textContent  = 'Усі';
    allBtn.addEventListener('click', () => {
        currentGenreSlug = null; currentPage = 1;
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        allBtn.classList.add('active-pill');
        loadContent();
    });
    DOM.categoryScroll.appendChild(allBtn);

    genres.forEach(genre => {
        const btn = document.createElement('button');
        btn.className    = 'category-pill';
        btn.dataset.genre = genre.slug;
        btn.textContent  = genre.name;
        btn.addEventListener('click', () => {
            currentGenreSlug = genre.slug; currentPage = 1;
            currentSearchQuery = ''; DOM.searchInput.value = '';
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            btn.classList.add('active-pill');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
            document.querySelector('[data-tab="main"]')?.classList.add('active-tab');
            currentTab = 'main';
            loadContent();
        });
        DOM.categoryScroll.appendChild(btn);
    });
}

/* ─── Event listeners ────────────────────────────────────── */
DOM.themeToggleBtn.addEventListener('click', toggleTheme);
DOM.profileBtn.addEventListener('click', openProfileModal);
DOM.closeModalBtn.addEventListener('click', closeModal);
DOM.closePlayerBtn.addEventListener('click', closePlayerModal);
DOM.closeProfileBtn.addEventListener('click', closeProfileModal);

document.getElementById('logoHome').addEventListener('click', resetToMain);

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab; currentPage = 1;
        currentSearchQuery = ''; currentGenreSlug = null;
        DOM.searchInput.value = '';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
        btn.classList.add('active-tab');
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        document.querySelector('.category-pill[data-genre=""]')?.classList.add('active-pill');
        loadContent();
    });
});

DOM.searchInput.addEventListener('input', debounce(() => {
    currentSearchQuery = DOM.searchInput.value.trim();
    currentPage = 1; currentGenreSlug = null; currentTab = 'main';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.querySelector('[data-tab="main"]')?.classList.add('active-tab');
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
    document.querySelector('.category-pill[data-genre=""]')?.classList.add('active-pill');
    loadContent();
}, 500));

window.addEventListener('click', e => {
    if (e.target === DOM.modal)         closeModal();
    if (e.target === DOM.playerModal)   closePlayerModal();
    if (e.target === DOM.profileModal)  closeProfileModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closePlayerModal(); closeProfileModal(); }
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    Storage.clearHistory();
    openProfileModal();
    if (currentTab === 'history') loadContent();
});

/* ─── Ініціалізація ──────────────────────────────────────── */
applyTheme(Storage.getTheme());
updateBadge();
initGenres().then(() => loadContent());
```

})();
