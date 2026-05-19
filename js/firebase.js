import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

export {
  app, auth, db,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove
};
