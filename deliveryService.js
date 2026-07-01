// ضع رابط الـ Web App المستخرج من جوجل شيت هنا بدلاً من الرابط التجريبي بالأسفل
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyu7oj8W4D4wACBVNOZb1pSufU1LzWrqFF_pLDbq66EeBiGMedgfdLrUDxrxYlUhGV3/exec"; 

let projectPhasesMap = {};
let allMaterialsArray = [];
let currentGeneratedID = "";

document.addEventListener("DOMContentLoaded", function() {
    generateUniqueMotionID();
    fetchSetupDataFromGoogleSheets();
    
    document.getElementById("matProject").addEventListener("change", handleProjectChange);
    document.getElementById("matPhase").addEventListener("change", handlePhaseChange);
});

function generateUniqueMotionID() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    currentGeneratedID = `REQ-${year}${month}${day}-${hrs}${mins}${secs}`;
    document.getElementById("motionIDDisplay").innerText = `رقم الطلب: ${currentGeneratedID}`;
}

async function fetchSetupDataFromGoogleSheets() {
    try {
        let response = await fetch(`${WEB_APP_URL}?action=getSetupData`);
        let data = await response.json();
        
        projectPhasesMap = data.projectPhases;
        allMaterialsArray = data.materials;
        
        const projectSelect = document.getElementById("matProject");
        projectSelect.innerHTML = '<option value="">اختر المشروع...</option>';
        data.projects.forEach(proj => {
            projectSelect.innerHTML += `<option value="${proj}">${proj}</option>`;
        });

        const supplierSelect = document.getElementById("matSupplier");
        supplierSelect.innerHTML = '<option value="">مورد عام / لا يوجد</option>';
        data.suppliers.forEach(sup => {
            if(sup) supplierSelect.innerHTML += `<option value="${sup}">${sup}</option>`;
        });
        
    } catch (error) {
        alert("فشل في جلب البيانات من جوجل شيت!");
    }
}

function handleProjectChange(e) {
    const selectedProj = e.target.value;
    const phaseSelect = document.getElementById("matPhase");
    const container = document.getElementById("dynamicMaterialsContainer");
    
    phaseSelect.innerHTML = '<option value="">اختر المرحلة...</option>';
    container.innerHTML = '<p class="text-gray-400 text-xs text-center col-span-full py-4">يرجى تحديد المرحلة لعرض المواد والكميات.</p>';
    document.getElementById("submitBtn").disabled = true;

    if (selectedProj && projectPhasesMap[selectedProj]) {
        phaseSelect.disabled = false;
        projectPhasesMap[selectedProj].forEach(phase => {
            phaseSelect.innerHTML += `<option value="${phase}">${phase}</option>`;
        });
    } else {
        phaseSelect.disabled = true;
    }
}

function handlePhaseChange(e) {
    const selectedPhase = e.target.value;
    const container = document.getElementById("dynamicMaterialsContainer");
    container.innerHTML = "";
    
    if (!selectedPhase) {
        container.innerHTML = '<p class="text-gray-400 text-xs text-center col-span-full py-4">يرجى تحديد المرحلة لعرض المواد والكميات.</p>';
        document.getElementById("submitBtn").disabled = true;
        return;
    }
    
    const filteredMaterials = allMaterialsArray.filter(m => m.phase === selectedPhase);
    
    if (filteredMaterials.length === 0) {
        container.innerHTML = '<p class="text-red-500 text-xs text-center col-span-full py-4">لا توجد مواد مضافة لهذه المرحلة في شيت "المواد".</p>';
        document.getElementById("submitBtn").disabled = true;
        return;
    }
    
    filteredMaterials.forEach(mat => {
        const card = document.createElement("div");
        card.className = "flex flex-col bg-white p-3 border rounded-xl shadow-sm";
        card.innerHTML = `
            <label class="text-xs font-bold text-gray-700 mb-1 truncate" title="${mat.name}">${mat.name}</label>
            <div class="flex items-center gap-2">
                <input type="number" step="any" min="0" data-matname="${mat.name}" data-matunit="${mat.unit}" 
                       class="qty-input-field w-full p-2 border rounded text-center text-sm font-semibold" 
                       placeholder="0">
                <span class="text-xs text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-1 rounded border">${mat.unit}</span>
            </div>
        `;
        container.appendChild(card);
    });
    
    document.getElementById("submitBtn").disabled = false;
}

async function submitLogOrder() {
    const project = document.getElementById("matProject").value;
    const phase = document.getElementById("matPhase").value;
    const type = document.getElementById("motionType").value;
    const supplier = document.getElementById("matSupplier").value;
    const createdBy = document.getElementById("createdBy").value.trim();
    const notes = document.getElementById("motionNotes").value.trim();
    const submitBtn = document.getElementById("submitBtn");
    
    if (!project || !phase || !createdBy) {
        alert("برجاء إدخال اسم المشرف واختيار المشروع والمرحلة!");
        return;
    }
    
    const inputElements = document.querySelectorAll(".qty-input-field");
    let orderedItems = [];
    
    inputElements.forEach(input => {
        const qty = parseFloat(input.value);
        if (qty && qty > 0) {
            orderedItems.push({
                material: input.getAttribute("data-matname"),
                unit: input.getAttribute("data-matunit"),
                qty: qty
            });
        }
    });
    
    if (orderedItems.length === 0) {
        alert("برجاء إدخال كمية واحدة على الأقل لأي من المواد المعروضة!");
        return;
    }
    
    const today = new Date();
    const formattedDate = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
    
    const payload = {
        motionID: currentGeneratedID,
        date: formattedDate,
        project: project,
        phase: phase,
        type: type,
        supplier: supplier || "مورد عام",
        createdBy: createdBy,
        notes: notes,
        items: orderedItems
    };
    
    submitBtn.disabled = true;
    submitBtn.innerText = "جاري الحفظ في الشيت المجمع...";
    
    try {
        await fetch(WEB_APP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        alert(`تم إرسال الحركة وحفظها في شيت "سجل_الحركة" بنجاح برقم مستند: ${currentGeneratedID}`);
        location.reload();
        
    } catch (error) {
        alert("حدث خطأ أثناء الاتصال بالخادم للحفظ!");
        submitBtn.disabled = false;
        submitBtn.innerText = "حفظ وإرسال للشيت";
    }
}
