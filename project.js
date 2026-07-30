import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

const projectSelect = document.getElementById('projectSelect');
const projectReport = document.getElementById('projectReport');

let allMovements = [];
let currentProjectFilter = '';

function isReturn(m) {
    const t = String(m['نوع الحركة'] || m.movementType || '').trim();
    if (t.indexOf('مرتجع') !== -1) return true;
    if (parseFloat(m['مرتجع للمستودع']) > 0 || parseFloat(m['مرتجع للمورد']) > 0) return true;
    return false;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    await fetchProjectReportData();
    projectSelect.addEventListener('change', (e) => {
        currentProjectFilter = e.target.value;
        renderReport();
    });
});

async function fetchProjectReportData() {
    try {
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm py-8">جاري تحميل الحركات من جوجل شيت...</p>';
        allMovements = await getMovements();
        rebuildProjectList();
        renderReport();
    } catch (error) {
        console.error('Error fetching report data:', error);
        projectReport.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-bold rounded-xl text-center">
                ❌ تعذر جلب البيانات من جوجل شيت: ${error.message}
            </div>`;
    }
}

function rebuildProjectList() {
    const projects = [...new Set(allMovements.map(m => m['المشروع']).filter(Boolean))].sort();
    const selected = projectSelect.value;
    projectSelect.innerHTML = '<option value="">كل المشاريع</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        projectSelect.appendChild(opt);
    });
    projectSelect.value = selected;
}

function renderReport() {
    const filtered = currentProjectFilter
        ? allMovements.filter(m => m['المشروع'] === currentProjectFilter)
        : allMovements;

    if (filtered.length === 0) {
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8 py-4">لا توجد حركات مسجلة بعد.</p>';
        return;
    }

    const byProject = {};
    filtered.forEach(m => {
        const proj = m['المشروع'] || 'غير محدد';
        const mat = m['المادة'] || 'غير محدد';
        const ret = isReturn(m);

        if (!byProject[proj]) byProject[proj] = {};
        if (!byProject[proj][mat]) {
            byProject[proj][mat] = {
                received: 0,
                returnedStore: 0,
                returnedSupplier: 0,
                unit: m['الوحدة'] || '',
                phase: m['المرحلة'] || 'عام'
            };
        }

        if (ret) {
            byProject[proj][mat].returnedStore += parseFloat(m['مرتجع للمستودع']) || 0;
            byProject[proj][mat].returnedSupplier += parseFloat(m['مرتجع للمورد']) || 0;
            // لو movementType=return ومافيش مرتجع تفصيلي، نستخدم الكمية كمرتجع
            if (!parseFloat(m['مرتجع للمستودع']) && !parseFloat(m['مرتجع للمورد'])) {
                byProject[proj][mat].returnedStore += parseFloat(m['وارد (استلام)']) || 0;
            }
        } else {
            byProject[proj][mat].received += parseFloat(m['وارد (استلام)']) || 0;
            // الحركات المباشرة: وارد = استهلاك
            if (m.movementType === 'direct' || parseFloat(m['مصروف على المشروع']) > 0) {
                // already counted in received, will show as consumed
            }
        }
    });

    projectReport.innerHTML = '';
    Object.keys(byProject).sort().forEach(proj => {
        const section = document.createElement('div');
        section.className = 'section-card p-5 mb-5';

        let rows = '';
        Object.keys(byProject[proj]).sort().forEach(mat => {
            const d = byProject[proj][mat];
            const totalReturned = d.returnedStore + d.returnedSupplier;
            const netConsumed = Math.max(0, d.received - totalReturned);
            rows += `
                <tr>
                    <td class="text-right p-3">${mat}</td>
                    <td class="text-center p-3 text-xs text-gray-400">${d.phase}</td>
                    <td class="text-center p-3">${d.received}</td>
                    <td class="text-center p-3 font-bold text-emerald-700">${netConsumed}</td>
                    <td class="text-center p-3">${totalReturned}</td>
                    <td class="text-center p-3 text-xs text-gray-400">${d.unit}</td>
                </tr>`;
        });

        section.innerHTML = `
            <h2 class="text-lg font-bold text-gray-800 mb-3">${proj}</h2>
            <div style="overflow-x:auto;">
                <table class="report-table">
                    <thead><tr><th>المادة</th><th>المرحلة</th><th>وارد</th><th>مستهلك</th><th>مرتجع</th><th>الوحدة</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        projectReport.appendChild(section);
    });
}
