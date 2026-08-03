import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, getMovements, submitSettlementRequest } from './sheets-service.js';

let allMovements = [];
let allSuppliers = [];
let allSetupProjects = [];
let currentUser = null;

const projectSelect = document.getElementById('returnProject');
const materialSelect = document.getElementById('returnMaterial');
const qtyInput = document.getElementById('returnQty');
const consumptionSpan = document.getElementById('currentConsumption');
const submitBtn = document.getElementById('submitReturnBtn');

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    await loadData();
    // تحديث تلقائي كل 30 ثانية من غير أي زرار
    setInterval(() => loadData(true).catch(() => {}), 30000);
});

async function loadData(forceRefresh = false) {
    // احفظ اختيارات المشرف الحالية قبل إعادة البناء
    const savedProject = projectSelect.value;
    const savedMaterial = materialSelect.value;
    const savedSupplier = document.getElementById('returnSupplier').value;

    try {
        const [movements, setup] = await Promise.all([
            getMovements(null, forceRefresh),
            getSetupData(forceRefresh)
        ]);
        allMovements = movements;
        allSuppliers = setup.suppliers || [];
        allSetupProjects = setup.projects || [];
        populateProjects();
        populateSuppliers();

        // أرجع اختيارات المشرف بعد التحديث (لو لسه موجودة)
        if (savedProject && populateProjectsValues().includes(savedProject)) projectSelect.value = savedProject;
        if (savedMaterial && [...document.querySelectorAll('#returnMaterial option')].some(o => o.value === savedMaterial)) {
            materialSelect.value = savedMaterial;
            updateConsumption();
        }
        if (savedSupplier && allSuppliers.includes(savedSupplier)) document.getElementById('returnSupplier').value = savedSupplier;
    } catch (err) {
        if (forceRefresh) showMessage('فشل تحميل البيانات: ' + err.message);
    }
}

function populateProjectsValues() {
    const fromSetup = allSetupProjects.filter(Boolean);
    const fromLog = allMovements.map(m => m['المشروع']).filter(Boolean);
    return [...new Set([...fromSetup, ...fromLog])];
}

function populateProjects() {
    const projects = populateProjectsValues();

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const lastUse = {};
    allMovements.forEach(m => {
        if (m['المشروع']) {
            const date = m['التاريخ'] ? new Date(m['التاريخ']) : null;
            if (date && (!lastUse[m['المشروع']] || date > lastUse[m['المشروع']])) {
                lastUse[m['المشروع']] = date;
            }
        }
    });

    projects.sort((a, b) => {
        const aRecent = lastUse[a] && lastUse[a] >= threeDaysAgo ? 1 : 0;
        const bRecent = lastUse[b] && lastUse[b] >= threeDaysAgo ? 1 : 0;
        if (aRecent !== bRecent) return bRecent - aRecent;
        return a.localeCompare(b);
    });

    projectSelect.innerHTML = '<option value="">اختر المشروع...</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (lastUse[p] && lastUse[p] >= threeDaysAgo) opt.style.fontWeight = 'bold';
        projectSelect.appendChild(opt);
    });
}

document.querySelectorAll('input[name="returnDest"]').forEach(r => {
    r.addEventListener('change', (e) => {
        const wrap = document.getElementById('returnSupplierWrap');
        wrap.classList.toggle('hidden', e.target.value !== 'supplier');
    });
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '...';
    try {
        await loadData(true);
        showMessage('✅ تم تحديث القوائم');
        setTimeout(() => hideMessage(), 1500);
    } catch (err) {
        showMessage('❌ فشل التحديث: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⟳';
    }
});

projectSelect.addEventListener('change', () => {
    const project = projectSelect.value;
    materialSelect.innerHTML = '<option value="">اختر المادة...</option>';
    materialSelect.disabled = true;
    qtyInput.value = '';
    consumptionSpan.textContent = '0';

    if (!project) return;

    const materials = [...new Set(
        allMovements
            .filter(m => m['المشروع'] === project)
            .map(m => m['المادة'])
            .filter(Boolean)
    )].sort();

    materials.forEach(mat => {
        materialSelect.innerHTML += `<option value="${mat}">${mat}</option>`;
    });
    materialSelect.disabled = false;
});

materialSelect.addEventListener('change', () => {
    updateConsumption();
});

function getNetConsumption(project, material) {
    const projectMovements = allMovements.filter(m =>
        m['المشروع'] === project && m['المادة'] === material
    );

    let totalReceived = 0;
    let totalReturned = 0;

    projectMovements.forEach(m => {
        const qty = parseFloat(m['وارد (استلام)']) || 0;
        const rt = parseFloat(m['مرتجع للمستودع']) || 0;
        const rs = parseFloat(m['مرتجع للمورد']) || 0;
        const consumed = parseFloat(m['مصروف على المشروع']) || 0;

        // الحركات المباشرة: وارد = استهلاك
        if (m.movementType === 'direct' || consumed > 0) {
            totalReceived += qty;
        } else if (!m.movementType || m.movementType === 'warehouse') {
            totalReceived += qty;
        }

        totalReturned += rt + rs;
    });

    return Math.max(0, totalReceived - totalReturned);
}

function updateConsumption() {
    const project = projectSelect.value;
    const material = materialSelect.value;
    if (project && material) {
        const consumed = getNetConsumption(project, material);
        consumptionSpan.textContent = consumed;
    }
}

submitBtn.addEventListener('click', async () => {
    const project = projectSelect.value;
    const material = materialSelect.value;
    const qty = parseFloat(qtyInput.value) || 0;

    if (!project || !material) {
        showMessage('اختر المشروع والمادة');
        return;
    }
    if (qty <= 0) {
        showMessage('أدخل كمية صحيحة');
        return;
    }

    const currentConsumed = getNetConsumption(project, material);
    if (qty > currentConsumed) {
        showMessage(`الكمية المرتجعة (${qty}) أكبر من الاستهلاك الحالي (${currentConsumed})`);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الحفظ...';

    const dest = document.querySelector('input[name="returnDest"]:checked');
    const toSupplier = dest && dest.value === 'supplier';
    const supplierName = toSupplier ? (document.getElementById('returnSupplier').value || 'مورد') : '';
    const notes = document.getElementById('returnNotes').value.trim();

    // إيجاد الحركة الأصلية (أحدث استلام لهذه المادة)
    const latest = allMovements
        .filter(m => m['المشروع'] === project && m['المادة'] === material && m['المرحلة'])
        .sort((a, b) => new Date(b['التاريخ'] || 0) - new Date(a['التاريخ'] || 0))[0];

    const origId = latest ? latest['ID'] : '';

    try {
        await submitSettlementRequest({
            movementId: origId,
            material,
            remainingInCar: 0,
            returnToStore: toSupplier ? 0 : qty,
            returnToSupplier: toSupplier ? qty : 0,
            notes: notes || (toSupplier ? `مرتجع للمورد ${supplierName}` : `مرتجع للمستودع`),
            requestedBy: currentUser ? currentUser.email.split('@')[0] : ''
        });

        showMessage(`✅ تم إرسال طلب مرتجع ${qty} للمهندس بانتظار الموافقة`);
        qtyInput.value = '';
        document.getElementById('returnNotes').value = '';
        document.getElementById('modalError')?.classList.add('hidden');
        setTimeout(() => hideMessage(), 2000);
    } catch (err) {
        const errDiv = document.getElementById('modalError');
        if (errDiv) {
            errDiv.textContent = '❌ ' + err.message;
            errDiv.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showMessage('❌ ' + err.message);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'تسجيل المرتجع';
    }
});

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
