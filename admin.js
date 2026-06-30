// ═══════════════════════════════════════════════════════════
// منطق لوحة الإدارة
// ═══════════════════════════════════════════════════════════
import { auth, db, appId, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const usersList = document.getElementById('usersList');

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    const userSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${user.uid}`));
    const role = userSnap.exists() ? userSnap.data().role : 'supervisor';

    if (role !== 'admin') {
        notAdminMsg.classList.remove('hidden');
        return;
    }

    adminContent.classList.remove('hidden');
    loadProjects();
    loadMaterials();
    loadSuppliers();
    loadUsers();
});

// ── المشاريع ──────────────────────────────────────────────
addProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProjectName').value.trim();
    if (!name) return;
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/projects`), { name, createdAt: new Date() });
        showMessage(`تمت إضافة المشروع "${name}"`);
        addProjectForm.reset();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('حدث خطأ أثناء الإضافة');
    }
});

function loadProjects() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/projects`), (snap) => {
        projectsList.innerHTML = '';
        if (snap.empty) { projectsList.innerHTML = '<p class="text-sm text-gray-500">لا توجد مشاريع</p>'; return; }
        snap.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `<span class="font-medium text-sm">${data.name}</span>
                <button class="text-red-500 text-xs hover:text-red-700" data-id="${d.id}">حذف</button>`;
            item.querySelector('button').addEventListener('click', () => deleteItem('projects', d.id, data.name));
            projectsList.appendChild(item);
        });
    });
}

// ── المواد ────────────────────────────────────────────────
addMaterialForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phase = document.getElementById('newMaterialPhase').value;
    const name = document.getElementById('newMaterialName').value.trim();
    const unit = document.getElementById('newMaterialUnit').value.trim();
    if (!phase || !name || !unit) return;
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/materials`), { phase, name, unit, createdAt: new Date() });
        showMessage(`تمت إضافة المادة "${name}"`);
        addMaterialForm.reset();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('حدث خطأ أثناء الإضافة');
    }
});

function loadMaterials() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/materials`), (snap) => {
        materialsList.innerHTML = '';
        if (snap.empty) { materialsList.innerHTML = '<p class="text-sm text-gray-500">لا توجد مواد</p>'; return; }
        snap.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `<span class="text-sm"><b>${data.name}</b> · ${data.unit} <span class="text-gray-400">(${data.phase})</span></span>
                <button class="text-red-500 text-xs hover:text-red-700" data-id="${d.id}">حذف</button>`;
            item.querySelector('button').addEventListener('click', () => deleteItem('materials', d.id, data.name));
            materialsList.appendChild(item);
        });
    });
}

// ── الموردين ──────────────────────────────────────────────
addSupplierForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newSupplierName').value.trim();
    if (!name) return;
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/suppliers`), { name, createdAt: new Date() });
        showMessage(`تمت إضافة المورد "${name}"`);
        addSupplierForm.reset();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('حدث خطأ أثناء الإضافة');
    }
});

function loadSuppliers() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/suppliers`), (snap) => {
        suppliersList.innerHTML = '';
        if (snap.empty) { suppliersList.innerHTML = '<p class="text-sm text-gray-500">لا يوجد موردون</p>'; return; }
        snap.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `<span class="text-sm font-medium">${data.name}</span>
                <button class="text-red-500 text-xs hover:text-red-700" data-id="${d.id}">حذف</button>`;
            item.querySelector('button').addEventListener('click', () => deleteItem('suppliers', d.id, data.name));
            suppliersList.appendChild(item);
        });
    });
}

// ── المستخدمين ────────────────────────────────────────────
function loadUsers() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/users`), (snap) => {
        usersList.innerHTML = '';
        if (snap.empty) { usersList.innerHTML = '<p class="text-sm text-gray-500">لا يوجد مستخدمون</p>'; return; }
        snap.forEach(d => {
            const data = d.data();
            const roleLabel = data.role === 'admin' ? 'مدير' : 'مشرف';
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `
                <span class="text-sm"><b>${data.username}</b> <span class="text-xs text-gray-400">(${roleLabel})</span></span>
                ${data.role !== 'admin' ? `<button class="text-xs text-gray-500 hover:text-gray-700" data-id="${d.id}">ترقية لمدير</button>` : ''}
            `;
            const btn = item.querySelector('button');
            if (btn) {
                btn.addEventListener('click', async () => {
                    if (!confirm(`هل تريد ترقية "${data.username}" لمدير؟`)) return;
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, d.id), { role: 'admin' });
                    showMessage('تمت الترقية بنجاح');
                    setTimeout(() => hideMessage(), 1200);
                });
            }
            usersList.appendChild(item);
        });
    });
}

// ── حذف عام ───────────────────────────────────────────────
async function deleteItem(collectionName, id, label) {
    if (!confirm(`هل أنت متأكد من حذف "${label}"؟`)) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/${collectionName}`, id));
        showMessage('تم الحذف بنجاح');
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('حدث خطأ أثناء الحذف');
    }
}
