// ═══════════════════════════════════════════════════════════
// إعدادات Firebase المشتركة — نظام مخزن شركة العزل
// ═══════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDNztzQF29nvHbys9yRPv5bICPGVbg32n8",
    authDomain: "exco-60e92.firebaseapp.com",
    projectId: "exco-60e92",
    storageBucket: "exco-60e92.firebasestorage.app",
    messagingSenderId: "875802729058",
    appId: "1:875802729058:web:8f1f18f775032f0f270f3b",
    measurementId: "G-3W0477KK1X"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// appId مختلف عن نظام التقارير القديم — عشان منعملش تعارض بيانات
export const appId = 'default-app-id';
export const adminUsername = "admin";

// ═══════════════════════════════════════════════════════════
// قائمة المراحل الثابتة وربطها بالمواد الافتراضية
// ═══════════════════════════════════════════════════════════
export const PHASES = ["فوم", "رولات", "أسمنتي", "دورات مياه"];

// خرائط الوحدات الافتراضية (تستخدم لو المادة الجديدة من غير وحدة محددة في Firestore)
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

// أنواع المواد التي ترجع للمستودع (وليس للمورد أو تبقى مع المقاول)
export const MATERIALS_RETURN_TO_WAREHOUSE = ["أسمنت", "دلمون"];
// أنواع المواد التي ترجع للمورد
export const MATERIALS_RETURN_TO_SUPPLIER = ["رول طبقتين", "طبقة حماية", "برايمر", "سيكا"];
// أنواع المواد بدون مرتجع (فوم) — بس فيها "متبقي في العربية"
export const MATERIALS_NO_RETURN = ["برميل أزرق", "برميل أحمر", "دهان"];

// ═══════════════════════════════════════════════════════════
// دوال مساعدة مشتركة
// ═══════════════════════════════════════════════════════════
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
