// Ligação ao Firebase (projeto myworkguru-4f422).
// Esta configuração é pública por natureza: os dados estão protegidos pelas regras de segurança (firestore.rules).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFIo263w6RaUJuNu3uWIbqjSehHI-xPzw",
  authDomain: "myworkguru-4f422.firebaseapp.com",
  projectId: "myworkguru-4f422",
  storageBucket: "myworkguru-4f422.firebasestorage.app",
  messagingSenderId: "16477704993",
  appId: "1:16477704993:web:398245d50377bdb4372460"
};

const app = initializeApp(firebaseConfig);
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = getFirestore(app); }
const auth = getAuth(app);

export const FB = { app, auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, writeBatch, query, where };
