import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

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

window.firebaseAuth = auth;
window.firebaseDb = db;

window.firebaseFns = {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment
};

window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        showToast('Вхід через Google успішний');
    } catch (err) {
        console.error(err);
        showToast('Помилка входу: ' + (err.message || 'Невідома помилка'));
    }
};

window.signUpWithEmail = async (email, password) => {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast('Реєстрація успішна');
    } catch (err) {
        showToast('Помилка реєстрації: ' + err.message);
    }
};

window.signInWithEmail = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Вхід успішний');
    } catch (err) {
        showToast('Помилка входу: ' + err.message);
    }
};

window.signOutUser = async () => {
    await signOut(auth);
    showToast('Ви вийшли з акаунту');
};

async function loadCloudData() {
    if (!window.currentFirebaseUser) return;
    const ref = window.firebaseFns.doc(window.firebaseDb, 'users', window.currentFirebaseUser.uid);
    const snap = await window.firebaseFns.getDoc(ref);
    if (snap.exists()) {
        const data = snap.data();
        if (data.bookmarks) {
            localStorage.setItem('mono_anime_bookmarks', JSON.stringify(data.bookmarks));
        }
        if (data.history) {
            localStorage.setItem('mono_anime_history', JSON.stringify(data.history));
        }
        if (data.theme) {
            localStorage.setItem('mono_anime_theme', data.theme);
            applyTheme(data.theme);
        }
        if (data.watchedEpisodes) {
            localStorage.setItem('mono_anime_watched', JSON.stringify(data.watchedEpisodes));
        }
        if (data.videoProgress) {
            localStorage.setItem('mono_anime_video_progress', JSON.stringify(data.videoProgress));
        }
    }
    updateBadge();
}

window.loadCloudData = loadCloudData;

onAuthStateChanged(auth, (user) => {
    window.currentFirebaseUser = user;
    if (typeof loadProfileUI === 'function') loadProfileUI();
    if (user) {
        loadCloudData();
    } else {
        localStorage.removeItem('mono_anime_bookmarks');
        localStorage.removeItem('mono_anime_history');
        localStorage.removeItem('mono_anime_watched');
        localStorage.removeItem('mono_anime_video_progress');
        updateBadge();
    }
    updateBadge();
});
