// --- Theme Toggle ---
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').innerText = next === 'light' ? '🌙' : '☀️';
}

async function downloadSpiffImage(spiffId) {
    const card = document.getElementById(`spiff-card-${spiffId}`);
    if (!card) return;
    
    const origBg = card.style.background;
    card.style.background = '#1a1a1a'; // Ensure dark background for image
    
    try {
        const canvas = await html2canvas(card, {
            backgroundColor: '#1a1a1a',
            scale: 2
        });
        const link = document.createElement('a');
        link.download = `Spiff_${spiffId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Error downloading spiff:", err);
        alert("Hubo un error al generar la imagen.");
    } finally {
        card.style.background = origBg;
    }
}

async function downloadCarreraImage() {
    const container = document.querySelector('#view-carrera .card');
    if (!container) return;
    
    const btn = document.getElementById('btn-download-carrera');
    if (btn) btn.style.display = 'none';

    try {
        const canvas = await html2canvas(container, {
            backgroundColor: '#1a1a1a',
            scale: 2
        });
        const link = document.createElement('a');
        link.download = `Carrera_Semanal.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Error downloading carrera:", err);
        alert("Hubo un error al generar la imagen.");
    } finally {
        if (btn) btn.style.display = 'inline-block';
    }
}

