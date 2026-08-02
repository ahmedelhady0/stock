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
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = { ok: true }; }
    if (parsed && parsed.ok === false) throw new Error(parsed.error || 'فشل الطلب');
    return parsed;
}

// ── كاش محلي (localStorage) ─────────────────────────────
function cacheGet(key, ttlMs, fetcher) {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < ttlMs) return Promise.resolve(data);
        }
    } catch (_) {}
    return fetcher().then(data => {
        try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
        return data;
    });
}

function bustCache(key) {
    try { localStorage.removeItem(key); } catch (_) {}
}

// ── القراءة ────────────────────────────────────────────────
export async function getSetupData(forceRefresh = false) {
    if (forceRefresh) bustCache('cache_setup');
    return cacheGet('cache_setup', 5 * 60 * 1000, () => callGet({ action: 'getSetupData' }));
}

export async function getMovements(email = null, forceRefresh = false) {
    const cacheKey = 'cache_movements_' + (email || 'all');
    if (forceRefresh) bustCache(cacheKey);
    return cacheGet(cacheKey, 5 * 60 * 1000, () =>
        callGet({ action: 'getMovements', email }).then(d => d.movements || [])
    );
}

export async function getUserRole(email) {
    return callGet({ action: 'getUserRole', email });
}

export async function getUsers() {
    const data = await callGet({ action: 'getUsers' });
    return data.users || [];
}

export async function getSettlementRequests(status = null) {
    const data = await callGet({ action: 'getSettlementRequests', status });
    return data.requests || [];
}

export async function getEditRequests(status = null) {
    const data = await callGet({ action: 'getEditRequests', status });
    return data.requests || [];
}

export async function getAllRequestsLog() {
    const data = await callGet({ action: 'getAllRequestsLog' });
    return data.log || [];
}

// ── تنظيف الكاش ──────────────────────────────────────────
export function clearCache() {
    try {
        localStorage.removeItem('cache_setup');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_movements_')) localStorage.removeItem(key);
        }
    } catch (_) {}
}

// ── الكتابة ────────────────────────────────────────────────
export async function logReceipt(movement) {
    const r = await callPost({ action: 'logReceipt', movement });
    clearCache();
    return r;
}

export async function registerUser(userData) {
    return callPost({ action: 'registerUser', ...userData });
}

export async function addProject(name, requesterEmail) {
    const r = await callPost({ action: 'addProject', name, requesterEmail });
    clearCache();
    return r;
}

export async function addMaterial(phase, name, unit, requesterEmail) {
    const r = await callPost({ action: 'addMaterial', phase, name, unit, requesterEmail });
    clearCache();
    return r;
}

export async function addSupplier(name, requesterEmail) {
    const r = await callPost({ action: 'addSupplier', name, requesterEmail });
    clearCache();
    return r;
}

export async function promoteUser(targetEmail, requesterEmail) {
    return callPost({ action: 'promoteUser', targetEmail, requesterEmail });
}

export async function toggleUserStatus(targetEmail, newStatus, requesterEmail) {
    return callPost({ action: 'toggleUserStatus', targetEmail, newStatus, requesterEmail });
}

export async function submitSettlementRequest(data) {
    const r = await callPost({ action: 'submitSettlementRequest', ...data });
    clearCache();
    return r;
}

export async function approveSettlementRequest(id, reviewedBy, engineerNotes) {
    const r = await callPost({ action: 'approveSettlementRequest', id, reviewedBy, engineerNotes });
    clearCache();
    return r;
}

export async function rejectSettlementRequest(id, reviewedBy, engineerNotes) {
    const r = await callPost({ action: 'rejectSettlementRequest', id, reviewedBy, engineerNotes });
    clearCache();
    return r;
}

export async function submitEditRequest(data) {
    const r = await callPost({ action: 'submitEditRequest', ...data });
    clearCache();
    return r;
}

export async function approveEditRequest(id, reviewedBy, engineerNotes) {
    const r = await callPost({ action: 'approveEditRequest', id, reviewedBy, engineerNotes });
    clearCache();
    return r;
}

export async function rejectEditRequest(id, reviewedBy, engineerNotes) {
    const r = await callPost({ action: 'rejectEditRequest', id, reviewedBy, engineerNotes });
    clearCache();
    return r;
}
