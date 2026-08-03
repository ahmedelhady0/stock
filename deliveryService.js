import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getSetupData, getMovements, logReceipt } from './sheets-service.js';

let currentUser = null;
let allMaterials = [];
let movementType = 'direct';
let allMovements = [];

const IMGBB_KEY = '8621949d7967c0c66d9ab1290454d70e';
const IMGBB_ALBUM = '9sJWHv';

async function uploadInvoiceToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', IMGBB_KEY);
    formData.append('album', IMGBB_ALBUM);
    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'فشل رفع الصورة');
    return data.data.url;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('matProject').addEventListener('change', handleProjectChange);
    document.getElementById('matPhase').addEventListener('change', handlePhaseChange);
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            await loadSetupData(true);
            showMessage('✅ تم تحديث القوائم');
            setTimeout(() => hideMessage(), 1500);
        } catch (err) {
            showMessage('❌ فشل التحديث: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '⟳';
        }
    });

    document.querySelectorAll('input[name="movementType"]').forEach(r => {
        r.addEventListener('change', (e) => {
            movementType = e.target.value;
            updateMovementTypeUI();
        });
    });
});

function updateMovementTypeUI() {
    const hint = document.getElementById('typeHint');
    const heading = document.getElementById('materialsHeading');
    const btn = document.getElementById('submitBtn');
    const supplierLabel = document.querySelector('label[for="matSupplier"]');

    if (movementType === 'direct') {
        hint.textContent = '✅ المادة تستهلك تلقائياً على المشروع - لا تحتاج تسوية';
        hint.className = 'text-xs text-emerald-600 mt-2 text-center font-semibold';
        heading.textContent = 'المواد (الكمية = استهلاك على المشروع)';
        btn.className = 'flex-1 py-4 font-bold bg-emerald-600 text-white rounded-2xl hover:brightness-110 disabled:bg-gray-400';
        document.getElementById('directLabel').className = 'flex-1 flex items-center justify-center gap-2 bg-white p-3 rounded-xl border-2 border-emerald-500 cursor-pointer bg-emerald-50 transition';
        document.getElementById('warehouseLabel').className = 'flex-1 flex items-center justify-center gap-2 bg-white p-3 rounded-xl border-2 border-blue-300 cursor-pointer hover:bg-blue-50 transition';
    } else {
        hint.textContent = '🏠 المواد تُخزّن في المستودع - بعدين تقدر تصرفها على المشاريع';
        hint.className = 'text-xs text-blue-600 mt-2 text-center font-semibold';
        heading.textContent = 'المواد (كميات واردة للمستودع)';
        btn.className = 'flex-1 py-4 font-bold bg-blue-600 text-white rounded-2xl hover:brightness-110 disabled:bg-gray-400';
        document.getElementById('directLabel').className = 'flex-1 flex items-center justify-center gap-2 bg-white p-3 rounded-xl border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50 transition';
        document.getElementById('warehouseLabel').className = 'flex-1 flex items-center justify-center gap-2 bg-white p-3 rounded-xl border-2 border-blue-500 cursor-pointer bg-blue-50 transition';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    await loadSetupData();
    // تحديث تلقائي كل 30 ثانية من غير أي زرار
    setInterval(() => loadSetupData(true).catch(() => {}), 30000);
});

async function loadSetupData(forceRefresh = false) {
    // احفظ اختيارات المشرف الحالية قبل إعادة البناء
    const savedProject = document.getElementById('matProject').value;
    const savedPhase = document.getElementById('matPhase').value;
    const savedSupplier = document.getElementById('matSupplier').value;

    try {
        const [data, movements] = await Promise.all([
            getSetupData(forceRefresh),
            getMovements(null, forceRefresh)
        ]);
        allMovements = movements || [];
        allMaterials = data.materials || [];

        // ترتيب المشاريع: الأحدث استخداماً أولاً (آخر 3 أيام)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const recentProjects = new Set();
        allMovements.forEach(m => {
            const date = m['التاريخ'] ? new Date(m['التاريخ']) : null;
            if (date && date >= threeDaysAgo && m['المشروع']) {
                recentProjects.add(m['المشروع']);
            }
        });

        const sorted = [...(data.projects || [])].sort((a, b) => {
            const aRecent = recentProjects.has(a) ? 1 : 0;
            const bRecent = recentProjects.has(b) ? 1 : 0;
            if (aRecent !== bRecent) return bRecent - aRecent;
            return a.localeCompare(b);
        });

        const projSelect = document.getElementById('matProject');
        projSelect.innerHTML = '<option value="">اختر المشروع...</option>';
        sorted.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            const isNew = data.projectDates && data.projectDates[p] && (Date.now() - data.projectDates[p] < 7 * 24 * 60 * 60 * 1000);
            opt.textContent = isNew ? p + ' 🆕' : p;
            opt.style.fontWeight = 'bold';
            if (isNew) opt.style.color = '#059669';
            projSelect.appendChild(opt);
        });

        const supSelect = document.getElementById('matSupplier');
        supSelect.innerHTML = '<option value="">اختر المورد...</option>';
        (data.suppliers || []).forEach(s => {
            supSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });

        // أرجع اختيارات المشرف بعد التحديث (لو لسه موجودة)
        if (savedProject && [...sorted].includes(savedProject)) projSelect.value = savedProject;
        if (savedSupplier && (data.suppliers || []).includes(savedSupplier)) supSelect.value = savedSupplier;
        if (savedPhase) document.getElementById('matPhase').value = savedPhase;

    } catch (e) {
        console.error('Load error:', e);
        if (forceRefresh) showMessage('فشل تحميل البيانات من الشيت: ' + e.message);
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
    const createdBy = currentUser ? currentUser.email.split('@')[0] : '';
    const invoice = document.getElementById('invoiceNo').value.trim();
    const notes = document.getElementById('motionNotes').value.trim();
    const submitBtn = document.getElementById('submitBtn');

    if (!project || !phase) {
        showMessage('يرجى ملء المشروع والمرحلة');
        return;
    }

    // في حالة "مستودع" المورد إجباري
    if (movementType === 'warehouse' && !supplier) {
        showMessage('يرجى اختيار المورد (المواد الواردة للمستودع)');
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

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جاري الحفظ...';

    // رفع صورة الفاتورة أولاً (مرة واحدة لكل الحركة)
    let invoiceImageUrl = '';
    const fileInput = document.getElementById('invoiceFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            invoiceImageUrl = await uploadInvoiceToImgBB(fileInput.files[0]);
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'حفظ الحركة';
            showMessage('❌ فشل رفع صورة الفاتورة: ' + err.message);
            return;
        }
    }

    const batchId = 'REQ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const isDirect = movementType === 'direct';

    try {
        const promises = items.map(item =>
            logReceipt({
                id: batchId,
                project,
                phase,
                material: item.material,
                unit: item.unit,
                quantity: item.quantity,
                consumed: isDirect ? item.quantity : 0, // مباشر = استهلاك فوري
                supplier: supplier || (isDirect ? 'صرف مباشر' : 'غير محدد'),
                contractor: createdBy,
                invoice: invoice,
                invoiceImageUrl,
                movementType: isDirect ? 'direct' : 'warehouse',
                notes: isDirect ? `صرف مباشر - ${notes}` : `وارد للمستودع - ${notes}`
            })
        );

        await Promise.all(promises);

        showMessage(`✅ تم حفظ ${items.length} مادة بنجاح!`);
        setTimeout(() => location.reload(), 1100);

    } catch (err) {
        console.error(err);
        showMessage('❌ خطأ أثناء الحفظ: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ الحركة';
    }
};

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
