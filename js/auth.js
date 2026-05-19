import {
  auth, db,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove
} from './firebase.js';

const userCache = new Map();
let syncInProgress = false;

async function getUserDocRef(uid) {
  return doc(db, 'users', uid);
}

async function ensureUserDocExists(user) {
  const ref = await getUserDocRef(user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const initialData = { bookmarks: [], history: [], progress: {}, createdAt: new Date() };
    await setDoc(ref, initialData);
    userCache.set(user.uid, initialData);
  } else {
    userCache.set(user.uid, snap.data());
  }
  return ref;
}

function cleanAnimeObject(anime) {
  return {
    mal_id: anime.mal_id,
    title: anime.title || '',
    url: anime.url || '',
    images: {
      jpg: {
        large_image_url: anime.images?.jpg?.large_image_url || '',
        image_url: anime.images?.jpg?.image_url || ''
      }
    },
    score: anime.score ?? null,
    year: anime.year ?? null,
    from: anime.from || 'animeua',
    genres: anime.genres || [],
    synopsis: anime.synopsis || '',
    rating: anime.rating || '',
    seasons: anime.seasons || {}
  };
}

export async function cloudGetBookmarks() {
  if (!window.currentUser) return [];
  if (userCache.has(window.currentUser.uid)) {
    return userCache.get(window.currentUser.uid).bookmarks || [];
  }
  const ref = await getUserDocRef(window.currentUser.uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { bookmarks: [] };
  userCache.set(window.currentUser.uid, data);
  return data.bookmarks || [];
}

export async function cloudSaveBookmarks(arr) {
  if (!window.currentUser) return;
  const ref = await getUserDocRef(window.currentUser.uid);
  const cleaned = arr.map(cleanAnimeObject);
  await updateDoc(ref, { bookmarks: cleaned });
  if (userCache.has(window.currentUser.uid)) {
    const data = userCache.get(window.currentUser.uid);
    data.bookmarks = cleaned;
    userCache.set(window.currentUser.uid, data);
  }
}

export async function cloudAddBookmark(anime) {
  if (!window.currentUser) return;
  const safe = cleanAnimeObject(anime);
  const ref = await getUserDocRef(window.currentUser.uid);
  await updateDoc(ref, { bookmarks: arrayUnion(safe) });
  if (userCache.has(window.currentUser.uid)) {
    const data = userCache.get(window.currentUser.uid);
    if (!data.bookmarks.some(b => b.mal_id === anime.mal_id)) {
      data.bookmarks.push(safe);
    }
  }
}

export async function cloudRemoveBookmark(malId) {
  if (!window.currentUser) return;
  const ref = await getUserDocRef(window.currentUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const bookmarks = snap.data().bookmarks || [];
  const updated = bookmarks.filter(b => b.mal_id !== malId);
  await updateDoc(ref, { bookmarks: updated });
  userCache.set(window.currentUser.uid, { ...snap.data(), bookmarks: updated });
}

export async function cloudGetHistory() {
  if (!window.currentUser) return [];
  if (userCache.has(window.currentUser.uid)) {
    return userCache.get(window.currentUser.uid).history || [];
  }
  const ref = await getUserDocRef(window.currentUser.uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { history: [] };
  userCache.set(window.currentUser.uid, data);
  return data.history || [];
}

export async function cloudAddHistory(anime) {
  if (!window.currentUser) return;
  const ref = await getUserDocRef(window.currentUser.uid);
  const entry = {
    mal_id: anime.mal_id,
    title: anime.title || '',
    image_url: anime.images?.jpg?.large_image_url || '',
    url: anime.url || '',
    score: anime.score ?? null,
    year: anime.year ?? null,
    timestamp: Date.now()
  };
  await updateDoc(ref, { history: arrayUnion(entry) });
  if (userCache.has(window.currentUser.uid)) {
    const data = userCache.get(window.currentUser.uid);
    const hist = data.history || [];
    hist.unshift(entry);
    data.history = hist.slice(0, 50);
  }
}

export async function cloudClearHistory() {
  if (!window.currentUser) return;
  const ref = await getUserDocRef(window.currentUser.uid);
  await updateDoc(ref, { history: [] });
  if (userCache.has(window.currentUser.uid)) {
    userCache.get(window.currentUser.uid).history = [];
  }
}

export async function cloudGetProgress(animeId) {
  if (!window.currentUser) return null;
  if (userCache.has(window.currentUser.uid)) {
    const progress = userCache.get(window.currentUser.uid).progress || {};
    return progress[animeId] || null;
  }
  const ref = await getUserDocRef(window.currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    userCache.set(window.currentUser.uid, data);
    const progress = data.progress || {};
    return progress[animeId] || null;
  }
  return null;
}

const progressTimers = new Map();
export async function cloudSaveProgress(animeId, season, dub, episode) {
  if (!window.currentUser) return;
  const uid = window.currentUser.uid;
  const key = `progress.${animeId}`;
  if (userCache.has(uid)) {
    const data = userCache.get(uid);
    if (!data.progress) data.progress = {};
    data.progress[animeId] = { season, dub, episode, currentTime: 0, updatedAt: new Date() };
  }
  if (progressTimers.has(animeId)) clearTimeout(progressTimers.get(animeId));
  progressTimers.set(animeId, setTimeout(async () => {
    const ref = await getUserDocRef(uid);
    await updateDoc(ref, { [key]: { season, dub, episode, currentTime: 0, updatedAt: new Date() } });
    progressTimers.delete(animeId);
  }, 300));
}

async function syncLocalToCloud(uid) {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    const lb = JSON.parse(localStorage.getItem('mono_anime_bookmarks') || '[]');
    const lh = JSON.parse(localStorage.getItem('mono_anime_history') || '[]');
    if (lb.length === 0 && lh.length === 0) return;

    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    let cloudBm = [], cloudHist = [];
    if (snap.exists()) {
      cloudBm = snap.data().bookmarks || [];
      cloudHist = snap.data().history || [];
    }

    const mergedBm = [...cloudBm.map(cleanAnimeObject)];
    for (const b of lb) {
      if (!mergedBm.some(c => c.mal_id === b.mal_id)) mergedBm.push(cleanAnimeObject(b));
    }

    const mergedHist = [...cloudHist];
    for (const h of lh) {
      const idx = mergedHist.findIndex(c => c.mal_id === h.mal_id);
      const newEntry = {
        mal_id: h.mal_id, title: h.title || '', image_url: h.image_url || '',
        url: h.url || '', score: h.score ?? null, year: h.year ?? null,
        timestamp: h.timestamp || Date.now()
      };
      if (idx > -1) {
        if ((newEntry.timestamp || 0) > (mergedHist[idx].timestamp || 0)) mergedHist[idx] = newEntry;
      } else mergedHist.push(newEntry);
    }
    mergedHist.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const finalHist = mergedHist.slice(0, 50);

    await setDoc(userRef, { bookmarks: mergedBm, history: finalHist, progress: snap.exists() ? snap.data().progress : {} }, { merge: true });
    userCache.set(uid, { bookmarks: mergedBm, history: finalHist, progress: snap.exists() ? snap.data().progress : {} });

    localStorage.removeItem('mono_anime_bookmarks');
    localStorage.removeItem('mono_anime_history');
  } finally {
    syncInProgress = false;
  }
}

// --- Auth UI ---
window.authGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    window.currentUser = result.user;
    await ensureUserDocExists(result.user);
    await syncLocalToCloud(result.user.uid);
    window.closeAuthModal();
    window.openProfileModal();
  } catch (err) {
    console.error('Google sign-in error', err);
    window.showToast('Помилка входу через Google');
  }
};

window.authEmailLogin = async () => {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value;
  if (!email || !password) { window.showToast('Введіть email та пароль'); return; }
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    window.currentUser = userCred.user;
    await ensureUserDocExists(userCred.user);
    await syncLocalToCloud(userCred.user.uid);
    window.closeAuthModal();
    window.openProfileModal();
  } catch (err) {
    console.error('Login error', err);
    window.showToast('Невірний email або пароль');
  }
};

window.authEmailRegister = async () => {
  const name = document.getElementById('authName')?.value.trim();
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value;
  if (!email || !password) { window.showToast('Введіть email та пароль'); return; }
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    if (name && userCred.user) {
      await updateProfile(userCred.user, { displayName: name });
    }
    window.currentUser = userCred.user;
    await ensureUserDocExists(userCred.user);
    await syncLocalToCloud(userCred.user.uid);
    window.closeAuthModal();
    window.openProfileModal();
  } catch (err) {
    console.error('Register error', err);
    window.showToast('Помилка реєстрації');
  }
};

window.authSignOut = async () => {
  await signOut(auth);
  window.currentUser = null;
  userCache.clear();
  const profile = document.getElementById('profileModal');
  if (profile) profile.style.display = 'none';
  document.body.style.overflow = '';
  window.showToast('Ви вийшли з облікового запису');
};

window.closeAuthModal = () => {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

async function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    window.currentUser = user;
    if (user) {
      await ensureUserDocExists(user);
      await syncLocalToCloud(user.uid);
    } else {
      userCache.clear();
    }
    if (typeof window.updateBadge === 'function') {
      window.updateBadge().catch(console.error);
    }
  });
}
initAuth();
