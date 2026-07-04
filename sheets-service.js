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
// أضفها مع الدوال الأخرى
export async function registerUser(userData) {
    return callPost({ action: 'registerUser', ...userData });
}


// دالة جلب وعرض الحركات
async function loadRecentMovements() {
    const container = document.getElementById('recentMovements');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500 text-sm">جاري تحميل البيانات...</p>';

    try {
        const response = await fetch(WEB_APP_URL);
        const data = await response.json();

        // التأكد من وجود بيانات (تخطي العناوين)
        if (!data || data.length <= 1) {
            container.innerHTML = '<p class="text-center text-gray-500 text-sm">لا توجد حركات مسجلة</p>';
            return;
        }

        // عرض آخر 5 حركات (نعكس الترتيب لنظهر الأحدث)
        container.innerHTML = '';
        const recentItems = data.slice(1).slice(-5).reverse();

        recentItems.forEach(m => {
            // توزيع الأعمدة: 
            // m[3]=المشروع, m[5]=المادة, m[6]=الكمية
            const card = document.createElement('div');
            card.className = "p-4 border-b border-gray-100 hover:bg-gray-50 transition";
            card.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-gray-800 text-sm">${m[5] || '---'}</span>
                    <span class="text-purple-700 font-bold text-sm">${m[6] || '0'}</span>
                </div>
                <div class="text-xs text-gray-400">${m[3] || 'بدون مشروع'}</div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("خطأ في الاتصال:", error);
        container.innerHTML = '<p class="text-center text-red-500 text-sm">فشل تحميل الحركات. تأكد من إعدادات الـ Deploy.</p>';
    }
}

// تشغيل الدالة فور تحميل الصفحة
window.onload = loadRecentMovements;
