// --- Download Image ---
function downloadImage() {
    const btn = document.getElementById('btn-download');
    const origHTML = btn.innerHTML;
    btn.innerHTML = 'Generando Imagen...';
    btn.disabled = true;

    const target = document.getElementById('table-card');
    
    setTimeout(() => {
        btn.style.display = 'none';

        html2canvas(target, {
            backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e1e1e' : '#ffffff',
            scale: 2,
            logging: false
        }).then(async (canvas) => {
            btn.style.display = 'flex';
            const dateStr = document.getElementById('dash-start').value;
            const filename = `Reporte_${dateStr}.png`;
            const dataUrl = canvas.toDataURL('image/png');
            
            try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                // Always force direct download to Downloads folder (no share sheet)
                const link = document.createElement('a');
                link.download = filename;
                const blobUrl = URL.createObjectURL(blob);
                link.href = blobUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            } catch(e) {
                console.error(e);
                // Fallback
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            btn.innerHTML = origHTML;
            btn.disabled = false;
        }).catch(err => {
            console.error(err);
            btn.style.display = 'flex';
            btn.innerHTML = origHTML;
            btn.disabled = false;
        });
    }, 100);
}

