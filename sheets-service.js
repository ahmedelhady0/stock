// ═══════════════════════════════════════════════════════════
// طبقة الاتصال الموحدة بالـ Google Apps Script Web App
// ═══════════════════════════════════════════════════════════

const WEB_APP_URL = "https://script.google.com/macros/library/d/1NobMckz-I6snRN9jxh5K5AsynX1fURueG-6uKS8Edw-2xGLeRB5f3qLJ/3"; 
// ← غيّر الرابط ده بعد أحدث Deploy

async function callGet(params) {
    const url = new URL(WEB_APP_URL);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

async function callPost(body) {
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok === false) throw new Error(data.error || 'فشلت العملية');
    return data;
}

// ── القراءة ────────────────────────────────────────────────
export async function getSetupData() {
    return callGet({ action: 'getSetupData' });
}

export async function getMovements(email = null) {
    return callGet({ action: 'getMovements', email }).then(d => d.movements || []);
}

export async function getUserRole(email) {
    return callGet({ action: 'getUserRole', email });
}

export async function getUsers() {
    return callGet({ action: 'getUsers' }).then(d => d.users || []);
}

// ── الكتابة ────────────────────────────────────────────────
export async function registerUser(userData) {
    return callPost({ action: 'registerUser', ...userData });
}

export async function logReceipt(movement) {
    return callPost({ action: 'logReceipt', movement });
}

export async function logSettlement(movement) {
    return callPost({ action: 'logSettlement', movement });
}

// دوال الإدارة
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
