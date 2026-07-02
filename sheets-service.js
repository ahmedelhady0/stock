// ═══════════════════════════════════════════════════════════
// طبقة الاتصال الموحدة بالـ Google Apps Script Web App
// ═══════════════════════════════════════════════════════════

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzZnl25Dvdn6StTIIIqWHTSRhiOeeCwd9udTAcipHzWp17VnAHWcyt-XhkAeUshA2RP/exec"; 
// ← غيّر الرابط ده بعد أحدث Deploy

async function callPost(body) {
    try {
        const res = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return { ok: true }; // لو الرد مش JSON
        }
    } catch (err) {
        console.error('POST Error:', err);
        throw new Error('فشل الاتصال بالشيت - CORS أو Deploy');
    }
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
