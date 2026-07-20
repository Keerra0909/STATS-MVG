// --- Carrera Config ---
let carreraConfig = { p1: 0.5, p2: 1.0, p3: 1.5, p4: 2.0, p5: 2.5, pa: 1.0, min: 10 };

window.togglePodium = function() {
    const podio = document.getElementById('carrera-podio');
    const btn = document.getElementById('btn-toggle-podium');
    if (!podio) return;
    if (podio.style.display === 'none') {
        podio.style.display = 'grid';
        btn.innerText = '🙈 Ocultar Podio';
    } else {
        podio.style.display = 'none';
        btn.innerText = '🏆 Revelar Podio';
    }
}

async function openCarreraConfig() {
    try {
        const doc = await firestore.collection('settings').doc('carrera').get();
        if (doc.exists) {
            carreraConfig = { ...carreraConfig, ...doc.data() };
        }
    } catch(e) { console.error("Error loading config", e); }
    
    document.getElementById('cfg-p1').value = carreraConfig.p1;
    document.getElementById('cfg-p2').value = carreraConfig.p2;
    document.getElementById('cfg-p3').value = carreraConfig.p3;
    document.getElementById('cfg-p4').value = carreraConfig.p4;
    document.getElementById('cfg-p5').value = carreraConfig.p5;
    document.getElementById('cfg-pa').value = carreraConfig.pa;
    document.getElementById('cfg-min').value = carreraConfig.min;
    
    document.getElementById('carrera-config-modal').style.display = 'flex';
}

function closeCarreraConfig(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('carrera-config-modal').style.display = 'none';
}

