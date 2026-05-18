import { DOM, showToast, applyTheme, toggleTheme, updateBadge } from './dom.js';
import { debounce } from './utils.js';
import { Storage } from './storage.js';
import {
    fetchMainPage, searchAnimeUA, fetchByGenre, fetchTop100, fetchGenres, loadAnimeDetails
} from './api.js';
import {
    renderCards, renderPagination, changePage, closeDetailModal,
    currentTab, currentPage, currentSearchQuery, currentGenreSlug, currentList, currentDetailAnime,
    setLoadContent, setOpenDetailModal, openDetailModal, buildDetailModal, attachDetailEvents,
    loadVideo, destroyHlsForVideo, openProfileModal
} from './ui.js';

// Головна функція завантаження контенту
export async function loadContent() {
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

// Функція відкриття детального вікна
async function openDetail(url) {
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
        DOM.modalBody.innerHTML = await buildDetailModal(anime);
        attachDetailEvents(anime);
    } catch (err) {
        DOM.modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
    }
}

// Ініціалізація жанрів
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

// Реєструємо всі обробники подій
export function registerEvents() {
    applyTheme(Storage.getTheme());
    updateBadge();

    if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    if (DOM.profileBtn) DOM.profileBtn.addEventListener('click', openProfileModal);
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debounce(() => {
            currentSearchQuery = DOM.searchInput.value.trim();
            currentPage = 1;
            currentTab = 'main';
            loadContent();
        }, 500));
    }

    if (DOM.closeModalBtn) DOM.closeModalBtn.addEventListener('click', closeDetailModal);
    if (DOM.closePlayerBtn) {
        DOM.closePlayerBtn.addEventListener('click', () => {
            DOM.playerModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
        });
    }
    if (DOM.closeProfileBtn) {
        DOM.closeProfileBtn.addEventListener('click', () => {
            DOM.profileModal.style.display = 'none';
            document.body.style.overflow = '';
        });
    }

    // ТОП 100
    if (DOM.top100Btn) {
        DOM.top100Btn.addEventListener('click', async () => {
            currentTab = 'top100';
            currentPage = 1;
            currentSearchQuery = null;
            currentGenreSlug = null;
            await loadContent();
        });
    }

    // Випадкове аніме
    if (DOM.randomBtn) {
        DOM.randomBtn.addEventListener('click', () => {
            const randomUrl = 'https://animeua.club/index.php?do=rand';
            openDetail(randomUrl);
        });
    }

    // Закриття модалок кліком поза ними
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

    // Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            if (DOM.playerModal) DOM.playerModal.style.display = 'none';
            document.body.style.overflow = '';
            destroyHlsForVideo(DOM.mainVideoPlayer);
            if (DOM.profileModal) DOM.profileModal.style.display = 'none';
        }
    });
}

// Після ініціалізації запускаємо
export async function initApp() {
    // Встановлюємо залежності між модулями
    setLoadContent(loadContent);
    setOpenDetailModal(openDetail);
    
    registerEvents();
    await initGenres();
    await loadContent();
}
