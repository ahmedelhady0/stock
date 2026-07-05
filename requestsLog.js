import { auth, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getAllRequestsLog } from './sheets-service.js';

const logList = document.getElementById('logList');
const notAdminMsg = document.getElementById('notAdminMsg');
let allLog = [];
let currentFilter = 'all';

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderLog();
    });
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    let role = 'supervisor';
    try {
        const info = await getUserRole(user.email);
        role = info.role || 'supervisor';
    } catch (err) {}

    if (role !== 'admin') {
        notAdminMsg.classList.remove('hidden');
        logList.classList.add('hidden');
        return;
    }

    try {
        allLog = await getAllRequestsLog();
        renderLog();
    } catch (err) {
        logList.innerHTML = `<p class="text-red-500 text-center">تعذر التحميل: ${err.message}</p>`;
    }
});

function renderLog() {
    let filtered = allLog;
    if (currentFilter !== 'all') {
        filtered = allLog.filter(r => String(r.status || '').trim() === currentFilter);
    }

    if (filtered.length === 0) {
        logList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد سجلات مطابقة</p>';
        return;
    }

    logList.innerHTML = '';
    filtered.forEach(r => {
        const approved = String(r.status || '').trim() === 'موافق عليها';
        const card = document.createElement('div');
        card.className = 'section-card p-4 mb-3';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="movement-badge ${approved ? 'badge-return' : 'badge-spend'}">
                        ${approved ? '✅ موافق عليها' : '❌ مرفوضة'}
                    </span>
                    <span class="text-xs text-gray-400 mr-2">${r.type === 'تسوية' ? '⚖️ تسوية' : '✏️ تعديل'}</span>
                    <p class="font-bold text-gray-800 mt-1">${r.material || ''}</p>
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap">${formatDate(r.reviewDate)}</span>
            </div>
            <p class="text-xs text-gray-500 mb-1">${r.details || ''}</p>
            <div class="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>مقدم الطلب: <b>${r.requestedBy || 'غير محدد'}</b></span>
                <span>راجعها: <b>${r.reviewedBy || 'غير محدد'}</b></span>
            </div>
            ${r.engineerNotes ? `<p class="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded-lg">ملاحظات المهندس: ${r.engineerNotes}</p>` : ''}
        `;
        logList.appendChild(card);
    });
}
