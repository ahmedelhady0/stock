import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, logReceipt } from './sheets-service.js';

let currentUser = null;
let allMaterials = [];
let projectPhasesMap = {};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('matProject').addEventListener('change', handleProjectChange);
    document.getElementById('matPhase').addEventListener('change', handlePhaseChange);
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    document.getElementById('createdBy').value = user.email.split('@')[0];
    await loadSetupData();
});

async function loadSetupData() {
    try {
        const data = await getSetupData();
        allMaterials = data.materials;

        // مشاريع
        const projSelect = document.getElementById('matProject');
        projSelect.innerHTML = '<option value="">اختر المشروع...</option>';
        data.projects.forEach(p => {
            projSelect.innerHTML += `<option value="${p}">${p}</option>`;
        });

        // موردين
        const supSelect = document.getElementById('matSupplier');
        supSelect.innerHTML = '<option value="">اختر المورد...</option>';
        data.suppliers.forEach(s => {
            supSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });

    } catch (e) {
        showMessage('فشل تحميل البيانات من الشيت: ' + e.message);
    }
}

function handleProjectChange(e) {
    const project = e.target.value;
    const phaseSelect = document.getElementById('matPhase');
    phaseSelect.innerHTML = '<option value="">اختر المرحلة...</option>';
    phaseSelect.disabled = true;

    if (!project) return;

    const phases = [...new Set(allMaterials.map(m => m.phase).filter(Boolean))];
    phases.forEach(ph => {
        phaseSelect.innerHTML += `<option value="${ph}">${ph}</option>`;
    });
    phaseSelect.disabled = false;
}

function handlePhaseChange(e) {
    const phase = e.target.value;
    const container = document.getElementById('dynamicMaterialsContainer');
    container.innerHTML = '';

    if (!phase) {
        document.getElementById('submitBtn').disabled = true;
        return;
    }

    const filtered = allMaterials.filter(m => m.phase === phase);
    filtered.forEach(mat => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl border border-gray-200';
        div.innerHTML = `
            <div class="font-medium text-gray-800 mb-2">${mat.name}</div>
            <div class="flex items-center gap-3">
                <input type="number" step="any" min="0" data-name="${mat.name}" data-unit="${mat.unit}"
                       class="qty-input input-field text-center font-semibold flex-1">
                <span class="text-sm text-gray-500">${mat.unit}</span>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('submitBtn').disabled = false;
};

window.submitReceipt = async function submitReceipt() {
    const project = document.getElementById('matProject').value;
    const phase = document.getElementById('matPhase').value;
    const supplier = document.getElementById('matSupplier').value;
    const createdBy = document.getElementById('createdBy').value.trim();
    const notes = document.getElementById('motionNotes').value.trim();

    if (!project || !phase || !createdBy) {
        showMessage('يرجى ملء المشروع والمرحلة واسم المشرف');
        return;
    }

    const items = [...document.querySelectorAll('.qty-input')]
        .map(inp => ({
            material: inp.dataset.name,
            unit: inp.dataset.unit,
            quantity: parseFloat(inp.value) || 0
        }))
        .filter(i => i.quantity > 0);

    if (items.length === 0) {
        showMessage('أدخل كمية واحدة على الأقل');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        for (const item of items) {
            await logReceipt({
                project,
                phase,
                material: item.material,
                unit: item.unit,
                quantity: item.quantity,
                supplier: supplier || 'غير محدد',
                contractor: createdBy,
                notes
            });
        }

        showMessage('✅ تم حفظ الاستلام بنجاح!');
        setTimeout(() => location.reload(), 1400);
    } catch (err) {
        showMessage('❌ خطأ أثناء الحفظ: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'حفظ الاستلام';
    }
};

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
