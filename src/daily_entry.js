// --- Daily Entry ---
let lastDailyLoadedStr = null;
async function loadDailyEntries() {
    const dateStr = document.getElementById('entry-date').value;
    if (lastDailyLoadedStr === dateStr) return;
    lastDailyLoadedStr = dateStr;
    localStorage.setItem('entryDate', dateStr);
    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayLabel = document.getElementById('entry-day-label');
    if (dayLabel) {
        if (!dateStr) {
            dayLabel.innerText = '';
        } else {
            const parts = dateStr.split('-');
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            dayLabel.innerText = dias[d.getDay()];
        }
    }

    const tbody = document.getElementById('daily-entry-body');
    if (tbody) {
        tbody.innerHTML = '';
        tbody.style.opacity = '0.5';
    }

    let users = [];
    if (globalActiveUsers) {
        users = globalActiveUsers;
    } else {
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'admin') users.push(doc.data());
        });
        users.sort((a, b) => a.name.localeCompare(b.name));
        globalActiveUsers = users;
    }
    
    // Fetch all stats in a single query for massive performance boost
    const statsSnap = await firestore.collection('stats').where('date', '==', dateStr).get();
    const statsMap = {};
    statsSnap.forEach(doc => {
        statsMap[doc.id] = doc.data();
    });
    
    for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const cleanName = u.name.replace(/ /g, '_');
        const docId = `${cleanName}_${dateStr}`;
        const stat = statsMap[docId] || null;
        
        const isLocked = !!stat;
        const disabledAttr = isLocked ? 'disabled' : '';
        const btnHtml = isLocked 
            ? `<button id="btn-save-admin-${cleanName}" class="btn-success" style="padding: 0.3rem 0.6rem; display: none;" onclick="saveDaily('${cleanName}', '${u.name.replace(/'/g, "\\'")}')">Guardar</button>
               <span id="saved-msg-admin-${cleanName}" style="color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>
               <button id="btn-edit-admin-${cleanName}" class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; margin-left: 0.5rem;" onclick="editDaily('${cleanName}')">Editar</button>`
            : `<button id="btn-save-admin-${cleanName}" class="btn-primary" onclick="saveDaily('${cleanName}', '${u.name.replace(/'/g, "\\'")}')" style="padding: 0.3rem 0.6rem;">Guardar</button>
               <span id="saved-msg-admin-${cleanName}" style="display: none; color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>
               <button id="btn-edit-admin-${cleanName}" class="btn-secondary" style="display: none; padding: 0.2rem 0.5rem; font-size: 0.7rem; margin-left: 0.5rem;" onclick="editDaily('${cleanName}')">Editar</button>`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.name}</strong></td>
            <td style="text-align: center;"><input type="number" min="0" id="shots-${cleanName}" value="${stat ? (stat.shots !== undefined ? stat.shots : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'shots')" ${disabledAttr}></td>
            <td style="text-align: center; font-weight: bold; color: var(--primary); vertical-align: middle;" id="visual-vts-${cleanName}">${stat ? (stat.ventas || 0) : 0}</td>
            <td style="text-align: center;"><input type="number" min="0" id="singles-${cleanName}" value="${stat ? (stat.singles !== undefined ? stat.singles : (stat.ventas || 0)) : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'singles')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="dobles-${cleanName}" value="${stat ? (stat.dobles || '') : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'dobles')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="triples-${cleanName}" value="${stat ? (stat.triples || '') : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'triples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="cuadruples-${cleanName}" value="${stat ? (stat.cuadruples || '') : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'cuadruples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="quintuples-${cleanName}" value="${stat ? (stat.quintuples || '') : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'quintuples')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="arpones-${cleanName}" value="${stat ? (stat.arpones || '') : ''}" class="input-field" style="width: 40px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'arpones')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="ads-${cleanName}" value="${stat ? (stat.ads !== undefined ? stat.ads : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" oninput="calcTotales('', '-${cleanName}', 'ads')" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="links-${cleanName}" value="${stat ? (stat.links !== undefined ? stat.links : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="cxl-${cleanName}" value="${stat ? (stat.cxl !== undefined ? stat.cxl : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;">
                <select id="lobby-${cleanName}" class="input-field" style="width: 80px; font-size: 0.75rem; padding: 0.2rem; text-align: center;" ${disabledAttr}>
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
    }
    if (tbody) {
        tbody.style.opacity = '1';
    }
}

function editDaily(cleanName) {
    document.getElementById(`shots-${cleanName}`).disabled = false;
    document.getElementById(`singles-${cleanName}`).disabled = false;
    document.getElementById(`dobles-${cleanName}`).disabled = false;
    document.getElementById(`triples-${cleanName}`).disabled = false;
    document.getElementById(`cuadruples-${cleanName}`).disabled = false;
    document.getElementById(`quintuples-${cleanName}`).disabled = false;
    document.getElementById(`arpones-${cleanName}`).disabled = false;
    document.getElementById(`ads-${cleanName}`).disabled = false;
    document.getElementById(`links-${cleanName}`).disabled = false;
    document.getElementById(`cxl-${cleanName}`).disabled = false;
    document.getElementById(`lobby-${cleanName}`).disabled = false;
    
    document.getElementById(`btn-save-admin-${cleanName}`).style.display = 'block';
    document.getElementById(`btn-save-admin-${cleanName}`).className = 'btn-primary';
    document.getElementById(`btn-save-admin-${cleanName}`).innerText = 'Guardar';
    document.getElementById(`saved-msg-admin-${cleanName}`).style.display = 'none';
    document.getElementById(`btn-edit-admin-${cleanName}`).style.display = 'none';
}

async function saveDaily(cleanName, realName) {
    const dateStr = document.getElementById('entry-date').value;
    const shots = Math.max(0, parseInt(document.getElementById(`shots-${cleanName}`).value) || 0);
    const singles = Math.max(0, parseInt(document.getElementById(`singles-${cleanName}`).value) || 0);
    const dobles = Math.max(0, parseInt(document.getElementById(`dobles-${cleanName}`).value) || 0);
    const triples = Math.max(0, parseInt(document.getElementById(`triples-${cleanName}`).value) || 0);
    const cuadruples = Math.max(0, parseInt(document.getElementById(`cuadruples-${cleanName}`).value) || 0);
    const quintuples = Math.max(0, parseInt(document.getElementById(`quintuples-${cleanName}`).value) || 0);
    const arpones = Math.max(0, parseInt(document.getElementById(`arpones-${cleanName}`).value) || 0);
    const ads = Math.max(0, parseInt(document.getElementById(`ads-${cleanName}`).value) || 0);
    const links = Math.max(0, parseInt(document.getElementById(`links-${cleanName}`).value) || 0);
    const cxl = Math.max(0, parseInt(document.getElementById(`cxl-${cleanName}`).value) || 0);
    const lobby = document.getElementById(`lobby-${cleanName}`).value;

    const ventas = singles + dobles + triples + cuadruples + quintuples + ads + arpones;
    const spiffPoints = (singles * 0.5) + (dobles * 1.0) + (triples * 1.5) + (cuadruples * 2.0) + (quintuples * 2.5) + (arpones * 1.0);

    const docId = `${cleanName}_${dateStr}`;
    const btn = document.getElementById(`btn-save-admin-${cleanName}`);
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        await Promise.race([
            firestore.collection('stats').doc(docId).set({
                name: realName,
                date: dateStr,
                shots, ventas, singles, dobles, triples, cuadruples, quintuples, arpones, spiffPoints, ads, links, cxl, lobby
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. El iPad podría haber perdido conexión a internet. Intenta de nuevo.")), 6000))
        ]);
        
        await recalculateUserMonth(cleanName, realName, dateStr).catch(e => console.error("Error updating monthly stats:", e));
        
        // Lock the row
        document.getElementById(`shots-${cleanName}`).disabled = true;
        document.getElementById(`singles-${cleanName}`).disabled = true;
        document.getElementById(`dobles-${cleanName}`).disabled = true;
        document.getElementById(`triples-${cleanName}`).disabled = true;
        document.getElementById(`cuadruples-${cleanName}`).disabled = true;
        document.getElementById(`quintuples-${cleanName}`).disabled = true;
        document.getElementById(`arpones-${cleanName}`).disabled = true;
        document.getElementById(`ads-${cleanName}`).disabled = true;
        document.getElementById(`links-${cleanName}`).disabled = true;
        document.getElementById(`cxl-${cleanName}`).disabled = true;
        document.getElementById(`lobby-${cleanName}`).disabled = true;
        
        btn.style.display = 'none';
        btn.disabled = false;
        document.getElementById(`saved-msg-admin-${cleanName}`).style.display = 'inline-block';
        document.getElementById(`btn-edit-admin-${cleanName}`).style.display = 'inline-block';
    } catch (err) {
        alert(err.message || "Error al guardar. Revisa tu conexión a internet.");
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
}

