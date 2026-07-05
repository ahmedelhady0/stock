import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getMovements } from './sheets-service.js';

const userWelcome = document.getElementById('userWelcome');
const signOutBtn = document.getElementById('signOutBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const approvalsBtn = document.getElementById('approvalsBtn');
const recentMovements = document.getElementById('recentMovements');

signOutBtn?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    const username = user.email ? user.email.split('@')[0] : 'المستخدم';
    if (userWelcome) userWelcome.textContent = `مرحباً: ${username}`;

    try {
        const { role } = await getUserRole(user.email);
        if (adminPanelBtn) adminPanelBtn.classList.toggle('hidden', role !== 'admin');
        if (approvalsBtn) approvalsBtn.classList.toggle('hidden', role !== 'admin');
    } catch (err) {
        console.error('Role check error:', err);
    }

    loadRecentMovements();
});

async function loadRecentMovements() {
    if (!recentMovements) return;
    recentMovements.innerHTML = '<p class="text-center text-gray-500 text-sm">جاري التحميل...</p>';

    try {
        const movements = await getMovements();
        if (movements.length === 0) {
            recentMovements.innerHTML = '<p class="text-center text-gray-500 text-sm">لا توجد حركات مسجلة</p>';
            return;
        }

        recentMovements.innerHTML = '';
        movements.slice(0, 5).forEach(m => {
            const card = document.createElement('div');
            card.className = 'p-3 bg-white rounded-xl shadow-sm mb-2 border-r-4 border-emerald-500';
            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-sm font-semibold">${m['المادة'] || 'مادة'}</span>
                        <span class="text-xs text-gray-500 block">${m['المشروع'] || ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-emerald-600">${m['وارد (استلام)'] || m['مصروف على المشروع'] || 0}</span>
                        <span class="text-xs text-gray-400 block">${m['الوحدة'] || ''}</span>
                    </div>
                </div>
            `;
            recentMovements.appendChild(card);
        });
    } catch (err) {
        recentMovements.innerHTML = '<p class="text-red-500 text-center text-sm">فشل تحميل الحركات</p>';
    }
}
