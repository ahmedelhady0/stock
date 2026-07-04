import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements, updateMovement } from './sheets-service.js';

let allMovements = [];
let currentFilter = 'all';

const movementsList = document.getElementById('movementsList');
const editModal = document.getElementById('editModal');
const editFormFields = document.getElementById('editFormFields');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let editingId = null;

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderMovements();
    });
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        allMovements = await getMovements(); // كل الحركات (مؤقتاً بدون فلترة على المستخدم)
        console.log("عدد الحركات:", allMovements.length, "أول حركة:", allMovements[0]);
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

function renderMovements() {
    let filtered = allMovements;
    if (currentFilter === 'receive') filtered = allMovements.filter(m => !isSettled(m));
    if (currentFilter === 'return') filtered = allMovements.filter(m => isSettled(m));

    if (filtered.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات مطابقة</p>';
        return;
    }

    movementsList.innerHTML = '';
    filtered.forEach(m => {
        const settled = isSettled(m);
        const card = document.createElement('div');
        card.className = 'movement-card p-4 bg-white rounded-2xl shadow-sm mb-3';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="movement-badge ${settled ? 'badge-return' : 'badge-receive'}">
                        ${settled ? 'تمت التسوية' : 'بانتظار التسوية'}
                    </span>
                    <p class="mt-2 font-semibold text-gray-800">
                        ${m['المادة'] || 'مادة غير محددة'} — ${m['وارد (استلام)'] || 0} ${m['الوحدة'] || ''}
                    </p>
                    <p class="text-sm text-gray-600">${m['المشروع'] || ''} • ${m['المرحلة'] || ''}</p>
                    <p class="text-xs text-gray-400">بواسطة: ${m['المقاول / العمالة'] || 'غير محدد'}</p>
                    ${settled ? `<p class="text-xs text-gray-500 mt-1">
                        مصروف: ${m['مصروف على المشروع'] || 0} • متبقي بالعربية: ${m['متبقي في العربية'] || 0} •
                        مرتجع مستودع: ${m['مرتجع للمستودع'] || 0} • مرتجع مورد: ${m['مرتجع للمورد'] || 0}
                    </p>` : ''}
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap">${formatDate(m['التاريخ'])}</span>
            </div>
            <div class="movement-actions mt-3 flex gap-2">
                <button class="btn-edit-sm" data-id="${m['ID']}">✏️ تعديل</button>
                ${!settled ? `<button class="btn-delete-sm settle-btn" data-id="${m['ID']}">⚖️ تسوية</button>` : ''}
            </div>
        `;
        movementsList.appendChild(card);
    });

    movementsList.querySelectorAll('.btn-edit-sm').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    movementsList.querySelectorAll('.settle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `settlement.html?id=${encodeURIComponent(btn.dataset.id)}`;
        });
    });
}

function openEditModal(id) {
    const m = allMovements.find(x => String(x['ID']) === String(id));
    if (!m) return;
    editingId = id;

    editFormFields.innerHTML = `
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
    `;
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    editingId = null;
}

cancelEditBtn?.addEventListener('click', closeEditModal);

saveEditBtn?.addEventListener('click', async () => {
    if (!editingId) return;
    const quantity = parseFloat(document.getElementById('editQuantity').value) || 0;
    const supplier = document.getElementById('editSupplier').value.trim();
    const notes = document.getElementById('editNotes').value.trim();

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'جاري الحفظ...';
    try {
        await updateMovement(editingId, {
            'وارد (استلام)': quantity,
            'وجهة الاستلام / الإرجاع': supplier,
            'ملاحظات': notes
        });
        showMessage('✅ تم تعديل الحركة بنجاح');
        closeEditModal();
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        showMessage('❌ فشل التعديل: ' + err.message);
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = 'حفظ التعديل';
    }
});

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
