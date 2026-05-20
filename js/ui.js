function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderCards(list) {
    const container = document.getElementById('animeContainer');
    if (!container) return;
    if (!list.length) { container.innerHTML = '<div class="loader">Нічого не знайдено</div>'; return; }
    const fragment = document.createDocumentFragment();
    list.forEach(a => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.url = a.url;
        card.innerHTML = `
            <div class="anime-poster">
                <img src="${a.images.jpg.large_image_url}" alt="${a.title}" loading="lazy">
            </div>
            <div class="anime-info">
                <div class="anime-title">${a.title}</div>
                <div class="anime-meta">${a.year || ''} • UA</div>
            </div>
        `;
        card.addEventListener('click', () => window.openDetailModal(card.dataset.url));
        fragment.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
    renderPagination();
}

function renderPagination() {
    const row = document.getElementById('paginationRow');
    if (!row) return;
    let html = '';
    if (window.currentPage > 1) html += `<button class="btn-outline" onclick="changePage(${window.currentPage - 1})">Назад</button>`;
    html += `<span style="margin:0 1rem; font-weight:bold;">Сторінка ${window.currentPage}</span>`;
    html += `<button class="btn-outline" onclick="changePage(${window.currentPage + 1})">Вперед</button>`;
    row.innerHTML = html;
}

window.showToast = showToast;
window.renderCards = renderCards;
window.renderPagination = renderPagination;
