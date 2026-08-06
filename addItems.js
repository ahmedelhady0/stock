// ═══════════════════════════════════════════════════════════
// إضافة مشروع / مادة — متاحة للمشرف والمهندس
// ═══════════════════════════════════════════════════════════
import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addProject, addMaterial } from './sheets-service.js';

// نفس خريطة المرحلة ← البند في الكود (Code.gs)
const PHASE_BOND = {
    'فوم': 'اعمال عزل الفوم للأسطح',
    'اسمنتي': 'أعمال عزل اسمنتي للخزانات من الداخل',
    'دورات مياه': 'اعمال عزل ولياسة دورات المياه',
    'رولات': 'اعمال عزل الرولات للخزانات من الخارج',
    'مضاف خرسانة': 'أعمال عزل مضاف مع الخرسانة'
};
const PROJECT_PHASES = ['فوم', 'اسمنتي', 'دورات مياه', 'رولات', 'مضاف خرسانة'];

let currentEmail = null;

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentEmail = user.email;

    const phaseSelect = document.getElementById('newMaterialPhase');
    phaseSelect.innerHTML = PROJECT_PHASES.map(p => `<option value="${p}">${p}</option>`).join('');
    updateBond();
    phaseSelect.addEventListener('change', updateBond);

    document.getElementById('addProjectForm').addEventListener('submit', handleAddProject);
    document.getElementById('addMaterialForm').addEventListener('submit', handleAddMaterial);
});

function updateBond() {
    const phase = document.getElementById('newMaterialPhase').value;
    document.getElementById('newMaterialBond').value = PHASE_BOND[phase] || '';
}

async function handleAddProject(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const name = nameInput.value.trim();
    if (!name) { showMessage('⚠️ اكتب اسم المشروع'); return; }
    if (!confirm(`إضافة مشروع "${name}" مع كل المراحل (${PROJECT_PHASES.length})؟`)) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الإضافة...';
    try {
        const r = await addProject(name, currentEmail);
        showMessage(`✅ تم إضافة المشروع (${r.phases || PROJECT_PHASES.length} مراحل)`);
        nameInput.value = '';
        setTimeout(() => hideMessage(), 1500);
    } catch (err) {
        showMessage('❌ فشل الإضافة: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'إضافة';
    }
}

async function handleAddMaterial(e) {
    e.preventDefault();
    const phase = document.getElementById('newMaterialPhase').value;
    const name = document.getElementById('newMaterialName').value.trim();
    const unit = document.getElementById('newMaterialUnit').value.trim();
    const price = document.getElementById('newMaterialPrice').value;
    if (!phase) { showMessage('⚠️ اختر المرحلة'); return; }
    if (!name) { showMessage('⚠️ اكتب اسم المادة'); return; }
    if (!unit) { showMessage('⚠️ اكتب الوحدة'); return; }
    if (!confirm(`إضافة مادة "${name}" في مرحلة "${phase}"؟`)) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الإضافة...';
    try {
        await addMaterial(phase, name, unit, currentEmail, price);
        showMessage('✅ تم إضافة المادة في شيت المواد');
        document.getElementById('newMaterialName').value = '';
        document.getElementById('newMaterialUnit').value = '';
        document.getElementById('newMaterialPrice').value = '';
        setTimeout(() => hideMessage(), 1500);
    } catch (err) {
        showMessage('❌ فشل الإضافة: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '📦 إضافة المادة';
    }
}
