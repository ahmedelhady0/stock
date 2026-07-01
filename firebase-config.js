    // ═══════════════════════════════════════════════════════════
    // إعدادات Firebase المشتركة — نظام مخزن شركة العزل
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
    
    // appId ده اسم منطقي بيستخدمه الكود كمسار داخل Firestore
    // (artifacts/{appId}/public/data/...) — مش لازم يتغير أبدًا،
    // وكل ملفات المشروع لازم تستورده من هنا فقط، عشان محدش يكتب في مسار غلط زي ما حصل في admin.js قبل كده
    export const appId = 'warehouse';
    
    // اسم المستخدم اللي لو حد عمل بيه حساب، هياخد صلاحية admin تلقائيًا (مرة واحدة بس، أول تسجيل)
    export const adminUsername = "admin";
    
    // ═══════════════════════════════════════════════════════════
    // قائمة المراحل الثابتة
    // ═══════════════════════════════════════════════════════════
    export const PHASES = ["فوم", "رولات", "أسمنتي", "دورات مياه"];
    
    // خرائط الوحدات الافتراضية (اختيارية، للرجوع إليها لو حبيت)
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
    
    // ⚠️ ملاحظة: القوائم دي بتحدد إمكانية عمل مرتجع للمادة أو لأ، وهي مبنية على أسماء مواد ثابتة.
    // لو ضفت مادة جديدة من لوحة الإدارة مش موجودة في أي قائمة من التلاتة دي، مش هيبقى ليها مرتجع خالص.
    // شوف قسم "تحسينات مقترحة" في دليل الإعداد — الحل الصح إنها تبقى خاصية (returnable) جوه مستند المادة نفسه في Firestore.
    export const MATERIALS_RETURN_TO_WAREHOUSE = ["أسمنت", "دلمون"];
    export const MATERIALS_RETURN_TO_SUPPLIER = ["رول طبقتين", "طبقة حماية", "برايمر", "سيكا"];
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
