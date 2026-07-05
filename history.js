import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements, getEditRequests, getSettlementRequests, submitEditRequest } from './sheets-service.js';

let allMovements = [];
let pendingEditKeys = new Set();
let pendingSettleKeys = new Set();
let currentFilter = 'all';
let currentUserEmail = null;

const movementsList = document.getElementById('movementsList');
const editModal = document.getElementById('editModal');
const editFormFields = document.getElementById('editFormFields');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let editingId = null;
let editingMaterial = null;

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderMovements();
    });
});

function keyOf(idOrObj, material) {
    if (typeof idOrObj === 'object') return `${idOrObj['ID']}|||${idOrObj['المادة']}`;
    return `${idOrObj}|||${material}`;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUserEmail = user.email;
    try {
        const [movements, pendingEdits, pendingSettles] = await Promise.all([
            getMovements(),
            getEditRequests('قيد الموافقة'),
            getSettlementRequests('قيد الموافقة')
        ]);
        allMovements = movements;
        pendingEditKeys = new Set(pendingEdits.map(r => keyOf(r['معرف الحركة'], r['المادة'])));
        pendingSettleKeys = new Set(pendingSettles.map(r => keyOf(r['معرف الحركة'], r['المادة'])));
        renderMovements();
    } catch (err) {
        movementsList.innerHTML = `<p class="text-red-500 text-center mt-8">تعذر تحميل السجل: ${err.message}</p>`;
    }
});

function isSettled(m) {
    const consumed = parseFloat(m['مصروف على المشروع']) || 0;
    const remaining = parseFloat(m['متبقي في العربية']) || 0;
    const retStore = parseFloat(m['مرتجع للمستودع']) || 0;
    const retSupplier = parseFloat(m['مرتجع للمورد']) || 0;
    return (consumed + remaining + retStore + retSupplier) > 0;
}

function groupByRequest(movements) {
    const groups = {};
    movements.forEach(m => {
        const id = m['ID'];
        if (!groups[id]) groups[id] = { id, date: m['التاريخ'], project: m['المشروع'], phase: m['المرحلة'], contractor: m['المقاول / العمالة'], items: [] };
        groups[id].items.push(m);
    });
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderMovements() {
    let filtered = allMovements;
    if (currentFilter === 'receive') filtered = allMovements.filter(m => !isSettled(m));
    if (currentFilter === 'return') filtered = allMovements.filter(m => isSettled(m));

    const groups = groupByRequest(filtered);

    if (groups.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات مطابقة</p>';
        return;
    }

    movementsList.innerHTML = '';
    groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'movement-card p-4 bg-white rounded-2xl shadow-sm mb-4';

        const itemsHtml = group.items.map(m => {
            const settled = isSettled(m);
            const key = keyOf(m);
            const editPending = pendingEditKeys.has(key);
            const settlePending = pendingSettleKeys.has(key);
            const safeMat = encodeURIComponent(m['المادة'] || '');

            let statusBadge = settled
                ? `<span class="movement-badge badge-return">تمت التسوية</span>`
                : settlePending
                    ? `<span class="movement-badge badge-spend">تسوية قيد موافقة المهندس</span>`
                    : `<span class="movement-badge badge-receive">بانتظار التسوية</span>`;

            return `
                <div class="border-t border-gray-100 pt-3 mt-3 first:border-0 first:mt-0 first:pt-0">
                    <div class="flex justify-between items-start">
                        <div>
                            ${statusBadge}
                            ${editPending ? `<span class="movement-badge" style="background:#9C27B0;">تعديل قيد موافقة المهندس</span>` : ''}
                            <p class="mt-1 font-semibold text-gray-800">
                                ${m['المادة'] || ''} — ${m['وارد (استلام)'] || 0} ${m['الوحدة'] || ''}
                            </p>
                            ${settled ? `<p class="text-xs text-gray-500 mt-1">
                                مصروف: ${m['مصروف على المشروع'] || 0} • متبقي بالعربية: ${m['متبقي في العربية'] || 0} •
                                مرتجع مستودع: ${m['مرتجع للمستودع'] || 0} • مرتجع مورد: ${m['مرتجع للمورد'] || 0}
                            </p>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2 mt-2">
                        <button class="btn-edit-sm" data-id="${group.id}" data-material="${safeMat}" ${editPending ? 'disabled' : ''}>✏️ تعديل</button>
                        ${!settled && !settlePending ? `<button class="btn-delete-sm settle-btn" data-id="${group.id}" data-material="${safeMat}">⚖️ تسوية</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="text-xs text-gray-400">رقم الطلب: ${group.id}</p>
                    <p class="font-bold text-gray-800">${group.project || ''} • ${group.phase || ''}</p>
                    <p class="text-xs text-gray-500">بواسطة: ${group.contractor || 'غير محدد'}</p>
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap">${formatDate(group.date)}</span>
            </div>
            ${itemsHtml}
        `;
        movementsList.appendChild(card);
    });

    movementsList.querySelectorAll('.btn-edit-sm:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id, decodeURIComponent(btn.dataset.material)));
    });
    movementsList.querySelectorAll('.settle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const material = decodeURIComponent(btn.dataset.material);
            window.location.href = `settlement.html?id=${encodeURIComponent(btn.dataset.id)}&material=${encodeURIComponent(material)}`;
        });
    });
}

function openEditModal(id, material) {
    const m = allMovements.find(x => String(x['ID']) === String(id) && String(x['المادة']) === String(material));
    if (!m) return;
    editingId = id;
    editingMaterial = material;

    editFormFields.innerHTML = `
        <div>
            <label class="block text-sm font-semibold mb-1">المادة: ${m['المادة'] || ''}</label>
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">الكمية المستلمة (${m['الوحدة'] || ''})</label>
            <input type="number" step="any" id="editQuantity" class="input-field w-full p-3" value="${m['وارد (استلام)'] || 0}">
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">وجهة الاستلام / المورد</label>
            <input type="text" id="editSupplier" class="input-field w-full p-3" value="${m['وجهة الاستلام / الإرجاع'] || ''}">
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">ملاحظات</label>
            <textarea id="editNotes" rows="3" class="input-field w-full p-3">${m['ملاحظات'] || ''}</textarea>
        </div>
        <p class="text-xs text-amber-600">⚠️ هذا التعديل سيُرسل كطلب وينتظر موافقة المهندس قبل التطبيق الفعلي.</p>
    `;
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    editingId = null;
    editingMaterial = null;
}

cancelEditBtn?.addEventListener('click', closeEditModal);

saveEditBtn?.addEventListener('click', async () => {
    if (!editingId || !editingMaterial) return;
    const quantity = parseFloat(document.getElementById('editQuantity').value) || 0;
    const supplier = document.getElementById('editSupplier').value.trim();
    const notes = document.getElementById('editNotes').value.trim();

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'جاري الإرسال...';
    try {
        await submitEditRequest({
            movementId: editingId,
            material: editingMaterial,
            quantity,
            supplier,
            notes,
            requestedBy: currentUserEmail ? currentUserEmail.split('@')[0] : ''
        });
        showMessage('✅ تم إرسال طلب التعديل للمهندس، بانتظار الموافقة');
        closeEditModal();
        setTimeout(() => location.reload(), 1200);
    } catch (err) {
        showMessage('❌ فشل الإرسال: ' + err.message);
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = 'حفظ التعديل';
    }
});

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
