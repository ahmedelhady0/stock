import { auth, showMessage, hideMessage, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getMovements } from './sheets-service.js';

let allInvoices = [];
let currentFilter = 'all';
let currentSupplier = '';

const invoiceList = document.getElementById('invoiceList');

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderInvoices();
    });
});

document.getElementById('supplierFilter').addEventListener('change', (e) => {
    currentSupplier = e.target.value;
    renderInvoices();
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '...';
    try {
        await loadInvoices(true);
        showMessage('✅ تم التحديث');
        setTimeout(() => hideMessage(), 1500);
    } catch (err) {
        showMessage('❌ ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⟳ تحديث';
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        await loadInvoices();
    } catch (err) {
        invoiceList.innerHTML = `<p class="text-red-500 text-center mt-8">تعذر تحميل البيانات: ${err.message}</p>`;
    }
});

function toNum(v) {
    return parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
}

function loadInvoices(forceRefresh = false) {
    return getMovements(null, forceRefresh).then(movements => {
        const groups = {};
        const noInvoice = [];

        (movements || []).forEach(m => {
            const inv = String(m['رقم الفاتورة'] || '').trim();
            const project = String(m['المشروع'] || '');
            // الحركات من المستودع للتوزيع لاحقاً — مش جزء من فاتورة مورد مباشرة
            if (project === 'المستودع' && inv === '') return;

            if (!inv) { noInvoice.push(m); return; }

            if (!groups[inv]) groups[inv] = {
                invoice: inv,
                supplier: '',
                items: [],
                total: 0,
                closedAmt: 0
            };

            const g = groups[inv];
            const supplier = String(m['وجهة الاستلام / الإرجاع'] || '').trim();
            if (supplier && g.supplier && g.supplier !== supplier) g.supplier += ' / ' + supplier;
            else if (supplier) g.supplier = supplier;

            const qtyIn = toNum(m['وارد (استلام)']);
            const qtyOut = toNum(m['مصروف على المشروع']);
            const retStore = toNum(m['مرتجع للمستودع']);
            const retSupplier = toNum(m['مرتجع للمورد']);
            const amount = toNum(m['اجمالي المبالغ المصروفه مع ضريبة']);
            const amountNoTax = toNum(m['اجمالي المبالغ المصروفه بدون ضريبة']);

            const balance = qtyIn - qtyOut - retStore - retSupplier;
            const closed = balance <= 0.0001; // اتسلم بالكامل اتصرّف/ارتجع بالكامل

            g.items.push({ m, qtyIn, qtyOut, retStore, retSupplier, amount, amountNoTax, balance, closed });
            g.total += amount;
            if (closed) g.closedAmt += amount;
        });

        allInvoices = Object.values(groups).sort((a, b) => a.invoice.localeCompare(b.invoice));
        populateSuppliers();
        renderInvoices();

        // إشعار بتحركات من غير رقم فاتورة
        if (noInvoice.length > 0) {
            const div = document.createElement('div');
            div.className = 'bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold p-3 rounded-xl mb-4 text-center';
            div.textContent = `⚠️ فيه ${noInvoice.length} حركة بدون رقم فاتورة — مش متضمنة في المطابقة. صيّرها من سجل الحركة.`;
            invoiceList.prepend(div);
        }
    });
}

function populateSuppliers() {
    const set = new Set();
    allInvoices.forEach(g => {
        g.supplier.split(' / ').filter(Boolean).forEach(s => set.add(s));
    });
    const sel = document.getElementById('supplierFilter');
    const current = sel.value;
    sel.innerHTML = '<option value="">كل الموردين</option>';
    [...set].sort().forEach(s => {
        sel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    if (current) sel.value = current;
}

function renderInvoices() {
    let filtered = allInvoices;
    if (currentFilter === 'closed') filtered = filtered.filter(g => (g.total - g.closedAmt) <= 0.0001);
    if (currentFilter === 'open') filtered = filtered.filter(g => (g.total - g.closedAmt) > 0.0001);
    if (currentSupplier) filtered = filtered.filter(g => g.supplier.split(' / ').includes(currentSupplier));

    const closedCount = allInvoices.filter(g => (g.total - g.closedAmt) <= 0.0001).length;
    const openCount = allInvoices.length - closedCount;
    const remainingTotal = allInvoices.reduce((s, g) => s + (g.total - g.closedAmt), 0);

    document.getElementById('statClosed').textContent = closedCount;
    document.getElementById('statOpen').textContent = openCount;
    document.getElementById('statRemaining').textContent = remainingTotal.toFixed(2);

    if (filtered.length === 0) {
        invoiceList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-4">لا توجد فواتير مطابقة</p>';
        return;
    }

    invoiceList.innerHTML = '';
    filtered.forEach(g => {
        const remaining = g.total - g.closedAmt;
        const isClosed = remaining <= 0.0001;

        const card = document.createElement('div');
        card.className = 'invoice-item bg-white';
        card.innerHTML = `
            <div class="invoice-header-pad" role="button" tabindex="0">
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-base font-bold" style="color:#6B2D8B;">فاتورة رقم: ${g.invoice}</span>
                        ${isClosed
                            ? '<span class="text-xs font-bold text-white px-2 py-0.5 rounded-full" style="background:#4CAF50;">✓ مقفولة</span>'
                            : `<span class="text-xs font-bold text-white px-2 py-0.5 rounded-full" style="background:#F59E0B;">✗ باقي ${remaining.toFixed(2)} ر.س</span>`}
                    </div>
                    <p class="text-xs text-gray-500 mt-1">المورد: ${g.supplier || 'غير محدد'} • الأصناف: ${g.items.length} • القيمة: <span class="font-bold">${g.total.toFixed(2)}</span> ر.س</p>
                </div>
                <span class="text-gray-400 text-sm">▼</span>
            </div>
            <div class="invoice-body hidden">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-gray-500">
                            <th class="text-right pb-2 font-semibold">التاريخ</th>
                            <th class="text-right pb-2 font-semibold">المشروع</th>
                            <th class="text-right pb-2 font-semibold">المادة</th>
                            <th class="text-center pb-2 font-semibold">الكمية</th>
                            <th class="text-center pb-2 font-semibold">مصروف</th>
                            <th class="text-center pb-2 font-semibold">المبلغ (مع ضريبة)</th>
                            <th class="text-center pb-2 font-semibold">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${g.items.map(it => `
                            <tr class="border-t border-gray-100">
                                <td class="py-1.5">${formatDate(it.m['التاريخ'])}</td>
                                <td class="py-1.5">${it.m['المشروع'] || ''}</td>
                                <td class="py-1.5">${it.m['المادة'] || ''}</td>
                                <td class="py-1.5 text-center">${it.qtyIn} ${it.m['الوحدة'] || ''}</td>
                                <td class="py-1.5 text-center">${it.qtyOut}</td>
                                <td class="py-1.5 text-center font-bold">${it.amount.toFixed(2)}</td>
                                <td class="py-1.5 text-center">
                                    ${it.closed
                                        ? '<span class="text-xs font-bold" style="color:#4CAF50;">✓ مصروف بالكامل</span>'
                                        : `<span class="text-xs font-bold" style="color:#E53935;">✗ باقي ${it.balance.toFixed(2)} ${it.m['الوحدة'] || ''}</span>`}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const header = card.querySelector('.invoice-header-pad');
        const body = card.querySelector('.invoice-body');
        const toggle = () => {
            body.classList.toggle('hidden');
            header.querySelector('span:last-child').textContent = body.classList.contains('hidden') ? '▼' : '▲';
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

        invoiceList.appendChild(card);
    });
}

document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);
