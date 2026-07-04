import { auth, showMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, logSettlement } from './sheets-service.js';

console.log("Settlement page loaded");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log("No user");
        return window.location.href = 'index.html';
    }
    console.log("User logged in:", user.email);
    try {
        const data = await getSetupData();
        console.log("Setup data received:", data);
        fillProjects(data.projects || []);
    } catch (e) {
        console.error("Load error:", e);
        showMessage('فشل تحميل البيانات: ' + e.message);
    }
});

function fillProjects(projects) {
    console.log("Filling projects:", projects);
    const select = document.getElementById('settleProject');
    select.innerHTML = '<option value="">اختر المشروع</option>';
    projects.forEach(p => {
        select.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

document.getElementById('settleProject').addEventListener('change', updatePhases);
document.getElementById('settlePhase').addEventListener('change', updateMaterials);

function updatePhases(e) {
    const phases = [...new Set(allMaterials.map(m => m.phase).filter(Boolean))];
    const phaseSelect = document.getElementById('settlePhase');
    phaseSelect.innerHTML = '<option value="">اختر المرحلة</option>';
    phases.forEach(ph => phaseSelect.innerHTML += `<option value="${ph}">${ph}</option>`);
}

function updateMaterials(e) {
    const phase = e.target.value;
    const matSelect = document.getElementById('settleMaterial');
    matSelect.innerHTML = '<option value="">اختر المادة</option>';
    allMaterials.filter(m => m.phase === phase).forEach(m => {
        matSelect.innerHTML += `<option value="${m.name}">${m.name}</option>`;
    });
}

window.submitSettlement = async function submitSettlement() {
    // ... (نفس الكود السابق)
};
