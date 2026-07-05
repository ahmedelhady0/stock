import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements, getSettlementRequests, submitSettlementRequest } from './sheets-service.js';

let unsettled = [];
let currentUserEmail = null;
let selectedMovement = null;

const picker = document.getElementById('movementPicker');
const pickerWrap = document.getElementById('pickerWrap');
const settleFields = document.getElementById('settleFields');
const noneMsg = document.getElementById('noneMsg');

function isSettled(m) {
    const consumed = parseFloat(m['مصروف على المشروع']) || 0;
    const remaining = parseFloat(m['متبقي في العربية']) || 0;
    const retStore = parseFloat(m['مرتجع للمستودع']) || 0;
    const retSupplier = parseFloat(m['مرتجع للمورد']) || 0;
    return (consumed + remaining + retStore + retSupplier) > 0;
}

function keyOf(idOrObj, material) {
    if (typeof idOrObj === 'object') return `${idOrObj['ID']}|||${idOrObj['المادة']}`;
    return `${idOrObj}|||${material}`;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    currentUserEmail = user.email;
    try {
        const [all, pendingRequests] = await Promise.all([
            getMovements(),
            getSettlementRequests('قيد الموافقة')
        ]);

        const pendingKeys = new Set(pendingRequests.map(r => keyOf(r['معرف الحركة'], r['المادة'])));

        unsettled = all.filter(m => !isSettled(m) && !pendingKeys.has(keyOf(m)));

        if (unsettled.length === 0) {
            pickerWrap.classList.add('hidden');
            noneMsg.classList.remove('hidden');
            if (pendingRequests.length > 0) {
                noneMsg.textContent = 'كل الحركات المتبقية مرسلة كطلبات وبانتظار موافقة المهندس ⏳';
            }
            return;
        }

        picker.innerHTML = '<option value="">اختر حركة...</option>';
        unsettled.forEach(m => {
            picker.innerHTML += `<option value="${keyOf(m)}">${m['المشروع']} — ${m['المادة']} (${m['وارد (استلام)']} ${m['الوحدة']})</option>`;
        });

        const params = new URLSearchParams(window.location.search);
        const presetId = params.get('id');
        const presetMaterial = params.get('material');
        if (presetId && presetMaterial) {
            const key = keyOf(presetId, presetMaterial);
            if (unsettled.some(m => keyOf(m) === key)) {
                picker.value = key;
                selectMovement(key);
            }
        }
    } catch (err) {
        showMessage('فشل تحميل البيانات: ' + err.message);
    }
});

picker.addEventListener('change', (e) => selectMovement(e.target.value));

function selectMovement(key) {
    selectedMovement = unsettled.find(m => keyOf(m) === key);
    if (!selectedMovement) {
        settleFields.classList.add('hidden');
        return;
    }
    document.getElementById('viewProject').textContent = selectedMovement['المشروع'] || '';
    document.getElementById('viewPhase').textContent = selectedMovement['المرحلة'] || '';
    document.getElementById('viewMaterial').textContent = selectedMovement['المادة'] || '';
    document.getElementById('viewQty').textContent = selectedMovement['وارد (استلام)'] || 0;
    document.getElementById('viewUnit').textContent = selectedMovement['الوحدة'] || '';
    settleFields.classList.remove('hidden');
    recalcConsumed();
}

['remainingInCar', 'returnToStore', 'returnToSupplier'].forEach(id => {
    document.getElementById(id).addEventListener('input', recalcConsumed);
});

function recalcConsumed() {
    if (!selectedMovement) return;
    const incoming = parseFloat(selectedMovement['وارد (استلام)']) || 0;
    const remaining = parseFloat(document.getElementById('remainingInCar').value) || 0;
    const retStore = parseFloat(document.getElementById('returnToStore').value) || 0;
    const retSupplier = parseFloat(document.getElementById('returnToSupplier').value) || 0;
    const consumed = Math.max(0, incoming - remaining - retStore - retSupplier);
    document.getElementById('calcConsumed').textContent = consumed;
}

document.getElementById('submitSettleBtn').addEventListener('click', async () => {
    if (!selectedMovement) { showMessage('اختر حركة أولاً'); return; }

    const remainingInCar = parseFloat(document.getElementById('remainingInCar').value) || 0;
    const returnToStore = parseFloat(document.getElementById('returnToStore').value) || 0;
    const returnToSupplier = parseFloat(document.getElementById('returnToSupplier').value) || 0;
    const notes = document.getElementById('settleNotes').value.trim();

    const btn = document.getElementById('submitSettleBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الإرسال...';

    try {
        await submitSettlementRequest({
            movementId: selectedMovement['ID'],
            material: selectedMovement['المادة'],
            remainingInCar,
            returnToStore,
            returnToSupplier,
            notes,
            requestedBy: currentUserEmail ? currentUserEmail.split('@')[0] : ''
        });
        showMessage('✅ تم إرسال طلب التسوية للمهندس، بانتظار الموافقة');
        setTimeout(() => { window.location.href = 'history.html'; }, 1400);
    } catch (err) {
        showMessage('❌ خطأ: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'حفظ التسوية';
    }
});

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
