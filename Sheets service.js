// ═══════════════════════════════════════════════════════════
// طبقة الاتصال الموحدة بالـ Google Apps Script Web App
// كل الملفات (home.js, admin.js, deliveries.js, project.js, history.js)
// بتستخدم الدوال دي بدل ما كل ملف يعمل fetch بنفسه
// ═══════════════════════════════════════════════════════════

// ⚠️ رابط الـ Web App بتاعك بعد أحدث Deploy
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby9p0z_PY7slUtTsZTiP2wJDqZ1DC2rbcJ1s-f3p3Qwg7HrTi_1hs2_y7sGGYi_krw/exec";

async function callGet(params) {
    const url = new URL(WEB_APP_URL);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

async function callPost(body) {
    // ملاحظة: mode "no-cors" بيمنعنا من قراءة الرد، فمستخدمينه بس لو مش محتاجين نتأكد من نجاح الكتابة فورًا.
    // هنا بنستخدم fetch عادي (بدون no-cors) عشان نقدر نقرأ رسالة الخطأ لو فشلت العملية (زي رفض صلاحية admin).
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain عشان نتجنب مشاكل CORS preflight مع Apps Script
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok === false) throw new Error(data.error || 'فشلت العملية');
    return data;
}

// ── القراءة ────────────────────────────────────────────────
export async function getSetupData() {
    return callGet({ action: 'getSetupData' }); // { projects, materials, suppliers }
}

export async function getMovements(email) {
    const data = await callGet({ action: 'getMovements', email });
    return data.movements || [];
}

export async function getUserRole(email) {
    return callGet({ action: 'getUserRole', email }); // { exists, role, username }
}

export async function getUsers() {
    const data = await callGet({ action: 'getUsers' });
    return data.users || [];
}

// ── الكتابة ────────────────────────────────────────────────
export async function registerUser({ uid, username, email }) {
    return callPost({ action: 'registerUser', uid, username, email });
}

export async function logMovement(movement) {
    return callPost({ action: 'logMovement', movement });
}

export async function addProject(name, requesterEmail) {
    return callPost({ action: 'addProject', name, requesterEmail });
}

export async function addMaterial(phase, name, unit, requesterEmail) {
    return callPost({ action: 'addMaterial', phase, name, unit, requesterEmail });
}

export async function addSupplier(name, requesterEmail) {
    return callPost({ action: 'addSupplier', name, requesterEmail });
}

export async function promoteUser(targetEmail, requesterEmail) {
    return callPost({ action: 'promoteUser', targetEmail, requesterEmail });
}
