import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements, settleMovement } from './sheets-service.js';

let unsettled = [];
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

function keyOf(m) {
    return `${m['ID']}|||${m['المادة']}`;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    try {
        const all = await getMovements(); // كل الحركات (فريق صغير)
        unsettled = all.filter(m => !isSettled(m));

        if (unsettled.length === 0) {
            pickerWrap.classList.add('hidden');
            noneMsg.classList.remove('hidden');
            return;
        }

        picker.innerHTML = '<option value="">اختر حركة...</option>';
        unsettled.forEach(m => {
            picker.innerHTML += `<option value="${keyOf(m)}">${m['المشروع']} — ${m['المادة']} (${m['وارد (استلام)']} ${m['الوحدة']})</option>`;
        });

        // لو جاي من زرار "تسوية" في سجل حركاتي فيه id + material جاهزين
        const params = new URLSearchParams(window.location.search);
        const presetId = params.get('id');
        const presetMaterial = params.get('material');
        if (presetId && presetMaterial) {
            const key = `${presetId}|||${presetMaterial}`;
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
    btn.textContent = 'جاري الحفظ...';

    try {
        await settleMovement(selectedMovement['ID'], selectedMovement['المادة'], { remainingInCar, returnToStore, returnToSupplier, notes });
        showMessage('✅ تم حفظ التسوية بنجاح!');
        setTimeout(() => { window.location.href = 'history.html'; }, 1200);
    } catch (err) {
        showMessage('❌ خطأ: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'حفظ التسوية';
    }
});

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
