import { auth, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

let allMovements = [];
let currentFilter = 'all';

const movementsList = document.getElementById('movementsList');

const TYPE_LABELS = {
    'استلام': { text: 'استلام', cls: 'receive' },
    'تسوية': { text: 'تسوية', cls: 'settlement' }
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
        allMovements = await getMovements();
        renderMovements();
    } catch (err) {
        console.error(err);
        movementsList.innerHTML = `<p class="text-center text-red-500 text-sm mt-8">تعذر تحميل السجل: ${err.message}</p>`;
    }
});

function renderMovements() {
    let filtered = allMovements;

    if (currentFilter === 'receive') {
        filtered = allMovements.filter(m => m['نوع الحركة'] === 'استلام');
    } else if (currentFilter === 'return') {
        filtered = allMovements.filter(m => m['نوع الحركة'] === 'تسوية');
    }

    if (filtered.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات مسجلة بعد</p>';
        return;
    }

    movementsList.innerHTML = '';
    filtered.forEach(m => {
        const type = m['نوع الحركة'] || 'غير معروف';
        const card = document.createElement('div');
        card.className = 'movement-card p-4 bg-white rounded-2xl shadow-sm mb-3';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="inline-block px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">${type}</span>
                    <p class="text-sm font-semibold mt-2">${m['المادة'] || ''} — ${m['وارد (استلام)'] || m['مصروف على المشروع'] || 0} ${m['الوحدة'] || ''}</p>
                    <p class="text-xs text-gray-500">${m['المشروع'] || ''} • ${m['المرحلة'] || ''}</p>
                </div>
                <span class="text-xs text-gray-400">${formatDate(m['التاريخ'])}</span>
            </div>
        `;
        movementsList.appendChild(card);
    });
}
