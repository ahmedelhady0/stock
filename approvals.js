import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getSettlementRequests, approveSettlementRequest, rejectSettlementRequest } from './sheets-service.js';

const requestsList = document.getElementById('requestsList');
const notAdminMsg = document.getElementById('notAdminMsg');
let currentUsername = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    let role = 'supervisor';
    try {
        const info = await getUserRole(user.email);
        role = info.role || 'supervisor';
        currentUsername = info.username || user.email.split('@')[0];
    } catch (err) {}

    if (role !== 'admin') {
        notAdminMsg.classList.remove('hidden');
        requestsList.classList.add('hidden');
        return;
    }

    await loadRequests();
});

async function loadRequests() {
    requestsList.innerHTML = '<p class="text-center text-gray-500 text-sm">جاري التحميل...</p>';
    try {
        const requests = await getSettlementRequests('قيد الموافقة');
        renderRequests(requests);
    } catch (err) {
        requestsList.innerHTML = `<p class="text-red-500 text-center">تعذر التحميل: ${err.message}</p>`;
    }
}

function renderRequests(requests) {
    if (requests.length === 0) {
        requestsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد طلبات تسوية معلّقة 🎉</p>';
        return;
    }

    requestsList.innerHTML = '';
    requests.forEach(r => {
        const card = document.createElement('div');
        card.className = 'section-card p-5 mb-4';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="movement-badge badge-receive">قيد الموافقة</span>
                    <p class="font-bold text-gray-800 mt-2">${r['المادة'] || ''}</p>
                    <p class="text-sm text-gray-600">مقدم الطلب: ${r['مقدم الطلب'] || 'غير محدد'}</p>
                </div>
                <span class="text-xs text-gray-400">${formatDate(r['تاريخ الطلب'])}</span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-center text-sm bg-gray-50 rounded-xl p-3 mb-3">
                <div><p class="text-gray-500 text-xs">متبقي بالعربية</p><p class="font-bold">${r['متبقي في العربية'] || 0}</p></div>
                <div><p class="text-gray-500 text-xs">مرتجع للمستودع</p><p class="font-bold">${r['مرتجع للمستودع'] || 0}</p></div>
                <div><p class="text-gray-500 text-xs">مرتجع للمورد</p><p class="font-bold">${r['مرتجع للمورد'] || 0}</p></div>
            </div>
            ${r['ملاحظات المشرف'] ? `<p class="text-xs text-gray-500 mb-3">ملاحظات المشرف: ${r['ملاحظات المشرف']}</p>` : ''}
            <textarea class="engineer-notes input-field w-full p-2 text-sm mb-3" rows="2" placeholder="ملاحظات المهندس (اختياري)"></textarea>
            <div class="flex gap-3">
                <button class="approve-btn flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">✅ موافقة</button>
                <button class="reject-btn flex-1 py-2 bg-red-500 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">❌ رفض</button>
            </div>
        `;
        requestsList.appendChild(card);
    });

    requestsList.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const notes = btn.closest('.section-card').querySelector('.engineer-notes').value.trim();
            btn.disabled = true;
            btn.textContent = 'جاري الموافقة...';
            try {
                await approveSettlementRequest(btn.dataset.id, currentUsername, notes);
                showMessage('✅ تمت الموافقة على التسوية بنجاح');
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                showMessage('❌ فشل: ' + err.message);
                btn.disabled = false;
                btn.textContent = '✅ موافقة';
            }
        });
    });

    requestsList.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const notes = btn.closest('.section-card').querySelector('.engineer-notes').value.trim();
            if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
            btn.disabled = true;
            btn.textContent = 'جاري الرفض...';
            try {
                await rejectSettlementRequest(btn.dataset.id, currentUsername, notes);
                showMessage('تم رفض الطلب');
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                showMessage('❌ فشل: ' + err.message);
                btn.disabled = false;
                btn.textContent = '❌ رفض';
            }
        });
    });
}

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
