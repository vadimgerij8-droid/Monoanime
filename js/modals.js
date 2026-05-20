import Storage from './storage.js';

// ---------- Auth Modal ----------
function openAuthModal() {
  let modal = document.getElementById('authModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px; padding:2rem; position:relative;">
        <button onclick="window.closeAuthModal()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.4rem;cursor:pointer;color:inherit;">✕</button>
        
        <div id="authTabBar" style="display:flex;gap:0;margin-bottom:1.5rem;border-radius:8px;overflow:hidden;border:1px solid var(--border,#ddd);">
          <button id="tabLoginBtn" onclick="window.switchAuthTab('login')" style="flex:1;padding:0.6rem;border:none;cursor:pointer;font-weight:600;background:#ffcc00;color:#333;">Увійти</button>
          <button id="tabRegisterBtn" onclick="window.switchAuthTab('register')" style="flex:1;padding:0.6rem;border:none;cursor:pointer;font-weight:600;background:transparent;color:inherit;">Реєстрація</button>
        </div>

        <button onclick="window.authGoogleSignIn()" style="width:100%;padding:0.75rem;border-radius:8px;border:1px solid #ddd;background:#fff;color:#333;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.7rem;margin-bottom:1rem;">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Продовжити з Google
        </button>

        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;color:#999;">
          <div style="flex:1;height:1px;background:#ddd;"></div>або<div style="flex:1;height:1px;background:#ddd;"></div>
        </div>

        <div id="authNameWrap" style="display:none;margin-bottom:0.75rem;">
          <input id="authName" type="text" placeholder="Ім'я" style="width:100%;padding:0.7rem 1rem;border-radius:8px;border:1px solid #ddd;font-size:1rem;box-sizing:border-box;background:var(--input-bg,#f5f5f5);color:inherit;">
        </div>
        <div style="margin-bottom:0.75rem;">
          <input id="authEmail" type="email" placeholder="Email" style="width:100%;padding:0.7rem 1rem;border-radius:8px;border:1px solid #ddd;font-size:1rem;box-sizing:border-box;background:var(--input-bg,#f5f5f5);color:inherit;">
        </div>
        <div style="margin-bottom:1.25rem;">
          <input id="authPassword" type="password" placeholder="Пароль" style="width:100%;padding:0.7rem 1rem;border-radius:8px;border:1px solid #ddd;font-size:1rem;box-sizing:border-box;background:var(--input-bg,#f5f5f5);color:inherit;">
        </div>

        <button id="authSubmitBtn" onclick="window.authEmailLogin()" style="width:100%;padding:0.75rem;border-radius:8px;border:none;background:#ffcc00;color:#333;font-size:1rem;font-weight:700;cursor:pointer;">
          Увійти
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) window.closeAuthModal(); });
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.switchAuthTab = function (tab) {
  const nameWrap = document.getElementById('authNameWrap');
  const submitBtn = document.getElementById('authSubmitBtn');
  const loginBtn = document.getElementById('tabLoginBtn');
  const regBtn = document.getElementById('tabRegisterBtn');
  if (tab === 'register') {
    nameWrap.style.display = 'block';
    submitBtn.textContent = 'Зареєструватись';
    submitBtn.onclick = window.authEmailRegister;
    loginBtn.style.background = 'transparent'; loginBtn.style.color = 'inherit';
    regBtn.style.background = '#ffcc00'; regBtn.style.color = '#333';
  } else {
    nameWrap.style.display = 'none';
    submitBtn.textContent = 'Увійти';
    submitBtn.onclick = window.authEmailLogin;
    loginBtn.style.background = '#ffcc00'; loginBtn.style.color = '#333';
    regBtn.style.background = 'transparent'; regBtn.style.color = 'inherit';
  }
};

// ---------- Profile Modal ----------
async function openProfileModal() {
  if (!window.currentUser) { openAuthModal(); return; }

  const profileModal = document.getElementById('profileModal');
  if (!profileModal) return;
  profileModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const profileBody = document.getElementById('profileBody');
  if (!profileBody) return;
  profileBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';

  try {
    const [bookmarks, history] = await Promise.all([
      Storage.getBookmarks(),
      Storage.getHistory()
    ]);
    const user = window.currentUser;

    profileBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;padding:1rem 0 1.5rem;border-bottom:1px solid var(--border,#eee);margin-bottom:1.5rem;">
        ${user.photoURL
          ? `<img src="${user.photoURL}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">`
          : `<div style="width:60px;height:60px;border-radius:50%;background:#ffcc00;display:flex;align-items:center;justify-content:center;font-size:1.8rem;"><i class="fas fa-user"></i></div>`
        }
        <div style="flex:1;">
          <div style="font-size:1.1rem;font-weight:700;">${user.displayName || 'Без імені'}</div>
          <div style="font-size:0.85rem;color:#888;">${user.email || ''}</div>
        </div>
        <button onclick="window.authSignOut()" style="padding:0.4rem 0.9rem;border-radius:8px;border:1px solid #ddd;background:none;cursor:pointer;font-size:0.85rem;color:inherit;">
          <i class="fas fa-sign-out-alt"></i> Вийти
        </button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem;">
        <div style="background:rgba(255,204,0,0.15);border-radius:10px;padding:0.9rem;text-align:center;">
          <div style="font-size:1.6rem;font-weight:700;color:#e6b800;">${bookmarks.length}</div>
          <div style="font-size:0.75rem;color:#888;">Обране</div>
        </div>
        <div style="background:rgba(0,0,0,0.05);border-radius:10px;padding:0.9rem;text-align:center;">
          <div style="font-size:1.6rem;font-weight:700;">${history.length}</div>
          <div style="font-size:0.75rem;color:#888;">Переглянуто</div>
        </div>
        <div style="background:rgba(0,0,0,0.05);border-radius:10px;padding:0.9rem;text-align:center;">
          <div style="font-size:1.6rem;font-weight:700;">★</div>
          <div style="font-size:0.75rem;color:#888;">Рейтинг</div>
        </div>
      </div>

      <div style="display:flex;gap:0;border-radius:8px;overflow:hidden;border:1px solid var(--border,#ddd);margin-bottom:1rem;">
        <button class="profile-tab" data-tab="bookmarks" onclick="window.switchProfileTab(this,'bookmarks')" style="flex:1;padding:0.55rem;border:none;cursor:pointer;font-weight:600;background:#ffcc00;color:#333;">⭐ Обране</button>
        <button class="profile-tab" data-tab="history" onclick="window.switchProfileTab(this,'history')" style="flex:1;padding:0.55rem;border:none;cursor:pointer;font-weight:600;background:transparent;color:inherit;">🕓 Історія</button>
      </div>

      <div id="profileTabBookmarks">${renderProfileGrid(bookmarks, 'Немає обраних аніме')}</div>
      <div id="profileTabHistory" style="display:none;">${renderProfileGrid(history, 'Історія порожня')}</div>
    `;

    profileBody.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', () => {
        profileModal.style.display = 'none';
        document.body.style.overflow = '';
        window.openDetailModal(card.dataset.url);
      });
    });
  } catch (err) {
    console.error('Помилка завантаження профілю:', err);
    profileBody.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">Не вдалося завантажити профіль. Спробуйте пізніше.</p>';
  }
}

function renderProfileGrid(list, emptyMsg) {
  if (!list.length) return `<p style="text-align:center;color:#888;padding:2rem;">${emptyMsg}</p>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:0.75rem;">
    ${list.slice(0, 24).map(item => `
      <div class="profile-card" data-url="${item.url}" style="cursor:pointer;border-radius:10px;overflow:hidden;background:var(--card-bg,#f5f5f5);">
        <img src="${item.image_url || item.images?.jpg?.large_image_url}" alt="${item.title}" style="width:100%;aspect-ratio:2/3;object-fit:cover;display:block;">
        <div style="padding:0.4rem 0.3rem;font-size:0.72rem;font-weight:600;line-height:1.2;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" title="${item.title}">${item.title}</div>
      </div>
    `).join('')}
  </div>`;
}

window.switchProfileTab = function (btn, tab) {
  document.querySelectorAll('.profile-tab').forEach(b => {
    b.style.background = 'transparent'; b.style.color = 'inherit';
  });
  btn.style.background = '#ffcc00'; btn.style.color = '#333';
  document.getElementById('profileTabBookmarks').style.display = tab === 'bookmarks' ? '' : 'none';
  document.getElementById('profileTabHistory').style.display = tab === 'history' ? '' : 'none';
};

// ---------- Detail Modal ----------
let currentDetailAnime = null;

window.closeDetailModal = () => {
  const modal = document.getElementById('animeModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const video = document.getElementById('detailVideoPlayer');
  if (video) { video.pause(); window.destroyHlsForVideo(video); }
};

async function toggleBookmark(anime) {
  const bm = await Storage.getBookmarks();
  const exists = bm.some(b => b.mal_id === anime.mal_id);
  if (exists) {
    await Storage.removeBookmark(anime.mal_id);
    window.showToast('Видалено з обраного');
  } else {
    await Storage.addBookmark(anime);
    window.showToast('Додано в обране');
  }
  window.updateBadge();
}

window.openDetailModal = async function (url) {
  const modal = document.getElementById('animeModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  if (!modal) return;

  modalTitle.textContent = 'Завантаження...';
  modalBody.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-pulse"></i> Завантаження...</div>';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    const anime = await window.loadAnimeDetails(url);
    await Storage.addHistory(anime);
    currentDetailAnime = anime;
    modalTitle.textContent = anime.title;

    const isBookmarked = (await Storage.getBookmarks()).some(b => b.mal_id === anime.mal_id);
    const savedProgress = window.currentUser ? await Storage.getProgressCached(anime.mal_id) : null;

    const seasons = Object.keys(anime.seasons).sort((a, b) => parseInt(a) - parseInt(b));
    const firstSeason = (savedProgress?.season && anime.seasons[savedProgress.season]) ? savedProgress.season : (seasons[0] || '1');
    const dubs = Object.keys(anime.seasons[firstSeason] || {}).sort();
    const firstDub = (savedProgress?.dub && dubs.includes(savedProgress.dub)) ? savedProgress.dub : (dubs[0] || '');
    const episodes = firstDub ? (anime.seasons[firstSeason][firstDub] || []) : [];
    const totalEpisodes = Object.values(anime.seasons).reduce((sum, s) =>
      sum + Object.values(s).reduce((s2, e) => Math.max(s2, e.length), 0), 0);
    const ratingTag = anime.rating ? `<span class="tag rating-tag"><i class="fas fa-user-shield"></i> ${anime.rating}</span>` : '';
    const savedEpIndex = savedProgress?.episode ? episodes.findIndex(ep => ep.episode === savedProgress.episode) : -1;

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
        ${savedProgress ? `
        <div style="background:rgba(255,204,0,0.15);border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <i class="fas fa-history" style="color:#e6b800;"></i>
          Продовжити: <strong>Сезон ${savedProgress.season} · ${savedProgress.dub} · Еп. ${savedProgress.episode}</strong>
          <button id="resumeBtn" style="margin-left:auto;padding:0.3rem 0.7rem;border-radius:6px;border:none;background:#ffcc00;color:#333;font-weight:600;cursor:pointer;">▶ Продовжити</button>
        </div>` : ''}

        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;background:rgba(0,0,0,0.05);padding:1rem;border-radius:8px;">
          <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <label style="font-size:0.8rem;font-weight:600;color:#666;">СЕЗОН</label>
            <select id="seasonSelect" class="btn-outline" style="padding:0.5rem;min-width:120px;">
              ${seasons.map(s => `<option value="${s}" ${s === firstSeason ? 'selected' : ''}>Сезон ${s}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <label style="font-size:0.8rem;font-weight:600;color:#666;">ОЗВУЧКА</label>
            <select id="dubSelect" class="btn-outline" style="padding:0.5rem;min-width:200px;">
              ${dubs.map(d => `<option value="${d}" ${d === firstDub ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <label style="font-size:0.8rem;font-weight:600;color:#666;">СЕРІЯ</label>
            <select id="episodeSelect" class="btn-outline" style="padding:0.5rem;min-width:100px;">
              ${episodes.length ? episodes.map((ep, i) => `<option value="${ep.file}" ${i === savedEpIndex ? 'selected' : ''}>Еп. ${ep.episode}</option>`).join('') : '<option value="">Немає серій</option>'}
            </select>
          </div>
          <button id="playSelectedBtn" class="btn-outline" style="align-self:flex-end;padding:0.4rem 0.8rem;background:#ffcc00;color:#333;border:none;font-size:0.85rem;margin-top:8px;" ${episodes.length ? '' : 'disabled'}>
            <i class="fas fa-play"></i> ДИВИТИСЯ
          </button>
        </div>
        <div class="player-container" style="margin-top:1rem;background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;">
          <video id="detailVideoPlayer" controls crossorigin="anonymous" style="width:100%;height:100%;"></video>
        </div>
      </div>
    `;

    const detailVideoEl = document.getElementById('detailVideoPlayer');
    const seasonSelect = document.getElementById('seasonSelect');
    const dubSelect = document.getElementById('dubSelect');
    const episodeSelect = document.getElementById('episodeSelect');
    const playSelectedBtn = document.getElementById('playSelectedBtn');

    function updateDubs() {
      const s = seasonSelect.value;
      const avail = Object.keys(anime.seasons[s] || {}).sort();
      dubSelect.innerHTML = avail.map(d => `<option value="${d}">${d}</option>`).join('');
      updateEpisodes();
    }

    function updateEpisodes() {
      const s = seasonSelect.value, d = dubSelect.value;
      const eps = anime.seasons[s]?.[d] || [];
      if (eps.length === 0) {
        episodeSelect.innerHTML = '<option value="">Немає серій</option>';
        playSelectedBtn.disabled = true;
      } else {
        episodeSelect.innerHTML = eps.map(ep => `<option value="${ep.file}">Еп. ${ep.episode}</option>`).join('');
        playSelectedBtn.disabled = false;
      }
    }

    async function playEpisode(file) {
      if (!file || file === '') {
        window.showToast('❌ Немає файлу - спробуйте вибрати іншу озвучку або сезон');
        return;
      }
      window.loadVideo(file, detailVideoEl);
      if (window.currentUser) {
        const s = seasonSelect.value, d = dubSelect.value;
        const ep = (anime.seasons[s]?.[d] || []).find(e => e.file === file);
        if (ep) {
          await Storage.saveProgress(anime.mal_id, s, d, ep.episode);
        }
      }
    }

    seasonSelect.addEventListener('change', updateDubs);
    dubSelect.addEventListener('change', updateEpisodes);
    playSelectedBtn.addEventListener('click', () => playEpisode(episodeSelect.value));

    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn && savedProgress) {
      resumeBtn.addEventListener('click', () => {
        if (anime.seasons[savedProgress.season]) { seasonSelect.value = savedProgress.season; updateDubs(); }
        if (dubSelect.querySelector(`option[value="${savedProgress.dub}"]`)) { dubSelect.value = savedProgress.dub; updateEpisodes(); }
        const ep = (anime.seasons[savedProgress.season]?.[savedProgress.dub] || []).find(e => e.episode === savedProgress.episode);
        if (ep) { episodeSelect.value = ep.file; playEpisode(ep.file); }
      });
    }

    document.getElementById('toggleBookmarkBtn').addEventListener('click', async () => {
      await toggleBookmark(anime);
      const nowBm = (await Storage.getBookmarks()).some(b => b.mal_id === anime.mal_id);
      document.getElementById('toggleBookmarkBtn').innerHTML = `<i class="fas fa-star"></i> ${nowBm ? 'В обраному' : 'Додати в обране'}`;
    });

    const synopsisText = document.getElementById('synopsisText');
    const moreBtn = document.getElementById('moreBtn');
    if (synopsisText && moreBtn) {
      if (synopsisText.scrollHeight > synopsisText.clientHeight) moreBtn.style.display = 'block';
      moreBtn.addEventListener('click', () => {
        const expanded = synopsisText.classList.toggle('expanded');
        moreBtn.textContent = expanded ? 'менше' : 'більше';
      });
    }
  } catch (err) {
    modalBody.innerHTML = `<div class="loader"><i class="fas fa-exclamation-circle"></i> Помилка: ${err.message}</div>`;
  }
};

// Глобальні експорти
window.openAuthModal = openAuthModal;
window.openProfileModal = openProfileModal;
window.toggleBookmark = toggleBookmark;
