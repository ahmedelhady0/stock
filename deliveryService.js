window.submitReceipt = async function submitReceipt() {
    const project = document.getElementById('matProject').value;
    const phase = document.getElementById('matPhase').value;
    const supplier = document.getElementById('matSupplier').value;
    const createdBy = document.getElementById('createdBy').value.trim();
    const notes = document.getElementById('motionNotes').value.trim();
    const submitBtn = document.getElementById('submitBtn');

    if (!project || !phase || !createdBy) {
        showMessage('يرجى ملء المشروع والمرحلة واسم المشرف');
        return;
    }

    const items = [...document.querySelectorAll('.qty-input')]
        .map(inp => ({
            material: inp.dataset.name,
            unit: inp.dataset.unit,
            quantity: parseFloat(inp.value) || 0
        }))
        .filter(i => i.quantity > 0);

    if (items.length === 0) {
        showMessage('أدخل كمية واحدة على الأقل');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الحفظ...';

    // رقم طلب واحد يشترك فيه كل المواد في نفس الاستلام
    const batchId = 'REQ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    try {
        const promises = items.map(item =>
            logReceipt({
                id: batchId,
                project,
                phase,
                material: item.material,
                unit: item.unit,
                quantity: item.quantity,
                supplier: supplier || 'غير محدد',
                contractor: createdBy,
                notes
            })
        );

        await Promise.all(promises);

        showMessage(`✅ تم حفظ ${items.length} مادة بنجاح!`);
        setTimeout(() => location.reload(), 1100);

    } catch (err) {
        console.error(err);
        showMessage('❌ خطأ أثناء الحفظ: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ الاستلام';
    }
};
