// ═══════════════════════════════════════════════════════════
// صفحة العهدة — المشرف يسجل صرف، والمهندس يدير الإيداعات
// ═══════════════════════════════════════════════════════════
import { auth, showMessage, hideMessage, todayStr, formatDate } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getUserRole, getSetupData, getUsers, getAdvanceMovements, logAdvanceExpense, depositAdvance } from './sheets-service.js';

const adminSection = document.getElementById('adminSection');
const summarySection = document.getElementById('summarySection');
const printArea = document.getElementById('printArea');
const supervisorSelect = document.getElementById('supervisorSelect');
const expenseProject = document.getElementById('expenseProject');
const filterProject = document.getElementById('filterProject');
const movementsList = document.getElementById('movementsList');
const movementsEmpty = document.getElementById('movementsEmpty');
const logTotals = document.getElementById('logTotals');
document.getElementById('closeMessageBtn')?.addEventListener('click', hideMessage);

let currentEmail = null;
let currentUsername = null;
let isAdmin = false;
let projects = [];
let allMovements = [];

document.getElementById('expenseDate').value = todayStr();

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentEmail = user.email;
    currentUsername = user.email.replace('@slabet.app', '');

    try {
        const info = await getUserRole(user.email);
        isAdmin = info.role === 'admin';
    } catch (err) {
        console.error(err);
    }

    if (isAdmin) {
        adminSection.classList.remove('hidden');
        await loadSupervisors();
        supervisorSelect.addEventListener('change', loadMovements);
    } else {
        adminSection.classList.add('hidden');
        await loadMovements();
    }

    await loadProjects();
    const expenseForm = document.getElementById('expenseForm');
    expenseForm.addEventListener('submit', handleExpenseSubmit);
    document.getElementById('depositForm').addEventListener('submit', handleDepositSubmit);
    document.getElementById('filterFrom').addEventListener('input', renderMovements);
    document.getElementById('filterTo').addEventListener('input', renderMovements);
    filterProject.addEventListener('change', renderMovements);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
});

async function loadSupervisors() {
    try {
        const users = await getUsers();
        const supervisors = users.filter(u => u.role !== 'admin' && String(u.status || '').trim() !== 'غير نشط');
        supervisorSelect.innerHTML = '<option value="">— اختر المشرف —</option>' +
            supervisors.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
    } catch (err) {
        console.error(err);
        showMessage('فشل تحميل المشرفين: ' + err.message);
    }
}

async function loadProjects() {
    try {
        const data = await getSetupData();
        projects = data.projects || [];
        const options = '<option value="">بدون مشروع</option>' +
            projects.map(p => `<option value="${p}">${p}</option>`).join('');
        expenseProject.innerHTML = options;
        filterProject.innerHTML = '<option value="">الكل</option>' + options;
    } catch (err) {
        console.error(err);
    }
}

async function loadMovements() {
    const supervisor = isAdmin ? supervisorSelect.value : currentUsername;
    if (!supervisor) return;
    try {
        allMovements = await getAdvanceMovements(supervisor);
        renderMovements();
    } catch (err) {
        console.error(err);
        showMessage('فشل تحميل سجل العهدة: ' + err.message);
    }
}

function renderMovements() {
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    const project = filterProject.value;

    let list = [...allMovements].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (from) list = list.filter(m => new Date(m.date) >= new Date(from));
    if (to) list = list.filter(m => new Date(m.date) <= new Date(to));
    if (project) list = list.filter(m => m.project === project);

    const totals = {
        deposit: 0,
        expense: 0
    };
    allMovements.forEach(m => {
        if (m.type === 'إيداع عهدة') totals.deposit += Number(m.amount) || 0;
        else totals.expense += Number(m.amount) || 0;
    });
    const remaining = totals.deposit - totals.expense;

    document.getElementById('totalDeposit').textContent = totals.deposit.toLocaleString('ar-EG') + ' ر.س';
    document.getElementById('totalExpense').textContent = totals.expense.toLocaleString('ar-EG') + ' ر.س';
    const remainingEl = document.getElementById('remaining');
    remainingEl.textContent = remaining.toLocaleString('ar-EG') + ' ر.س';
    remainingEl.className = 'text-xl font-bold ' + (remaining < 0 ? 'text-red-600' : 'text-emerald-600');
    document.getElementById('negativeAlert').classList.toggle('hidden', remaining >= 0);
    summarySection.classList.remove('hidden');
    printArea.classList.remove('hidden');
    document.getElementById('printTitle').classList.remove('hidden');
    document.getElementById('printHeader').classList.remove('hidden');
    document.getElementById('printName').textContent = isAdmin ? supervisorSelect.value : currentUsername;

    movementsList.innerHTML = '';
    const isDeposit = m => m.type === 'إيداع عهدة';
    const filtered = list;
    filtered.forEach(m => {
        const row = document.createElement('tr');
        row.className = 'border-b last:border-0';
        const amt = Number(m.amount) || 0;
        row.innerHTML = `
            <td class="py-2 px-2 whitespace-nowrap">${formatDate(m.date)}</td>
            <td class="py-2 px-2">${m.project || '-'}</td>
            <td class="py-2 px-2">${m.description || '-'}</td>
            <td class="py-2 px-2">${m.invoice || '-'}</td>
            <td class="py-2 px-2 text-left font-semibold ${isDeposit(m) ? 'text-emerald-600' : 'text-red-600'}">${isDeposit(m) ? '+' : '−'} ${amt.toLocaleString('ar-EG')}</td>
        `;
        movementsList.appendChild(row);
    });
    movementsEmpty.classList.toggle('hidden', filtered.length > 0);

    const shownExpense = filtered.filter(m => !isDeposit(m)).reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const shownDeposit = filtered.filter(isDeposit).reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const hasFilter = from || to || project;
    if (hasFilter) {
        logTotals.classList.remove('hidden');
        logTotals.innerHTML = `
            <p class="text-sm text-gray-600">إيداعات في العرض: <b class="text-emerald-600">${shownDeposit.toLocaleString('ar-EG')}</b>
            &nbsp;|&nbsp; مصروف في العرض: <b class="text-red-600">${shownExpense.toLocaleString('ar-EG')}</b></p>`;
    } else {
        logTotals.classList.add('hidden');
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const amount = document.getElementById('expenseAmount').value;
    const invoice = document.getElementById('expenseInvoice').value.trim();
    const project = expenseProject.value;
    const description = document.getElementById('expenseDesc').value.trim();
    const date = document.getElementById('expenseDate').value;
    if (!amount || Number(amount) <= 0) { showMessage('⚠️ أدخل مبلغ صحيح'); return; }
    if (!description) { showMessage('⚠️ أدخل الوصف'); return; }
    if (!confirm(`تسجيل صرف ${amount} ر.س ${description ? '— ' + description : ''}؟`)) return;
    try {
        await logAdvanceExpense({
            date, amount: Number(amount), invoice, project, description,
            supervisor: currentUsername, recordedBy: currentEmail
        });
        showMessage('✅ تم تسجيل الصرف');
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseInvoice').value = '';
        document.getElementById('expenseDesc').value = '';
        expenseProject.value = '';
        setTimeout(() => hideMessage(), 1200);
        await loadMovements();
    } catch (err) {
        showMessage('❌ فشل الحفظ: ' + err.message);
    }
}

async function handleDepositSubmit(e) {
    e.preventDefault();
    const target = supervisorSelect.value;
    const amount = document.getElementById('depositAmount').value;
    const description = document.getElementById('depositDesc').value.trim();
    if (!target) { showMessage('⚠️ اختر المشرف أولاً'); return; }
    if (!amount || Number(amount) <= 0) { showMessage('⚠️ أدخل مبلغ صحيح'); return; }
    if (!confirm(`إيداع ${amount} ر.س في عهدة "${target}"؟`)) return;
    try {
        await depositAdvance({
            date: todayStr(), amount: Number(amount), description,
            supervisor: target, recordedBy: currentEmail
        });
        showMessage('✅ تم الإيداع بنجاح');
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositDesc').value = '';
        setTimeout(() => hideMessage(), 1200);
        await loadMovements();
    } catch (err) {
        showMessage('❌ فشل الإيداع: ' + err.message);
    }
}
