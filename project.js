// ═══════════════════════════════════════════════════════════
// رصيد المشاريع — جلب الحركات من جوجل شيت وحساب (المستلم - المرتجع)
// ═══════════════════════════════════════════════════════════

// رابط الـ Web App الخاص بك جاهز وسليم 100%
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyu7oj8W4D4wACBVNOZb1pSufU1LzWrqFF_pLDbq66EeBiGMedgfdLrUDxrxYlUhGV3/exec"; 

const projectSelect = document.getElementById('projectSelect');
const projectReport = document.getElementById('projectReport');

let allMovements = [];
let currentProjectFilter = '';

// عند تحميل الصفحة، يتم التحقق من الجلسة وجلب البيانات من جوجل شيت فوراً
document.addEventListener("DOMContentLoaded", function() {
    // التحقق من وجود جلسة دخول (أو توجيهه لصفحة index إذا لم يكن مسجلاً)
    if (!localStorage.getItem('exo_session')) {
        window.location.href = 'index.html';
        return;
    }

    fetchProjectReportData();
    
    projectSelect.addEventListener('change', (e) => {
        currentProjectFilter = e.target.value;
        renderReport();
    });
});

async function fetchProjectReportData() {
    try {
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm py-8">جاري تحديث تقارير الأرصدة ومزامنة الحركات من جوجل شيت...</p>';
        
        // طلب جلب جدول الحركات بالكامل من جوجل شيت عبر الـ Web App
        let response = await fetch(`${WEB_APP_URL}?action=getMovementsLog`);
        
        if (!response.ok) throw new Error("تعذر الاتصال بالسيرفر");
        
        let data = await response.json();
        allMovements = data.movements || []; 
        
        // إعادة بناء قائمة المشاريع ديناميكياً في قائمة الاختيار (Dropdown)
        rebuildProjectList();
        // رندر وعرض الجداول بناءً على الحركات الفعلية
        renderReport();
        
    } catch (error) {
        console.error("Error fetching report data:", error);
        projectReport.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-bold rounded-xl text-center">
                ❌ تعذر جلب البيانات من جوجل شيت. يرجى التأكد من صلاحيات النشر (Anyone) في الـ Web App.
            </div>
        `;
    }
}

function rebuildProjectList() {
    // استخراج المشاريع الفريدة من سجل الحركات القادم من الشيت
    const projects = [...new Set(allMovements.map(m => m.project).filter(Boolean))].sort();
    const selected = projectSelect.value;
    
    projectSelect.innerHTML = '<option value="">كل المشاريع المتاحة</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; 
        opt.textContent = p;
        projectSelect.appendChild(opt);
    });
    projectSelect.value = selected;
}

function renderReport() {
    // تصفية الحركات بناءً على المشروع المختار
    const filtered = currentProjectFilter
        ? allMovements.filter(m => m.project === currentProjectFilter)
        : allMovements;

    if (filtered.length === 0) {
        projectReport.innerHTML = '<p class="text-center text-gray-500 text-sm mt-8 py-4">لا توجد حركات مواد مسجلة لهذا المشروع في الشيت بعد.</p>';
        return;
    }

    // تجميع الحسابات: مشروع ← مادة ← { received, returned, unit, phase }
    const byProject = {};
    
    filtered.forEach(m => {
        const proj = m.project || 'غير محدد';
        const mat = m.material || 'غير محدد';
        const type = m.type || m.movementType; // التوافق مع مسميات الحركات
        
        if (!byProject[proj]) byProject[proj] = {};
        if (!byProject[proj][mat]) {
            byProject[proj][mat] = { received: 0, returned: 0, unit: m.unit || '', phase: m.phase || 'عام' };
        }
        
        const qty = parseFloat(m.qty || m.quantity) || 0;
        
        // حساب الاستلام والصرف المرتجع بناءً على مسميات النظام المجمع الجديد
        if (type === 'استلام من مورد' || type === 'receive') {
            byProject[proj][mat].received += qty;
        } else if (type === 'مرتجع من الموقع' || type === 'return') {
            byProject[proj][mat].returned += qty;
        } else if (type === 'صرف داخلي') {
            // إذا كنت تريد معاملة الصرف الداخلي كتقليل للمخزن أو حسب الحسابات المتفق عليها مع الإدارة
            // يمكنك تركها أو إضافتها حسب رغبتك المحاسبية للمشروع
        }
    });

    projectReport.innerHTML = '';
    
    // بناء الجداول لكل مشروع بشكل منسق ومتوافق مع شاشات الجوال
    Object.keys(byProject).sort().forEach(proj => {
        const section = document.createElement('div');
        section.className = 'section-card p-5 mb-5 bg-white border rounded-2xl shadow-sm';

        let rows = '';
        Object.keys(byProject[proj]).sort().forEach(mat => {
            const d = byProject[proj][mat];
            const net = d.received - d.returned; // صافي الكمية المستهلكة في الموقع فعلياً
            
            rows += `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-3 text-right font-medium text-gray-800">${mat}</td>
                    <td class="p-3 text-center"><span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${d.phase}</span></td>
                    <td class="p-3 text-center text-green-600 font-semibold">${d.received}</td>
                    <td class="p-3 text-center text-orange-500">${d.returned}</td>
                    <td class="p-3 text-center font-bold text-blue-600">${net} <span class="text-xs font-normal text-gray-400">${d.unit}</span></td>
                </tr>`;
        });

        section.innerHTML = `
            <h2 class="text-md font-bold text-gray-700 border-b pb-2 mb-3 flex items-center gap-2">
                🏢 <span class="text-blue-600">${proj}</span>
            </h2>
            <div style="overflow-x:auto;">
                <table class="w-full text-sm text-right">
                    <thead>
                        <tr class="bg-gray-50 text-gray-500 font-bold border-b text-xs">
                            <th class="p-3 text-right">المادة</th>
                            <th class="p-3 text-center">المرحلة</th>
                            <th class="p-3 text-center">إجمالي المستلم</th>
                            <th class="p-3 text-center">إجمالي المرتجع</th>
                            <th class="p-3 text-center">الصافي بالموقع</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        projectReport.appendChild(section);
    });
}
