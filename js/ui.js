import { DOM, showToast, updateBadge } from './dom.js';
import { Storage } from './storage.js';
import { getProxyUrl } from './utils.js';
import { PROXY_URL, ANIMEUA_BASE } from './config.js';

let hlsInstances = new Map();
export function destroyHlsForVideo(videoEl) {
    if (hlsInstances.has(videoEl)) {
        hlsInstances.get(videoEl).destroy();
        hlsInstances.delete(videoEl);
    }
}

export function loadVideo(url, videoElement = DOM.mainVideoPlayer) {
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

export let currentTab = 'main';
export let currentPage = 1;
export let currentSearchQuery = '';
export let currentGenreSlug = null;
export let currentList = [];
export let currentDetailAnime = null;

export function renderCards(list) {
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

export function renderPagination() {
    if (!DOM.paginationRow) return;
    let html = '';
    if (currentPage > 1) {
        html += `<button class="btn-outline prev-page">Назад</button>`;
    }
    html += `<span style="margin:0 1rem; font-weight:bold;">Сторінка ${currentPage}</span>`;
    html += `<button class="btn-outline next-page">Вперед</button>`;
    DOM.paginationRow.innerHTML = html;

    const prevBtn = DOM.paginationRow.querySelector('.prev-page');
    const nextBtn = DOM.paginationRow.querySelector('.next-page');
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(currentPage + 1));
}

export function changePage(p) {
    currentPage = p;
    window.scrollTo(0, 0);
    // loadContent буде імпортовано з events, щоб уникнути циклів, викличемо подію або зробимо через main
    // Тому викличемо функцію loadContent, яка буде передана через замикання
    // Тут просто викликаємо глобальну подію: document.dispatchEvent(new CustomEvent('pageChanged'));
    // Але простіше зробити loadContent доступним через модуль main, тому зробимо інакше.
    // Замість цього в ui залишимо посилання на функцію, яку встановить main.
    if (typeof uiLoadContent === 'function') uiLoadContent();
}
// Функцію-завантажувач встановимо з main:
export let uiLoadContent = null;
export function setLoadContent(fn) { uiLoadContent = fn; }

export function closeDetailModal() {
    if (!DOM.modal) return;
    DOM.modal.style.display = 'none';
    document.body.style.overflow = '';
    const video = document.getElementById('detailVideoPlayer');
    if (video) {
        video.pause();
        destroyHlsForVideo(video);
    }
}

export function toggleBookmark(anime) {
    let b = Storage.getBookmarks();
    const idx = b.findIndex(x => x.mal_id === anime.mal_id);
    if (idx > -1) {
        b.splice(idx, 1);
        showToast('Видалено з обраного');
    } else {
        b.push(anime);
        showToast('Додано в обране');
    }
    Storage.saveBookmarks(b);
    updateBadge();
}

// Функція відкриття деталей аніме буде визначена пізніше через імпорт api, тому робимо через динамічний імпорт або передамо
// Проте для уникнення циклічних залежностей між ui та api, краще винести openDetailModal в events або зробити через async import.
// Ми можемо просто залишити оголошення і ініціалізувати з events.
export let openDetailModal = null;
export function setOpenDetailModal(fn) { openDetailModal = fn; }

export async function buildDetailModal(anime) {
    const isBookmarked = Storage.getBookmarks().some(b => b.mal_id === anime.mal_id);
    const seasons = Object.keys(anime.seasons).sort((a,b) => parseInt(a) - parseInt(b));
    const firstSeason = seasons[0] || '1';
    const dubs = Object.keys(anime.seasons[firstSeason] || {}).sort();
    const firstDub = dubs[0] || '';
    const episodes = firstDub ? anime.seasons[firstSeason][firstDub] : [];
    const totalEpisodes = episodes.length;

    const ratingTag = anime.rating ? `<span class="tag rating-tag"><i class="fas fa-user-shield"></i> ${anime.rating}</span>` : '';

    return `
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
                <button class="btn-outline" id="toggleBookmarkBtn" style="margin-top: 1.5rem;">
                    <i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}
                </button>
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
                <button id="playSelectedBtn" class="btn-outline" style="align-self: flex-end; padding: 0.4rem 0.8rem; background: #ffcc00; color: #333; border: none; font-size: 0.85rem; margin-top: 8px;">
                    <i class="fas fa-play"></i> ДИВИТИСЯ
                </button>
            </div>
            <div class="player-container" style="margin-top:1rem; background: #000; border-radius: 8px; overflow: hidden; aspect-ratio: 16/9;">
                <video id="detailVideoPlayer" controls crossorigin="anonymous" style="width:100%; height: 100%;"></video>
            </div>
        </div>
    `;
}

export function attachDetailEvents(anime) {
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

    // Логіка "більше"
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
}

export function openProfileModal() {
    if (!DOM.profileModal) return;
    const bookmarks = Storage.getBookmarks(),
          history = Storage.getHistory();
    const bList = document.getElementById('bookmarkList'),
          hList = document.getElementById('historyList');

    if (bList) bList.innerHTML = bookmarks.length
        ? bookmarks.slice(0,12).map(b => `<div class="bookmark-item" data-url="${b.url}"><img src="${b.image_url}"><span>${b.title}</span></div>`).join('')
        : '<p>Немає обраних</p>';
    if (hList) hList.innerHTML = history.length
        ? history.slice(0,12).map(h => `<div class="bookmark-item" data-url="${h.url}"><img src="${h.image_url}"><span>${h.title}</span></div>`).join('')
        : '<p>Історія порожня</p>';

    document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
        item.addEventListener('click', () => {
            DOM.profileModal.style.display = 'none';
            document.body.style.overflow = '';
            if (openDetailModal) openDetailModal(item.dataset.url);
        });
    });

    DOM.profileModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
