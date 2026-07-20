// --- Top 3 Podium ---
function renderTop3() {
    const specialNames = ['EN REPORTE', 'TOTALES'];
    const candidates = dashData.filter(d => !specialNames.includes(d.name) && (d.totals.ventas > 0 || d.totals.shots > 0));
    
    // Sort by Ventas DESC, then % Cierre DESC
    candidates.sort((a, b) => {
        if (b.totals.ventas !== a.totals.ventas) {
            return b.totals.ventas - a.totals.ventas;
        }
        return b.cierre - a.cierre;
    });

    const top3 = candidates.slice(0, 3);
    const container = document.getElementById('top3-container');
    const podium = document.getElementById('top3-podium');

    const startStr = document.getElementById('dash-start').value;
    const endStr = document.getElementById('dash-end').value;

    // Hide podium if there's no data OR if it's a single day ("Hoy")
    if (top3.length === 0 || startStr === endStr) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    // Podium arrangement: [2nd, 1st, 3rd] for visual effect
    const places = [];
    if (top3[1]) places.push({ 
        ...top3[1], 
        rank: 2, 
        icon: '', 
        finalHeight: 130, 
        gradient: 'linear-gradient(180deg, #66a6ff 0%, #3a7bd5 100%)',
        glow: 'rgba(102, 166, 255, 0.4)',
        textColor: '#89f7fe',
        delay: 0,
        medalBg: 'linear-gradient(135deg, #e6e9f0 0%, #aeb4c3 100%)',
        medalColor: '#111'
    });
    if (top3[0]) places.push({ 
        ...top3[0], 
        rank: 1, 
        icon: '👑', 
        finalHeight: 180, 
        gradient: 'linear-gradient(180deg, #00d2ff 0%, #3a7bd5 100%)',
        glow: 'rgba(0, 210, 255, 0.5)',
        textColor: '#00d2ff',
        delay: 200,
        medalBg: 'linear-gradient(135deg, #ffe066 0%, #f9a826 100%)',
        medalColor: '#111'
    });
    if (top3[2]) places.push({ 
        ...top3[2], 
        rank: 3, 
        icon: '', 
        finalHeight: 100, 
        gradient: 'linear-gradient(180deg, #b224ef 0%, #7579ff 100%)',
        glow: 'rgba(178, 36, 239, 0.5)',
        textColor: '#d946ef',
        delay: 100,
        medalBg: 'linear-gradient(135deg, #e69d73 0%, #b85c34 100%)',
        medalColor: '#111'
    });
    
    // Build HTML with data attributes for animation targets
    let html = '';
    places.forEach((p) => {
        html += `
            <div class="podium-card" data-rank="${p.rank}" data-ventas="${p.totals.ventas}" data-cierre="${(p.cierre * 100).toFixed(1)}" data-delay="${p.delay}"
                 style="display: flex; flex-direction: column; align-items: center; width: 140px; opacity: 0; transform: translateY(30px); transition: opacity 0.4s ease, transform 0.4s ease;">
                <div style="font-size: 1.5rem; margin-bottom: 0.2rem; filter: drop-shadow(0 0 8px ${p.textColor}); height: 24px;">${p.icon}</div>
                <strong style="font-size: 1.15rem; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(255,255,255,0.6); text-align: center; font-weight: 900;">${p.name}</strong>
                <div class="podium-cierre" style="font-size: 0.75rem; color: ${p.textColor}; font-weight: bold; margin-bottom: 0.8rem; text-shadow: 0 0 8px ${p.glow}; letter-spacing: 0.5px;">Cierre: 0%</div>
                
                <div style="width: 100%; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 0 25px ${p.glow}, inset 0 2px 10px rgba(255,255,255,0.3); overflow: hidden; background: ${p.gradient};">
                    <div class="podium-bar" style="height: 0px; display: flex; justify-content: center; align-items: flex-start; padding-top: 15px; position: relative; transition: height 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);">
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%); pointer-events: none;"></div>
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${p.medalBg}; display: flex; justify-content: center; align-items: center; font-weight: 900; font-size: 1.1rem; color: ${p.medalColor}; box-shadow: 0 4px 8px rgba(0,0,0,0.5); z-index: 1; border: 1px solid rgba(255,255,255,0.5);">
                            ${p.rank}
                        </div>
                    </div>
                    
                    <div style="background: rgba(10, 10, 15, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 14px 0; display: flex; justify-content: center; align-items: baseline; border-top: 1px solid rgba(255,255,255,0.15);">
                        <span class="podium-ventas" style="font-size: 1.6rem; font-weight: 900; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">0</span>
                        <span style="font-size: 0.85rem; color: #aaa; margin-left: 4px; font-weight: bold;">Vts</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    podium.innerHTML = html;

    // Animate each card with staggered delay
    const cards = podium.querySelectorAll('.podium-card');
    cards.forEach(card => {
        const delay = parseInt(card.dataset.delay);
        const finalVentas = parseInt(card.dataset.ventas);
        const finalCierre = parseFloat(card.dataset.cierre);
        const rank = parseInt(card.dataset.rank);
        const finalHeight = rank === 1 ? 180 : rank === 2 ? 130 : 100;

        setTimeout(() => {
            // Fade-in + slide up
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';

            // Grow the bar after card appears
            const bar = card.querySelector('.podium-bar');
            setTimeout(() => { bar.style.height = finalHeight + 'px'; }, 80);

            // Count up ventas and cierre
            const ventasEl = card.querySelector('.podium-ventas');
            const cierreEl = card.querySelector('.podium-cierre');
            const duration = 900;
            let startTs = null;

            const countStep = (ts) => {
                if (!startTs) startTs = ts;
                const progress = Math.min((ts - startTs) / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                ventasEl.textContent = Math.floor(ease * finalVentas);
                cierreEl.textContent = `Cierre: ${(ease * finalCierre).toFixed(1)}%`;
                if (progress < 1) requestAnimationFrame(countStep);
                else {
                    ventasEl.textContent = finalVentas;
                    cierreEl.textContent = `Cierre: ${finalCierre}%`;
                }
            };
            requestAnimationFrame(countStep);

        }, delay);
    });
}

function downloadTop3() {
    const btn = document.getElementById('btn-download-top3');
    const origHTML = btn.innerHTML;
    btn.innerHTML = 'Generando...';
    btn.disabled = true;
    
    // Create an off-screen container for WhatsApp vertical format
    const exportDiv = document.createElement('div');
    exportDiv.style.position = 'absolute';
    exportDiv.style.left = '-9999px';
    exportDiv.style.top = '0';
    exportDiv.style.width = '540px';
    exportDiv.style.height = '960px'; // 9:16 aspect ratio
    exportDiv.style.backgroundColor = '#0a0a0f';
    exportDiv.style.backgroundImage = 'radial-gradient(circle at 50% 30%, #1a1a2e 0%, #0a0a0f 70%)';
    exportDiv.style.display = 'flex';
    exportDiv.style.flexDirection = 'column';
    exportDiv.style.alignItems = 'center';
    exportDiv.style.justifyContent = 'center';
    exportDiv.style.fontFamily = 'Inter, sans-serif';
    exportDiv.style.overflow = 'hidden';
    
    // Premium Background Elements (Stars/Confetti effect)
    const bgEffect = document.createElement('div');
    bgEffect.style.position = 'absolute';
    bgEffect.style.inset = '0';
    bgEffect.style.background = 'radial-gradient(circle at 50% 10%, rgba(0,210,255,0.15) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(196,113,237,0.1) 0%, transparent 50%)';
    bgEffect.style.pointerEvents = 'none';
    
    // Add some "confetti" dots via box-shadow
    const dots = document.createElement('div');
    dots.style.width = '4px';
    dots.style.height = '4px';
    dots.style.background = 'transparent';
    dots.style.borderRadius = '50%';
    dots.style.position = 'absolute';
    dots.style.top = '0';
    dots.style.left = '0';
    dots.style.boxShadow = '100px 200px #ffd700, 400px 150px #ff007a, 250px 400px #00d2ff, 450px 600px #00ff88, 150px 700px #ffd700, 350px 850px #c471ed, 50px 500px #ff007a, 480px 300px #00d2ff, 200px 100px #c471ed';
    dots.style.opacity = '0.6';
    bgEffect.appendChild(dots);
    exportDiv.appendChild(bgEffect);
    
    // Logo
    const logo = document.createElement('div');
    logo.innerHTML = 'MVG <span style="color: #00d2ff;">STATS</span>';
    logo.style.color = '#fff';
    logo.style.fontSize = '2.5rem';
    logo.style.fontWeight = '900';
    logo.style.marginBottom = '2.5rem';
    logo.style.letterSpacing = '2px';
    
    const title = document.createElement('h1');
    title.innerText = 'TOP 3 VENDEDORES';
    title.style.fontSize = '2.2rem';
    title.style.marginBottom = '0.5rem';
    title.style.color = '#ffdf00'; // Bright gold
    title.style.textShadow = '0 4px 15px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)';
    title.style.fontWeight = '900';
    title.style.letterSpacing = '1px';
    
    // Date
    const dateSub = document.createElement('h2');
    const dStart = document.getElementById('dash-start').value.split('-').reverse().join('/');
    const dEnd = document.getElementById('dash-end').value.split('-').reverse().join('/');
    dateSub.innerText = `${dStart} al ${dEnd}`;
    dateSub.style.color = '#888';
    dateSub.style.fontSize = '1.1rem';
    dateSub.style.marginBottom = '5rem';
    
    // Podium Clone
    const podiumClone = document.getElementById('top3-podium').cloneNode(true);
    podiumClone.style.borderBottom = 'none';
    
    // Glowing pedestal underneath
    const pedestal = document.createElement('div');
    pedestal.style.width = '100%';
    pedestal.style.height = '20px';
    pedestal.style.background = 'radial-gradient(ellipse at center, rgba(0, 210, 255, 0.4) 0%, transparent 70%)';
    pedestal.style.marginTop = '-10px';
    pedestal.style.zIndex = '-1';
    
    const podiumWrapper = document.createElement('div');
    podiumWrapper.style.position = 'relative';
    podiumWrapper.style.display = 'flex';
    podiumWrapper.style.flexDirection = 'column';
    podiumWrapper.style.alignItems = 'center';
    podiumWrapper.appendChild(podiumClone);
    podiumWrapper.appendChild(pedestal);
    
    // Append all
    exportDiv.appendChild(logo);
    exportDiv.appendChild(title);
    exportDiv.appendChild(dateSub);
    exportDiv.appendChild(podiumWrapper);
    
    // Watermark
    const water = document.createElement('div');
    water.innerHTML = '🔥 POWERED BY <strong>MVG STATS</strong>';
    water.style.position = 'absolute';
    water.style.bottom = '2rem';
    water.style.color = 'rgba(255,255,255,0.2)';
    water.style.fontSize = '0.9rem';
    water.style.letterSpacing = '1px';
    exportDiv.appendChild(water);
    
    document.body.appendChild(exportDiv);
    
    setTimeout(() => {
        html2canvas(exportDiv, {
            backgroundColor: '#0a0a0f',
            scale: 2 // Outputs 1080x1920 image
        }).then(async (canvas) => {
            const dateStr = document.getElementById('dash-start').value;
            const filename = `Top3_${dateStr}.png`;
            const dataUrl = canvas.toDataURL('image/png');
            
            try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                
                // Force direct download to the Downloads folder
                const link = document.createElement('a');
                link.download = filename;
                const blobUrl = URL.createObjectURL(blob);
                link.href = blobUrl;
                link.click();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            } catch(e) {
                console.error(e);
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            }
            
            btn.innerHTML = origHTML;
            btn.disabled = false;
            document.body.removeChild(exportDiv);
        }).catch(err => {
            console.error(err);
            btn.innerHTML = origHTML;
            btn.disabled = false;
            document.body.removeChild(exportDiv);
        });
    }, 500);
}

async function exportToExcel() {
    if (!dashData || dashData.length === 0) return;
    
    const btn = document.getElementById('btn-export-excel');
    const origHTML = btn.innerHTML;
    btn.innerHTML = 'Generando...';
    btn.disabled = true;

    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte');

        const startStr = document.getElementById('dash-start').value;
        const endStr = document.getElementById('dash-end').value;
        
        // Generate array of dates
        const startDate = new Date(startStr + 'T00:00:00');
        const endDate = new Date(endStr + 'T00:00:00');
        const dates = [];
        let curr = new Date(startDate);
        while (curr <= endDate) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
        }

        const dateStrsForHeader = dates.map(d => {
            const dateObj = new Date(d + 'T00:00:00');
            const days = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
            return `${days[dateObj.getDay()]} ${d.split('-').reverse().join('/')}`;
        });

        // ROW 1: Title
        const titleRow = sheet.addRow([`REPORTE DEL ${startStr.split('-').reverse().join('/')} AL ${endStr.split('-').reverse().join('/')}`]);
        titleRow.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        
        // ROW 2: Main Headers
        const row2 = ['NOMBRE'];
        dates.forEach(d => {
            row2.push(dateStrsForHeader[dates.indexOf(d)]);
            row2.push(''); // For merging
        });
        row2.push('TOTAL SHOTS', 'TOTAL VENTAS', '% CIERRE', 'CXL', 'ADS', '% ADS');
        const headerRow2 = sheet.addRow(row2);
        
        // ROW 3: Sub Headers
        const row3 = [''];
        dates.forEach(() => {
            row3.push('SHOTS');
            row3.push('VENTAS');
        });
        row3.push('', '', '', '', '', '');
        const headerRow3 = sheet.addRow(row3);

        // Merge cells
        sheet.mergeCells(1, 1, 1, 1 + (dates.length * 2) + 6); // Title spans all
        sheet.mergeCells(2, 1, 3, 1); // NOMBRE spans vertically
        
        let colIdx = 2;
        dates.forEach(() => {
            sheet.mergeCells(2, colIdx, 2, colIdx + 1); // Date spans SHOTS and VENTAS
            colIdx += 2;
        });
        
        const totalColsStart = 2 + (dates.length * 2);
        sheet.mergeCells(2, totalColsStart, 3, totalColsStart); // TOTAL SHOTS
        sheet.mergeCells(2, totalColsStart + 1, 3, totalColsStart + 1); // TOTAL VENTAS
        sheet.mergeCells(2, totalColsStart + 2, 3, totalColsStart + 2); // % CIERRE
        sheet.mergeCells(2, totalColsStart + 3, 3, totalColsStart + 3); // CXL
        sheet.mergeCells(2, totalColsStart + 4, 3, totalColsStart + 4); // ADS
        sheet.mergeCells(2, totalColsStart + 5, 3, totalColsStart + 5); // % ADS

        // Style headers
        [headerRow2, headerRow3].forEach(row => {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0070C0' }
                };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
                };
            });
        });
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Data Rows
        const specialNames = ['EN REPORTE', 'TOTALES'];
        const regularData = dashData.filter(d => !specialNames.includes(d.name));
        
        const addDataRow = (u) => {
            const rowData = [u.name];
            dates.forEach(d => {
                if (u.daily && u.daily[d]) {
                    rowData.push(u.daily[d].shots || 0);
                    rowData.push(u.daily[d].ventas || 0);
                } else {
                    rowData.push(0);
                    rowData.push(0);
                }
            });
            rowData.push(u.totals.shots);
            rowData.push(u.totals.ventas);
            rowData.push(u.cierre); // Decimal format for excel percentage
            rowData.push(u.totals.cxl);
            rowData.push(u.totals.ads);
            rowData.push(u.totals.shots > 0 ? (u.totals.ads / u.totals.shots) : 0);
            
            const row = sheet.addRow(rowData);
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: {style:'thin', color: {argb:'FFDDDDDD'}}, 
                    left: {style:'thin', color: {argb:'FFDDDDDD'}}, 
                    bottom: {style:'thin', color: {argb:'FFDDDDDD'}}, 
                    right: {style:'thin', color: {argb:'FFDDDDDD'}}
                };
                cell.alignment = { horizontal: 'center' };
                
                // Format percentages
                if (colNumber === totalColsStart + 2 || colNumber === totalColsStart + 5) {
                    cell.numFmt = '0.00%';
                }
                
                // Left align names
                if (colNumber === 1) cell.alignment = { horizontal: 'left' };
            });
        };

        // Sort exactly as the dashboard table is currently sorted
        regularData.sort((a, b) => {
            let valA, valB;
            if (sortCol === 'name')   { valA = a.name; valB = b.name; }
            if (sortCol === 'shots')  { valA = a.totals.shots;  valB = b.totals.shots; }
            if (sortCol === 'ventas') { valA = a.totals.ventas; valB = b.totals.ventas; }
            if (sortCol === 'cierre') { valA = a.cierre;        valB = b.cierre; }
            if (sortCol === 'ads')    { valA = a.totals.ads;    valB = b.totals.ads; }
            if (sortCol === 'links')  { valA = a.totals.links;  valB = b.totals.links; }
            if (sortCol === 'cxl')    { valA = a.totals.cxl;   valB = b.totals.cxl; }
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            // Tie-breakers
            if (sortCol !== 'shots' && a.totals.shots !== b.totals.shots)
                return b.totals.shots - a.totals.shots;
            if (sortCol !== 'ventas' && a.totals.ventas !== b.totals.ventas)
                return b.totals.ventas - a.totals.ventas;
            if (sortCol !== 'links' && (a.totals.links || 0) !== (b.totals.links || 0))
                return (b.totals.links || 0) - (a.totals.links || 0);
            if (sortCol !== 'ads' && (a.totals.ads || 0) !== (b.totals.ads || 0))
                return (b.totals.ads || 0) - (a.totals.ads || 0);
            return a.name.localeCompare(b.name);
        });

        regularData.forEach(addDataRow);

        const enReporte = dashData.find(d => d.name === 'EN REPORTE');
        if (enReporte) addDataRow(enReporte);

        // Totals Row
        let totShots = 0, totVentas = 0, totAds = 0, totCxl = 0;
        regularData.forEach(d => {
            totShots += d.totals.shots;
            totVentas += d.totals.ventas;
            totAds += d.totals.ads;
            totCxl += d.totals.cxl;
        });
        const totCierre = totShots > 0 ? (totVentas / totShots) : 0;
        const totPctAds = totShots > 0 ? (totAds / totShots) : 0;

        const totRowData = ['TOTALES'];
        dates.forEach(d => {
            let dShots = 0, dVentas = 0;
            regularData.forEach(u => {
                if (u.daily && u.daily[d]) {
                    dShots += (u.daily[d].shots || 0);
                    dVentas += (u.daily[d].ventas || 0);
                }
            });
            totRowData.push(dShots);
            totRowData.push(dVentas);
        });
        totRowData.push(totShots, totVentas, totCierre, totCxl, totAds, totPctAds);
        
        const totRow = sheet.addRow(totRowData);
        totRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = { 
                top: {style:'thin', color:{argb:'FF000000'}}, 
                left: {style:'thin', color:{argb:'FF000000'}}, 
                bottom: {style:'thin', color:{argb:'FF000000'}}, 
                right: {style:'thin', color:{argb:'FF000000'}} 
            };
            cell.alignment = { horizontal: 'center' };
            if (colNumber === totalColsStart + 2 || colNumber === totalColsStart + 5) {
                cell.numFmt = '0.00%';
            }
            if (colNumber === 1) cell.alignment = { horizontal: 'left' };
        });

        // Set column widths
        sheet.getColumn(1).width = 18;
        for(let i=2; i<=1 + (dates.length * 2); i++) {
            sheet.getColumn(i).width = 8;
        }
        for(let i=totalColsStart; i<=totalColsStart+5; i++) {
            sheet.getColumn(i).width = 13;
        }

        // Generate Blob and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Reporte_Stats_${startStr}_al_${endStr}.xlsx`);
        
    } catch (e) {
        console.error(e);
        alert('Error generando Excel');
    } finally {
        btn.innerHTML = origHTML;
        btn.disabled = false;
    }
}

