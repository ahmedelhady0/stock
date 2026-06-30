// ═══════════════════════════════════════════════════════════
// منطق صفحة سجل الحركات — عرض / تعديل / حذف
// ═══════════════════════════════════════════════════════════
import { auth, db, appId, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let currentUser = null;
let allMovements = [];
let currentFilter = 'all';
let editingId = null;

const movementsList = document.getElementById('movementsList');
const closeMessageBtn = document.getElementById('closeMessageBtn');
const editModal = document.getElementById('editModal');
const editFormFields = document.getElementById('editFormFields');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

closeMessageBtn?.addEventListener('click', hideMessage);
cancelEditBtn?.addEventListener('click', () => { editModal.classList.add('hidden'); editModal.classList.remove('flex'); });

const TYPE_LABELS = {
    receive: { text: 'استلام', cls: 'receive' },
    return:  { text: 'مرتجع', cls: 'return' }
};

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderMovements();
    });
});

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;

    const movementsRef = collection(db, `artifacts/${appId}/public/data/movements`);
    const q = query(movementsRef, where('createdBy', '==', user.uid), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        allMovements = [];
        snapshot.forEach(d => allMovements.push({ id: d.id, ...d.data() }));
        renderMovements();
    }, (err) => {
        console.error(err);
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm">تعذر تحميل البيانات</p>';
    });
});

function renderMovements() {
    const filtered = currentFilter === 'all' ? allMovements : allMovements.filter(m => m.movementType === currentFilter);

    if (filtered.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات</p>';
        return;
    }

    movementsList.innerHTML = '';
    filtered.forEach(m => {
        const t = TYPE_LABELS[m.movementType] || { text: m.movementType, cls: '' };
        const card = document.createElement('div');
        card.className = `movement-card type-${t.cls}`;

        let extra = '';
        if (m.movementType === 'receive') extra = `المورد: ${m.supplier || '-'}`;
        if (m.movementType === 'return') extra = `الوجهة: ${m.destination || '-'} · السبب: ${m.reason || '-'}`;

        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="movement-badge badge-${t.cls}">${t.text}</span>
                <span class="text-xs text-gray-400">${formatDate(m.timestamp)}</span>
            </div>
            <p class="text-sm text-gray-800 font-semibold">${m.material} — ${m.quantity ?? ''} ${m.unit || ''}</p>
            <p class="text-xs text-gray-500 mb-1">${m.project || ''} ${m.phase ? '· ' + m.phase : ''}</p>
            <p class="text-xs text-gray-500">${extra}</p>
            ${m.imageUrl ? `<a href="${m.imageUrl}" target="_blank"><img src="${m.imageUrl}" class="thumb-preview mt-2"></a>` : ''}
            <div class="movement-actions mt-2">
                <button class="btn-edit-sm" data-id="${m.id}">تعديل</button>
                <button class="btn-delete-sm" data-id="${m.id}">حذف</button>
            </div>
        `;
        movementsList.appendChild(card);
    });

    movementsList.querySelectorAll('.btn-edit-sm').forEach(btn => {
        btn.addEventListener('click', () => openEdit(btn.dataset.id));
    });
    movementsList.querySelectorAll('.btn-delete-sm').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
}

async function handleDelete(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع.')) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/movements`, id));
        showMessage('تم الحذف بنجاح');
        setTimeout(() => hideMessage(), 1200);
    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحذف');
    }
}

function openEdit(id) {
    const m = allMovements.find(x => x.id === id);
    if (!m) return;
    editingId = id;

    let fieldsHtml = `
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">التاريخ</label>
            <input type="date" id="editDate" value="${m.date || ''}" class="input-field block w-full p-2">
        </div>
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">الكمية</label>
            <input type="number" id="editQuantity" value="${m.quantity ?? ''}" step="any" class="input-field block w-full p-2">
        </div>
    `;

    if (m.movementType === 'receive') {
        fieldsHtml += `
            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1">المورد</label>
                <input type="text" id="editSupplier" value="${m.supplier || ''}" class="input-field block w-full p-2">
            </div>`;
    }
    if (m.movementType === 'return') {
        fieldsHtml += `
            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1">سبب الإرجاع</label>
                <select id="editReason" class="input-field block w-full p-2">
                    <option value="فائض" ${m.reason === 'فائض' ? 'selected' : ''}>فائض</option>
                    <option value="تالف" ${m.reason === 'تالف' ? 'selected' : ''}>تالف</option>
                    <option value="غير مناسب" ${m.reason === 'غير مناسب' ? 'selected' : ''}>غير مناسب</option>
                </select>
            </div>`;
    }

    fieldsHtml += `
        <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
            <textarea id="editNotes" rows="2" class="input-field block w-full p-2">${m.notes || ''}</textarea>
        </div>
    `;

    editFormFields.innerHTML = fieldsHtml;
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

saveEditBtn.addEventListener('click', async () => {
    if (!editingId) return;
    const m = allMovements.find(x => x.id === editingId);
    if (!m) return;

    const updates = {
        date: document.getElementById('editDate').value,
        quantity: parseFloat(document.getElementById('editQuantity').value),
        notes: document.getElementById('editNotes').value.trim(),
        editedAt: new Date()
    };

    const supplierEl = document.getElementById('editSupplier');
    if (supplierEl) updates.supplier = supplierEl.value.trim();

    const contractorEl = document.getElementById('editContractor');
    if (contractorEl) updates.contractor = contractorEl.value.trim();

    const remainingEl = document.getElementById('editRemaining');
    if (remainingEl) updates.remainingWithContractor = remainingEl.value !== '' ? parseFloat(remainingEl.value) : null;

    const reasonEl = document.getElementById('editReason');
    if (reasonEl) updates.reason = reasonEl.value;

    try {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/movements`, editingId), updates);
        editModal.classList.add('hidden');
        editModal.classList.remove('flex');
        showMessage('تم حفظ التعديل بنجاح');
        setTimeout(() => hideMessage(), 1200);
    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء حفظ التعديل');
    }
});
