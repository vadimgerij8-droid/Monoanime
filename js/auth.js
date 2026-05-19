// js/auth.js — Firebase Auth + Firestore integration

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Firebase Init ────────────────────────────────────────────────────────────
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

// ─── Auth State ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    window.currentUser = user || null;
    updateAuthUI(user);
    updateBadge();
});

function updateAuthUI(user) {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;
    if (user) {
        profileBtn.innerHTML = user.photoURL
            ? `<img src="${user.photoURL}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;">`
            : `<i class="fas fa-user-check"></i>`;
        profileBtn.title = user.displayName || user.email || 'Профіль';
    } else {
        profileBtn.innerHTML = `<i class="fas fa-user"></i>`;
        profileBtn.title = 'Профіль';
    }
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────
window.authGoogleSignIn = async function () {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        closeAuthModal();
        showToast('✅ Увійшли через Google!');
    } catch (e) {
        showToast('❌ ' + (e.message || 'Помилка входу через Google'));
    }
};

// ─── Email Register ───────────────────────────────────────────────────────────
window.authEmailRegister = async function () {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const name = document.getElementById('authName')?.value?.trim();
    if (!email || !password) { showToast('❌ Введіть email та пароль'); return; }
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        closeAuthModal();
        showToast('✅ Реєстрація успішна!');
    } catch (e) {
        const msg = {
            'auth/email-already-in-use': 'Email вже використовується',
            'auth/weak-password': 'Пароль занадто слабкий (мін. 6 символів)',
            'auth/invalid-email': 'Невірний формат email'
        }[e.code] || e.message;
        showToast('❌ ' + msg);
    }
};

// ─── Email Login ──────────────────────────────────────────────────────────────
window.authEmailLogin = async function () {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) { showToast('❌ Введіть email та пароль'); return; }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeAuthModal();
        showToast('✅ Успішний вхід!');
    } catch (e) {
        const msg = {
            'auth/user-not-found': 'Користувача не знайдено',
            'auth/wrong-password': 'Невірний пароль',
            'auth/invalid-credential': 'Невірні дані для входу',
            'auth/invalid-email': 'Невірний формат email'
        }[e.code] || e.message;
        showToast('❌ ' + msg);
    }
};

// ─── Sign Out ─────────────────────────────────────────────────────────────────
window.authSignOut = async function () {
    await signOut(auth);
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
    document.body.style.overflow = '';
    showToast('👋 Вийшли з акаунту');
};

// ─── Close Auth Modal ─────────────────────────────────────────────────────────
window.closeAuthModal = function () {
    const modal = document.getElementById('authModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
};

// ─── Firestore helpers ────────────────────────────────────────────────────────
function userDoc() {
    if (!window.currentUser) return null;
    return doc(db, 'users', window.currentUser.uid);
}

async function ensureUserDoc() {
    const ref = userDoc();
    if (!ref) return;
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { bookmarks: [], history: [], progress: {} });
    }
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export async function cloudGetBookmarks() {
    const ref = userDoc();
    if (!ref) return [];
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data().bookmarks || []) : [];
}

export async function cloudAddBookmark(anime) {
    await ensureUserDoc();
    const ref = userDoc();
    if (!ref) return;
    const entry = {
        mal_id: anime.mal_id,
        title: anime.title,
        image_url: anime.images?.jpg?.large_image_url || '',
        url: anime.url || '',
        score: anime.score || null,
        year: anime.year || null,
        timestamp: Date.now()
    };
    const snap = await getDoc(ref);
    const bm = snap.data().bookmarks || [];
    const exists = bm.some(b => b.mal_id === anime.mal_id);
    if (!exists) {
        await updateDoc(ref, { bookmarks: arrayUnion(entry) });
    }
}

export async function cloudRemoveBookmark(mal_id) {
    const ref = userDoc();
    if (!ref) return;
    const snap = await getDoc(ref);
    const bm = (snap.data().bookmarks || []).filter(b => b.mal_id !== mal_id);
    await updateDoc(ref, { bookmarks: bm });
}

// ─── History ──────────────────────────────────────────────────────────────────
export async function cloudGetHistory() {
    const ref = userDoc();
    if (!ref) return [];
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data().history || []) : [];
}

export async function cloudAddHistory(anime) {
    await ensureUserDoc();
    const ref = userDoc();
    if (!ref) return;
    const snap = await getDoc(ref);
    let hist = (snap.data().history || []).filter(h => h.mal_id !== anime.mal_id);
    const entry = {
        mal_id: anime.mal_id,
        title: anime.title,
        image_url: anime.images?.jpg?.large_image_url || '',
        url: anime.url || '',
        score: anime.score || null,
        year: anime.year || null,
        timestamp: Date.now()
    };
    hist.unshift(entry);
    hist = hist.slice(0, 50);
    await updateDoc(ref, { history: hist });
}

// ─── Progress ─────────────────────────────────────────────────────────────────
export async function cloudGetProgress(mal_id) {
    const ref = userDoc();
    if (!ref) return null;
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const progress = snap.data().progress || {};
    return progress[String(mal_id)] || null;
}

export async function cloudSaveProgress(mal_id, season, dub, episode) {
    await ensureUserDoc();
    const ref = userDoc();
    if (!ref) return;
    await updateDoc(ref, {
        [`progress.${mal_id}`]: { season, dub, episode, updatedAt: Date.now() }
    });
}
