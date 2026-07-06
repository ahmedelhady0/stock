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
    // registerUser مش لازم يـ throw لو فشل — الحساب Firebase شغال على أي حال
    if (parsed && parsed.ok === false && body.action !== 'registerUser') {
        throw new Error(parsed.error || 'فشل الطلب');
    }
    return parsed;
}
// ── القراءة ────────────────────────────────────────────────
export async function getSetupData() {
    return callGet({ action: 'getSetupData' });
}

export async function getMovements(email = null) {
    const data = await callGet({ action: 'getMovements', email });
    return data.movements || [];
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

// ── الكتابة ────────────────────────────────────────────────
export async function logReceipt(movement) {
    return callPost({ action: 'logReceipt', movement });
}

export async function registerUser(userData) {
    return callPost({ action: 'registerUser', ...userData });
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

export async function submitSettlementRequest(data) {
    return callPost({ action: 'submitSettlementRequest', ...data });
}

export async function approveSettlementRequest(id, reviewedBy, engineerNotes) {
    return callPost({ action: 'approveSettlementRequest', id, reviewedBy, engineerNotes });
}

export async function rejectSettlementRequest(id, reviewedBy, engineerNotes) {
    return callPost({ action: 'rejectSettlementRequest', id, reviewedBy, engineerNotes });
}

export async function submitEditRequest(data) {
    return callPost({ action: 'submitEditRequest', ...data });
}

export async function approveEditRequest(id, reviewedBy, engineerNotes) {
    return callPost({ action: 'approveEditRequest', id, reviewedBy, engineerNotes });
}

export async function rejectEditRequest(id, reviewedBy, engineerNotes) {
    return callPost({ action: 'rejectEditRequest', id, reviewedBy, engineerNotes });
}
export async function getAllRequestsLog() {
    const data = await callGet({ action: 'getAllRequestsLog' });
    return data.log || [];
}
export async function getUsers() {
    const data = await callGet({ action: 'getUsers' });
    return data.users || [];
}

export async function toggleUserStatus(targetEmail, newStatus, requesterEmail) {
    return callPost({ action: 'toggleUserStatus', targetEmail, newStatus, requesterEmail });
}
