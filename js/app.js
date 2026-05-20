import Storage from './storage.js';

// Глобалізація функцій, які були у звичайних скриптах
const {
    fetchTop100,
    searchAnimeUA,
    fetchByGenre,
    fetchMainPage,
    fetchGenres,
    applyTheme,
    toggleTheme,
    debounce,
    renderCards,
    destroyHlsForVideo
} = window;

let currentTab = 'main';
let currentPage = 1;
let currentSearchQuery = '';
let currentGenreSlug = null;
let currentList = [];

// Робимо currentPage глобально доступною для ui.js
window.currentPage = 1;

window.changePage = (p) => {
    window.currentPage = p;
    window.scrollTo(0, 0);
    loadContent();
};

async function loadContent() {
    const container = document.getElementById('animeContainer');
    if (!container) return;
    container.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
    try {
        if (currentTab === 'top100') {
            currentList = await fetchTop100();
        } else if (currentSearchQuery) {
            currentList = await searchAnimeUA(currentSearchQuery, window.currentPage);
        } else if (currentGenreSlug) {
            currentList = await fetchByGenre(currentGenreSlug, window.currentPage);
        } else {
            currentList = await fetchMainPage(window.currentPage);
        }
        renderCards(currentList);
    } catch (err) {
        container.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
    }
}

async function showTop100() {
    currentTab = 'top100';
    window.currentPage = 1;
    currentSearchQuery = '';
    currentGenreSlug = null;
    const container = document.getElementById('animeContainer');
    if (container) container.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження ТОП 100...</div>';
    try {
        currentList = await fetchTop100();
        renderCards(currentList);
    } catch (err) {
        if (container) container.innerHTML = `<div class="loader"><i class="fas fa-exclamation-triangle"></i> Помилка: ${err.message}</div>`;
    }
}

function openRandomAnime() {
    window.openDetailModal(`${ANIMEUA_BASE}/index.php?do=rand`);
}

async function initGenres() {
    const categoryScroll = document.getElementById('categoryScroll');
    if (!categoryScroll) return;
    const genres = fetchGenres();
    categoryScroll.querySelectorAll('.category-pill').forEach(p => p.remove());

    const allBtn = document.createElement('button');
    allBtn.className = 'category-pill active-pill';
    allBtn.textContent = 'Усі';
    allBtn.addEventListener('click', () => {
        currentGenreSlug = null;
        window.currentPage = 1;
        currentTab = 'main';
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
        allBtn.classList.add('active-pill');
        loadContent();
    });
    categoryScroll.appendChild(allBtn);

    genres.forEach(genre => {
        const btn = document.createElement('button');
        btn.className = 'category-pill';
        btn.textContent = genre.name;
        btn.addEventListener('click', () => {
            currentGenreSlug = genre.slug;
            window.currentPage = 1;
            currentTab = 'main';
            document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active-pill'));
            btn.classList.add('active-pill');
            loadContent();
        });
        categoryScroll.appendChild(btn);
    });
}

applyTheme(Storage.getTheme());
window.updateBadge();

const themeBtn = document.getElementById('themeToggleBtn');
const profileBtn = document.getElementById('profileBtn');
const searchInput = document.getElementById('searchInput');
const topBtn = document.getElementById('top100Btn');
const randBtn = document.getElementById('randomBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const closePlayerBtn = document.getElementById('closePlayerBtn');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const playerModal = document.getElementById('playerModal');
const profileModal = document.getElementById('profileModal');
const mainVideoPlayer = document.getElementById('mainVideoPlayer');

// Делегування кліків на картках аніме
const animeContainer = document.getElementById('animeContainer');
if (animeContainer) {
    animeContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.anime-card');
        if (card && card.dataset.url) {
            window.openDetailModal(card.dataset.url);
        }
    });
}

if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
if (profileBtn) profileBtn.addEventListener('click', window.openProfileModal);
if (searchInput) searchInput.addEventListener('input', debounce(() => {
    currentSearchQuery = searchInput.value.trim();
    window.currentPage = 1;
    currentTab = 'main';
    loadContent();
}, 500));
if (topBtn) topBtn.addEventListener('click', showTop100);
if (randBtn) randBtn.addEventListener('click', openRandomAnime);
if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeDetailModal);
if (closePlayerBtn) closePlayerBtn.addEventListener('click', () => {
    playerModal.style.display = 'none';
    document.body.style.overflow = '';
    destroyHlsForVideo(mainVideoPlayer);
});
if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => {
    profileModal.style.display = 'none';
    document.body.style.overflow = '';
});

window.addEventListener('click', (e) => {
    const animeModal = document.getElementById('animeModal');
    if (e.target === animeModal) window.closeDetailModal();
    if (e.target === playerModal) { playerModal.style.display = 'none'; document.body.style.overflow = ''; destroyHlsForVideo(mainVideoPlayer); }
    if (e.target === profileModal) { profileModal.style.display = 'none'; document.body.style.overflow = ''; }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeDetailModal();
        if (playerModal) { playerModal.style.display = 'none'; destroyHlsForVideo(mainVideoPlayer); }
        document.body.style.overflow = '';
        if (profileModal) profileModal.style.display = 'none';
    }
});

initGenres().then(() => loadContent());
