import { auth, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

let allMovements = [];
let currentFilter = 'all';

const movementsList = document.getElementById('movementsList');

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
        console.log("الحركات المجلوبة:", allMovements); // للتصحيح
        renderMovements();
    } catch (err) {
        console.error(err);
        movementsList.innerHTML = `<p class="text-center text-red-500 text-sm mt-8">تعذر تحميل السجل</p>`;
    }
});

function renderMovements() {
    let filtered = allMovements;

    if (currentFilter === 'receive') {
        filtered = allMovements.filter(m => String(m['نوع الحركة'] || '').includes('استلام'));
    } else if (currentFilter === 'return') {
        filtered = allMovements.filter(m => String(m['نوع الحركة'] || '').includes('تسوية'));
    }

    if (filtered.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8">لا توجد حركات مسجلة بعد</p>';
        return;
    }

    movementsList.innerHTML = '';
    filtered.slice(0, 20).forEach(m => {   // أول 20 حركة
        const card = document.createElement('div');
        card.className = 'movement-card p-4 bg-white rounded-2xl shadow-sm mb-3';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">
                        ${m['نوع الحركة'] || 'غير معروف'}
                    </span>
                    <p class="mt-2 font-semibold text-gray-800">
                        ${m['المادة'] || 'غير محدد'} — ${m['وارد (استلام)'] || m['مصروف على المشروع'] || 0} ${m['الوحدة'] || ''}
                    </p>
                    <p class="text-sm text-gray-600">${m['المشروع'] || ''} • ${m['المرحلة'] || ''}</p>
                </div>
                <span class="text-xs text-gray-400">${formatDate(m['التاريخ'])}</span>
            </div>
        `;
        movementsList.appendChild(card);
    });
}
