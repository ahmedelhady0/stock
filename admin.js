// ═══════════════════════════════════════════════════════════
// منطق لوحة الإدارة — مع أداة الترقية التلقائية المؤقتة
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

    // ── حماية الصفحة + زر الترقية السحري للمشرفين ─────────────────
    if (role !== 'admin') {
        notAdminMsg.classList.remove('hidden');
        
        // تعديل محتوى رسالة الخطأ ليظهر بها زر الترقية الفورية
        notAdminMsg.innerHTML = `
            <div class="p-4 bg-orange-50 border border-orange-200 rounded-xl text-center">
                <p class="text-orange-800 font-bold mb-4">⚠️ حسابك الحالي مسجل برتبة (مشرف)، ولا يملك صلاحية إدارة الجداول.</p>
                <button id="quickUpgradeBtn" type="button" class="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-200 transform hover:scale-105 active:scale-95">
                    ⚡ اضغط هنا لترقية حسابك الحالي إلى مدير (Admin) فوراً ⚡
                </button>
            </div>
        `;
        
        // إظهار المحتوى مؤقتاً تحت الزر حتى تستطيع رؤية اللوحة وتجربتها
        adminContent.classList.remove('hidden'); 

        // تشغيل منطق زر الترقية عند الضغط عليه
        document.getElementById('quickUpgradeBtn')?.addEventListener('click', async () => {
            try {
                // تحديث حقل الـ role في مستند المستخدم الحالي بداخل الفايربيز
                await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, user.uid), { 
                    role: 'admin' 
                });
                
                alert('🎉 ممتاز جداً! تم ترقية حسابك إلى Admin في قاعدة البيانات بنجاح.\nجاري إعادة تحميل الصفحة لتفعيل الصلاحيات الكاملة...');
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('❌ فشلت الترقية التلقائية بسبب قواعد الحماية:\n' + err.message + '\n\nإذا استمر الخطأ، يرجى تعديل الـ role يدوياً من Firebase Console.');
            }
        });

        // تشغيل الاستماع الحي للقوائم حتى تظهر لك البيانات فوراً للتجربة
        loadLiveProjects();
        loadLiveMaterials();
        loadLiveSuppliers();
        loadLiveUsers();
        return;
    }

    // إذا كان المستخدم Admin أصلي أو تم ترقيته بنجاح
    notAdminMsg.classList.add('hidden');
    adminContent.classList.remove('hidden');

    loadLiveProjects();
    loadLiveMaterials();
    loadLiveSuppliers();
    loadLiveUsers();
});

// ── 1. إدارة المشاريع ───────────────────────────────────────
addProjectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/projects`), {
            name,
            createdAt: new Date()
        });
        showMessage('🏢 تم إضافة المشروع الجديد بنجاح!');
        nameInput.value = '';
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('❌ فشل الحفظ: حسابك لا يملك صلاحية الأدمن في Firestore Rules بعد!');
    }
});

function loadLiveProjects() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/projects`), (snapshot) => {
        projectsList.innerHTML = '';
        if (snapshot.empty) {
            projectsList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مشاريع مضافة</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
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
// ── 2. إدارة المواد (النسخة المصلحة والمطابقة للـ HTML لديك) ─────────────────
addMaterialForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newMaterialName');
    const unitInput = document.getElementById('materialUnit');

    const name = nameInput.value.trim();
    const unit = unitInput.value.trim();

    // نتحقق من الحقول المتاحة لديك فقط في التصميم
    if (!name || !unit) {
        showMessage('⚠️ يرجى ملء اسم المادة والوحدة أولاً');
        return;
    }

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/materials`), {
            name,
            unit,
            createdAt: new Date()
        });
        showMessage('📦 تم إضافة المادة بنجاح!');
        nameInput.value = '';
        unitInput.value = '';
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('❌ فشل حفظ المادة: ' + err.message);
    }
});

function loadLiveMaterials() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/materials`), (snapshot) => {
        materialsList.innerHTML = '';
        if (snapshot.empty) {
            materialsList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد مواد مضافة</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-3 flex justify-between items-center bg-white my-1 rounded shadow-sm';
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
        await addDoc(collection(db, `artifacts/${appId}/public/data/suppliers`), {
            name,
            createdAt: new Date()
        });
        showMessage('🤝 تم إضافة المورد بنجاح!');
        nameInput.value = '';
        setTimeout(() => hideMessage(), 1200);
    } catch (err) {
        console.error(err);
        showMessage('❌ فشل الحفظ: حسابك لا يملك صلاحية الأدمن في Firestore Rules بعد!');
    }
});

function loadLiveSuppliers() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/suppliers`), (snapshot) => {
        suppliersList.innerHTML = '';
        if (snapshot.empty) {
            suppliersList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا توجد موردين مضافين</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `
                <span class="text-sm font-medium text-gray-800">${data.name}</span>
                <button class="text-xs text-red-500 hover:text-red-700 font-semibold">حذف</button>
            `;
            item.querySelector('button').addEventListener('click', () => deleteItem('suppliers', d.id, data.name));
            suppliersList.appendChild(item);
        });
    });
}

// ── 4. عرض وإدارة المستخدمين ─────────────────────────────────
function loadLiveUsers() {
    onSnapshot(collection(db, `artifacts/${appId}/public/data/users`), (snapshot) => {
        usersList.innerHTML = '';
        if (snapshot.empty) {
            usersList.innerHTML = '<p class="text-center text-gray-400 py-2 text-sm">لا يوجد مستخدمين آخرين</p>';
            return;
        }
        snapshot.forEach(d => {
            const data = d.data();
            const roleLabel = data.role === 'admin' ? 'مدير' : 'مشرف';
            const item = document.createElement('div');
            item.className = 'admin-panel-item p-2 flex justify-between items-center';
            item.innerHTML = `
                <span class="text-sm"><b>${data.username}</b> <span class="text-xs text-gray-400">(${roleLabel})</span></span>
                ${data.role !== 'admin' ? `<button class="text-xs text-indigo-500 hover:text-indigo-700 font-semibold" data-id="${d.id}">ترقية لمدير</button>` : ''}
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

// ── دالة الحذف العامة ─────────────────────────────────────────
async function deleteItem(collectionName, id, label) {
    if (!confirm(`هل أنت متأكد من حذف "${label}"؟`)) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/${collectionName}`, id));
        showMessage('تم الحذف بنجاح');
        setTimeout(() => hideMessage(), 1200);
    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحذف: ' + error.message);
    }
}
