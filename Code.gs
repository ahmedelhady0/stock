/**
 * =============================================
 * نظام مخزن شركة العزل - Code.gs النهائي المدموج
 * =============================================
 */

const SHEET_NAMES = {
  projects: 'بيانات المشاريع',
  materials: 'المواد',
  suppliers: 'الموردين',
  movements: 'سجل_الحركة',
  users: 'Users',
  settlementRequests: 'طلبات التسوية',
  editRequests: 'طلبات التعديل'
};

// ⚠️ إيميلات المهندسين اللي هيوصلهم التنبيه
const ENGINEER_EMAILS = ['ahmedelhady007@gmail.com', 'Amj20011@hotmail.com'];
const SITE_URL = 'https://slabet.vercel.app';

// ── دوال مساعدة عامة ─────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function normalizeHeader(h) {
  return String(h).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function getHeaderRowIndex(sheet) {
  const values = sheet.getDataRange().getValues();
  for (let i = 0; i < Math.min(5, values.length); i++) {
    if (String(values[i][0]).trim() === 'ID') return i;
  }
  return 0;
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headerIdx = getHeaderRowIndex(sheet);
  const headers = values[headerIdx].map(normalizeHeader);
  return values.slice(headerIdx + 1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

function getNormalizedHeaders(sheet) {
  const headerIdx = getHeaderRowIndex(sheet);
  const raw = sheet.getRange(headerIdx + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return raw.map(normalizeHeader);
}

function findRow(sheet, id, material) {
  const data = sheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(sheet);
  const headers = data[headerIdx].map(normalizeHeader);
  const matCol = headers.indexOf('المادة');

  for (let i = headerIdx + 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      if (!material || String(data[i][matCol]) === String(material)) return i + 1;
    }
  }
  return -1;
}

function findRequestRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(sheet);
  for (let i = headerIdx + 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function getCellByName(sheet, row, headers, colName) {
  const idx = headers.indexOf(colName);
  if (idx === -1) return '';
  return sheet.getRange(row, idx + 1).getValue();
}

function setCellByName(sheet, row, headers, colName, value) {
  const idx = headers.indexOf(colName);
  if (idx !== -1) sheet.getRange(row, idx + 1).setValue(value);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── إرسال إيميل تنبيه (يبعت لكل الإيميلات في المصفوفة) ─────────────────
function notifyEngineer(subject, bodyText) {
  try {
    if (!ENGINEER_EMAILS || ENGINEER_EMAILS.length === 0) return;
    const validEmails = ENGINEER_EMAILS.filter(e => e && e.indexOf('@') !== -1);
    if (validEmails.length === 0) return;
    MailApp.sendEmail({
      to: validEmails.join(','),
      subject: subject,
      body: bodyText
    });
  } catch (err) {
    console.log('Email error:', err.message);
  }
}

function getOrCreateUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.users);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.users);
    sheet.appendRow(['uid', 'username', 'email', 'role', 'تاريخ الإنشاء', 'الحالة']);
  }
  return sheet;
}

function getOrCreateSettlementRequestsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.settlementRequests);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.settlementRequests);
    sheet.appendRow([
      'ID', 'معرف الحركة', 'المادة', 'متبقي في العربية', 'مرتجع للمستودع',
      'مرتجع للمورد', 'ملاحظات المشرف', 'مقدم الطلب', 'الحالة', 'تاريخ الطلب',
      'راجعها', 'تاريخ المراجعة', 'ملاحظات المهندس'
    ]);
  }
  return sheet;
}

function getOrCreateEditRequestsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.editRequests);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.editRequests);
    sheet.appendRow([
      'ID', 'معرف الحركة', 'المادة', 'المشروع', 'الكمية السابقة', 'الكمية الجديدة',
      'الوجهة الجديدة', 'الملاحظات الجديدة', 'مقدم الطلب', 'الحالة', 'تاريخ الطلب',
      'راجعها', 'تاريخ المراجعة', 'ملاحظات المهندس'
    ]);
  }
  return sheet;
}

// ── الدوال القديمة المفيدة ─────────────────────
function GET_STAGE_COST(projectName, phaseName) {
  if (!projectName || !phaseName) return 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("سجل_الحركة");
  var priceSheet = ss.getSheetByName("دليل_الأسعار");

  var priceData = priceSheet.getRange(2, 1, priceSheet.getLastRow() - 1, 4).getValues();
  var prices = {};
  priceData.forEach(r => { prices[r[2]] = r[3]; });

  var logData = logSheet.getDataRange().getValues();
  var totalCost = 0;
  for (var j = 1; j < logData.length; j++) {
    if (logData[j][2] == projectName && logData[j][3] == phaseName) {
      totalCost += (parseFloat(logData[j][7]) || 0) * (prices[logData[j][4]] || 0);
    }
  }
  return totalCost;
}

// ====================== القراءة (GET) ======================
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getSetupData') return handleGetSetupData(e);
    if (action === 'getMovements') return handleGetMovements(e);
    if (action === 'getUserRole') return handleGetUserRole(e);
    if (action === 'getUsers') return handleGetUsers();
    if (action === 'getSettlementRequests') return handleGetSettlementRequests(e);
    if (action === 'getEditRequests') return handleGetEditRequests(e);
    if (action === 'getAllRequestsLog') return handleGetAllRequestsLog(e);
    if (action === 'getAdvanceMovements') return handleGetAdvanceMovements(e);

    return jsonResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function handleGetSetupData(e) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'setupData_v1';

  // لو جالي طلب تحديث يدوي، امسح الكاش وجيب جديد من الشيت
  if (e.parameter && e.parameter.refresh) cache.remove(cacheKey);

  const cached = cache.get(cacheKey);
  if (cached) return jsonResponse(JSON.parse(cached));

    let projects = [], projectDates = {}, materials = [], suppliers = [];

  try {
    const projData = sheetToObjects(getSheet(SHEET_NAMES.projects));
    const newestDate = {}; // اسم المشروع -> أحدث تاريخ
    projData.forEach(p => {
      const name = String(p['اسم المشروع'] || '').trim();
      if (!name || !String(p['الحالة'] || '').trim().includes('شغال')) return;
      const d = p['تاريخ الإضافة'] ? new Date(p['تاريخ الإضافة']) : null;
      if (d && (!newestDate[name] || d > newestDate[name])) newestDate[name] = d;
    });
    projects = Object.keys(newestDate);
    Object.entries(newestDate).forEach(([k, v]) => { projectDates[k] = v.getTime(); });
  } catch (err) { console.log('Projects Error:', err.message); }

  try {
    const matData = sheetToObjects(getSheet(SHEET_NAMES.materials));
    materials = matData.map(row => ({
      phase: String(row['اسم مختصر للبند'] || '').trim(),
      name: String(row['المواد المستخدمة'] || '').trim(),
      unit: String(row['الوحدة'] || '').trim()
    })).filter(m => m.name && m.phase);
  } catch (err) { console.log('Materials Error:', err.message); }

  try {
    suppliers = sheetToObjects(getSheet(SHEET_NAMES.suppliers))
      .map(s => String(s['اسم المورد'] || '').trim()).filter(Boolean);
  } catch (err) { console.log('Suppliers Error:', err.message); }

    const result = { projects, projectDates, materials, suppliers };
  cache.put(cacheKey, JSON.stringify(result), 30);
  return jsonResponse(result);
}

function handleGetMovements(e) {
  let movements = sheetToObjects(getSheet(SHEET_NAMES.movements));
  movements.sort((a, b) => new Date(b['التاريخ'] || 0) - new Date(a['التاريخ'] || 0));

  const email = e.parameter.email;
  if (email && email !== 'null' && email !== 'undefined') {
    const username = email.split('@')[0].toLowerCase();
    movements = movements.filter(m =>
      String(m['المقاول / العمالة'] || '').trim().toLowerCase() === username
    );
  }
  return jsonResponse({ movements });
}

function handleGetUserRole(e) {
  const email = e.parameter.email;
  const username = email ? email.split('@')[0].toLowerCase() : '';

  if (username === 'admin') return jsonResponse({ role: 'admin', username, active: true });

  try {
    const users = sheetToObjects(getOrCreateUsersSheet());
    const found = users.find(u => String(u['email'] || '').toLowerCase() === String(email || '').toLowerCase());

    if (!found) {
      return jsonResponse({ role: 'blocked', username, active: false, reason: 'not_registered' });
    }

    const status = String(found['الحالة'] || '').trim();
    if (status !== 'نشط') {
      return jsonResponse({ role: 'blocked', username, active: false, reason: 'inactive' });
    }

    return jsonResponse({ role: found['role'] || 'supervisor', username, active: true });
  } catch (err) {
    console.log('getUserRole error:', err.message);
  }

  return jsonResponse({ role: 'supervisor', username, active: true });
}

function handleGetUsers() {
  const users = sheetToObjects(getOrCreateUsersSheet());
  return jsonResponse({
    users: users.map(u => ({
      uid: u['uid'],
      username: u['username'],
      email: u['email'],
      role: u['role'] || 'supervisor',
      status: u['الحالة'] || 'نشط'
    }))
  });
}

function handleGetSettlementRequests(e) {
  let requests = sheetToObjects(getOrCreateSettlementRequestsSheet());
  requests.sort((a, b) => new Date(b['تاريخ الطلب'] || 0) - new Date(a['تاريخ الطلب'] || 0));

  const status = e.parameter.status;
  if (status) {
    requests = requests.filter(r => String(r['الحالة'] || '').trim().indexOf(status.trim()) !== -1);
  }
  return jsonResponse({ requests });
}

function handleGetEditRequests(e) {
  let requests = sheetToObjects(getOrCreateEditRequestsSheet());
  requests.sort((a, b) => new Date(b['تاريخ الطلب'] || 0) - new Date(a['تاريخ الطلب'] || 0));

  const status = e.parameter.status;
  if (status) {
    requests = requests.filter(r => String(r['الحالة'] || '').trim().indexOf(status.trim()) !== -1);
  }
  return jsonResponse({ requests });
}

function handleGetAllRequestsLog(e) {
  const settlements = sheetToObjects(getOrCreateSettlementRequestsSheet())
    .filter(r => String(r['الحالة'] || '').trim() !== 'قيد الموافقة')
    .map(r => ({
      type: 'تسوية',
      id: r['ID'],
      material: r['المادة'],
      requestedBy: r['مقدم الطلب'],
      status: r['الحالة'],
      requestDate: r['تاريخ الطلب'],
      reviewedBy: r['راجعها'],
      reviewDate: r['تاريخ المراجعة'],
      engineerNotes: r['ملاحظات المهندس'],
      details: `متبقي: ${r['متبقي في العربية'] || 0} | مرتجع مستودع: ${r['مرتجع للمستودع'] || 0} | مرتجع مورد: ${r['مرتجع للمورد'] || 0}`
    }));

  const edits = sheetToObjects(getOrCreateEditRequestsSheet())
    .filter(r => String(r['الحالة'] || '').trim() !== 'قيد الموافقة')
    .map(r => ({
      type: 'تعديل',
      id: r['ID'],
      material: r['المادة'],
      requestedBy: r['مقدم الطلب'],
      status: r['الحالة'],
      requestDate: r['تاريخ الطلب'],
      reviewedBy: r['راجعها'],
      reviewDate: r['تاريخ المراجعة'],
      engineerNotes: r['ملاحظات المهندس'],
      details: `الكمية: ${r['الكمية السابقة'] || 0} ← ${r['الكمية الجديدة'] || 0} | المشروع: ${r['المشروع'] || ''}`
    }));

  const all = [...settlements, ...edits].sort((a, b) => new Date(b.reviewDate || 0) - new Date(a.reviewDate || 0));
  return jsonResponse({ log: all });
}

// ====================== الكتابة (POST) ======================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'logReceipt') return handleLogReceipt(body);
    if (action === 'registerUser') return handleRegisterUser(body);
    if (action === 'addProject') return handleAddProject(body);
    if (action === 'addMaterial') return handleAddMaterial(body);
    if (action === 'addSupplier') return handleAddSupplier(body);
    if (action === 'promoteUser') return handlePromoteUser(body);
    if (action === 'toggleUserStatus') return handleToggleUserStatus(body);
    if (action === 'submitSettlementRequest') return handleSubmitSettlementRequest(body);
    if (action === 'approveSettlementRequest') return handleApproveSettlementRequest(body);
    if (action === 'rejectSettlementRequest') return handleRejectSettlementRequest(body);
    if (action === 'submitEditRequest') return handleSubmitEditRequest(body);
    if (action === 'approveEditRequest') return handleApproveEditRequest(body);
    if (action === 'rejectEditRequest') return handleRejectEditRequest(body);
    if (action === 'uploadInvoiceImage') return handleUploadInvoiceImage(body);
    if (action === 'logAdvanceExpense') return handleLogAdvanceExpense(body);
    if (action === 'depositAdvance') return handleDepositAdvance(body);
    if (action === 'generateWafeqEntry') return handleGenerateWafeqEntry(body);
    if (action === 'getWafeqGenerated') return handleGetWafeqGenerated(body);

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function handleLogReceipt(body) {
  const m = body.movement;
  const id = m.id || ('REC-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random()*1000));

  const qty = parseFloat(m.quantity) || 0;
  const movementType = String(m.movementType || '').trim();
  let received = 0, consumed = 0, retStore = 0, retSupplier = 0, typeLabel = 'استلام';

  const movSheet = getSheet(SHEET_NAMES.movements);
  const movData = movSheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(movSheet);
  const headers = movData[headerIdx].map(normalizeHeader);

  // خريطة أعمدة حسب الأسماء (أي ترتيب في الشيت)
  const col = {
    id:        0,
    proj:      headers.indexOf('المشروع'),
    phase:     headers.indexOf('المرحلة'),
    mat:       headers.indexOf('المادة'),
    unit:      headers.indexOf('الوحدة'),
    received:  headers.indexOf('وارد (استلام)'),
    consumed:  headers.indexOf('مصروف على المشروع'),
    remaining: headers.indexOf('متبقي في العربية'),
    retStore:  headers.indexOf('مرتجع للمستودع'),
    retSup:    headers.indexOf('مرتجع للمورد'),
    supplier:  headers.indexOf('وجهة الاستلام / الإرجاع'),
    movType:   headers.indexOf('نوع الحركة'),
    contractor: headers.indexOf('المقاول / العمالة'),
    invoice:   headers.indexOf('رقم الفاتورة'),
    invoiceImg: headers.indexOf('صورة الفاتورة'),
    notes:     headers.indexOf('ملاحظات')
  };

  if (movementType === 'return' || movementType === 'return_to_supplier') {
    const origId = m.originalId || '';
    const project = String(m.project || '').trim();
    const material = String(m.material || '').trim();

    let foundRow = -1;
    for (let i = headerIdx + 1; i < movData.length; i++) {
      const rowId = String(movData[i][col.id] || '').trim();
      const rowMat = String(movData[i][col.mat] || '').trim();
      const rowProj = String(movData[i][col.proj] || '').trim();

      if (origId && rowId === origId && rowMat === material) { foundRow = i + 1; break; }
      if (!origId && rowProj === project && rowMat === material) { foundRow = i + 1; break; }
    }
    if (foundRow === -1) {
      return jsonResponse({ ok: false, error: 'لم يتم العثور على الحركة الأصلية للمرتجع' });
    }

    const rowReceived = parseFloat(movData[foundRow - 1][col.received]) || 0;
    const rowRetStore = parseFloat(movData[foundRow - 1][col.retStore]) || 0;
    const rowRetSup = parseFloat(movData[foundRow - 1][col.retSup]) || 0;
    const totalReturned = rowRetStore + rowRetSup + qty;

    if (totalReturned > rowReceived) {
      return jsonResponse({ ok: false, error: 'إجمالي المرتجع (' + totalReturned + ') أكبر من الكمية المستلمة (' + rowReceived + ')' });
    }

    const newConsumed = Math.max(0, rowReceived - totalReturned);
    if (movementType === 'return') {
      movSheet.getRange(foundRow, col.retStore + 1).setValue(rowRetStore + qty);
      movSheet.getRange(foundRow, col.consumed + 1).setValue(newConsumed);
    } else {
      movSheet.getRange(foundRow, col.retSup + 1).setValue(rowRetSup + qty);
      movSheet.getRange(foundRow, col.consumed + 1).setValue(newConsumed);
    }

    retStore = movementType === 'return' ? qty : 0;
    retSupplier = movementType === 'return_to_supplier' ? qty : 0;
    typeLabel = movementType === 'return' ? 'مرتجع مستودع' : 'مرتجع مورد';
  } else if (movementType === 'direct') {
    received = qty;
    consumed = qty;
    typeLabel = 'صرف مباشر';
  } else if (movementType === 'warehouse') {
    received = qty;
    typeLabel = 'وارد مستودع';
  } else {
    received = qty;
  }

  if (m.consumed !== undefined && parseFloat(m.consumed) > 0 && consumed === 0) {
    consumed = parseFloat(m.consumed);
  }

  // بناء الصف حسب أسماء الأعمدة - الملاحظات هتوصل صح أي ترتيب للشيت
  const row = [];
  for (let c = 0; c < headers.length; c++) row.push('');
  row[col.id]         = id;
  row[headers.indexOf('التاريخ')] = new Date();
  row[col.proj]       = m.project || '';
  row[col.phase]      = m.phase || '';
  row[col.mat]        = m.material || '';
  row[col.unit]       = m.unit || '';
  row[col.received]   = received;
  row[col.consumed]   = consumed;
  row[col.remaining]  = 0;
  row[col.retStore]   = retStore;
  row[col.retSup]     = retSupplier;
  row[col.supplier]   = m.supplier || 'مورد عام';
  row[col.movType]    = typeLabel;
  row[col.contractor] = m.contractor || '';
  row[col.invoice]    = m.invoice || '';
  row[col.invoiceImg] = m.invoiceImageUrl || '';
  row[col.notes]      = m.notes || '';

  movSheet.appendRow(row);
  return jsonResponse({ ok: true, type: movementType || 'receipt', id });
}
function handleRegisterUser(body) {
  const sheet = getOrCreateUsersSheet();
  const role = String(body.username || '').toLowerCase() === 'admin' ? 'admin' : 'supervisor';
  sheet.appendRow([body.uid || '', body.username || '', body.email || '', role, new Date(), 'نشط']);
  return jsonResponse({ ok: true, role });
}

function handleAddProject(body) {
  getSheet(SHEET_NAMES.projects).appendRow([body.name || '', '', 'شغالة', '', '', '', '', '', new Date()]);
  CacheService.getScriptCache().remove('setupData_v1');
  return jsonResponse({ ok: true });
}

function handleAddMaterial(body) {
  getSheet(SHEET_NAMES.materials).appendRow([body.phase || '', '', body.name || '', '', body.unit || '', '']);
  CacheService.getScriptCache().remove('setupData_v1');
  return jsonResponse({ ok: true });
}

function handleAddSupplier(body) {
  getSheet(SHEET_NAMES.suppliers).appendRow([body.name || '']);
  CacheService.getScriptCache().remove('setupData_v1');
  return jsonResponse({ ok: true });
}

function handlePromoteUser(body) {
  const sheet = getOrCreateUsersSheet();
  const headers = getNormalizedHeaders(sheet);
  const data = sheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(sheet);

  for (let i = headerIdx + 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === String(body.targetEmail || '').toLowerCase()) {
      setCellByName(sheet, i + 1, headers, 'role', 'admin');
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: 'المستخدم غير موجود' });
}

function handleToggleUserStatus(body) {
  const sheet = getOrCreateUsersSheet();
  const headers = getNormalizedHeaders(sheet);
  const data = sheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(sheet);

  for (let i = headerIdx + 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === String(body.targetEmail || '').toLowerCase()) {
      setCellByName(sheet, i + 1, headers, 'الحالة', body.newStatus || 'نشط');
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: 'المستخدم غير موجود' });
}

// ── طلبات التسوية ─────────────────
function handleSubmitSettlementRequest(body) {
  const sheet = getOrCreateSettlementRequestsSheet();

  const existing = sheetToObjects(sheet);
  const dup = existing.find(r =>
    String(r['معرف الحركة']) === String(body.movementId) &&
    String(r['المادة']) === String(body.material) &&
    String(r['الحالة']).trim() === 'قيد الموافقة'
  );
  if (dup) return jsonResponse({ ok: false, error: 'يوجد طلب تسوية سابق قيد الموافقة لهذه المادة بالفعل' });

  const id = 'SET-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random()*1000);

  sheet.appendRow([
    id, body.movementId || '', body.material || '',
    parseFloat(body.remainingInCar) || 0,
    parseFloat(body.returnToStore) || 0,
    parseFloat(body.returnToSupplier) || 0,
    body.notes || '', body.requestedBy || '',
    'قيد الموافقة', new Date(), '', '', ''
  ]);

  notifyEngineer(
    '⚖️ طلب تسوية جديد بانتظار موافقتك',
    `المادة: ${body.material}\nمقدم الطلب: ${body.requestedBy}\n\nمتبقي بالعربية: ${body.remainingInCar || 0}\nمرتجع للمستودع: ${body.returnToStore || 0}\nمرتجع للمورد: ${body.returnToSupplier || 0}\n\nلمراجعة الطلب والموافقة عليه:\n${SITE_URL}/approvals.html`
  );

  return jsonResponse({ ok: true, id });
}

function handleApproveSettlementRequest(body) {
  const reqSheet = getOrCreateSettlementRequestsSheet();
  const reqRow = findRequestRow(reqSheet, body.id);
  if (reqRow === -1) return jsonResponse({ ok: false, error: 'طلب التسوية غير موجود' });

  const reqHeaders = getNormalizedHeaders(reqSheet);
  const movementId = getCellByName(reqSheet, reqRow, reqHeaders, 'معرف الحركة');
  const material = getCellByName(reqSheet, reqRow, reqHeaders, 'المادة');
  const remainingInCar = parseFloat(getCellByName(reqSheet, reqRow, reqHeaders, 'متبقي في العربية')) || 0;
  const returnToStore = parseFloat(getCellByName(reqSheet, reqRow, reqHeaders, 'مرتجع للمستودع')) || 0;
  const returnToSupplier = parseFloat(getCellByName(reqSheet, reqRow, reqHeaders, 'مرتجع للمورد')) || 0;
  const supervisorNotes = getCellByName(reqSheet, reqRow, reqHeaders, 'ملاحظات المشرف') || '';
  const requester = getCellByName(reqSheet, reqRow, reqHeaders, 'مقدم الطلب') || '';

  // البحث عن الحركة الأصلية
  const movSheet = getSheet(SHEET_NAMES.movements);
  const movData = movSheet.getDataRange().getValues();
  const headerIdx = getHeaderRowIndex(movSheet);
  const movHeaders = movData[headerIdx].map(normalizeHeader);

  // خريطة أسماء الأعمدة ⇒ index (0-based)
  const col = {
    id:         0,
    proj:       movHeaders.indexOf('المشروع'),
    phase:      movHeaders.indexOf('المرحلة'),
    mat:        movHeaders.indexOf('المادة'),
    unit:       movHeaders.indexOf('الوحدة'),
    received:   movHeaders.indexOf('وارد (استلام)'),
    consumed:   movHeaders.indexOf('مصروف على المشروع'),
    remaining:  movHeaders.indexOf('متبقي في العربية'),
    retStore:   movHeaders.indexOf('مرتجع للمستودع'),
    retSup:     movHeaders.indexOf('مرتجع للمورد'),
    supplier:   movHeaders.indexOf('وجهة الاستلام / الإرجاع'),
    movType:    movHeaders.indexOf('نوع الحركة'),
    contractor: movHeaders.indexOf('المقاول / العمالة'),
    notes:      movHeaders.indexOf('ملاحظات')
  };

  // تحقق إن كل الأعمدة موجودة
  for (const [key, val] of Object.entries(col)) {
    if (val === -1) {
      return jsonResponse({ ok: false, error: 'العمود "' + key + '" مش موجود في شيت الحركة. تأكد من headers' });
    }
  }

  let foundRow = -1, project = '', phase = '', unit = '';
  for (let i = headerIdx + 1; i < movData.length; i++) {
    if (String(movData[i][col.id]).trim() === String(movementId).trim() &&
        String(movData[i][col.mat]).trim() === String(material).trim()) {
      foundRow = i + 1;
      project = movData[i][col.proj] || '';
      phase = movData[i][col.phase] || '';
      unit = movData[i][col.unit] || '';
      break;
    }
  }
  if (foundRow === -1) {
    return jsonResponse({ ok: false, error: 'الحركة الأصلية غير موجودة (ID=' + movementId + ', مادة=' + material + ')' });
  }

  // ❶ حساب القيم الجديدة
  const oldConsumed  = parseFloat(movData[foundRow - 1][col.consumed]) || 0;
  const oldRetStore  = parseFloat(movData[foundRow - 1][col.retStore]) || 0;
  const oldRetSup    = parseFloat(movData[foundRow - 1][col.retSup]) || 0;
  const oldRemaining = parseFloat(movData[foundRow - 1][col.remaining]) || 0;

  const newConsumed  = Math.max(0, oldConsumed - (returnToStore + returnToSupplier));
  const newRetStore  = oldRetStore + returnToStore;
  const newRetSup    = oldRetSup + returnToSupplier;
  const newRemaining = oldRemaining + remainingInCar;

  // ❷ حدث الحركة الأصلية
  movSheet.getRange(foundRow, col.consumed + 1).setValue(newConsumed);
  movSheet.getRange(foundRow, col.remaining + 1).setValue(newRemaining);
  movSheet.getRange(foundRow, col.retStore + 1).setValue(newRetStore);
  movSheet.getRange(foundRow, col.retSup + 1).setValue(newRetSup);
  SpreadsheetApp.flush(); // تأكد إن التحديث خلص

  // ❸ إنشاء ID مميز للمرتجع
  const baseSuffix = String(movementId).replace(/^REQ-/i, '');
  let retId = 'RET-' + baseSuffix;
  let counter = 1;
  // لو الـ ID موجود، زود -v2, -v3 إلخ
  while (true) {
    let exists = false;
    for (let i = headerIdx + 1; i < movData.length; i++) {
      if (String(movData[i][col.id]).trim() === retId) { exists = true; break; }
    }
    if (!exists) break;
    counter++;
    retId = 'RET-' + baseSuffix + '-v' + counter;
  }

  // ❹ أنشئ صف مرتجع جديد (15 عمود)
  const newRow = [];
  newRow[col.id]        = retId;
  newRow[col.proj]      = project;
  newRow[col.phase]     = phase;
  newRow[col.mat]       = material;
  newRow[col.unit]      = unit;
  newRow[col.received]  = 0;
  newRow[col.consumed]  = 0;
  newRow[col.remaining] = 0;
  newRow[col.retStore]  = returnToStore;
  newRow[col.retSup]    = returnToSupplier;
  newRow[col.supplier]  = returnToSupplier > 0 ? (movData[foundRow - 1][col.supplier] || 'مورد') : 'مرتجع مستودع';
  newRow[col.movType]   = returnToSupplier > 0 ? 'مرتجع للمورد' : 'مرتجع لمخازن الإدارة';
  newRow[col.contractor]= requester;
  newRow[col.notes]     = supervisorNotes || '';

  // تأكد من ترتيب القيم حسب أعمدة الشيت
  const orderedRow = [];
  for (let c = 0; c <= Math.max(...Object.values(col).filter(v => v >= 0)); c++) {
    const idx = Object.entries(col).find(([_, v]) => v === c)?.[0];
    orderedRow.push(idx ? newRow[c] : '');
  }
  // حط التاريخ في العمود الصحيح (1)
  const dateColInOrder = movHeaders.indexOf('التاريخ');
  if (dateColInOrder === -1) {
    orderedRow.splice(1, 0, new Date()); // لو مش لاقي التاريخ، احطه كأول قيمة بعد ID
  } else {
    orderedRow[dateColInOrder] = new Date();
  }

  movSheet.appendRow(orderedRow);
  SpreadsheetApp.flush();

  // ❺ حدث حالة الطلب
  setCellByName(reqSheet, reqRow, reqHeaders, 'الحالة', 'موافق عليها');
  setCellByName(reqSheet, reqRow, reqHeaders, 'راجعها', body.reviewedBy || '');
  setCellByName(reqSheet, reqRow, reqHeaders, 'تاريخ المراجعة', new Date());
  setCellByName(reqSheet, reqRow, reqHeaders, 'ملاحظات المهندس', body.engineerNotes || '');

  return jsonResponse({ ok: true, consumed: newConsumed, returnId: retId });
}

function handleRejectSettlementRequest(body) {
  const reqSheet = getOrCreateSettlementRequestsSheet();
  const reqRow = findRequestRow(reqSheet, body.id);
  if (reqRow === -1) return jsonResponse({ ok: false, error: 'طلب التسوية غير موجود' });

  const reqHeaders = getNormalizedHeaders(reqSheet);
  setCellByName(reqSheet, reqRow, reqHeaders, 'الحالة', 'مرفوضة');
  setCellByName(reqSheet, reqRow, reqHeaders, 'راجعها', body.reviewedBy || '');
  setCellByName(reqSheet, reqRow, reqHeaders, 'تاريخ المراجعة', new Date());
  setCellByName(reqSheet, reqRow, reqHeaders, 'ملاحظات المهندس', body.engineerNotes || '');

  return jsonResponse({ ok: true });
}

// ── طلبات التعديل ─────────────────
function handleSubmitEditRequest(body) {
  const sheet = getOrCreateEditRequestsSheet();

  const existing = sheetToObjects(sheet);
  const dup = existing.find(r =>
    String(r['معرف الحركة']) === String(body.movementId) &&
    String(r['المادة']) === String(body.material) &&
    String(r['الحالة']).trim() === 'قيد الموافقة'
  );
  if (dup) return jsonResponse({ ok: false, error: 'يوجد طلب تعديل سابق قيد الموافقة لهذه المادة بالفعل' });

  const movSheet = getSheet(SHEET_NAMES.movements);
  const movRow = findRow(movSheet, body.movementId, body.material);
  let project = '';
  let previousQuantity = 0;
  if (movRow !== -1) {
    const movHeaders = getNormalizedHeaders(movSheet);
    project = getCellByName(movSheet, movRow, movHeaders, 'المشروع') || '';
    previousQuantity = parseFloat(getCellByName(movSheet, movRow, movHeaders, 'وارد (استلام)')) || 0;
  }

  const id = 'EDT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random()*1000);

  sheet.appendRow([
    id, body.movementId || '', body.material || '',
    project, previousQuantity,
    parseFloat(body.quantity) || 0,
    body.supplier || '', body.notes || '',
    body.requestedBy || '', 'قيد الموافقة', new Date(),
    '', '', ''
  ]);

  notifyEngineer(
    '✏️ طلب تعديل حركة جديد بانتظار موافقتك',
    `المشروع: ${project}\nالمادة: ${body.material}\nمقدم الطلب: ${body.requestedBy}\n\nالكمية السابقة: ${previousQuantity}\nالكمية المطلوبة: ${body.quantity}\n\nلمراجعة الطلب والموافقة عليه:\n${SITE_URL}/approvals.html`
  );

  return jsonResponse({ ok: true, id });
}

function handleApproveEditRequest(body) {
  const reqSheet = getOrCreateEditRequestsSheet();
  const reqRow = findRequestRow(reqSheet, body.id);
  if (reqRow === -1) return jsonResponse({ ok: false, error: 'طلب التعديل غير موجود' });

  const reqHeaders = getNormalizedHeaders(reqSheet);
  const movementId = getCellByName(reqSheet, reqRow, reqHeaders, 'معرف الحركة');
  const material = getCellByName(reqSheet, reqRow, reqHeaders, 'المادة');
  const newQuantity = parseFloat(getCellByName(reqSheet, reqRow, reqHeaders, 'الكمية الجديدة')) || 0;
  const newSupplier = getCellByName(reqSheet, reqRow, reqHeaders, 'الوجهة الجديدة') || '';
  const newNotes = getCellByName(reqSheet, reqRow, reqHeaders, 'الملاحظات الجديدة') || '';

  const movSheet = getSheet(SHEET_NAMES.movements);
  const movRow = findRow(movSheet, movementId, material);
  if (movRow === -1) return jsonResponse({ ok: false, error: 'الحركة الأصلية غير موجودة' });

  const movHeaders = getNormalizedHeaders(movSheet);
  setCellByName(movSheet, movRow, movHeaders, 'وارد (استلام)', newQuantity);
  setCellByName(movSheet, movRow, movHeaders, 'وجهة الاستلام / الإرجاع', newSupplier);
  setCellByName(movSheet, movRow, movHeaders, 'ملاحظات', newNotes);

  setCellByName(reqSheet, reqRow, reqHeaders, 'الحالة', 'موافق عليها');
  setCellByName(reqSheet, reqRow, reqHeaders, 'راجعها', body.reviewedBy || '');
  setCellByName(reqSheet, reqRow, reqHeaders, 'تاريخ المراجعة', new Date());
  setCellByName(reqSheet, reqRow, reqHeaders, 'ملاحظات المهندس', body.engineerNotes || '');

  return jsonResponse({ ok: true, updatedRow: reqRow });
}

function handleRejectEditRequest(body) {
  const reqSheet = getOrCreateEditRequestsSheet();
  const reqRow = findRequestRow(reqSheet, body.id);
  if (reqRow === -1) return jsonResponse({ ok: false, error: 'طلب التعديل غير موجود' });

  const reqHeaders = getNormalizedHeaders(reqSheet);
  setCellByName(reqSheet, reqRow, reqHeaders, 'الحالة', 'مرفوضة');
  setCellByName(reqSheet, reqRow, reqHeaders, 'راجعها', body.reviewedBy || '');
  setCellByName(reqSheet, reqRow, reqHeaders, 'تاريخ المراجعة', new Date());
  setCellByName(reqSheet, reqRow, reqHeaders, 'ملاحظات المهندس', body.engineerNotes || '');

  return jsonResponse({ ok: true, updatedRow: reqRow });
}

function handleUploadInvoiceImage(body) {
  const base64 = String(body.image || '');
  if (!base64 || base64.indexOf('base64,') === -1) {
    return jsonResponse({ ok: false, error: 'الصورة غير صالحة' });
  }

  // استخرج البيانات من data:image/...;base64,xxxx
  const mime = base64.match(/^data:([^;]+);base64,/);
  const mimeType = mime ? mime[1] : 'image/jpeg';
  const ext = mimeType.indexOf('png') !== -1 ? 'png' : 'jpg';
  const raw = base64.substring(base64.indexOf('base64,') + 7);
  const cleanName = String(body.fileName || 'invoice').replace(/[^\w.\-آ-ي ]/g, '_').slice(0, 60);

  // ابحث عن مجلد "فواتير المخزن" أو اعمل واحد جديد
  let folder;
  const folders = DriveApp.getFoldersByName('فواتير المخزن');
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('فواتير المخزن');

  const fileName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '_' + cleanName;
  const blob = Utilities.newBlob(Utilities.base64Decode(raw), mimeType, fileName + '.' + ext);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return jsonResponse({ ok: true, url: file.getUrl() });
}

function testDrive() {
  const f = DriveApp.getFoldersByName('فواتير المخزن');
  return f.hasNext();
}

// ════════════════════════════════════════════════════════
//  العهدة: سجل حركات العهد (إيداع + صرف)
// ════════════════════════════════════════════════════════

const ADVANCE_SHEET = 'سجل حركات العهدة';

function getOrCreateAdvanceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ADVANCE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ADVANCE_SHEET);
    sheet.appendRow(['ID', 'التاريخ', 'المشروع', 'المبلغ', 'رقم الفاتورة', 'الوصف', 'المشرف', 'نوع الحركة', 'المسجل بواسطة', 'تاريخ التسجيل']);
  }
  return sheet;
}

function handleGetAdvanceMovements(e) {
  let movements = sheetToObjects(getOrCreateAdvanceSheet());
  movements.sort((a, b) => new Date(b['التاريخ'] || 0) - new Date(a['التاريخ'] || 0));

  const supervisor = String((e.parameter && e.parameter.supervisor) || '').trim();
  if (supervisor) {
    movements = movements.filter(m => String(m['المشرف'] || '').trim() === supervisor);
  }

  return jsonResponse({
    movements: movements.map(m => ({
      id: m['ID'],
      date: m['التاريخ'],
      project: m['المشروع'],
      amount: m['المبلغ'],
      invoice: m['رقم الفاتورة'],
      description: m['الوصف'],
      supervisor: m['المشرف'],
      type: m['نوع الحركة']
    }))
  });
}

function handleLogAdvanceExpense(params) {
  try {
    const amount = parseFloat(params.amount) || 0;
    if (amount <= 0) return jsonResponse({ ok: false, error: 'المبلغ غير صحيح' });
    const supervisor = String(params.supervisor || '').trim();
    if (!supervisor) return jsonResponse({ ok: false, error: 'المشرف مطلوب' });
    const id = 'ADV-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000);
    getOrCreateAdvanceSheet().appendRow([
      id,
      formatWafeqDate_(params.date || new Date()),
      String(params.project || '').trim(),
      Math.round(amount * 100) / 100,
      String(params.invoice || '').trim(),
      String(params.description || '').trim(),
      supervisor,
      'صرف',
      String(params.recordedBy || '').trim(),
      new Date()
    ]);
    return jsonResponse({ ok: true, id });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'خطأ: ' + err.message });
  }
}

function handleDepositAdvance(params) {
  try {
    const amount = parseFloat(params.amount) || 0;
    if (amount <= 0) return jsonResponse({ ok: false, error: 'المبلغ غير صحيح' });
    const supervisor = String(params.supervisor || '').trim();
    if (!supervisor) return jsonResponse({ ok: false, error: 'المشرف مطلوب' });
    const id = 'DEP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000);
    getOrCreateAdvanceSheet().appendRow([
      id,
      formatWafeqDate_(params.date || new Date()),
      '',
      Math.round(amount * 100) / 100,
      '',
      String(params.description || '').trim(),
      supervisor,
      'إيداع عهدة',
      String(params.recordedBy || '').trim(),
      new Date()
    ]);
    return jsonResponse({ ok: true, id });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'خطأ: ' + err.message });
  }
}

// ════════════════════════════════════════════════════════
//  وافق: توليد القيود المحاسبية
// ════════════════════════════════════════════════════════

const WAFEQ_SHEET = 'قيود وافق';
const WAFEQ_INTERMEDIATE_ACCOUNT = 'المستودع'; // الحساب الوسيط الدائن — غيّره لاسم الحساب في وافق
const WAFEQ_CURRENCY = 'SAR';

function handleGenerateWafeqEntry(params) {
  try {
    const invoice = String((params && params.invoice) || '').trim();
    if (!invoice) return jsonResponse({ ok: false, error: 'رقم الفاتورة مطلوب' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wafeqSheet = ss.getSheetByName(WAFEQ_SHEET);
    if (!wafeqSheet) return jsonResponse({ ok: false, error: 'شيت "' + WAFEQ_SHEET + '" مش موجود' });

    // منع التكرار: نشوف لو الفاتورة اتولّد قيدها قبل كده
    const existing = wafeqSheet.getDataRange().getValues();
    for (let i = 1; i < existing.length; i++) {
      if (String(existing[i][8] || '').indexOf('فاتورة ' + invoice) !== -1) {
        return jsonResponse({ ok: false, error: 'القيد بتاع الفاتورة ' + invoice + ' اتولّد قبل كده' });
      }
    }

    // قراءة الحركات بتاعة الفاتورة
    const movSh = ss.getSheetByName(SHEET_NAMES.movements);
    if (!movSh) return jsonResponse({ ok: false, error: 'شيت "' + SHEET_NAMES.movements + '" مش موجود' });
    const movV = movSh.getDataRange().getValues();
    const movHeaderIdx = getHeaderRowIndex(movSh);
    const movH = movV[movHeaderIdx].map(normalizeHeader);
    const mi = n => movH.indexOf(n);

    // خريطة المادة => حساب وافق من شيت المواد
    const matSh = ss.getSheetByName(SHEET_NAMES.materials);
    if (!matSh) return jsonResponse({ ok: false, error: 'شيت "' + SHEET_NAMES.materials + '" مش موجود' });
    const matV = matSh.getDataRange().getValues();
    const matHeaderIdx = getHeaderRowIndex(matSh);
    const matH = matV[matHeaderIdx].map(normalizeHeader);
    const accountMap = {};
    for (let i = matHeaderIdx + 1; i < matV.length; i++) {
      const matName = String(matV[i][matH.indexOf('المواد المستخدمة')] || '').trim();
      const acc = String(matV[i][matH.indexOf('حساب وافق')] || '').trim();
      if (matName && acc) accountMap[matName] = acc;
    }

    const debitRows = [];
    let total = 0;
    let entryDate = '';

    for (let i = movHeaderIdx + 1; i < movV.length; i++) {
      const r = movV[i];
      const inv = String(r[mi('رقم الفاتورة')] || '').trim();
      const face = String(r[mi('وجهة الاستلام / الإرجاع')] || '').trim();
      if (inv !== invoice) continue;
      if (face === 'المستودع') continue; // صرف من المستودع — معندوش مبلغ
      const amount = parseFloat(r[mi('اجمالي المبالغ المصروفه مع ضريبة')]) || 0;
      if (amount <= 0) continue;
      if (!entryDate) entryDate = formatWafeqDate_(r[mi('التاريخ')]);

      const material = String(r[mi('المادة')] || '').trim();
      const project = String(r[mi('المشروع')] || '').trim();
      const qty = r[mi('وارد (استلام)')];
      const unit = String(r[mi('الوحدة')] || '').trim();
      const account = accountMap[material] || 'مواد بناء';

      debitRows.push({
        account,
        debit: amount,
        desc: 'فاتورة ' + invoice + ' - ' + material + (qty ? ' x' + qty : '') + (unit ? ' ' + unit : '') + (project ? ' - ' + project : '')
      });
      total += amount;
    }

    if (debitRows.length === 0) {
      return jsonResponse({ ok: false, error: 'مفيش أصناف بالمبالغ للفاتورة ' + invoice + ' — تأكد إن المبالغ متعباية في عمود "مع ضريبة"' });
    }

    total = Math.round(total * 100) / 100;
    const uid = 'SYS-' + invoice;

    const out = [];
    // سطر دائن: الحساب الوسيط بالمبلغ الإجمالي
    out.push([uid, entryDate, WAFEQ_INTERMEDIATE_ACCOUNT, WAFEQ_CURRENCY, '', total, '', total, 'فاتورة ' + invoice + ' - ' + WAFEQ_INTERMEDIATE_ACCOUNT]);
    // سطور مدينة: كل مادة بحسابها
    debitRows.forEach(d => {
      out.push([uid, entryDate, d.account, WAFEQ_CURRENCY, d.debit, '', d.debit, '', d.desc]);
    });

    wafeqSheet.getRange(wafeqSheet.getLastRow() + 1, 1, out.length, 9).setValues(out);

    return jsonResponse({ ok: true, invoice, total, lines: debitRows.length, uid });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'خطأ: ' + err.message });
  }
}

function handleGetWafeqGenerated(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wafeqSheet = ss.getSheetByName(WAFEQ_SHEET);
    if (!wafeqSheet) return jsonResponse({ invoices: [] });
    const v = wafeqSheet.getDataRange().getValues();
    const invoices = [];
    for (let i = 1; i < v.length; i++) {
      const m = String(v[i][8] || '').match(/فاتورة\s+([^\s\-]+)/);
      if (m && invoices.indexOf(m[1]) === -1) invoices.push(m[1]);
    }
    return jsonResponse({ invoices });
  } catch (err) {
    return jsonResponse({ invoices: [] });
  }
}

function formatWafeqDate_(d) {
  if (!d) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  const s = String(d).trim();
  const parts = s.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) return s; // yyyy/MM/dd
    return parts[2] + '/' + parts[1] + '/' + parts[0]; // dd/MM/yyyy -> yyyy/MM/dd
  }
  return s;
}
