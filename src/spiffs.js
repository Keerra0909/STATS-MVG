// --- SPIFFS ---
let editingSpiffId = null;

async function loadCarrera() {
    const today = new Date();
    const day = today.getDay() || 7; 
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const localStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        weekDates.push(localStr);
    }

    const dateRangeEl = document.getElementById('carrera-date-range');
    if (dateRangeEl) {
        const startD = weekDates[0].split('-');
        const endD = weekDates[6].split('-');
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        dateRangeEl.innerText = `(${startD[2]} ${months[parseInt(startD[1])-1]} - ${endD[2]} ${months[parseInt(endD[1])-1]})`;
    }

    try {
        // Fetch config first
        const cfgDoc = await firestore.collection('settings').doc('carrera').get();
        if (cfgDoc.exists) {
            carreraConfig = { ...carreraConfig, ...cfgDoc.data() };
        }
        
        const badge = document.getElementById('carrera-min-pts-badge');
        if (badge) badge.innerText = `Mínimo ${carreraConfig.min} Ventas`;

        const snap = await firestore.collection('stats')
            .where('date', 'in', weekDates)
            .get();

        const userPoints = {};
        
        snap.forEach(doc => {
            const data = doc.data();
            if (!userPoints[data.name]) userPoints[data.name] = 0;
            
            let pts = 0;
            if (data.singles !== undefined) {
                // New detailed data
                pts = (data.singles * carreraConfig.p1) + 
                      ((data.dobles || 0) * carreraConfig.p2) + 
                      ((data.triples || 0) * carreraConfig.p3) + 
                      ((data.cuadruples || 0) * carreraConfig.p4) + 
                      ((data.quintuples || 0) * carreraConfig.p5) + 
                      ((data.arpones || 0) * carreraConfig.pa);
            } else {
                // Legacy data: 'ventas' represents total individual sales for the day. 
                // Massive closes should be manually edited by admin to use detailed fields.
                const v = data.ventas || 0;
                pts = v * carreraConfig.p1;
            }
            
            userPoints[data.name] += pts;
        });

        // OVERRIDE FOR WEEK JULY 13 - 19
        if (weekDates.includes('2026-07-13')) {
            const manualScores = {
                "ISA": 12.5, "MICHELLE": 10.0, "ANDERSON": 9.5, "ALEX": 9.0,
                "RICKY": 8.0, "TONY": 8.0, "GALA": 8.0, "GONZALO": 7.5,
                "ANDRES A": 7.5, "SEBASTIAN": 7.5, "ERICK": 7.0, "BONJO": 7.0,
                "MONTSE": 6.5, "CHRIS": 6.0, "GALAOR": 6.0, "ANTONIO": 5.5,
                "NANCY": 5.5, "JOSEFINA": 5.0, "PANCHO": 4.5, "ANA M": 4.5,
                "ANDRES G": 4.5, "ADRIAN": 4.5, "JUANJO JJ": 4.5, "BRUNO": 4.5,
                "RICARDO": 4.5, "SERGIO": 4.0, "MIKE": 3.5, "PAOLO": 3.5,
                "NONO": 3.0, "JP": 2.5, "LEONARDO": 1.5
            };
            
            // Apply the manual scores for this specific week only
            Object.keys(manualScores).forEach(name => {
                userPoints[name] = manualScores[name];
            });
            
            // Clean up any other users that might have been picked up from DB but shouldn't be here
            Object.keys(userPoints).forEach(name => {
                if (manualScores[name] === undefined && manualScores[name.replace(' M', '')] === undefined) {
                    delete userPoints[name];
                }
            });
        }

        const leaderboard = Object.keys(userPoints)
            .map(name => ({ name, points: userPoints[name] }))
            .sort((a, b) => b.points - a.points);

        // TEMPORARY OVERRIDE FOR THIS WEEK (July 13 - 19)
        if (weekDates.includes('2026-07-13')) {
            leaderboard.forEach(item => {
                const n = item.name.toUpperCase();
                if (n.includes('ISA')) item.points = 12.5;
                if (n.includes('MICHELLE')) item.points = 10;
                if (n.includes('ANDERSON')) item.points = 9.5;
                if (n.includes('RICKY')) item.points = 8.5; // Capped
                if (n.includes('GALA')) item.points = 8.0;  // Capped
            });
            leaderboard.sort((a, b) => b.points - a.points);
        }

        const renderMedal = (idx, idPrefix) => {
            const data = leaderboard[idx];
            const nameEl = document.getElementById(`${idPrefix}-${idx + 1}`);
            const ptsEl = document.getElementById(`${idPrefix}-pts-${idx + 1}`);
            
            if (data && data.points > 0) {
                nameEl.innerText = data.name;
                ptsEl.innerText = `${data.points} pts`;
                if (data.points < carreraConfig.min) {
                    nameEl.style.opacity = '0.5';
                    ptsEl.style.opacity = '0.5';
                } else {
                    nameEl.style.opacity = '1';
                    ptsEl.style.opacity = '1';
                }
            } else {
                nameEl.innerText = '--';
                ptsEl.innerText = '0 pts';
                nameEl.style.opacity = '1';
                ptsEl.style.opacity = '1';
            }
        };

        renderMedal(0, 'carrera');
        renderMedal(1, 'carrera');
        renderMedal(2, 'carrera');

        const tbody = document.getElementById('carrera-table-body');
        tbody.innerHTML = '';
        leaderboard.forEach((item, index) => {
            if (item.points === 0) return;
            const opacity = '1'; // Removed fading for readability
            let posStr = `${index + 1}`;
            if (index === 0) posStr = '🥇 1';
            if (index === 1) posStr = '🥈 2';
            if (index === 2) posStr = '🥉 3';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 1rem; border-bottom: 1px solid var(--border); font-weight: bold; opacity: ${opacity};">${posStr}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--border); opacity: ${opacity};">${item.name}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--border); text-align: center; font-weight: bold; color: var(--primary); opacity: ${opacity};">${item.points}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading carrera", e);
    }
}

async function loadSpiffs() {
    const adminPanel = document.getElementById('spiff-admin-panel');
    if (currentUser && currentUser.role === 'admin') {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }
    
    const activeContainer = document.getElementById('spiffs-active-container');
    const completedContainer = document.getElementById('spiffs-completed-container');
    const archivedContainer = document.getElementById('spiffs-archived-container');
    if(!activeContainer) return;
    
    activeContainer.innerHTML = '<div class="skeleton" style="height:150px; width:100%;"></div>';
    completedContainer.innerHTML = '<div class="skeleton" style="height:100px; width:100%;"></div>';
    if(archivedContainer) archivedContainer.innerHTML = '';

    try {
        const snap = await firestore.collection('spiffs').orderBy('createdAt', 'desc').get();
        activeContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        if(archivedContainer) archivedContainer.innerHTML = '';
        
        if (snap.empty) {
            activeContainer.innerHTML = '<p style="color:var(--text-muted);">No hay Spiffs activos.</p>';
            return;
        }

        snap.forEach(doc => {
            const s = doc.data();
            s.id = doc.id;
            const card = document.createElement('div');
            card.id = `spiff-card-${s.id}`;
            card.style.background = 'var(--surface)';
            card.style.padding = '1.5rem';
            card.style.borderRadius = '12px';
            card.style.border = '1px solid var(--border)';
            card.style.position = 'relative';
            
            let dateStr = 'Hoy';
            if (s.createdAt) {
                const dateObj = s.createdAt.toDate ? s.createdAt.toDate() : new Date();
                dateStr = dateObj.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
            }

            if (s.status === 'active') {
                card.innerHTML = `<h3 style="margin-top:0; color:#fff;">🔥 ${s.title} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-left:10px;">(${dateStr})</span></h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">🕒 ${s.time || 'Día completo'} | 🗓️ ${s.period.toUpperCase()}</p>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">🎯 Métrica: ${s.metric}</p>
                    ${s.cierre ? `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">📈 Min % Cierre: ${s.cierre}</p>` : `<div style="margin-bottom:1rem;"></div>`}
                    <div style="background:rgba(16,185,129,0.1); color:#10b981; padding:0.5rem 1rem; border-radius:8px; display:inline-block; font-weight:bold; margin-bottom:1rem;">
                        Premio: ${s.prize}
                    </div>`;
                
                if (currentUser && currentUser.role === 'admin') {
                    const adminControls = document.createElement('div');
                    adminControls.style.marginTop = '1rem';
                    adminControls.style.borderTop = '1px solid var(--border)';
                    adminControls.style.paddingTop = '1rem';
                    let selectHtml = `<select id="winner-${s.id}" style="width:100%; margin-bottom:10px; padding:0.5rem; border-radius:6px; background:var(--bg-color); color:var(--text); border:1px solid var(--border);">
                        <option value="">Seleccionar Ganador...</option>
                        <option value="SIN GANADOR">❌ Nadie (Sin ganador)</option>`;
                    
                    if (globalActiveUsers) {
                        globalActiveUsers.forEach(u => {
                            if(u.role !== 'admin') selectHtml += `<option value="${u.name}">${u.name}</option>`;
                        });
                    }
                    
                    selectHtml += `</select><button onclick="declareSpiffWinner('${s.id}')" class="btn-primary" style="width:100%; padding:0.5rem; margin-bottom: 0.5rem;">Declarar Ganador 🏆</button>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="editSpiff('${s.id}', '${s.title.replace(/'/g, "\\'")}', '${(s.time||'').replace(/'/g, "\\'")}', '${s.period}', '${(s.prize||'').replace(/'/g, "\\'")}', '${(s.metric||'').replace(/'/g, "\\'")}', '${(s.cierre||'').replace(/'/g, "\\'")}')" class="btn-secondary" style="flex:1; padding:0.5rem; color: #3b82f6; border-color: rgba(59, 130, 246, 0.3);">Editar ✏️</button>
                        <button onclick="deleteSpiff('${s.id}')" class="btn-secondary" style="flex:1; padding:0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Eliminar 🗑️</button>
                    </div>`;
                    adminControls.innerHTML = selectHtml;
                    card.appendChild(adminControls);
                }
                activeContainer.appendChild(card);
            } else if (s.status === 'completed') {
                card.innerHTML = `<h4 style="margin-top:0; color:var(--text-muted);">✔️ ${s.title} <span style="font-size:0.75rem; font-weight:normal; margin-left:5px;">(${dateStr})</span></h4>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">⏱️ ${s.time || 'Día completo'} | 📅 ${s.period.toUpperCase()}</p>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">📊 Métrica: ${s.metric}</p>
                    ${s.cierre ? `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">🎯 Min % Cierre: ${s.cierre}</p>` : ''}
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Premio: ${s.prize}</p>
                    <div style="background:rgba(79,172,254,0.1); color:#4facfe; padding:0.5rem; border-radius:8px; text-align:center; font-weight:bold;">
                        ${s.winner === 'SIN GANADOR' ? '❌ SIN GANADOR' : `👑 Ganador: ${s.winner}`}
                    </div>`;
                
                if (currentUser && currentUser.role === 'admin') {
                    const controls = document.createElement('div');
                    controls.setAttribute('data-html2canvas-ignore', 'true');
                    controls.style.display = 'flex';
                    controls.style.gap = '0.5rem';
                    controls.style.marginTop = '10px';
                    
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-secondary';
                    editBtn.style.cssText = 'flex: 1; padding: 0.4rem; font-size: 0.8rem; color: #3b82f6; border-color: rgba(59, 130, 246, 0.3);';
                    editBtn.innerText = 'Editar ✏️';
                    editBtn.onclick = () => editSpiff(s.id, s.title, s.time, s.period, s.prize, s.metric, s.cierre);
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-secondary';
                    deleteBtn.style.cssText = 'flex: 1; padding: 0.4rem; font-size: 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);';
                    deleteBtn.innerText = 'Eliminar 🗑️';
                    deleteBtn.onclick = () => deleteSpiff(s.id);
                    
                    const archiveBtn = document.createElement('button');
                    archiveBtn.className = 'btn-secondary';
                    archiveBtn.style.cssText = 'flex: 1; padding: 0.4rem; font-size: 0.8rem; color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);';
                    archiveBtn.innerText = 'Archivar 📦';
                    archiveBtn.onclick = () => archiveSpiff(s.id);
                    
                    controls.appendChild(editBtn);
                    controls.appendChild(deleteBtn);
                    controls.appendChild(archiveBtn);
                    card.appendChild(controls);
                }
                
                const dlBtn = document.createElement('button');
                dlBtn.setAttribute('data-html2canvas-ignore', 'true');
                dlBtn.className = 'btn-secondary';
                dlBtn.style.cssText = 'width: 100%; padding: 0.5rem; margin-top: 10px; font-size: 0.85rem; border-color: rgba(255, 255, 255, 0.2);';
                dlBtn.innerHTML = 'Descargar Foto 📸';
                dlBtn.onclick = () => downloadSpiffImage(s.id);
                card.appendChild(dlBtn);
                

                completedContainer.appendChild(card);
            } else if (s.status === 'archived') {
                card.innerHTML = `<h4 style="margin-top:0; color:var(--text-muted);">📦 ${s.title} <span style="font-size:0.75rem; font-weight:normal; margin-left:5px;">(${dateStr})</span></h4>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">⏱️ ${s.time || 'Día completo'} | 📅 ${s.period.toUpperCase()}</p>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">📊 Métrica: ${s.metric}</p>
                    ${s.cierre ? `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.25rem;">🎯 Min % Cierre: ${s.cierre}</p>` : ''}
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Premio: ${s.prize}</p>
                    <div style="background:rgba(255,255,255,0.05); color:var(--text-muted); padding:0.5rem; border-radius:8px; text-align:center; font-weight:bold;">
                        ${s.winner === 'SIN GANADOR' ? '❌ SIN GANADOR' : `👑 Ganador: ${s.winner}`}
                    </div>`;
                
                if (currentUser && currentUser.role === 'admin') {
                    const controls = document.createElement('div');
                    controls.setAttribute('data-html2canvas-ignore', 'true');
                    controls.style.display = 'flex';
                    controls.style.gap = '0.5rem';
                    controls.style.marginTop = '10px';
                    
                    const unarchiveBtn = document.createElement('button');
                    unarchiveBtn.className = 'btn-secondary';
                    unarchiveBtn.style.cssText = 'flex: 1; padding: 0.4rem; font-size: 0.8rem; color: #10b981; border-color: rgba(16, 185, 129, 0.3);';
                    unarchiveBtn.innerText = 'Desarchivar ♻️';
                    unarchiveBtn.onclick = () => unarchiveSpiff(s.id);
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-secondary';
                    deleteBtn.style.cssText = 'flex: 1; padding: 0.4rem; font-size: 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);';
                    deleteBtn.innerText = 'Eliminar 🗑️';
                    deleteBtn.onclick = () => deleteSpiff(s.id);
                    
                    controls.appendChild(unarchiveBtn);
                    controls.appendChild(deleteBtn);
                    card.appendChild(controls);
                }
                
                if(archivedContainer) archivedContainer.appendChild(card);
            }
        });
    } catch (e) {
        console.error("Error loading spiffs", e);
    }
}

async function createSpiff() {
    const title = document.getElementById('spiff-title').value;
    const time = document.getElementById('spiff-time').value;
    const period = document.getElementById('spiff-period').value;
    let prize = document.getElementById('spiff-prize').value.trim();
    
    // Auto-format prize to $X USD
    const prizeMatch = prize.match(/\d+/);
    if (prizeMatch) {
        prize = `$${prizeMatch[0]} USD`;
    }
    let metric = document.getElementById('spiff-metric').value.trim();
    let cierre = document.getElementById('spiff-cierre').value.trim();
    
    if (/^\d+$/.test(metric)) {
        metric = `Mínimo ${metric} ventas`;
    }
    if (/^\d+$/.test(cierre)) {
        cierre = `${cierre}%`;
    }
    
    if (!title || !prize || !metric) return alert('Por favor llena el título, premio y métrica.');
    
    try {
        if (editingSpiffId) {
            await firestore.collection('spiffs').doc(editingSpiffId).update({
                title, time, period, prize, metric, cierre, status: 'active', winner: null // Reactivates if completed
            });
            editingSpiffId = null;
            document.getElementById('spiff-submit-btn').innerText = 'Lanzar Spiff 🔥';
        } else {
            await firestore.collection('spiffs').add({
                title, time, period, prize, metric, cierre, status: 'active', winner: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        document.getElementById('spiff-title').value = '';
        document.getElementById('spiff-time').value = '';
        document.getElementById('spiff-prize').value = '';
        document.getElementById('spiff-metric').value = '';
        document.getElementById('spiff-cierre').value = '';
        loadSpiffs();
    } catch (e) { console.error(e); alert('Error al crear spiff'); }
}

async function declareSpiffWinner(id) {
    const winner = document.getElementById('winner-' + id).value;
    if (!winner) return alert('Selecciona un ganador primero');
    try {
        await firestore.collection('spiffs').doc(id).update({
            status: 'completed', winner: winner, completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadSpiffs();
    } catch(e) { console.error(e); alert('Error al declarar ganador'); }
}

function archiveSpiff(id) {
    showConfirmModal('¿Estás seguro de que deseas archivar este Spiff? Desaparecerá del historial.', async () => {
        try {
            await firestore.collection('spiffs').doc(id).update({
                status: 'archived', archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadSpiffs();
        } catch(e) { console.error(e); alert('Error al archivar Spiff'); }
    });
}

function deleteSpiff(id) {
    showConfirmModal('¿Estás seguro de que deseas eliminar este Spiff? Esta acción no se puede deshacer.', async () => {
        try {
            await firestore.collection('spiffs').doc(id).delete();
            loadSpiffs();
        } catch(e) { console.error(e); alert('Error al eliminar Spiff'); }
    });
}

async function unarchiveSpiff(id) {
    try {
        await firestore.collection('spiffs').doc(id).update({
            status: 'completed'
        });
        loadSpiffs();
    } catch(e) { console.error(e); alert('Error al desarchivar Spiff'); }
}

function toggleArchivedSpiffs() {
    const container = document.getElementById('spiffs-archived-container');
    const btn = document.getElementById('btn-toggle-archived');
    if (!container || !btn) return;
    if (container.style.display === 'none') {
        container.style.display = 'grid';
        btn.innerText = 'Ocultar Archivados 📦';
    } else {
        container.style.display = 'none';
        btn.innerText = 'Ver Archivados 📦';
    }
}

function editSpiff(id, title, time, period, prize, metric, cierre) {
    editingSpiffId = id;
    document.getElementById('spiff-title').value = title || '';
    document.getElementById('spiff-time').value = time || '';
    document.getElementById('spiff-period').value = period || 'diario';
    document.getElementById('spiff-prize').value = prize || '';
    document.getElementById('spiff-metric').value = metric || '';
    document.getElementById('spiff-cierre').value = cierre || '';
    
    document.getElementById('spiff-submit-btn').innerText = 'Guardar Cambios 💾';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

