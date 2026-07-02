// ═══════════════════════════════════════════════════════════
// إعدادات Firebase — نظام مخزن شركة العزل
// ═══════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAtMjR7QBvfLZ3c2QS6FpGrzBF-EIUbS4Q",
    authDomain: "warehouse-8edf4.firebaseapp.com",
    projectId: "warehouse-8edf4",
    storageBucket: "warehouse-8edf4.firebasestorage.app",
    messagingSenderId: "819315880651",
    appId: "1:819315880651:web:03221eb8c80d115897214e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const appId = 'warehouse-8edf4';
export const adminUsername = "admin";

export const PHASES = ["فوم", "رولات", "أسمنتي", "دورات مياه"];

export const DEFAULT_UNITS = {
    "برميل أزرق": "برميل 220كج",
    "برميل أحمر": "برميل 240كج",
    "دهان": "وعاء 20كج",
    "رول طبقتين": "رول",
    "طبقة حماية": "رول",
    "برايمر": "وحدة",
    "سيكا": "وحدة",
    "دلمون": "وحدة",
    "أسمنت": "كيس 20كج"
};

export const MATERIALS_RETURN_TO_WAREHOUSE = ["أسمنت", "دلمون"];
export const MATERIALS_RETURN_TO_SUPPLIER = ["رول طبقتين", "طبقة حماية", "برايمر", "سيكا"];
export const MATERIALS_NO_RETURN = ["برميل أزرق", "برميل أحمر", "دهان"];

// ═══════════════════════════════════════════════════════════
// دوال مساعدة مشتركة
// ═══════════════════════════════════════════════════════════
export function usernameToEmail(username) {
    return `${username.toLowerCase()}@slabet.app`;
}

export function showMessage(text) {
    const box = document.getElementById('messageBox');
    const txt = document.getElementById('messageText');
    if (box && txt) {
        txt.textContent = text;
        box.classList.remove('hidden');
        box.classList.add('flex');
    } else {
        alert(text);
    }
}

export function hideMessage() {
    const box = document.getElementById('messageBox');
    if (box) {
        box.classList.add('hidden');
        box.classList.remove('flex');
    }
}

export function todayStr() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

export function formatDate(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}
