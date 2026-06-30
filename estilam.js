// ═══════════════════════════════════════════════════════════
// منطق فورم استلام المواد
// ═══════════════════════════════════════════════════════════
import { auth, db, storage, appId, PHASES, showMessage, hideMessage, todayStr } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let currentUser = null;
let currentUsername = '';
let allMaterials = []; // {id, name, unit, phase}
let allProjects = [];

const fDate = document.getElementById('fDate');
const fSupplier = document.getElementById('fSupplier');
const fProject = document.getElementById('fProject');
const fPhase = document.getElementById('fPhase');
const fMaterial = document.getElementById('fMaterial');
const fUnit = document.getElementById('fUnit');
const fQuantity = document.getElementById('fQuantity');
const fImage = document.getElementById('fImage');
const fNotes = document.getElementById('fNotes');
const receiveForm = document.getElementById('receiveForm');
const submitBtn = document.getElementById('submitBtn');
const uploadProgressWrap = document.getElementById('uploadProgressWrap');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const closeMessageBtn = document.getElementById('closeMessageBtn');

closeMessageBtn?.addEventListener('click', hideMessage);
fDate.value = todayStr();

// تعبئة المراحل
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
});

async function loadProjects() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/projects`));
    allProjects = [];
    fProject.innerHTML = '<option value="" disabled selected>اختر المشروع</option>';
    snap.forEach(d => {
        const data = d.data();
        allProjects.push({ id: d.id, ...data });
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
        opt.textContent = `${m.name} (${m.unit})`;
        fMaterial.appendChild(opt);
    });
    fMaterial.disabled = false;
    fUnit.value = '';
});

fMaterial.addEventListener('change', () => {
    const selected = fMaterial.options[fMaterial.selectedIndex];
    fUnit.value = selected?.dataset?.unit || '';
});

receiveForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        showMessage('خطأ: المستخدم غير مسجل دخول');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> جاري الحفظ...';

    try {
        let imageUrl = '';
        const file = fImage.files[0];

        if (file) {
            uploadProgressWrap.classList.remove('hidden');
            const fileRef = ref(storage, `warehouse-images/receive/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            imageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        uploadProgressBar.style.width = pct + '%';
                    },
                    (error) => reject(error),
                    async () => {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(url);
                    }
                );
            });
        }

        const movementsRef = collection(db, `artifacts/${appId}/public/data/movements`);
        await addDoc(movementsRef, {
            movementType: 'receive',
            date: fDate.value,
            supplier: fSupplier.value.trim(),
            project: fProject.value,
            phase: fPhase.value,
            material: fMaterial.value,
            unit: fUnit.value,
            quantity: parseFloat(fQuantity.value),
            imageUrl: imageUrl,
            notes: fNotes.value.trim(),
            createdBy: currentUser.uid,
            createdByName: currentUsername,
            timestamp: new Date(),
            syncedToSheets: false
        });

        showMessage('✅ تم تسجيل الاستلام بنجاح!');
        receiveForm.reset();
        fDate.value = todayStr();
        fMaterial.innerHTML = '<option value="" disabled selected>اختر المرحلة أولاً</option>';
        fMaterial.disabled = true;
        uploadProgressWrap.classList.add('hidden');
        uploadProgressBar.style.width = '0%';

        setTimeout(() => { hideMessage(); }, 1800);

    } catch (error) {
        console.error(error);
        showMessage('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'تسجيل الاستلام';
    }
});
