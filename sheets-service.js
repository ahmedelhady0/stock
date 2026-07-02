// ═══════════════════════════════════════════════════════════
// طبقة الاتصال الموحدة بالـ Google Apps Script Web App
// ═══════════════════════════════════════════════════════════

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzZnl25Dvdn6StTIIIqWHTSRhiOeeCwd9udTAcipHzWp17VnAHWcyt-XhkAeUshA2RP/exec";

async function callGet(params) {
    const url = new URL(WEB_APP_URL);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    try {
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (err) {
        console.error('GET Error:', err);
        throw err;
    }
}

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
            return { ok: true };
        }
    } catch (err) {
        console.error('POST Error:', err);
        throw new Error('فشل الاتصال بالشيت');
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

// ── الكتابة ────────────────────────────────────────────────
export async function logReceipt(movement) {
    return callPost({ action: 'logReceipt', movement });
}

export async function logSettlement(movement) {
    return callPost({ action: 'logSettlement', movement });
}

// دوال إدارية (لو محتاجها)
export async function addProject(name, requesterEmail) {
    return callPost({ action: 'addProject', name, requesterEmail });
}
export async function addMaterial(phase, name, unit, requesterEmail) {
    return callPost({ action: 'addMaterial', phase, name, unit, requesterEmail });
}
export async function addSupplier(name, requesterEmail) {
    return callPost({ action: 'addSupplier', name, requesterEmail });
}
