// ─── Глобальна змінна користувача ───────────────────────────────────────────
window.currentUser = null;

// ─── Firebase конфігурація ──────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDjJ0Hzq1X2kL3mN4oPqRsT5uV6wXyZ7aB",
    authDomain: "monoanime-app.firebaseapp.com",
    projectId: "monoanime-app",
    storageBucket: "monoanime-app.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef1234567890"
};

// ─── Ініціалізація Firebase ────────────────────────────────────────────────
try {
    if (!window.firebase) {
        console.warn('Firebase SDK не завантажена. Auth функції будуть недоступні.');
    } else {
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        
        auth.onAuthStateChanged((user) => {
            window.currentUser = user ? {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || ''
            } : null;
            updateBadge?.();
        });
    }
} catch (err) {
    console.warn('Помилка ініціалізації Firebase:', err);
}

// ─── Вхід/реєстрація через Google ───────────────────────────────────────────
window.authGoogleSignIn = async function () {
    try {
        if (!window.firebase) throw new Error('Firebase не завантажена');
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        window.currentUser = {
            uid: result.user.uid,
            displayName: result.user.displayName || '',
            email: result.user.email || '',
            photoURL: result.user.photoURL || ''
        };
        closeAuthModal?.();
        showToast('✓ Успішно авторизовані');
    } catch (err) {
        showToast(`❌ Помилка: ${err.message}`);
        console.error('Google SignIn error:', err);
    }
};

// ─── Вхід через Email/Password ──────────────────────────────────────────────
window.authEmailLogin = async function () {
    try {
        if (!window.firebase) throw new Error('Firebase не завантажена');
        const email = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value;
        
        if (!email || !password) {
            showToast('❌ Заповніть email та пароль');
            return;
        }
        
        const result = await firebase.auth().signInWithEmailAndPassword(email, password);
        window.currentUser = {
            uid: result.user.uid,
            displayName: result.user.displayName || '',
            email: result.user.email || '',
            photoURL: result.user.photoURL || ''
        };
        closeAuthModal?.();
        showToast('✓ Успішно авторизовані');
    } catch (err) {
        showToast(`❌ Помилка входу: ${err.message}`);
        console.error('Email login error:', err);
    }
};

// ─── Реєстрація через Email/Password ────────────────────────────────────────
window.authEmailRegister = async function () {
    try {
        if (!window.firebase) throw new Error('Firebase не завантажена');
        const name = document.getElementById('authName')?.value?.trim();
        const email = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value;
        
        if (!name || !email || !password) {
            showToast('❌ Заповніть усі поля');
            return;
        }
        
        if (password.length < 6) {
            showToast('❌ Пароль повинен мати щонайменше 6 символів');
            return;
        }
        
        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await result.user.updateProfile({ displayName: name });
        
        window.currentUser = {
            uid: result.user.uid,
            displayName: result.user.displayName || '',
            email: result.user.email || '',
            photoURL: result.user.photoURL || ''
        };
        closeAuthModal?.();
        showToast('✓ Акаунт успішно створений');
    } catch (err) {
        showToast(`❌ Помилка реєстрації: ${err.message}`);
        console.error('Email register error:', err);
    }
};

// ─── Вихід з акаунту ────────────────────────────────────────────────────────
window.authSignOut = async function () {
    try {
        if (!window.firebase) throw new Error('Firebase не завантажена');
        await firebase.auth().signOut();
        window.currentUser = null;
        updateBadge?.();
        showToast('✓ Ви вийшли');
    } catch (err) {
        showToast(`❌ Помилка виходу: ${err.message}`);
        console.error('Sign out error:', err);
    }
};

// ─── Закриття модалю автентифікації ─────────────────────────────────────────
window.closeAuthModal = function () {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
        document.getElementById('authName').value = '';
    }
};

// ─── Хмарні функції (Firestore) ─────────────────────────────────────────────

async function getFirestore() {
    if (!window.firebase) throw new Error('Firebase не завантажена');
    return window.firebase.firestore();
}

export async function cloudGetBookmarks() {
    if (!window.currentUser) return [];
    try {
        const db = await getFirestore();
        const doc = await db.collection('users').doc(window.currentUser.uid).collection('bookmarks').get();
        return doc.docs.map(d => d.data());
    } catch (err) {
        console.error('cloudGetBookmarks error:', err);
        return [];
    }
}

export async function cloudAddBookmark(anime) {
    if (!window.currentUser) return;
    try {
        const db = await getFirestore();
        await db.collection('users').doc(window.currentUser.uid).collection('bookmarks').doc(String(anime.mal_id)).set(anime);
    } catch (err) {
        console.error('cloudAddBookmark error:', err);
    }
}

export async function cloudRemoveBookmark(mal_id) {
    if (!window.currentUser) return;
    try {
        const db = await getFirestore();
        await db.collection('users').doc(window.currentUser.uid).collection('bookmarks').doc(String(mal_id)).delete();
    } catch (err) {
        console.error('cloudRemoveBookmark error:', err);
    }
}

export async function cloudGetHistory() {
    if (!window.currentUser) return [];
    try {
        const db = await getFirestore();
        const doc = await db.collection('users').doc(window.currentUser.uid).collection('history').orderBy('timestamp', 'desc').limit(50).get();
        return doc.docs.map(d => d.data());
    } catch (err) {
        console.error('cloudGetHistory error:', err);
        return [];
    }
}

export async function cloudAddHistory(anime) {
    if (!window.currentUser) return;
    try {
        const db = await getFirestore();
        await db.collection('users').doc(window.currentUser.uid).collection('history').doc(String(anime.mal_id)).set({
            mal_id: anime.mal_id,
            title: anime.title,
            image_url: anime.images?.jpg?.large_image_url || '',
            url: anime.url || '',
            score: anime.score,
            year: anime.year,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('cloudAddHistory error:', err);
    }
}

export async function cloudSaveProgress(mal_id, season, dub, episode) {
    if (!window.currentUser) return;
    try {
        const db = await getFirestore();
        await db.collection('users').doc(window.currentUser.uid).collection('progress').doc(String(mal_id)).set({
            season, dub, episode, timestamp: Date.now()
        });
    } catch (err) {
        console.error('cloudSaveProgress error:', err);
    }
}

export async function cloudGetProgress(mal_id) {
    if (!window.currentUser) return null;
    try {
        const db = await getFirestore();
        const doc = await db.collection('users').doc(window.currentUser.uid).collection('progress').doc(String(mal_id)).get();
        return doc.exists ? doc.data() : null;
    } catch (err) {
        console.error('cloudGetProgress error:', err);
        return null;
    }
}
