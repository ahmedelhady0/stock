// ═══════════════════════════════════════════════════════════
// منطق الصفحة الرئيسية — الترحيب، زر لوحة الإدارة، آخر الحركات
// (هذا الملف كان ناقص من المشروع الأصلي، تم إنشاؤه من جديد)
// ═══════════════════════════════════════════════════════════
import { auth, db, appId, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const userWelcome = document.getElementById('userWelcome');
const signOutBtn = document.getElementById('signOutBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const recentMovements = document.getElementById('recentMovements');
const closeMessageBtn = document.getElementById('closeMessageBtn');

closeMessageBtn?.addEventListener('click', hideMessage);

signOutBtn?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});

const TYPE_LABELS = {
    receive: { text: 'استلام', cls: 'receive' },
    return:  { text: 'مرتجع', cls: 'return' }
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // جلب بيانات المستخدم الحالي (الاسم + الرتبة)
    const userSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${user.uid}`));
    let currentUsername = user.email ? user.email.split('@')[0] : 'المستخدم';
    let role = 'supervisor';

    if (userSnap.exists()) {
        currentUsername = userSnap.data().username || currentUsername;
        role = userSnap.data().role || 'supervisor';
    }

    if (userWelcome) {
        userWelcome.textContent = `مرحباً: ${currentUsername}`;
    }

    // زر لوحة الإدارة يظهر فقط لو المستخدم admin فعلاً
    if (adminPanelBtn) {
        if (role === 'admin') {
            adminPanelBtn.classList.remove('hidden');
        } else {
            adminPanelBtn.classList.add('hidden');
        }
    }

    // جلب آخر 5 حركات سجلها هذا المستخدم
    // ملاحظة: هذا الاستعلام (where + orderBy) يحتاج Composite Index في Firestore.
    // أول مرة تفتح الصفحة، لو ظهر خطأ في الـ Console فيه رابط لإنشاء الـ Index تلقائيًا، اضغط عليه.
    const movementsRef = collection(db, `artifacts/${appId}/public/data/movements`);
    const q = query(movementsRef, where('createdBy', '==', user.uid), orderBy('timestamp', 'desc'), limit(5));

    onSnapshot(q, (snapshot) => {
        if (!recentMovements) return;
        if (snapshot.empty) {
            recentMovements.innerHTML = '<p class="text-center text-gray-500 text-sm">لا توجد حركات مسجلة بعد</p>';
            return;
        }
        recentMovements.innerHTML = '';
        snapshot.forEach(d => {
            const m = d.data();
            const t = TYPE_LABELS[m.movementType] || { text: m.movementType, cls: '' };
            const card = document.createElement('div');
            card.className = `movement-card type-${t.cls}`;
            card.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="movement-badge badge-${t.cls}">${t.text}</span>
                    <span class="text-xs text-gray-400">${formatDate(m.timestamp)}</span>
                </div>
                <p class="text-sm text-gray-800 font-semibold">${m.material} — ${m.quantity ?? ''} ${m.unit || ''}</p>
                <p class="text-xs text-gray-500">${m.project || ''} ${m.phase ? '· ' + m.phase : ''}</p>
            `;
            recentMovements.appendChild(card);
        });
    }, (error) => {
        console.error("Error loading movements:", error);
        recentMovements.innerHTML = '<p class="text-center text-red-500 text-sm">فشل تحميل الحركات الأخيرة</p>';
    });
});
