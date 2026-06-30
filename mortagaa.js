// ═══════════════════════════════════════════════════════════
// منطق فورم المرتجع
// ═══════════════════════════════════════════════════════════
import { auth, db, storage, appId, PHASES, MATERIALS_RETURN_TO_WAREHOUSE, MATERIALS_RETURN_TO_SUPPLIER, showMessage, hideMessage, todayStr } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let currentUser = null;
let currentUsername = '';
let allMaterials = [];
let allSuppliers = [];

const fDate = document.getElementById('fDate');
const fProject = document.getElementById('fProject');
const fPhase = document.getElementById('fPhase');
const fMaterial = document.getElementById('fMaterial');
const fUnit = document.getElementById('fUnit');
const fDestination = document.getElementById('fDestination');
const fQuantity = document.getElementById('fQuantity');
const fReason = document.getElementById('fReason');
const fImage = document.getElementById('fImage');
const fNotes = document.getElementById('fNotes');
const returnForm = document.getElementById('returnForm');
const submitBtn = document.getElementById('submitBtn');
const uploadProgressWrap = document.getElementById('uploadProgressWrap');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const closeMessageBtn = document.getElementById('closeMessageBtn');

closeMessageBtn?.addEventListener('click', hideMessage);
fDate.value = todayStr();

PHASES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    fPhase.appendChild(opt);
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    const userSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users/${user.uid}`));
    currentUsername = userSnap.exists() ? (userSnap.data().username || '') : '';
    await loadProjects();
    await loadMaterials();
    await loadSuppliers();
});

async function loadProjects() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/projects`));
    fProject.innerHTML = '<option value="" disabled selected>اختر المشروع</option>';
    snap.forEach(d => {
        const data = d.data();
        const opt = document.createElement('option');
        opt.value = data.name; opt.textContent = data.name;
        fProject.appendChild(opt);
    });
}

async function loadMaterials() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/materials`));
    allMaterials = [];
    snap.forEach(d => allMaterials.push({ id: d.id, ...d.data() }));
}

async function loadSuppliers() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/suppliers`));
    allSuppliers = [];
    snap.forEach(d => allSuppliers.push({ id: d.id, ...d.data() }));
}

fPhase.addEventListener('change', () => {
    const phase = fPhase.value;
    fMaterial.innerHTML = '<option value="" disabled selected>اختر المادة</option>';
    const matchingMaterials = allMaterials.filter(m => m.phase === phase);

    if (matchingMaterials.length === 0) {
        fMaterial.innerHTML = '<option value="" disabled selected>لا توجد مواد لهذه المرحلة</option>';
        fMaterial.disabled = true;
        return;
    }

    matchingMaterials.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.dataset.unit = m.unit;
        fMaterial.appendChild(opt).textContent = `${m.name} (${m.unit})`;
    });
    fMaterial.disabled = false;
    fUnit.value = '';
    fDestination.innerHTML = '<option value="" disabled selected>اختر المادة أولاً</option>';
});

fMaterial.addEventListener('change', () => {
    const selected = fMaterial.options[fMaterial.selectedIndex];
    fUnit.value = selected?.dataset?.unit || '';
    buildDestinationOptions(fMaterial.value);
});

function buildDestinationOptions(materialName) {
    fDestination.innerHTML = '';

    if (MATERIALS_RETURN_TO_WAREHOUSE.includes(materialName)) {
        const opt = document.createElement('option');
        opt.value = 'مستودع'; opt.textContent = 'مستودع';
        fDestination.appendChild(opt);
    } else if (MATERIALS_RETURN_TO_SUPPLIER.includes(materialName)) {
        const defOpt = document.createElement('option');
        defOpt.value = ''; defOpt.disabled = true; defOpt.selected = true;
        defOpt.textContent = 'اختر المورد';
        fDestination.appendChild(defOpt);
        allSuppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name; opt.textContent = s.name;
            fDestination.appendChild(opt);
        });
        // اختيار "مورد آخر" يدوي لو مش موجود في القائمة
        const otherOpt = document.createElement('option');
        otherOpt.value = '__other__'; otherOpt.textContent = 'مورد آخر (اكتب يدوياً)';
        fDestination.appendChild(otherOpt);
    } else {
        const opt = document.createElement('option');
        opt.value = ''; opt.disabled = true; opt.selected = true;
        opt.textContent = 'هذه المادة ليس لها مرتجع (راجع فورم الصرف)';
        fDestination.appendChild(opt);
    }
}

returnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { showMessage('خطأ: المستخدم غير مسجل دخول'); return; }

    let destinationValue = fDestination.value;
    if (destinationValue === '__other__') {
        const manual = prompt('اكتب اسم المورد:');
        if (!manual) { return; }
        destinationValue = manual.trim();
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جاري الحفظ...';

    try {
        let imageUrl = '';
        const file = fImage.files[0];
        if (file) {
            uploadProgressWrap.classList.remove('hidden');
            const fileRef = ref(storage, `warehouse-images/return/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);
            imageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snap) => { uploadProgressBar.style.width = (snap.bytesTransferred / snap.totalBytes * 100) + '%'; },
                    reject,
                    async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
                );
            });
        }

        const toWarehouse = destinationValue === 'مستودع';

        await addDoc(collection(db, `artifacts/${appId}/public/data/movements`), {
            movementType: 'return',
            date: fDate.value,
            project: fProject.value,
            phase: fPhase.value,
            material: fMaterial.value,
            unit: fUnit.value,
            destination: destinationValue,
            returnToWarehouse: toWarehouse ? parseFloat(fQuantity.value) : 0,
            returnToSupplier: !toWarehouse ? parseFloat(fQuantity.value) : 0,
            quantity: parseFloat(fQuantity.value),
            reason: fReason.value,
            imageUrl,
            notes: fNotes.value.trim(),
            createdBy: currentUser.uid,
            createdByName: currentUsername,
            timestamp: new Date(),
            syncedToSheets: false
        });

        showMessage('✅ تم تسجيل المرتجع بنجاح!');
        returnForm.reset();
        fDate.value = todayStr();
        fMaterial.innerHTML = '<option value="" disabled selected>اختر المرحلة أولاً</option>';
        fMaterial.disabled = true;
        fDestination.innerHTML = '<option value="" disabled selected>اختر المرحلة والمادة أولاً</option>';
        uploadProgressWrap.classList.add('hidden');
        uploadProgressBar.style.width = '0%';

        setTimeout(() => hideMessage(), 1800);

    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'تسجيل المرتجع';
    }
});
