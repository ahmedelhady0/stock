// ضع رابط الـ Web App المستخرج من جوجل شيت هنا
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyu7oj8W4D4wACBVNOZb1pSufU1LzWrqFF_pLDbq66EeBiGMedgfdLrUDxrxYlUhGV3/exec"; 

document.addEventListener("DOMContentLoaded", function() {
    loadRecentMovements();
    
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
        // تفريغ الجلسة والرجوع لصفحة الدخول
        localStorage.removeItem('exo_session');
        window.location.href = 'index.html';
    });
});

async function loadRecentMovements() {
    const container = document.getElementById('recentMovements');
    try {
        // طلب جلب البيانات لإظهار آخر الحركات المسجلة في الشيت
        let response = await fetch(`${WEB_APP_URL}?action=getSetupData`);
        let data = await response.json();
        
        // سنفترض أننا سنعرض رسالة تأكيدية بالاتصال الناجح هنا لحين بناء شيت الحركة بالكامل
        container.innerHTML = `
            <div class="p-4 bg-green-50 border border-green-200 text-green-800 text-sm font-semibold rounded-lg text-center">
                ✅ تم الاتصال بقاعدة بيانات جوجل شيت بنجاح والمنظومة جاهزة للعمل.
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p class="text-center text-red-500 text-sm">تعذر جلب البيانات من شيت جوجل، يرجى التأكد من الرابط.</p>';
        console.error(error);
    }
}
