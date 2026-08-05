import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getUserRole,
    getSettlementRequests, approveSettlementRequest, rejectSettlementRequest,
    getEditRequests, approveEditRequest, rejectEditRequest
} from './sheets-service.js';

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
        const [settlementReqs, editReqs] = await Promise.all([
            getSettlementRequests('قيد الموافقة'),
            getEditRequests('قيد الموافقة')
        ]);
        renderAll(settlementReqs, editReqs);
    } catch (err) {
        requestsList.innerHTML = `<p class="text-red-500 text-center">تعذر التحميل: ${err.message}</p>`;
    }
}

function renderAll(settlementReqs, editReqs) {
    if (settlementReqs.length === 0 && editReqs.length === 0) {
        requestsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">🎉 لا توجد طلبات معلّقة</p>';
        return;
    }

    requestsList.innerHTML = '';

    if (settlementReqs.length > 0) {
        const heading = document.createElement('h2');
        heading.className = 'text-lg font-bold text-gray-800 mb-3 mt-2';
        heading.textContent = '🔄 طلبات المرتجع';
        requestsList.appendChild(heading);
        settlementReqs.forEach(r => requestsList.appendChild(renderSettlementCard(r)));
    }

    if (editReqs.length > 0) {
        const heading = document.createElement('h2');
        heading.className = 'text-lg font-bold text-gray-800 mb-3 mt-6';
        heading.textContent = '✏️ طلبات تعديل الحركات';
        requestsList.appendChild(heading);
        editReqs.forEach(r => requestsList.appendChild(renderEditCard(r)));
    }
}

function renderSettlementCard(r) {
    const card = document.createElement('div');
    card.className = 'section-card p-5 mb-4';
    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <span class="movement-badge badge-receive">قيد الموافقة</span>
                <p class="font-bold text-gray-800 mt-2">${r['المادة'] || ''}</p>
                <p class="text-sm text-gray-600">مقدم الطلب: ${r['مقدم الطلب'] || 'غير محدد'}</p>
                <p class="text-xs text-gray-400 mt-1" style="direction:ltr;text-align:right;">رقم الحركة: <b class="text-indigo-600">${r['معرف الحركة'] || '—'}</b></p>
            </div>
            <span class="text-xs text-gray-400">${formatDate(r['تاريخ الطلب'])}</span>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center text-sm bg-gray-50 rounded-xl p-3 mb-3">
            <div><p class="text-gray-500 text-xs">مرتجع للمستودع</p><p class="font-bold">${r['مرتجع للمستودع'] || 0}</p></div>
            <div><p class="text-gray-500 text-xs">مرتجع للمورد</p><p class="font-bold">${r['مرتجع للمورد'] || 0}</p></div>
            <div><p class="text-gray-500 text-xs">متبقي</p><p class="font-bold">${r['متبقي في العربية'] || 0}</p></div>
        </div>
        ${r['ملاحظات المشرف'] ? `<p class="text-xs text-gray-500 mb-3">ملاحظات: ${r['ملاحظات المشرف']}</p>` : ''}
        <textarea class="engineer-notes input-field w-full p-2 text-sm mb-3" rows="2" placeholder="ملاحظات المهندس (اختياري)"></textarea>
        <div class="flex gap-3">
            <button class="approve-settle-btn flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">✅ موافقة</button>
            <button class="reject-settle-btn flex-1 py-2 bg-red-500 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">❌ رفض</button>
        </div>
    `;

    card.querySelector('.approve-settle-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const notes = card.querySelector('.engineer-notes').value.trim();
        btn.disabled = true; btn.textContent = 'جاري الموافقة...';
        try {
            await approveSettlementRequest(btn.dataset.id, currentUsername, notes);
            showMessage('✅ تمت الموافقة على المرتجع بنجاح');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            showMessage('❌ فشل: ' + err.message);
            btn.disabled = false; btn.textContent = '✅ موافقة';
        }
    });

    card.querySelector('.reject-settle-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const notes = card.querySelector('.engineer-notes').value.trim();
        if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
        btn.disabled = true; btn.textContent = 'جاري الرفض...';
        try {
            await rejectSettlementRequest(btn.dataset.id, currentUsername, notes);
            showMessage('تم رفض الطلب');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            showMessage('❌ فشل: ' + err.message);
            btn.disabled = false; btn.textContent = '❌ رفض';
        }
    });

    return card;
}

function renderEditCard(r) {
    const card = document.createElement('div');
    card.className = 'section-card p-5 mb-4';
    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <span class="movement-badge" style="background:#9C27B0;">قيد الموافقة</span>
                <p class="font-bold text-gray-800 mt-2">${r['المادة'] || ''}</p>
                <p class="text-sm text-gray-600">المشروع: ${r['المشروع'] || 'غير محدد'}</p>
                <p class="text-sm text-gray-600">مقدم الطلب: ${r['مقدم الطلب'] || 'غير محدد'}</p>
                <p class="text-xs text-gray-400 mt-1" style="direction:ltr;text-align:right;">رقم الحركة: <b class="text-indigo-600">${r['معرف الحركة'] || '—'}</b></p>
            </div>
            <span class="text-xs text-gray-400">${formatDate(r['تاريخ الطلب'])}</span>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center text-sm bg-gray-50 rounded-xl p-3 mb-3">
            <div><p class="text-gray-500 text-xs">الكمية السابقة</p><p class="font-bold text-gray-700">${r['الكمية السابقة'] ?? 0}</p></div>
            <div><p class="text-gray-500 text-xs">الكمية المطلوبة</p><p class="font-bold text-emerald-700">${r['الكمية الجديدة'] ?? 0}</p></div>
            <div><p class="text-gray-500 text-xs">الوجهة الجديدة</p><p class="font-bold">${r['الوجهة الجديدة'] || '-'}</p></div>
        </div>
        ${r['الملاحظات الجديدة'] ? `<p class="text-xs text-gray-500 mb-3">الملاحظات الجديدة: ${r['الملاحظات الجديدة']}</p>` : ''}
        <textarea class="engineer-notes input-field w-full p-2 text-sm mb-3" rows="2" placeholder="ملاحظات المهندس (اختياري)"></textarea>
        <div class="flex gap-3">
            <button class="approve-edit-btn flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">✅ موافقة</button>
            <button class="reject-edit-btn flex-1 py-2 bg-red-500 text-white rounded-xl font-bold text-sm" data-id="${r['ID']}">❌ رفض</button>
        </div>
    `;

    card.querySelector('.approve-edit-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const notes = card.querySelector('.engineer-notes').value.trim();
        btn.disabled = true; btn.textContent = 'جاري الموافقة...';
        try {
            await approveEditRequest(btn.dataset.id, currentUsername, notes);
            showMessage('✅ تمت الموافقة على التعديل بنجاح');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            showMessage('❌ فشل: ' + err.message);
            btn.disabled = false; btn.textContent = '✅ موافقة';
        }
    });

    card.querySelector('.reject-edit-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const notes = card.querySelector('.engineer-notes').value.trim();
        if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
        btn.disabled = true; btn.textContent = 'جاري الرفض...';
        try {
            await rejectEditRequest(btn.dataset.id, currentUsername, notes);
            showMessage('تم رفض الطلب');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            showMessage('❌ فشل: ' + err.message);
            btn.disabled = false; btn.textContent = '❌ رفض';
        }
    });

    return card;
}

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
