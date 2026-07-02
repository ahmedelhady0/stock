// ═══════════════════════════════════════════════════════════
// سجل حركاتي — قراءة فقط من Google Sheets (فلترة على المستخدم الحالي)
// أي تعديل أو حذف على حركة قديمة بيتعمل مباشرة في شيت Movements
// ═══════════════════════════════════════════════════════════
import { auth, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

let allMovements = [];
let currentFilter = 'all';

const movementsList = document.getElementById('movementsList');

const TYPE_LABELS = {
    'استلام من مورد': { text: 'استلام', cls: 'receive' },
    'مرتجع من الموقع': { text: 'مرتجع', cls: 'return' },
    'صرف داخلي': { text: 'صرف', cls: 'spend' }
};

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderMovements();
    });
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        allMovements = await getMovements(user.email);
        renderMovements();
    } catch (err) {
        console.error(err);
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm">تعذر تحميل البيانات: ' + err.message + '</p>';
    }
});

function renderMovements() {
    const filterMap = { receive: 'استلام من مورد', return: 'مرتجع من الموقع' };
    const filtered = currentFilter === 'all' ? allMovements : allMovements.filter(m => m.type === filterMap[currentFilter]);

    if (filtered.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات</p>';
        return;
    }

    movementsList.innerHTML = '';
    filtered.forEach(m => {
        const t = TYPE_LABELS[m.type] || { text: m.type || '', cls: '' };
        const card = document.createElement('div');
        card.className = `movement-card type-${t.cls}`;

        let extra = '';
        if (m.type === 'استلام من مورد') extra = `المورد: ${m.supplier || '-'}`;
        if (m.type === 'مرتجع من الموقع') extra = `الوجهة: ${m.supplier || '-'} · السبب: ${m.reason || '-'}`;

        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="movement-badge badge-${t.cls}">${t.text}</span>
                <span class="text-xs text-gray-400">${formatDate(m.timestamp)}</span>
            </div>
            <p class="text-sm text-gray-800 font-semibold">${m.material} — ${m.quantity ?? ''} ${m.unit || ''}</p>
            <p class="text-xs text-gray-500 mb-1">${m.project || ''} ${m.phase ? '· ' + m.phase : ''}</p>
            <p class="text-xs text-gray-500">${extra}</p>
        `;
        movementsList.appendChild(card);
    });
}
