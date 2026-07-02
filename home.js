// ═══════════════════════════════════════════════════════════
// الصفحة الرئيسية — Firebase Auth للهوية، Google Sheets للبيانات
// ═══════════════════════════════════════════════════════════
import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getMovements } from './sheets-service.js';

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
    'استلام من مورد': 'استلام',
    'صرف داخلي': 'صرف',
    'مرتجع من الموقع': 'مرتجع'
};

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    const username = user.email ? user.email.split('@')[0] : 'المستخدم';
    if (userWelcome) userWelcome.textContent = `مرحباً: ${username}`;

    try {
        const { role } = await getUserRole(user.email);
        if (adminPanelBtn) {
            if (role === 'admin') adminPanelBtn.classList.remove('hidden');
            else adminPanelBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error('getUserRole failed:', err);
    }

    try {
        const movements = (await getMovements(user.email)).slice(0, 5);
        if (!recentMovements) return;
        if (movements.length === 0) {
            recentMovements.innerHTML = '<p class="text-center text-gray-500 text-sm">لا توجد حركات مسجلة بعد</p>';
            return;
        }
        recentMovements.innerHTML = '';
        movements.forEach(m => {
            const label = TYPE_LABELS[m.type] || m.type || '';
            const card = document.createElement('div');
            card.className = 'movement-card';
            card.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="movement-badge" style="background:#667eea;">${label}</span>
                    <span class="text-xs text-gray-400">${formatDate(m.timestamp)}</span>
                </div>
                <p class="text-sm text-gray-800 font-semibold">${m.material || ''} — ${m.quantity ?? ''} ${m.unit || ''}</p>
                <p class="text-xs text-gray-500">${m.project || ''} ${m.phase ? '· ' + m.phase : ''}</p>
            `;
            recentMovements.appendChild(card);
        });
    } catch (err) {
        console.error('getMovements failed:', err);
        if (recentMovements) recentMovements.innerHTML = '<p class="text-center text-red-500 text-sm">فشل تحميل الحركات الأخيرة، تأكد من رابط Apps Script في sheets-service.js</p>';
    }
});
