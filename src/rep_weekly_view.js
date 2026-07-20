// --- Rep Weekly View ---
async function loadRepWeekly() {
    if (!currentUser || currentUser.role !== 'rep') return;
    
    const tbody = document.getElementById('rep-weekly-body');
    tbody.innerHTML = '';
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(diff);
    
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    const fetchPromises = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        
        const cleanName = currentUser.name.replace(/ /g, '_');
        const docId = `${cleanName}_${dateStr}`;
        fetchPromises.push(
            firestore.collection('stats').doc(docId).get().then(doc => ({
                index: i,
                dateStr: dateStr,
                stat: doc.exists ? doc.data() : null
            }))
        );
    }
    
    const results = await Promise.all(fetchPromises);
    
    results.forEach(result => {
        const i = result.index;
        const dateStr = result.dateStr;
        const stat = result.stat;
        
        const tr = document.createElement('tr');
        
        const rowDate = new Date(dateStr + 'T00:00:00');
        const todayTime = new Date().setHours(0,0,0,0);
        const isFuture = rowDate.getTime() > todayTime;

        // If stat exists or it's a future day, lock mode
        const isLocked = !!stat || isFuture;
        const disabledAttr = isLocked ? 'disabled' : '';
        
        let btnHtml = '';
        if (isFuture) {
            btnHtml = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Próximamente</span>`;
        } else {
            btnHtml = isLocked 
                ? `<span id="saved-msg-${i}" style="color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>`
                : `<button id="btn-save-${i}" class="btn-primary" onclick="saveRepStat(${i}, '${dateStr}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Guardar</button>
                   <span id="saved-msg-${i}" style="display: none; color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>`;
        }

        tr.innerHTML = `
            <td>
                <strong>${dias[i]}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${dateStr.substring(5).replace('-', '/')}</div>
            </td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-shots-${i}" value="${stat ? (stat.shots !== undefined ? stat.shots : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" oninput="calcTotales('rep-', '-${i}', 'shots')" ${disabledAttr}></td>
            <td style="text-align: center; font-weight: bold; color: var(--primary); vertical-align: middle;" id="rep-visual-vts-${i}">${stat ? (stat.ventas || 0) : 0}</td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-singles-${i}" value="${stat ? (stat.singles !== undefined ? stat.singles : (stat.ventas || 0)) : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'singles')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-dobles-${i}" value="${stat ? (stat.dobles || '') : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'dobles')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-triples-${i}" value="${stat ? (stat.triples || '') : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'triples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-cuadruples-${i}" value="${stat ? (stat.cuadruples || '') : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'cuadruples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-quintuples-${i}" value="${stat ? (stat.quintuples || '') : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'quintuples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-arpones-${i}" value="${stat ? (stat.arpones || '') : ''}" class="input-field" style="width: 45px; text-align: center; padding: 0.2rem;" oninput="calcTotales('rep-', '-${i}', 'arpones')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-ads-${i}" value="${stat ? (stat.ads !== undefined ? stat.ads : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" oninput="calcTotales('rep-', '-${i}', 'ads')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-links-${i}" value="${stat ? (stat.links !== undefined ? stat.links : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" ${disabledAttr}></td>
            <td style="text-align: center;">
                <select id="rep-lobby-${i}" class="input-field" style="width: 80px; font-size: 0.75rem; padding: 0.2rem; text-align: center;" ${disabledAttr}>
                    <option value=""></option>
                    <option value="Nizuc" ${stat && stat.lobby === 'Nizuc' ? 'selected' : ''}>Nizuc</option>
                    <option value="Sunrise" ${stat && stat.lobby === 'Sunrise' ? 'selected' : ''}>Sunrise</option>
                    <option value="The Grand" ${stat && stat.lobby === 'The Grand' ? 'selected' : ''}>The Grand</option>
                </select>
            </td>
            <td style="text-align: center; vertical-align: middle;">
                <div style="display: flex; justify-content: center; align-items: center; min-height: 40px; gap: 0.5rem;">
                    ${btnHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // --- Calculate Monthly Progress ---
    try {
        const y = today.getFullYear();
        const mo = today.getMonth(); // 0-indexed
        const daysInMonth = new Date(y, mo + 1, 0).getDate();
        const cleanName = currentUser.name.replace(/ /g, '_');

        // Fetch all days of current month using the known docId pattern
        const monthPromises = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dd = String(d).padStart(2, '0');
            const mm = String(mo + 1).padStart(2, '0');
            const dateStr = `${y}-${mm}-${dd}`;
            const docId = `${cleanName}_${dateStr}`;
            monthPromises.push(
                firestore.collection('stats').doc(docId).get().then(doc => doc.exists ? doc.data() : null)
            );
        }

        const monthDocs = await Promise.all(monthPromises);

        let monthVentas = 0;
        let monthShots = 0;
        let monthCxl = 0;

        monthDocs.forEach(data => {
            if (!data) return;
            monthVentas += data.ventas || 0;
            monthShots += data.shots || 0;
            monthCxl += data.cxl || 0;
        });

        monthVentas = Math.max(0, monthVentas - monthCxl);

        const goalVentas = globalGoals.ventas || 55;
        const goalCierre = (globalGoals.cierre || 30) / 100;

        let percVentas = goalVentas > 0 ? (monthVentas / goalVentas) * 100 : 0;
        if (percVentas > 100) percVentas = 100;

        let actualCierre = monthShots > 0 ? (monthVentas / monthShots) : 0;
        let percCierre = goalCierre > 0 ? (actualCierre / goalCierre) * 100 : 0;
        if (percCierre > 100) percCierre = 100;

        document.getElementById('rep-goal-ventas-text').innerText = `${monthVentas} / ${goalVentas}`;
        const barVentas = document.getElementById('rep-goal-ventas-bar');
        barVentas.style.width = `${percVentas}%`;
        
        document.getElementById('rep-blanqueos-text').innerText = globalMonthlyBlanks[currentUser.name] || 0;
        
        // Ventas colors: Red <= 30, Yellow 31-54, Green >= 55
        if (monthVentas <= 30) {
            barVentas.style.backgroundColor = 'var(--danger)';
        } else if (monthVentas <= 54) {
            barVentas.style.backgroundColor = '#f1c40f'; // Yellow
        } else {
            barVentas.style.backgroundColor = 'var(--success)';
        }

        document.getElementById('rep-goal-cierre-target').innerText = globalGoals.cierre || 30;
        document.getElementById('rep-goal-cierre-text').innerText = `${(actualCierre * 100).toFixed(1)}%`;
        const barCierre = document.getElementById('rep-goal-cierre-bar');
        barCierre.style.width = `${percCierre}%`;

        // Cierre colors based on target
        const actualCierrePct = parseFloat((actualCierre * 100).toFixed(1));
        if (actualCierrePct >= 30.0) {
            barCierre.style.backgroundColor = 'var(--success)';
        } else if (actualCierrePct >= 25.0) {
            barCierre.style.backgroundColor = '#f1c40f'; // Yellow
        } else {
            barCierre.style.backgroundColor = 'var(--danger)';
        }
    } catch(e) { console.error("Error calculating monthly progress", e); }
}

function editRepStat(index) {
    // Deprecated: Reps can no longer edit their own stats once saved.
}

async function saveRepStat(index, dateStr) {
    const cleanName = currentUser.name.replace(/ /g, '_');
    const shots = Math.max(0, parseInt(document.getElementById(`rep-shots-${index}`).value) || 0);
    const singles = Math.max(0, parseInt(document.getElementById(`rep-singles-${index}`).value) || 0);
    const dobles = Math.max(0, parseInt(document.getElementById(`rep-dobles-${index}`).value) || 0);
    const triples = Math.max(0, parseInt(document.getElementById(`rep-triples-${index}`).value) || 0);
    const cuadruples = Math.max(0, parseInt(document.getElementById(`rep-cuadruples-${index}`).value) || 0);
    const quintuples = Math.max(0, parseInt(document.getElementById(`rep-quintuples-${index}`).value) || 0);
    const arpones = Math.max(0, parseInt(document.getElementById(`rep-arpones-${index}`).value) || 0);
    const ads = Math.max(0, parseInt(document.getElementById(`rep-ads-${index}`).value) || 0);
    const links = Math.max(0, parseInt(document.getElementById(`rep-links-${index}`).value) || 0);
    const cxl = 0; // Not edited by rep directly yet
    const lobby = document.getElementById(`rep-lobby-${index}`).value;

    const ventas = singles + dobles + triples + cuadruples + quintuples + ads + arpones;
    const spiffPoints = (singles * 0.5) + (dobles * 1.0) + (triples * 1.5) + (cuadruples * 2.0) + (quintuples * 2.5) + (arpones * 1.0);

    const docId = `${cleanName}_${dateStr}`;
    const btn = document.getElementById(`btn-save-${index}`);
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        await Promise.race([
            firestore.collection('stats').doc(docId).set({
                name: currentUser.name,
                date: dateStr,
                shots, ventas, singles, dobles, triples, cuadruples, quintuples, arpones, spiffPoints, ads, links, cxl, lobby
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. El iPad podría haber perdido conexión a internet. Intenta de nuevo.")), 6000))
        ]);

        await recalculateUserMonth(cleanName, currentUser.name, dateStr).catch(e => console.error("Error updating monthly stats:", e));

        document.getElementById(`rep-shots-${index}`).disabled = true;
        document.getElementById(`rep-singles-${index}`).disabled = true;
        document.getElementById(`rep-dobles-${index}`).disabled = true;
        document.getElementById(`rep-triples-${index}`).disabled = true;
        document.getElementById(`rep-cuadruples-${index}`).disabled = true;
        document.getElementById(`rep-quintuples-${index}`).disabled = true;
        document.getElementById(`rep-arpones-${index}`).disabled = true;
        document.getElementById(`rep-ads-${index}`).disabled = true;
        document.getElementById(`rep-links-${index}`).disabled = true;
        document.getElementById(`rep-lobby-${index}`).disabled = true;
        
        btn.style.display = 'none';
        btn.disabled = false;
        document.getElementById(`saved-msg-${index}`).style.display = 'inline-block';
    } catch (err) {
        alert(err.message || "Error al guardar. Revisa tu conexión a internet.");
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
}

