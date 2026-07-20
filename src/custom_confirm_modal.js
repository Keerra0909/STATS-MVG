// --- Custom Confirm Modal ---
let confirmCallback = null;

function showConfirmModal(message, onConfirm) {
    document.getElementById('confirm-modal-msg').innerText = message;
    confirmCallback = onConfirm;
    document.getElementById('confirm-modal').style.display = 'flex';
    
    document.getElementById('btn-confirm-yes').onclick = () => {
        const cb = confirmCallback;
        closeConfirmModal();
        if (cb) cb();
    };
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    confirmCallback = null;
}

async function saveCarreraConfig() {
    const btn = document.getElementById('btn-save-carrera-cfg');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    const newCfg = {
        p1: parseFloat(document.getElementById('cfg-p1').value) || 0,
        p2: parseFloat(document.getElementById('cfg-p2').value) || 0,
        p3: parseFloat(document.getElementById('cfg-p3').value) || 0,
        p4: parseFloat(document.getElementById('cfg-p4').value) || 0,
        p5: parseFloat(document.getElementById('cfg-p5').value) || 0,
        pa: parseFloat(document.getElementById('cfg-pa').value) || 0,
        min: parseInt(document.getElementById('cfg-min').value) || 0
    };

    try {
        await firestore.collection('settings').doc('carrera').set(newCfg, { merge: true });
        carreraConfig = newCfg;
        closeCarreraConfig();
        // Reload carrera view to reflect changes
        loadCarrera();
    } catch(e) {
        console.error("Error saving config", e);
        alert("Error al guardar configuración");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Guardar';
    }
}

