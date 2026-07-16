// --- Database Setup ---
const db = new Dexie('StatsMasterDB');
db.version(1).stores({
    users: '++id, name, active', // active: 1 or 0
    stats: '++id, userId, date, shots, ventas, ads, links, cxl' // date format: YYYY-MM-DD
});

let myChart = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Restore saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').innerText = savedTheme === 'light' ? '🌙' : '☀️';

    // Set today for inputs
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById('entry-date').value = today;
    setDashRange('week');

    // Pre-populate users if empty
    const count = await db.users.count();
    if (count === 0) {
        const initialUsers = ["ADRIAN", "ALEX", "ANA M", "ANDERSON"];
        for (const name of initialUsers) {
            await db.users.add({ name, active: 1 });
        }
    }
    
    await injectWednesdayData();

    const savedView = localStorage.getItem('view') || 'dashboard';
    navigate(savedView);
});

async function injectWednesdayData() {
    if (localStorage.getItem('wednesday_injected')) return;

    const wedData = [
        {name: "ADRIAN", shots: 8, ventas: 3},
        {name: "ALEX", shots: 7, ventas: 1},
        {name: "ANA M", shots: 6, ventas: 2},
        {name: "ANDERSON", shots: 9, ventas: 7},
        {name: "ANDRES G", shots: 4, ventas: 2},
        {name: "BONJO", shots: 7, ventas: 0},
        {name: "CHRIS", shots: 6, ventas: 0},
        {name: "ERICK", shots: 1, ventas: 0},
        {name: "GALA", shots: 5, ventas: 13},
        {name: "GONZALO", shots: 4, ventas: 2},
        {name: "JP", shots: 8, ventas: 0},
        {name: "JUANJO JJ", shots: 6, ventas: 0},
        {name: "MIKE", shots: 12, ventas: 6},
        {name: "MONTSE", shots: 9, ventas: 0},
        {name: "NANCY", shots: 8, ventas: 4},
        {name: "NONO", shots: 5, ventas: 2},
        {name: "PANCHO", shots: 4, ventas: 0},
        {name: "RICKY", shots: 5, ventas: 5},
        {name: "SEBASTIAN", shots: 6, ventas: 0},
        {name: "SERGIO", shots: 7, ventas: 1},
        {name: "TONY", shots: 7, ventas: 3}
    ];

    const date = '2026-07-15';

    for (const d of wedData) {
        const u = await db.users.where('name').equals(d.name).first();
        if (u) {
            const existing = await db.stats.get({ userId: u.id, date: date });
            if (existing) {
                await db.stats.update(existing.id, { shots: d.shots, ventas: d.ventas });
            } else {
                await db.stats.add({ userId: u.id, date: date, shots: d.shots, ventas: d.ventas, ads: 0, links: 0, cxl: 0 });
            }
        }
    }

    localStorage.setItem('wednesday_injected', 'true');
}

// --- Theme Toggle ---
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').innerText = next === 'light' ? '🌙' : '☀️';
}

// --- Navigation ---
function navigate(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.getElementById(`btn-${viewId}`).classList.add('active');

    localStorage.setItem('view', viewId);

    if (viewId === 'team') loadTeam();
    if (viewId === 'daily') loadDailyEntries();
    if (viewId === 'dashboard') loadDashboard();
}

// --- Team Management ---
async function loadTeam() {
    const activeDiv = document.getElementById('active-users-list');
    const inactiveDiv = document.getElementById('inactive-users-list');
    activeDiv.innerHTML = ''; inactiveDiv.innerHTML = '';

    const users = await db.users.toArray();
    users.sort((a, b) => a.name.localeCompare(b.name));
    users.forEach(u => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <strong>${u.name}</strong>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${u.active ? 
                    `<button class="btn-danger" onclick="toggleUser(${u.id}, 0)">Desactivar</button>` : 
                    `<button class="btn-success" onclick="toggleUser(${u.id}, 1)">Activar</button>`}
                <button class="btn-icon" title="Borrar permanentemente" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
        `;
        if (u.active) activeDiv.appendChild(card);
        else inactiveDiv.appendChild(card);
    });
}

async function addUser(e) {
    e.preventDefault();
    const input = document.getElementById('new-user-name');
    const name = input.value.trim().toUpperCase();
    if (name) {
        await db.users.add({ name, active: 1 });
        input.value = '';
        loadTeam();
    }
}

async function toggleUser(id, status) {
    await db.users.update(id, { active: status });
    loadTeam();
}

async function deleteUser(id, name) {
    if (confirm(`¿Estás súper seguro de borrar PERMANENTEMENTE a "${name}"?\n\n¡Esto eliminará todo su historial de la base de datos de inmediato!`)) {
        await db.users.delete(id);
        await db.stats.where('userId').equals(id).delete();
        loadTeam();
        loadDashboard();
    }
}

// --- Daily Entry ---
async function loadDailyEntries() {
    const dateStr = document.getElementById('entry-date').value;
    
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
    tbody.innerHTML = '';

    const users = await db.users.where('active').equals(1).toArray();
    users.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const u of users) {
        let stat = await db.stats.get({ userId: u.id, date: dateStr });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.name}</strong></td>
            <td><input type="number" id="shots-${u.id}" value="${stat ? stat.shots : 0}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;"></td>
            <td><input type="number" id="ventas-${u.id}" value="${stat ? stat.ventas : 0}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;"></td>
            <td><input type="number" id="ads-${u.id}" value="${stat ? (stat.ads || 0) : 0}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;"></td>
            <td><input type="number" id="links-${u.id}" value="${stat ? (stat.links || 0) : 0}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;"></td>
            <td><input type="number" id="cxl-${u.id}" value="${stat ? (stat.cxl || 0) : 0}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;"></td>
            <td><button class="btn-primary" onclick="saveDaily(${u.id})" style="padding: 0.3rem 0.6rem;">Guardar</button></td>
        `;
        tbody.appendChild(tr);
    }
}

async function saveDaily(id) {
    const dateStr = document.getElementById('entry-date').value;
    const shots = parseInt(document.getElementById(`shots-${id}`).value) || 0;
    const ventas = parseInt(document.getElementById(`ventas-${id}`).value) || 0;
    const ads = parseInt(document.getElementById(`ads-${id}`).value) || 0;
    const links = parseInt(document.getElementById(`links-${id}`).value) || 0;
    const cxl = parseInt(document.getElementById(`cxl-${id}`).value) || 0;

    const existing = await db.stats.get({ userId: id, date: dateStr });
    if (existing) {
        await db.stats.update(existing.id, { shots, ventas, ads, links, cxl });
    } else {
        await db.stats.add({ userId: id, date: dateStr, shots, ventas, ads, links, cxl });
    }
    
    // Quick visual feedback
    const btn = event.target;
    const orig = btn.innerText;
    btn.innerText = '¡Guardado!';
    btn.style.background = 'var(--success)';
    setTimeout(() => { btn.innerText = orig; btn.style.background = ''; }, 1000);
}

// --- Dashboard ---
function setDashRange(type) {
    const today = new Date();
    let start = new Date();

    if (type === 'today') {
        // start date is already today
    } else if (type === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        start.setDate(diff);
    } else if (type === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
    }

    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    document.getElementById('dash-start').value = fmt(start);
    document.getElementById('dash-end').value = fmt(today);
    loadDashboard();
}

let dashData = [];
let sortCol = 'ventas';
let sortAsc = false;
let isMatrixMode = false;
let matrixDates = [];

async function loadDashboard() {
    const startStr = document.getElementById('dash-start').value;
    const endStr = document.getElementById('dash-end').value;

    const startDate = new Date(startStr + 'T00:00:00');
    const endDate = new Date(endStr + 'T00:00:00');
    
    matrixDates = [];
    let d = new Date(startDate);
    while(d <= endDate) {
        matrixDates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }
    
    // Matrix mode for ranges between 2 and 7 days
    isMatrixMode = matrixDates.length > 1 && matrixDates.length <= 7;

    const users = await db.users.where('active').equals(1).toArray();
    let userStats = {};
    users.forEach(u => {
        userStats[u.id] = { 
            name: u.name, 
            totals: { shots: 0, ventas: 0, ads: 0, links: 0, cxl: 0 },
            daily: {} 
        };
        matrixDates.forEach(date => {
            userStats[u.id].daily[date] = { shots: 0, ventas: 0 };
        });
    });

    for (const date of matrixDates) {
        const stats = await db.stats.where('date').equals(date).toArray();
        for (const s of stats) {
            if (userStats[s.userId]) {
                userStats[s.userId].totals.shots += s.shots;
                userStats[s.userId].totals.ventas += s.ventas;
                userStats[s.userId].totals.ads += (s.ads || 0);
                userStats[s.userId].totals.links += (s.links || 0);
                userStats[s.userId].totals.cxl += (s.cxl || 0);
                
                userStats[s.userId].daily[date].shots += s.shots;
                userStats[s.userId].daily[date].ventas += s.ventas;
            }
        }
    }

    dashData = Object.values(userStats).map(u => {
        u.cierre = u.totals.shots > 0 ? (u.totals.ventas / u.totals.shots) : 0;
        return u;
    });

    // Totals
    const totVentas = dashData.reduce((sum, u) => sum + u.totals.ventas, 0);
    const totShots = dashData.reduce((sum, u) => sum + u.totals.shots, 0);
    const totCierre = totShots > 0 ? (totVentas / totShots) : 0;

    document.getElementById('stat-ventas').innerText = totVentas;
    document.getElementById('stat-shots').innerText = totShots;
    document.getElementById('stat-cierre').innerText = (totCierre * 100).toFixed(1) + '%';

    renderTop3();
    renderDashTable();
}

function sortTable(colIdx) {
    if (sortCol === colIdx) sortAsc = !sortAsc;
    else { sortCol = colIdx; sortAsc = false; }
    renderDashTable();
}

function renderDashTable() {
    const thead = document.getElementById('dash-table-head');
    const tbody = document.getElementById('dash-table-body');
    
    let headHTML = '<tr>';
    headHTML += `<th rowspan="2" style="vertical-align: middle; width: 30px; text-align: center; color: var(--text-muted); border-right: 1px solid var(--border);">#</th>`;
    headHTML += `<th rowspan="2" onclick="sortTable('name')" style="vertical-align: middle;">Vendedor ↕</th>`;
    
    if (isMatrixMode) {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        matrixDates.forEach(date => {
            const dateObj = new Date(date + 'T12:00:00');
            const dayName = dayNames[dateObj.getDay()];
            headHTML += `<th colspan="2" style="text-align: center; border-left: 1px solid var(--border); padding-bottom: 0;">${dayName}<br><small style="font-weight: normal; font-size: 0.7rem; color: var(--text-muted);">${date.substring(5)}</small></th>`;
        });
    }
    
    headHTML += `<th colspan="2" style="text-align: center; border-left: 2px solid var(--primary); padding-bottom: 0;">TOTALES</th>`;
    headHTML += `<th rowspan="2" onclick="sortTable('cierre')" style="vertical-align: middle; text-align: center; border-left: 1px solid var(--border);">% Cierre ↕</th>`;
    headHTML += `<th rowspan="2" onclick="sortTable('ads')" style="vertical-align: middle; text-align: center; border-left: 1px solid var(--border);">Ads ↕</th>`;
    headHTML += `<th rowspan="2" onclick="sortTable('links')" style="vertical-align: middle; text-align: center; border-left: 1px solid var(--border);">Links ↕</th>`;
    headHTML += `<th rowspan="2" onclick="sortTable('cxl')" style="vertical-align: middle; text-align: center; border-left: 1px solid var(--border);">CXL ↕</th>`;
    headHTML += '</tr><tr>';
    
    if (isMatrixMode) {
        matrixDates.forEach(date => {
            headHTML += `<th style="text-align: center; border-left: 1px solid var(--border); color: var(--text-muted); font-size: 0.75rem;">Shots</th><th style="text-align: center; border-left: 1px solid var(--border); color: var(--primary); font-size: 0.75rem;">Vts</th>`;
        });
    }
    
    headHTML += `<th onclick="sortTable('shots')" style="text-align: center; border-left: 2px solid var(--primary);">Shots ↕</th>`;
    headHTML += `<th onclick="sortTable('ventas')" style="text-align: center; border-left: 1px solid var(--border); color: var(--primary);">Ventas ↕</th>`;
    headHTML += '</tr>';
    
    thead.innerHTML = headHTML;
    tbody.innerHTML = '';

    const specialNames = ['EN REPORTE', 'TOTALES'];
    const regularData = dashData.filter(d => !specialNames.includes(d.name));
    const enReporte = dashData.find(d => d.name === 'EN REPORTE');

    // Calculate synthetic totals dynamically
    const synthTotales = {
        name: 'TOTALES',
        totals: { shots: 0, ventas: 0, ads: 0, links: 0, cxl: 0 },
        daily: {},
        cierre: 0
    };
    
    if (isMatrixMode) {
        matrixDates.forEach(date => {
            synthTotales.daily[date] = { shots: 0, ventas: 0 };
        });
    }

    regularData.forEach(d => {
        synthTotales.totals.shots += d.totals.shots;
        synthTotales.totals.ventas += d.totals.ventas;
        synthTotales.totals.ads += d.totals.ads;
        synthTotales.totals.links += d.totals.links;
        synthTotales.totals.cxl += d.totals.cxl;
        
        if (isMatrixMode) {
            matrixDates.forEach(date => {
                synthTotales.daily[date].shots += d.daily[date].shots;
                synthTotales.daily[date].ventas += d.daily[date].ventas;
            });
        }
    });
    
    synthTotales.cierre = synthTotales.totals.shots > 0 ? (synthTotales.totals.ventas / synthTotales.totals.shots) : 0;

    regularData.sort((a, b) => {
        let valA, valB;
        if (sortCol === 'name') { valA = a.name; valB = b.name; }
        if (sortCol === 'shots') { valA = a.totals.shots; valB = b.totals.shots; }
        if (sortCol === 'ventas') { valA = a.totals.ventas; valB = b.totals.ventas; }
        if (sortCol === 'cierre') { valA = a.cierre; valB = b.cierre; }
        if (sortCol === 'ads') { valA = a.totals.ads; valB = b.totals.ads; }
        if (sortCol === 'links') { valA = a.totals.links; valB = b.totals.links; }
        if (sortCol === 'cxl') { valA = a.totals.cxl; valB = b.totals.cxl; }
        
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    const renderRow = (d, idx = '', isSpecial = false) => {
        if (!d) return;
        const tr = document.createElement('tr');
        if (isSpecial) tr.style.background = 'var(--nav-bg)'; // Highlight slightly
        
        let badgeClass = 'badge-red';
        if (d.cierre >= 0.40) badgeClass = 'badge-green';
        else if (d.cierre >= 0.25) badgeClass = 'badge-yellow';
        
        if (isSpecial && d.totals.shots === 0) badgeClass = '';

        let rowHTML = `<td style="text-align: center; color: var(--text-muted); font-size: 0.85rem; border-right: 1px solid var(--border);">${idx}</td>`;
        rowHTML += `<td><strong>${d.name}</strong></td>`;
        
        if (isMatrixMode) {
            matrixDates.forEach(date => {
                const s = d.daily[date].shots;
                const v = d.daily[date].ventas;
                const isEmpty = (s === 0 && v === 0);
                const sDisplay = isEmpty ? '' : s;
                const vDisplay = isEmpty ? '' : v;
                rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); font-weight: 600; color: ${s > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${sDisplay}</td>`;
                rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); font-weight: 800; color: ${v > 0 ? 'var(--primary)' : 'var(--text-muted)'};">${vDisplay}</td>`;
            });
        }
        
        rowHTML += `
            <td style="text-align: center; border-left: 2px solid var(--primary); font-weight: bold;">${d.totals.shots}</td>
            <td style="text-align: center; border-left: 1px solid var(--border); font-weight: bold; color: var(--primary);">${d.totals.ventas}</td>
            <td style="text-align: center; border-left: 1px solid var(--border);"><span class="badge ${badgeClass}">${(d.cierre * 100).toFixed(1)}%</span></td>
            <td style="text-align: center; border-left: 1px solid var(--border);">${d.totals.ads}</td>
            <td style="text-align: center; border-left: 1px solid var(--border);">${d.totals.links}</td>
            <td style="text-align: center; border-left: 1px solid var(--border); color: var(--danger);">${d.totals.cxl}</td>
        `;
        
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    };

    regularData.forEach((d, idx) => renderRow(d, idx + 1));
    
    if (enReporte) renderRow(enReporte, '', true);
    renderRow(synthTotales, '', true);
}

// --- Import Historical Data ---
async function importExcelData() {
    const btn = document.getElementById('btn-import');
    btn.innerText = 'Importando...';
    btn.disabled = true;

    try {
        const response = await fetch('initial_data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("JSON no encontrado. Asegurate de correr el script de extracción.");
        const jsonData = await response.json();
        const data = jsonData.stats || jsonData; // Support both old array and new dict format

        // Find max date to determine active users
        let maxDate = '2000-01-01';
        data.forEach(d => {
            if (d.date > maxDate) maxDate = d.date;
        });

        // The "last week" is within 7 days of maxDate
        const lastWeekStart = new Date(maxDate);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekStr = lastWeekStart.toISOString().split('T')[0];

        const activeNames = new Set();
        data.forEach(d => {
            if (d.date >= lastWeekStr) activeNames.add(d.name);
        });

        // Insert all users
        const allNames = new Set(data.map(d => d.name));
        for (const name of allNames) {
            const existing = await db.users.where('name').equals(name).first();
            const isActive = activeNames.has(name) ? 1 : 0;
            if (!existing) {
                await db.users.add({ name, active: isActive });
            } else {
                await db.users.update(existing.id, { active: isActive });
            }
        }

        // Fetch users map for IDs
        const users = await db.users.toArray();
        const userMap = {};
        users.forEach(u => userMap[u.name] = u.id);

        // Clear existing stats and bulk insert new
        await db.stats.clear();
        const statsToInsert = data.map(d => ({
            userId: userMap[d.name],
            date: d.date,
            shots: d.shots,
            ventas: d.ventas,
            ads: d.ads || 0,
            links: d.links || 0,
            cxl: d.cxl || 0
        }));
        
        await db.stats.bulkAdd(statsToInsert);

        btn.innerText = '¡Historial Importado Exitosamente!';
        btn.style.background = 'var(--success)';
        btn.style.color = 'white';
        
        loadTeam();
        loadDashboard();

    } catch (e) {
        console.error(e);
        btn.innerText = 'Error al importar (Revisa la consola)';
    }
}

// --- Download Image ---
function downloadImage() {
    const btn = document.getElementById('btn-download');
    const origHTML = btn.innerHTML;
    btn.innerHTML = 'Generando Imagen...';
    btn.disabled = true;

    const target = document.getElementById('table-card');
    
    // Slight delay to allow button text update
    setTimeout(() => {
        // Temporarily hide the button during screenshot
        btn.style.display = 'none';

        html2canvas(target, {
            backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e1e1e' : '#ffffff',
            scale: 2, // High resolution for Retina displays/iPads
            logging: false
        }).then(canvas => {
            btn.style.display = 'flex'; // Restore button
            
            const link = document.createElement('a');
            const dateStr = document.getElementById('dash-start').value;
            link.download = `Reporte_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
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
    if (top3[1]) places.push({ ...top3[1], rank: 2, medal: '🥈', height: '140px', color: '#bdc3c7' });
    if (top3[0]) places.push({ ...top3[0], rank: 1, medal: '🥇', height: '180px', color: '#f1c40f' });
    if (top3[2]) places.push({ ...top3[2], rank: 3, medal: '🥉', height: '110px', color: '#cd7f32' });
    
    let html = '';
    places.forEach(p => {
        html += `
            <div style="display: flex; flex-direction: column; align-items: center; width: 130px;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.2));">${p.medal}</div>
                <div style="background: ${p.color}; width: 100%; height: ${p.height}; border-radius: 8px 8px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 1rem; color: #fff; box-shadow: 0 -4px 10px rgba(0,0,0,0.15);">
                    <strong style="font-size: 1.1rem; text-transform: uppercase; text-shadow: 1px 1px 2px rgba(0,0,0,0.4); text-align: center; line-height: 1.1; padding: 0 5px;">${p.name}</strong>
                    <div style="font-size: 1.8rem; font-weight: 800; margin-top: 0.5rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">${p.totals.ventas} V</div>
                    <div style="font-size: 0.9rem; font-weight: bold; margin-top: 0.3rem; background: rgba(0,0,0,0.2); padding: 3px 8px; border-radius: 12px; text-shadow: none;">${(p.cierre * 100).toFixed(1)}%</div>
                </div>
            </div>
        `;
    });
    
    podium.innerHTML = html;
}

function downloadTop3() {
    const btn = document.getElementById('btn-download-top3');
    const origHTML = btn.innerHTML;
    btn.innerHTML = 'Generando...';
    btn.disabled = true;
    
    const target = document.getElementById('top3-container');
    
    setTimeout(() => {
        btn.style.display = 'none'; // hide for screenshot
        html2canvas(target, {
            backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e1e1e' : '#ffffff',
            scale: 2
        }).then(canvas => {
            btn.style.display = 'flex';
            const link = document.createElement('a');
            const dateStr = document.getElementById('dash-start').value;
            link.download = `Top3_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
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
