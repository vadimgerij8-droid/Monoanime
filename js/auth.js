import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxEGgR8KuZh9IEeAEv5yXa2lAzdLGP5jI",
  authDomain: "monoanime-46d6f.firebaseapp.com",
  projectId: "monoanime-46d6f",
  storageBucket: "monoanime-46d6f.firebasestorage.app",
  messagingSenderId: "645025854458",
  appId: "1:645025854458:web:f41af5e48b79517522aa43",
  measurementId: "G-ZJB9D0CJQL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

export function initAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    window.currentUser = user;

    if (user) {
      await syncCloudToLocal();
    }
    if (callback) callback(user);
  });
}

export function getCurrentUser() {
  return currentUser;
}

export async function authGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    closeAuthModal();
  } catch (error) {
    console.error('Google sign-in error:', error);
    window.showToast?.('Помилка входу через Google');
  }
}

export async function authEmailLogin() {
  const email = document.getElementById('authEmail')?.value;
  const password = document.getElementById('authPassword')?.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (error) {
    console.error('Email login error:', error);
    window.showToast?.('Помилка входу: ' + error.message);
  }
}

export async function authEmailRegister() {
  const email = document.getElementById('authEmail')?.value;
  const password = document.getElementById('authPassword')?.value;
  const name = document.getElementById('authName')?.value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    closeAuthModal();
  } catch (error) {
    console.error('Register error:', error);
    window.showToast?.('Помилка реєстрації: ' + error.message);
  }
}

export async function authSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// --- Firestore helpers ---

function getUserDocRef(uid) {
  return doc(db, 'users', uid);
}

async function getUserData() {
  if (!currentUser) return null;
  const ref = getUserDocRef(currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data();
  } else {
    const initial = { bookmarks: [], history: [], progress: {} };
    await setDoc(ref, initial);
    return initial;
  }
}

async function syncCloudToLocal() {
  const data = await getUserData();
  if (!data) return;
  localStorage.setItem('mono_anime_bookmarks', JSON.stringify(data.bookmarks || []));
  localStorage.setItem('mono_anime_history', JSON.stringify(data.history || []));
  localStorage.setItem('mono_anime_progress', JSON.stringify(data.progress || {}));
}

// --- Bookmarks ---

export async function cloudGetBookmarks() {
  const data = await getUserData();
  return data?.bookmarks || [];
}

export async function cloudAddBookmark(anime) {
  if (!currentUser) return;
  const ref = getUserDocRef(currentUser.uid);
  const data = await getUserData();
  const bookmarks = data?.bookmarks || [];
  if (!bookmarks.some(b => b.mal_id === anime.mal_id)) {
    bookmarks.push(anime);
    await setDoc(ref, { bookmarks }, { merge: true });
    localStorage.setItem('mono_anime_bookmarks', JSON.stringify(bookmarks));
  }
}

export async function cloudRemoveBookmark(mal_id) {
  if (!currentUser) return;
  const ref = getUserDocRef(currentUser.uid);
  const data = await getUserData();
  if (!data) return;
  const newBookmarks = data.bookmarks.filter(b => b.mal_id !== mal_id);
  await setDoc(ref, { bookmarks: newBookmarks }, { merge: true });
  localStorage.setItem('mono_anime_bookmarks', JSON.stringify(newBookmarks));
}

// --- History ---

export async function cloudGetHistory() {
  const data = await getUserData();
  return data?.history || [];
}

export async function cloudAddHistory(anime) {
  if (!currentUser) return;
  const ref = getUserDocRef(currentUser.uid);
  const data = await getUserData();
  if (!data) return;
  const history = data.history || [];
  const filtered = history.filter(h => h.mal_id !== anime.mal_id);
  const entry = {
    mal_id: anime.mal_id,
    title: anime.title,
    image_url: anime.images?.jpg?.large_image_url || '',
    url: anime.url || '',
    score: anime.score,
    year: anime.year,
    timestamp: Date.now()
  };
  filtered.unshift(entry);
  const newHistory = filtered.slice(0, 50);
  await setDoc(ref, { history: newHistory }, { merge: true });
  localStorage.setItem('mono_anime_history', JSON.stringify(newHistory));
}

// --- Progress ---

export async function cloudGetProgress(mal_id) {
  const data = await getUserData();
  return data?.progress?.[mal_id] || null;
}

export async function cloudSaveProgress(mal_id, season, dub, episode) {
  if (!currentUser) return;
  const ref = getUserDocRef(currentUser.uid);
  const data = await getUserData();
  if (!data) return;
  const progress = data.progress || {};
  progress[mal_id] = { season, dub, episode, timestamp: Date.now() };
  await setDoc(ref, { progress }, { merge: true });
  localStorage.setItem('mono_anime_progress', JSON.stringify(progress));
}

// Глобальні функції для виклику з HTML (onclick)
window.authGoogleSignIn = authGoogleSignIn;
window.authEmailLogin = authEmailLogin;
window.authEmailRegister = authEmailRegister;
window.authSignOut = authSignOut;
