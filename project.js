// ═══════════════════════════════════════════════════════════
// رصيد المشاريع — المستلم - المرتجع = الصافي لكل مادة
// ═══════════════════════════════════════════════════════════
import { auth, db, appId } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const projectSelect = document.getElementById('projectSelect');
const projectReport = document.getElementById('projectReport');
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyu7oj8W4D4wACBVNOZb1pSufU1LzWrqFF_pLDbq66EeBiGMedgfdLrUDxrxYlUhGV3/exec"; 

let allMovements = [];
let currentProjectFilter = '';

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    const movementsRef = collection(db, `artifacts/${appId}/public/data/movements`);
    const q = query(movementsRef, where('movementType', 'in', ['receive', 'return']));

    onSnapshot(q, (snapshot) => {
        allMovements = [];
        snapshot.forEach(d => allMovements.push(d.data()));
        rebuildProjectList();
        renderReport();
    }, (err) => {
        console.error(err);
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm">تعذر تحميل البيانات</p>';
    });
});

projectSelect.addEventListener('change', () => {
    currentProjectFilter = projectSelect.value;
    renderReport();
});

function rebuildProjectList() {
    const projects = [...new Set(allMovements.map(m => m.project).filter(Boolean))].sort();
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
        ? allMovements.filter(m => m.project === currentProjectFilter)
        : allMovements;

    if (filtered.length === 0) {
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد بيانات</p>';
        return;
    }

    // تجميع: مشروع → مادة → { received, returned, unit, phase }
    const byProject = {};
    filtered.forEach(m => {
        const proj = m.project || 'غير محدد';
        const mat = m.material || 'غير محدد';
        if (!byProject[proj]) byProject[proj] = {};
        if (!byProject[proj][mat]) {
            byProject[proj][mat] = { received: 0, returned: 0, unit: m.unit || '', phase: m.phase || '' };
        }
        const qty = parseFloat(m.quantity) || 0;
        if (m.movementType === 'receive') byProject[proj][mat].received += qty;
        if (m.movementType === 'return') byProject[proj][mat].returned += qty;
    });

    projectReport.innerHTML = '';
    Object.keys(byProject).sort().forEach(proj => {
        const section = document.createElement('div');
        section.className = 'section-card p-5 mb-5';

        let rows = '';
        Object.keys(byProject[proj]).sort().forEach(mat => {
            const d = byProject[proj][mat];
            const net = d.received - d.returned;
            rows += `
                <tr>
                    <td class="text-right">${mat}</td>
                    <td class="text-center text-xs text-gray-400">${d.phase}</td>
                    <td class="text-center">${d.received}</td>
                    <td class="text-center">${d.returned}</td>
                    <td class="text-center font-bold" style="color:#6B2D8B;">${net} ${d.unit}</td>
                </tr>`;
        });

        section.innerHTML = `
            <h2 class="text-lg font-bold text-gray-800 mb-3">${proj}</h2>
            <div style="overflow-x:auto;">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>المادة</th>
                            <th>المرحلة</th>
                            <th>مستلم</th>
                            <th>مرتجع</th>
                            <th>الصافي (مستهلك)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        projectReport.appendChild(section);
    });
}
