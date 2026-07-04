import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

let allMovements = [];

const movementsList = document.getElementById('movementsList');

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        allMovements = await getMovements();
        console.log("عدد الحركات:", allMovements.length);
        renderMovements();
    } catch (err) {
        movementsList.innerHTML = `<p class="text-red-500 text-center mt-8">خطأ في تحميل السجل</p>`;
    }
});

function renderMovements() {
    if (allMovements.length === 0) {
        movementsList.innerHTML = '<p class="text-center text-gray-500 mt-8">لا توجد حركات مسجلة</p>';
        return;
    }

    movementsList.innerHTML = '';
    allMovements.slice(0, 30).forEach(m => {
        const card = document.createElement('div');
        card.className = 'p-4 bg-white rounded-2xl shadow mb-3';
        card.innerHTML = `
            <div class="flex justify-between">
                <div class="flex-1">
                    <p class="font-medium">${m['المادة'] || m['البند'] || 'مادة غير محددة'}</p>
                    <p class="text-sm text-gray-600">${m['المشروع'] || ''}</p>
                    <p class="text-xs text-gray-500">${m['ملاحظات'] || ''}</p>
                </div>
                <div class="text-right text-xs text-gray-400">
                    ${m['التاريخ'] ? new Date(m['التاريخ']).toLocaleDateString('ar-EG') : ''}
                </div>
            </div>
        `;
        movementsList.appendChild(card);
    });
}
