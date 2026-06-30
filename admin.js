// ═══════════════════════════════════════════════════════════
// منطق لوحة الإدارة — النسخة المستقلة والمصلحة بالكامل 100%
// ═══════════════════════════════════════════════════════════
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// المعرف الثابت الخاص بمشروعك
const MY_APP_ID = "exco-60e92"; 

const notAdminMsg = document.getElementById('notAdminMsg');
const adminContent = document.getElementById('adminContent');

const addProjectForm = document.getElementById('addProjectForm');
const addMaterialForm = document.getElementById('addMaterialForm');
const addSupplierForm = document.getElementById('addSupplierForm');
const projectsList = document.getElementById('projectsList');
const materialsList = document.getElementById('materialsList');
const suppliersList = document.getElementById('suppliersList');

// دالة عرض الرسائل المحلية لضمان عدم حدوث خطأ بسبب الاستيراد
function localShowMessage(text) {
    const box = document.getElementById('messageBox');
    const txt = document.getElementById('messageText');
    if (box && txt) {
        txt.textContent = text;
        box.classList.remove('hidden');
        box.classList.add('flex');
    } else {
        alert(text);
    }
}

function localHideMessage() {
    const box = document.getElementById('messageBox');
    if (box) {
        box.classList.add('hidden');
        box.classList.remove('flex');
    }
}

// تفعيل زر إغلاق الرسالة إن وجد
document.getElementById('closeMessageBtn')?.addEventListener('click', localHideMessage);

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    // فتح اللوحة مباشرة للمستخدم الحالي
    if (notAdminMsg) notAdminMsg.classList.add('hidden');
    if (adminContent) adminContent.classList.remove('hidden');

    // تشغيل جلب البيانات الحي
    loadLiveProjects();
    loadLiveMaterials();
    loadLiveSuppliers();
});

// ── 1. إدارة المشاريع ───────────────────────────────────────
addProjectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        await addDoc(collection(db, `artifacts/${MY_APP_ID}/public/data/projects`), {
            name,
            createdAt: new Date()
        });
        localShowMessage('🏢 تم إضافة المشروع الجديد بنجاح!');
        nameInput.value = '';
        setTimeout(() => localHideMessage(), 1200);
    } catch (err) {
        console.error("Error adding project:", err);
        localShowMessage('❌ فشل الحفظ: ' + err.message);
    }
});

function loadLiveProjects() {
    onSnapshot(collection(db, `artifacts/${MY_APP_ID}/public/data/projects`), (snapshot) => {
        if (!projectsList) return;
        projectsList.innerHTML = '';
        if (snapshot.empty) {
            projectsList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مشاريع مضافة</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center bg-white my-1 rounded shadow-sm border border-gray-100';
            item.innerHTML = `
                <span class="text-sm font-medium text-gray-800">${data.name}</span>
                <button class="text-xs text-red-500 hover:text-red-700 font-semibold">حذف</button>
            `;
            item.querySelector('button').addEventListener('click', () => deleteItem('projects', d.id, data.name));
            projectsList.appendChild(item);
        });
    }, (err) => { console.error("Snapshot error projects:", err); });
}

// ── 2. إدارة المواد ─────────────────────────────────────────
addMaterialForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newMaterialName');
    const unitInput = document.getElementById('materialUnit');

    const name = nameInput.value.trim();
    const unit = unitInput.value.trim();

    if (!name || !unit) return;

    try {
        await addDoc(collection(db, `artifacts/${MY_APP_ID}/public/data/materials`), {
            name,
            unit,
            createdAt: new Date()
        });
        localShowMessage('📦 تم إضافة المادة بنجاح!');
        nameInput.value = '';
        unitInput.value = '';
        setTimeout(() => localHideMessage(), 1200);
    } catch (err) {
        console.error("Error adding material:", err);
        localShowMessage('❌ فشل الحفظ: ' + err.message);
    }
});

function loadLiveMaterials() {
    onSnapshot(collection(db, `artifacts/${MY_APP_ID}/public/data/materials`), (snapshot) => {
        if (!materialsList) return;
        materialsList.innerHTML = '';
        if (snapshot.empty) {
            materialsList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مواد مضافة</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-3 flex justify-between items-center bg-white my-1 rounded shadow-sm border border-gray-100';
            item.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-indigo-900">${data.name}</span>
                    <span class="text-xs text-gray-500 mt-0.5">الوحدة: ${data.unit}</span>
                </div>
                <button class="text-xs text-red-500 hover:text-red-700 font-semibold">حذف</button>
            `;
            item.querySelector('button').addEventListener('click', () => deleteItem('materials', d.id, data.name));
            materialsList.appendChild(item);
        });
    }, (err) => { console.error("Snapshot error materials:", err); });
}

// ── 3. إدارة الموردين ───────────────────────────────────────
addSupplierForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newSupplierName');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        await addDoc(collection(db, `artifacts/${MY_APP_ID}/public/data/suppliers`), {
            name,
            createdAt: new Date()
        });
        localShowMessage('🤝 تم إضافة المورد بنجاح!');
        nameInput.value = '';
        setTimeout(() => localHideMessage(), 1200);
    } catch (err) {
        console.error("Error adding supplier:", err);
        localShowMessage('❌ فشل الحفظ: ' + err.message);
    }
});

function loadLiveSuppliers() {
    onSnapshot(collection(db, `artifacts/${MY_APP_ID}/public/data/suppliers`), (snapshot) => {
        if (!suppliersList) return;
        suppliersList.innerHTML = '';
        if (snapshot.empty) {
            suppliersList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد موردين مضافين</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center bg-white my-1 rounded shadow-sm border border-gray-100';
            item.innerHTML = `
                <span class="text-sm font-medium text-gray-800">${data.name}</span>
                <button class="text-xs text-red-500 hover:text-red-700 font-semibold">حذف</button>
            `;
            item.querySelector('button').addEventListener('click', () => deleteItem('suppliers', d.id, data.name));
            suppliersList.appendChild(item);
        });
    }, (err) => { console.error("Snapshot error suppliers:", err); });
}

// ── دالة الحذف العامة ─────────────────────────────────────────
async function deleteItem(collectionName, id, label) {
    if (!confirm(`هل أنت متأكد من حذف "${label}"؟`)) return;
    try {
        await deleteDoc(doc(db, `artifacts/${MY_APP_ID}/public/data/${collectionName}`, id));
        localShowMessage('تم الحذف بنجاح');
        setTimeout(() => localHideMessage(), 1200);
    } catch (error) {
        console.error(error);
        localShowMessage('حدث خطأ أثناء الحذف: ' + error.message);
    }
}
