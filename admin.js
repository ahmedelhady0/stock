// ═══════════════════════════════════════════════════════════
// لوحة الإدارة — Firebase Auth للهوية، Google Sheets لكل البيانات
// ═══════════════════════════════════════════════════════════
import { auth, showMessage, hideMessage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getSetupData, getUsers, addProject, addMaterial, addSupplier, promoteUser } from './sheets-service.js';

const notAdminMsg = document.getElementById('notAdminMsg');
const adminContent = document.getElementById('adminContent');
document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);

const addProjectForm = document.getElementById('addProjectForm');
const addMaterialForm = document.getElementById('addMaterialForm');
const addSupplierForm = document.getElementById('addSupplierForm');
const projectsList = document.getElementById('projectsList');
const materialsList = document.getElementById('materialsList');
const suppliersList = document.getElementById('suppliersList');
const usersList = document.getElementById('usersList');

let currentEmail = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentEmail = user.email;

    let role = 'supervisor';
    try {
        role = (await getUserRole(user.email)).role || 'supervisor';
    } catch (err) {
        console.error(err);
    }

    if (role !== 'admin') {
        notAdminMsg.classList.remove('hidden');
        notAdminMsg.innerHTML = `<p class="text-gray-600">هذه الصفحة للإدارة فقط. حسابك الحالي رتبته "مشرف".</p>`;
        adminContent.classList.add('hidden');
        return;
    }

    notAdminMsg.classList.add('hidden');
    adminContent.classList.remove('hidden');
    await refreshAll();
});

async function refreshAll() {
    try {
        const [{ projects, materials, suppliers }, users] = await Promise.all([getSetupData(), getUsers()]);
        renderProjects(projects);
        renderMaterials(materials);
        renderSuppliers(suppliers);
        renderUsers(users);
    } catch (err) {
        console.error(err);
        showMessage('فشل تحميل البيانات: ' + err.message);
    }
}

function renderProjects(projects) {
    projectsList.innerHTML = projects.length
        ? projects.map(p => `<div class="admin-panel-item p-2"><span class="text-sm font-medium text-gray-800">${p}</span></div>`).join('')
        : '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مشاريع مضافة</p>';
}

function renderMaterials(materials) {
    materialsList.innerHTML = materials.length
        ? materials.map(m => `
            <div class="admin-panel-item p-3">
                <span class="text-sm font-bold text-indigo-900">${m.name}</span>
                <span class="text-xs text-gray-500 block mt-0.5">المرحلة: ${m.phase || '-'} | الوحدة: ${m.unit}</span>
            </div>`).join('')
        : '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مواد مضافة</p>';
}

function renderSuppliers(suppliers) {
    suppliersList.innerHTML = suppliers.length
        ? suppliers.map(s => `<div class="admin-panel-item p-2"><span class="text-sm font-medium text-gray-800">${s}</span></div>`).join('')
        : '<p class="text-center text-gray-400 py-2 text-sm">لا توجد موردين مضافين</p>';
}

function renderUsers(users) {
    usersList.innerHTML = '';
    if (users.length === 0) {
        usersList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا يوجد مستخدمين</p>';
        return;
    }
    users.forEach(u => {
        const roleLabel = u.role === 'admin' ? 'مدير' : 'مشرف';
        const item = document.createElement('div');
        item.className = 'admin-panel-item p-2 flex justify-between items-center';
        item.innerHTML = `
            <span class="text-sm"><b>${u.username}</b> <span class="text-xs text-gray-400">(${roleLabel})</span></span>
            ${u.role !== 'admin' ? `<button class="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">ترقية لمدير</button>` : ''}
        `;
        const btn = item.querySelector('button');
        if (btn) {
            btn.addEventListener('click', async () => {
                if (!confirm(`هل تريد ترقية "${u.username}" لمدير؟`)) return;
                try {
                    await promoteUser(u.email, currentEmail);
                    showMessage('تمت الترقية بنجاح');
                    await refreshAll();
                } catch (err) {
                    showMessage('فشلت الترقية: ' + err.message);
                }
                setTimeout(() => hideMessage(), 1200);
            });
        }
        usersList.appendChild(item);
    });
}

addProjectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const name = nameInput.value.trim();
    if (!name) return;
    try {
        await addProject(name, currentEmail);
        showMessage('🏢 تم إضافة المشروع بنجاح!');
        nameInput.value = '';
        await refreshAll();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
});

addMaterialForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phaseSelect = document.getElementById('newMaterialPhase');
    const nameInput = document.getElementById('newMaterialName');
    const unitInput = document.getElementById('newMaterialUnit');
    const phase = phaseSelect.value, name = nameInput.value.trim(), unit = unitInput.value.trim();
    if (!phase || !name || !unit) { showMessage('⚠️ يرجى ملء المرحلة واسم المادة والوحدة'); return; }
    try {
        await addMaterial(phase, name, unit, currentEmail);
        showMessage('📦 تم إضافة المادة بنجاح!');
        nameInput.value = ''; unitInput.value = ''; phaseSelect.selectedIndex = 0;
        await refreshAll();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
});

addSupplierForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newSupplierName');
    const name = nameInput.value.trim();
    if (!name) return;
    try {
        await addSupplier(name, currentEmail);
        showMessage('🤝 تم إضافة المورد بنجاح!');
        nameInput.value = '';
        await refreshAll();
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
});
