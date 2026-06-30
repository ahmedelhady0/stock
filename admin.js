// ═══════════════════════════════════════════════════════════
// منطق لوحة الإدارة — النسخة النهائية المصلحة والمستقلة
// ═══════════════════════════════════════════════════════════
import { auth, db, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// تعريف الـ appId الخاص بمشروعك بشكل ثابت لضمان عدم حدوث خطأ برميجي
const MY_APP_ID = "exco-60e92"; 

const notAdminMsg = document.getElementById('notAdminMsg');
const adminContent = document.getElementById('adminContent');
const closeMessageBtn = document.getElementById('closeMessageBtn');
closeMessageBtn?.addEventListener('click', hideMessage);

const addProjectForm = document.getElementById('addProjectForm');
const addMaterialForm = document.getElementById('addMaterialForm');
const addSupplierForm = document.getElementById('addSupplierForm');
const projectsList = document.getElementById('projectsList');
const materialsList = document.getElementById('materialsList');
const suppliersList = document.getElementById('suppliersList');

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    // إظهار اللوحة مباشرة وتخطي الحجب
    notAdminMsg.classList.add('hidden');
    adminContent.classList.remove('hidden');

    // تشغيل القوائم الحية
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
        showMessage('🏢 تم إضافة المشروع الجديد بنجاح!');
        nameInput.value = '';
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
});

function loadLiveProjects() {
    onSnapshot(collection(db, `artifacts/${MY_APP_ID}/public/data/projects`), (snapshot) => {
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
    });
}

// ── 2. إدارة المواد ─────────────────────────────────────────
// ── 2. إدارة المواد (النسخة المطابقة للـ HTML تماماً) ─────────────────────────
addMaterialForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🎯 التعديل هنا: تم تغيير المعرف إلى materialName ليتطابق مع الـ HTML لديك
    const nameInput = document.getElementById('materialName'); 
    const unitInput = document.getElementById('materialUnit');

    if (!nameInput || !unitInput) {
        console.error("حقول الإدخال غير موجودة في الـ HTML");
        return;
    }

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
    });
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
        showMessage('🤝 تم إضافة المورد بنجاح!');
        nameInput.value = '';
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
});

function loadLiveSuppliers() {
    onSnapshot(collection(db, `artifacts/${MY_APP_ID}/public/data/suppliers`), (snapshot) => {
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
    });
}

// ── دالة الحذف العامة ─────────────────────────────────────────
async function deleteItem(collectionName, id, label) {
    if (!confirm(`هل أنت متأكد من حذف "${label}"؟`)) return;
    try {
        await deleteDoc(doc(db, `artifacts/${MY_APP_ID}/public/data/${collectionName}`, id));
        showMessage('تم الحذف بنجاح');
        setTimeout(() => hideMessage(), 1200);
    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحذف: ' + error.message);
    }
}
