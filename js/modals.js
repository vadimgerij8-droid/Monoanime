let currentDetailAnime = null;

function closeDetailModal() {
    const modal = document.getElementById('animeModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    const video = document.getElementById('detailVideoPlayer');
    if (video) { video.pause(); destroyHlsForVideo(video); }
}

async function toggleBookmark(anime) {
    let b = await Storage.getBookmarks();
    const idx = b.findIndex(x => x.mal_id === anime.mal_id);
    if (idx > -1) {
        b.splice(idx, 1);
        showToast('Видалено з обраного');
    } else {
        b.push({
            mal_id: anime.mal_id,
            title: anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url: anime.url
        });
        showToast('Додано в обране');
    }
    await Storage.saveBookmarks(b);
    updateBadge();
}

async function openDetailModal(url) {
    const modal = document.getElementById('animeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!modal) return;

    modalTitle.textContent = 'Завантаження...';
    modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const anime = await loadAnimeDetails(url);
        Storage.addHistory(anime);
        currentDetailAnime = anime;
        modalTitle.textContent = anime.title;

        const isBookmarked = (await Storage.getBookmarks()).some(b => b.mal_id === anime.mal_id);
        const seasons = Object.keys(anime.seasons).sort((a, b) => parseInt(a) - parseInt(b));
        const firstSeason = seasons[0] || '1';
        const dubs = Object.keys(anime.seasons[firstSeason] || {}).sort();
        const firstDub = dubs[0] || '';
        const episodes = firstDub ? anime.seasons[firstSeason][firstDub] : [];
        const totalEpisodes = episodes.length;
        const ratingTag = anime.rating ? `<span class="tag rating-tag"><i class="fas fa-user-shield"></i> ${anime.rating}</span>` : '';

        modalBody.innerHTML = `
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
                        <button class="more-btn" id="moreBtn" style="display:none;">більше</button>
                    </div>
                    <button class="btn-outline" id="toggleBookmarkBtn" style="margin-top:1.5rem;">
                        <i class="fas fa-star"></i> ${isBookmarked ? 'В обраному' : 'Додати в обране'}
                    </button>
                </div>
            </div>
            <div style="margin-top:1.5rem;">
                <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem; background:rgba(0,0,0,0.05); padding:1rem; border-radius:8px;">
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.8rem; font-weight:600; color:#666;">СЕЗОН</label>
                        <select id="seasonSelect" class="btn-outline" style="padding:0.5rem; min-width:120px;">
                            ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.8rem; font-weight:600; color:#666;">ОЗВУЧКА</label>
                        <select id="dubSelect" class="btn-outline" style="padding:0.5rem; min-width:200px;">
                            ${dubs.map(d => `<option value="${d}" ${d === firstDub ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.8rem; font-weight:600; color:#666;">СЕРІЯ</label>
                        <select id="episodeSelect" class="btn-outline" style="padding:0.5rem; min-width:100px;">
                            ${episodes.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('')}
                        </select>
                    </div>
                    <button id="playSelectedBtn" class="btn-outline" style="align-self:flex-end; padding:0.4rem 0.8rem; background:#ffcc00; color:#333; border:none; font-size:0.85rem; margin-top:8px;">
                        <i class="fas fa-play"></i> ДИВИТИСЯ
                    </button>
                </div>
                <div class="player-container" style="margin-top:1rem; background:#000; border-radius:8px; overflow:hidden; aspect-ratio:16/9;">
                    <video id="detailVideoPlayer" controls crossorigin="anonymous" style="width:100%; height:100%;"></video>
                </div>
                <div style="margin-top:1rem; display:flex; justify-content:flex-end; align-items:center;">
                    <button id="markWatchedBtn" class="btn-outline"><i class="fas fa-check"></i> Переглянуто</button>
                    <span id="watchedCount" style="margin-left:1rem; font-size:0.9rem;"></span>
                </div>
            </div>
        `;

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
            const epOption = episodeSelect.options[episodeSelect.selectedIndex];
            const episodeNumber = epOption ? epOption.text.replace('Еп. ', '') : '1';
            if (file) loadVideo(file, detailVideoEl, anime.mal_id, episodeNumber);
            else showToast('❌ Немає файлу');
        });

        document.getElementById('toggleBookmarkBtn').addEventListener('click', async () => {
            await toggleBookmark(anime);
            const isNow = (await Storage.getBookmarks()).some(b => b.mal_id === anime.mal_id);
            document.getElementById('toggleBookmarkBtn').innerHTML = `<i class="fas fa-star"></i> ${isNow ? 'В обраному' : 'Додати в обране'}`;
        });

        const markBtn = document.getElementById('markWatchedBtn');
        const watchedSpan = document.getElementById('watchedCount');
        const updateWatchedDisplay = async () => {
            const count = await Storage.getWatchedEpisodes(anime.mal_id);
            watchedSpan.textContent = `Переглянуто серій: ${count}`;
        };
        updateWatchedDisplay();

        markBtn.addEventListener('click', async () => {
            await Storage.incrementWatched(anime.mal_id);
            updateWatchedDisplay();
            showToast('Серію зараховано!');
        });

        const synopsisText = document.getElementById('synopsisText');
        const moreBtn = document.getElementById('moreBtn');
        if (synopsisText && moreBtn) {
            if (synopsisText.scrollHeight > synopsisText.clientHeight) moreBtn.style.display = 'block';
            moreBtn.addEventListener('click', () => {
                const isExpanded = synopsisText.classList.toggle('expanded');
                moreBtn.textContent = isExpanded ? 'менше' : 'більше';
            });
        }

    } catch (err) {
        modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
    }
}

function openProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (!profileModal) return;
    loadProfileUI();
    profileModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

window.loadProfileUI = async function() {
    const profileBody = document.getElementById('profileBody');
    if (!profileBody) return;

    const user = window.currentFirebaseUser;
    if (!user) {
        profileBody.innerHTML = `
            <div style="text-align:center;">
                <button id="googleLoginBtn" class="btn-outline" style="margin-bottom:1rem;">
                    <i class="fab fa-google"></i> Увійти через Google
                </button>
                <hr>
                <input type="email" id="profileEmail" placeholder="Email" class="input-field" style="margin:0.5rem 0; width:100%;">
                <input type="password" id="profilePassword" placeholder="Пароль" class="input-field" style="margin:0.5rem 0; width:100%;">
                <div style="display:flex; gap:0.5rem;">
                    <button id="signInBtn" class="btn-outline" style="flex:1;">Увійти</button>
                    <button id="signUpBtn" class="btn-outline" style="flex:1;">Реєстрація</button>
                </div>
            </div>
        `;
        document.getElementById('googleLoginBtn').addEventListener('click', window.signInWithGoogle);
        document.getElementById('signInBtn').addEventListener('click', () => {
            const email = document.getElementById('profileEmail').value.trim();
            const pass = document.getElementById('profilePassword').value;
            if (!email || !pass) return showToast('Заповніть поля');
            window.signInWithEmail(email, pass);
        });
        document.getElementById('signUpBtn').addEventListener('click', () => {
            const email = document.getElementById('profileEmail').value.trim();
            const pass = document.getElementById('profilePassword').value;
            if (!email || !pass) return showToast('Заповніть поля');
            window.signUpWithEmail(email, pass);
        });
    } else {
        const bookmarks = await Storage.getBookmarks();
        const history = await Storage.getHistory();
        profileBody.innerHTML = `
            <div style="text-align:center; margin-bottom:1rem;">
                <p>Ви увійшли як <strong>${user.email || user.displayName || 'Користувач'}</strong></p>
                <button id="logoutBtn" class="btn-outline"><i class="fas fa-sign-out-alt"></i> Вийти</button>
            </div>
            <h3>Обране</h3>
            <div id="bookmarkList" class="profile-list">
                ${bookmarks.length ? bookmarks.slice(0, 12).map(b => `<div class="bookmark-item" data-url="${b.url}"><img src="${b.image_url}"><span>${b.title}</span></div>`).join('') : '<p>Немає обраних</p>'}
            </div>
            <h3>Історія</h3>
            <div id="historyList" class="profile-list">
                ${history.length ? history.slice(0, 12).map(h => `<div class="bookmark-item" data-url="${h.url}"><img src="${h.image_url}"><span>${h.title}</span></div>`).join('') : '<p>Історія порожня</p>'}
            </div>
        `;
        document.getElementById('logoutBtn').addEventListener('click', window.signOutUser);
        document.querySelectorAll('#bookmarkList .bookmark-item, #historyList .bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('profileModal').style.display = 'none';
                document.body.style.overflow = '';
                openDetailModal(item.dataset.url);
            });
        });
    }
};
