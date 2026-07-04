// ═══════════════════════════════════════════════════════════
// طبقة الاتصال الموحدة بالـ Google Apps Script Web App
// ═══════════════════════════════════════════════════════════

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzZnl25Dvdn6StTIIIqWHTSRhiOeeCwd9udTAcipHzWp17VnAHWcyt-XhkAeUshA2RP/exec";

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
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { ok: true };
    }
}

// ── القراءة ────────────────────────────────────────────────
export async function getSetupData() {
    return callGet({ action: 'getSetupData' });
}

export async function getMovements() {
    const data = await callGet({ action: 'getMovements' });
    return data.movements || [];
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

export async function registerUser(userData) {
    return callPost({ action: 'registerUser', ...userData });
}
