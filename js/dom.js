export const DOM = {
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
    profileBody: document.getElementById('profileBody'),
    top100Btn: document.getElementById('top100Btn'),
    randomBtn: document.getElementById('randomBtn')
};

export function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    clearTimeout(DOM.toast._timeout);
    DOM.toast._timeout = setTimeout(() => DOM.toast.classList.remove('show'), 2200);
}

export function updateBadge() {
    if (!DOM.bookmarkBadge) return;
    const count = Storage.getBookmarks().length;
    DOM.bookmarkBadge.textContent = count;
    DOM.bookmarkBadge.style.display = count > 0 ? 'flex' : 'none';
}

export function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

export function toggleTheme() {
    const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
    applyTheme(next);
}
