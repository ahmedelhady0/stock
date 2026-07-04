import { auth, showMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, logSettlement } from './sheets-service.js';

let allMaterials = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    await loadData();
});

async function loadData() {
    const data = await getSetupData();
    allMaterials = data.materials || [];

    // Fill projects
    const projSelect = document.getElementById('settleProject');
    projSelect.innerHTML = '<option value="">اختر المشروع</option>';
    data.projects.forEach(p => projSelect.innerHTML += `<option value="${p}">${p}</option>`);
}

document.getElementById('settleProject').addEventListener('change', updatePhases);
document.getElementById('settlePhase').addEventListener('change', updateMaterials);

function updatePhases(e) {
    const project = e.target.value;
    const phaseSelect = document.getElementById('settlePhase');
    phaseSelect.innerHTML = '<option value="">اختر المرحلة</option>';
    if (!project) return;
    const phases = [...new Set(allMaterials.map(m => m.phase).filter(Boolean))];
    phases.forEach(ph => phaseSelect.innerHTML += `<option value="${ph}">${ph}</option>`);
}

function updateMaterials(e) {
    const phase = e.target.value;
    const matSelect = document.getElementById('settleMaterial');
    matSelect.innerHTML = '<option value="">اختر المادة</option>';
    if (!phase) return;
    const filtered = allMaterials.filter(m => m.phase === phase);
    filtered.forEach(m => matSelect.innerHTML += `<option value="${m.name}">${m.name}</option>`);
}

window.submitSettlement = async function submitSettlement() {
    const project = document.getElementById('settleProject').value;
    const phase = document.getElementById('settlePhase').value;
    const material = document.getElementById('settleMaterial').value;
    const remaining = parseFloat(document.getElementById('remainingInCar').value) || 0;
    const returnStore = parseFloat(document.getElementById('returnToStore').value) || 0;
    const returnSupplier = parseFloat(document.getElementById('returnToSupplier').value) || 0;
    const notes = document.getElementById('settleNotes').value.trim();

    if (!project || !phase || !material) {
        showMessage('يرجى اختيار المشروع والمرحلة والمادة');
        return;
    }

    try {
        await logSettlement({
            project,
            phase,
            material,
            remainingInCar: remaining,
            returnToStore,
            returnToSupplier,
            notes
        });
        showMessage('✅ تم حفظ التسوية بنجاح!');
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        showMessage('❌ خطأ: ' + err.message);
    }
};
