// ═══════════════════════════════════════════════════════════
// منطق صفحة "طلب حركة مواد جديد" — Firebase Auth + Google Sheets
// ═══════════════════════════════════════════════════════════
import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, logMovement } from './sheets-service.js';

let currentUser = null;
let currentUsername = '';
let projectPhasesMap = {}; // { projectName: [phase, phase, ...] } — مبني من شيت Materials مربوط بكل مشروع بشكل عام (كل المراحل المتاحة)
let allMaterialsArray = [];
let currentGeneratedID = '';

document.addEventListener('DOMContentLoaded', () => {
    generateUniqueMotionID();
    document.getElementById('matProject').addEventListener('change', handleProjectChange);
    document.getElementById('matPhase').addEventListener('change', handlePhaseChange);
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    currentUsername = user.email ? user.email.split('@')[0] : '';
    const createdByInput = document.getElementById('createdBy');
    if (createdByInput && !createdByInput.value) createdByInput.value = currentUsername;
    await fetchSetupDataFromSheets();
});

function generateUniqueMotionID() {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    currentGeneratedID = `REQ-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    document.getElementById('motionIDDisplay').innerText = `رقم الطلب: ${currentGeneratedID}`;
}

async function fetchSetupDataFromSheets() {
    try {
        const data = await getSetupData();
        allMaterialsArray = data.materials;

        // المراحل المتاحة لكل مشروع = كل المراحل الموجودة في شيت Materials (كل مشروع تقدر تسجل عليه أي مرحلة)
        const allPhases = [...new Set(allMaterialsArray.map(m => m.phase).filter(Boolean))];
        projectPhasesMap = {};
        data.projects.forEach(p => { projectPhasesMap[p] = allPhases; });

        const projectSelect = document.getElementById('matProject');
        projectSelect.innerHTML = '<option value="">اختر المشروع...</option>';
        data.projects.forEach(proj => {
            projectSelect.innerHTML += `<option value="${proj}">${proj}</option>`;
        });

        const supplierSelect = document.getElementById('matSupplier');
        supplierSelect.innerHTML = '<option value="">مورد عام / لا يوجد</option>';
        data.suppliers.forEach(sup => {
            if (sup) supplierSelect.innerHTML += `<option value="${sup}">${sup}</option>`;
        });
    } catch (error) {
        console.error(error);
        showMessage('فشل في جلب البيانات من جوجل شيت: ' + error.message);
    }
}

function handleProjectChange(e) {
    const selectedProj = e.target.value;
    const phaseSelect = document.getElementById('matPhase');
    const container = document.getElementById('dynamicMaterialsContainer');

    phaseSelect.innerHTML = '<option value="">اختر المرحلة...</option>';
    container.innerHTML = '<p class="text-gray-400 text-xs text-center col-span-full py-4">يرجى تحديد المرحلة لعرض المواد والكميات.</p>';
    document.getElementById('submitBtn').disabled = true;

    if (selectedProj && projectPhasesMap[selectedProj]) {
        phaseSelect.disabled = false;
        projectPhasesMap[selectedProj].forEach(phase => {
            phaseSelect.innerHTML += `<option value="${phase}">${phase}</option>`;
        });
    } else {
        phaseSelect.disabled = true;
    }
}

function handlePhaseChange(e) {
    const selectedPhase = e.target.value;
    const container = document.getElementById('dynamicMaterialsContainer');
    container.innerHTML = '';

    if (!selectedPhase) {
        container.innerHTML = '<p class="text-gray-400 text-xs text-center col-span-full py-4">يرجى تحديد المرحلة لعرض المواد والكميات.</p>';
        document.getElementById('submitBtn').disabled = true;
        return;
    }

    const filteredMaterials = allMaterialsArray.filter(m => m.phase === selectedPhase);
    if (filteredMaterials.length === 0) {
        container.innerHTML = '<p class="text-red-500 text-xs text-center col-span-full py-4">لا توجد مواد مضافة لهذه المرحلة في شيت "Materials".</p>';
        document.getElementById('submitBtn').disabled = true;
        return;
    }

    filteredMaterials.forEach(mat => {
        const card = document.createElement('div');
        card.className = 'flex flex-col bg-white p-3 border rounded-xl shadow-sm';
        card.innerHTML = `
            <label class="text-xs font-bold text-gray-700 mb-1 truncate" title="${mat.name}">${mat.name}</label>
            <div class="flex items-center gap-2">
                <input type="number" step="any" min="0" data-matname="${mat.name}" data-matunit="${mat.unit}"
                       class="qty-input-field w-full p-2 border rounded text-center text-sm font-semibold" placeholder="0">
                <span class="text-xs text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-1 rounded border">${mat.unit}</span>
            </div>`;
        container.appendChild(card);
    });

    document.getElementById('submitBtn').disabled = false;
}

window.submitLogOrder = async function submitLogOrder() {
    const project = document.getElementById('matProject').value;
    const phase = document.getElementById('matPhase').value;
    const type = document.getElementById('motionType').value;
    const supplier = document.getElementById('matSupplier').value;
    const createdBy = document.getElementById('createdBy').value.trim();
    const notes = document.getElementById('motionNotes').value.trim();
    const submitBtn = document.getElementById('submitBtn');

    if (!currentUser) { showMessage('خطأ: المستخدم غير مسجل دخول'); return; }
    if (!project || !phase || !createdBy) {
        showMessage('برجاء إدخال اسم المشرف واختيار المشروع والمرحلة!');
        return;
    }

    const orderedItems = [...document.querySelectorAll('.qty-input-field')]
        .map(input => ({
            material: input.getAttribute('data-matname'),
            unit: input.getAttribute('data-matunit'),
            qty: parseFloat(input.value)
        }))
        .filter(i => i.qty && i.qty > 0);

    if (orderedItems.length === 0) {
        showMessage('برجاء إدخال كمية واحدة على الأقل لأي من المواد المعروضة!');
        return;
    }

    const today = new Date();
    const formattedDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري الحفظ في الشيت...';

    try {
        // بنسجل صف منفصل لكل مادة (بنفس رقم الطلب motionID) عشان يتوافق مع project.js وhistory.js
        for (const item of orderedItems) {
            await logMovement({
                motionID: currentGeneratedID,
                date: formattedDate,
                type,
                project,
                phase,
                material: item.material,
                unit: item.unit,
                quantity: item.qty,
                supplier: supplier || 'مورد عام',
                reason: '',
                notes,
                createdByEmail: currentUser.email,
                createdByName: createdBy
            });
        }

        showMessage(`✅ تم حفظ الحركة بنجاح برقم: ${currentGeneratedID}`);
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحفظ في الشيت: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = 'حفظ وإرسال للشيت';
    }
};

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
