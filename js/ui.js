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
    container.innerHTML = list.map(a => `
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
    container.querySelectorAll('.anime-card').forEach(card =>
        card.addEventListener('click', () => openDetailModal(card.dataset.url))
    );
    renderPagination();
}

function renderPagination() {
    const row = document.getElementById('paginationRow');
    if (!row) return;
    let html = '';
    if (currentPage > 1) html += `<button class="btn-outline" onclick="changePage(${currentPage - 1})">Назад</button>`;
    html += `<span style="margin:0 1rem; font-weight:bold;">Сторінка ${currentPage}</span>`;
    html += `<button class="btn-outline" onclick="changePage(${currentPage + 1})">Вперед</button>`;
    row.innerHTML = html;
}
