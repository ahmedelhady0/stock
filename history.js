import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements, getEditRequests, submitEditRequest, submitSettlementRequest } from './sheets-service.js';

let allMovements = [];
let pendingEditKeys = new Set();
let currentFilter = 'all';
let currentUserEmail = null;

const movementsList = document.getElementById('movementsList');
const editModal = document.getElementById('editModal');
const editFormFields = document.getElementById('editFormFields');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let editingId = null;
let editingMaterial = null;
let isReturnMode = false;
let returningMovement = null;

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

function getType(m) {
    const t = String(m['نوع الحركة'] || m.movementType || '').trim();
    if (t.indexOf('مرتجع') !== -1) return 'return';
    if (t === 'صرف مباشر' || t === 'direct') return 'direct';
    if (t === 'وارد مستودع' || t === 'warehouse') return 'warehouse';
    // كشف تلقائي للحركات القديمة اللي مالهاش نوع
    if (parseFloat(m['مصروف على المشروع']) > 0 && parseFloat(m['مرتجع للمستودع']) === 0 && parseFloat(m['مرتجع للمورد']) === 0) return 'direct';
    if (parseFloat(m['وارد (استلام)']) > 0 && parseFloat(m['مصروف على المشروع']) === 0) return 'warehouse';
    if (parseFloat(m['مرتجع للمستودع']) > 0 || parseFloat(m['مرتجع للمورد']) > 0) return 'return';
    return 'warehouse';
}

function isReturn(m) { return getType(m) === 'return'; }
function isDirect(m) { return getType(m) === 'direct'; }
function isWarehouse(m) { return getType(m) === 'warehouse'; }

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUserEmail = user.email;
    try {
        const [movements, pendingEdits] = await Promise.all([
            getMovements(),
            getEditRequests('قيد الموافقة')
        ]);
        allMovements = movements;
        pendingEditKeys = new Set(pendingEdits.map(r => keyOf(r['معرف الحركة'], r['المادة'])));
        renderMovements();
    } catch (err) {
        movementsList.innerHTML = `<p class="text-red-500 text-center mt-8">تعذر تحميل السجل: ${err.message}</p>`;
    }
});

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
    if (currentFilter === 'receive') filtered = allMovements.filter(m => !isReturn(m));
    if (currentFilter === 'return') filtered = allMovements.filter(m => isReturn(m));

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
            const ret = isReturn(m);
            const dir = isDirect(m);
            const wh = isWarehouse(m);
            const key = keyOf(m);
            const editPending = pendingEditKeys.has(key);
            const safeMat = encodeURIComponent(m['المادة'] || '');
            const safeId = encodeURIComponent(group.id);

            let typeBadge = '';
            let qtyDisplay = '';
            if (ret) {
                typeBadge = `<span class="movement-badge badge-return">🔄 مرتجع</span>`;
                const totalRet = (parseFloat(m['مرتجع للمستودع']) || 0) + (parseFloat(m['مرتجع للمورد']) || 0);
                qtyDisplay = `${totalRet || m['وارد (استلام)'] || 0}`;
            } else if (dir) {
                typeBadge = `<span class="movement-badge badge-receive">🚚 صرف مباشر</span>`;
                const consumed = parseFloat(m['مصروف على المشروع']) || parseFloat(m['وارد (استلام)']) || 0;
                qtyDisplay = `${consumed}`;
            } else if (wh) {
                typeBadge = `<span class="movement-badge" style="background:#2196F3;">🏠 وارد مستودع</span>`;
                qtyDisplay = `${m['وارد (استلام)'] || 0}`;
            }

            return `
                <div class="border-t border-gray-100 pt-3 mt-3 first:border-0 first:mt-0 first:pt-0">
                    <div class="flex justify-between items-start">
                        <div>
                            ${typeBadge}
                            ${editPending ? `<span class="movement-badge" style="background:#9C27B0;">✏️ تعديل قيد الموافقة</span>` : ''}
                            <p class="mt-1 font-semibold text-gray-800">
                                ${m['المادة'] || ''} — ${qtyDisplay} ${m['الوحدة'] || ''}
                            </p>
                            ${ret && (parseFloat(m['مرتجع للمستودع']) > 0 || parseFloat(m['مرتجع للمورد']) > 0)
                                ? `<p class="text-xs text-gray-500 mt-1">
                                    لمستودع: ${m['مرتجع للمستودع'] || 0} • لمورد: ${m['مرتجع للمورد'] || 0}
                                   </p>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-2 mt-2">
                        ${!ret ? `<button class="btn-return-sm" data-id="${safeId}" data-material="${safeMat}" data-project="${encodeURIComponent(m['المشروع'] || '')}">🔄 مرتجع</button>` : ''}
                        <button class="btn-edit-sm" data-id="${group.id}" data-material="${safeMat}" ${editPending || ret ? 'disabled' : ''}>✏️ تعديل</button>
                    </div>
                </div>
            `;
        }).join('');

        const typeLabel = group.items.some(m => isReturn(m)) ? '🔄 مرتجع' :
                          group.items.some(m => isDirect(m)) ? '🚚 صرف مباشر' : '🏠 وارد مستودع';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="text-xs text-gray-400">رقم الطلب: ${group.id}</p>
                    <p class="font-bold text-gray-800">${group.project || ''} • ${group.phase || ''}</p>
                    <p class="text-xs text-gray-500">بواسطة: ${group.contractor || 'غير محدد'} | ${typeLabel}</p>
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

    movementsList.querySelectorAll('.btn-return-sm').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = decodeURIComponent(btn.dataset.id);
            const material = decodeURIComponent(btn.dataset.material);
            const project = decodeURIComponent(btn.dataset.project);
            openReturnForm(id, material, project);
        });
    });
}

function openReturnForm(id, material, project) {
    const m = allMovements.find(x => String(x['ID']) === String(id) && String(x['المادة']) === String(material));
    if (!m) return;

    isReturnMode = true;
    returningMovement = m;
    editingId = id;
    editingMaterial = material;

    editFormFields.innerHTML = `
        <div id="modalError" class="hidden bg-red-50 border border-red-200 text-red-700 text-sm font-semibold p-3 rounded-xl mb-3 text-center"></div>
        <div class="text-center mb-3">
            <span class="movement-badge badge-return" style="font-size:14px;">🔄 مرتجع</span>
        </div>
        <div class="bg-amber-50 p-3 rounded-xl text-sm mb-3">
            <p><b>المشروع:</b> ${project}</p>
            <p><b>المادة:</b> ${material}</p>
            <p><b>الاستهلاك الحالي:</b> <span class="font-bold text-indigo-700">${(allMovements.find(x => String(x['ID']) === String(m?.['ID']) && String(x['المادة']) === String(material)))?.['مصروف على المشروع'] || m?.['مصروف على المشروع'] || 0}</span></p>
        </div>
        <div class="flex gap-3 mb-3">
            <label class="flex-1 flex items-center justify-center gap-1 bg-white p-2 rounded-xl border-2 border-indigo-300 cursor-pointer hover:bg-indigo-50 transition" id="destStoreLabel">
                <input type="radio" name="returnDest" value="warehouse" checked class="accent-indigo-600">
                <span class="text-sm font-semibold text-indigo-700">🏠 مستودع</span>
            </label>
            <label class="flex-1 flex items-center justify-center gap-1 bg-white p-2 rounded-xl border-2 border-orange-300 cursor-pointer hover:bg-orange-50 transition" id="destSupplierLabel">
                <input type="radio" name="returnDest" value="supplier" class="accent-orange-600">
                <span class="text-sm font-semibold text-orange-700">🚚 مورد</span>
            </label>
        </div>
        <div id="returnSupplierWrap" class="hidden">
            <label class="block text-sm font-semibold mb-1">اسم المورد</label>
            <input type="text" id="returnSupplier" class="input-field w-full p-3" placeholder="اسم المورد">
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">الكمية المرتجعة</label>
            <input type="number" step="any" id="returnQty" class="input-field w-full p-3 text-center text-lg font-bold" placeholder="0" min="0">
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">ملاحظات (اختياري)</label>
            <textarea id="returnNotes" rows="2" class="input-field w-full p-3" placeholder="سبب الإرجاع..."></textarea>
        </div>
        <p class="text-xs text-emerald-600">⚠️ المرتجع يُخصم مباشرة من الاستهلاك (بدون موافقة)</p>
    `;

    document.querySelectorAll('input[name="returnDest"]').forEach(r => {
        r.addEventListener('change', (e) => {
            const wrap = document.getElementById('returnSupplierWrap');
            wrap.classList.toggle('hidden', e.target.value !== 'supplier');
        });
    });

    saveEditBtn.textContent = 'تسجيل المرتجع';
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

function openEditModal(id, material) {
    const m = allMovements.find(x => String(x['ID']) === String(id) && String(x['المادة']) === String(material));
    if (!m) return;

    isReturnMode = false;
    returningMovement = null;
    editingId = id;
    editingMaterial = material;

    editFormFields.innerHTML = `
        <div>
            <label class="block text-sm font-semibold mb-1">المادة: ${m['المادة'] || ''}</label>
        </div>
        <div>
            <label class="block text-sm font-semibold mb-1">الكمية (${m['الوحدة'] || ''})</label>
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
    saveEditBtn.textContent = 'حفظ التعديل';
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    editingId = null;
    editingMaterial = null;
    isReturnMode = false;
    returningMovement = null;
}

cancelEditBtn?.addEventListener('click', closeEditModal);

saveEditBtn?.addEventListener('click', async () => {
    if (isReturnMode) {
        await submitReturn();
    } else {
        await submitEdit();
    }
});

async function submitReturn() {
    if (!returningMovement || !editingMaterial) return;

    const qty = parseFloat(document.getElementById('returnQty').value) || 0;
    if (qty <= 0) {
        showMessage('أدخل كمية صحيحة');
        return;
    }

    const dest = document.querySelector('input[name="returnDest"]:checked');
    const toSupplier = dest && dest.value === 'supplier';
    const supplierName = toSupplier ? (document.getElementById('returnSupplier').value.trim() || 'مورد') : '';
    const notes = document.getElementById('returnNotes').value.trim();

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'جاري الحفظ...';

    const origId = returningMovement['ID'];

    try {
        await submitSettlementRequest({
            movementId: origId,
            material: editingMaterial,
            remainingInCar: 0,
            returnToStore: toSupplier ? 0 : qty,
            returnToSupplier: toSupplier ? qty : 0,
            notes: notes || (toSupplier ? `مرتجع للمورد ${supplierName}` : `مرتجع للمستودع`),
            requestedBy: currentUserEmail ? currentUserEmail.split('@')[0] : ''
        });

        showMessage(`✅ تم إرسال طلب مرتجع ${qty} ${returningMovement['الوحدة'] || ''} للمهندس بانتظار الموافقة`);
        closeEditModal();
        setTimeout(() => location.reload(), 1200);
    } catch (err) {
        const errDiv = document.getElementById('modalError');
        if (errDiv) {
            errDiv.textContent = '❌ ' + err.message;
            errDiv.classList.remove('hidden');
        } else {
            showMessage('❌ ' + err.message);
        }
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = 'تسجيل المرتجع';
    }
}

async function submitEdit() {
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
}

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
