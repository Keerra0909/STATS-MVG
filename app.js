// --- Firebase Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyB6bBY99Jt507YdRiYLaM77k-AZGOv56XM",
    authDomain: "statsmvg.firebaseapp.com",
    projectId: "statsmvg",
    storageBucket: "statsmvg.firebasestorage.app",
    messagingSenderId: "605661495564",
    appId: "1:605661495564:web:34636c9b7a598d49114929",
    measurementId: "G-WTJVL9J96C"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
firestore.enablePersistence().catch(err => console.error("Persistence error:", err));

// --- Auth State ---
let currentUser = null;

// --- Database Setup (Legacy Local) ---
const db = new Dexie('StatsMasterDB');
db.version(1).stores({
    users: '++id, name, active', // active: 1 or 0
    stats: '++id, userId, date, shots, ventas, ads, links, cxl' // date format: YYYY-MM-DD
});

let myChart = null;

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
                ? `<button id="btn-save-${i}" class="btn-success" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; display: none;" onclick="saveRepStat(${i}, '${dateStr}')">Guardar</button>
                   <span id="saved-msg-${i}" style="color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>
                   <button id="btn-edit-${i}" class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; margin-left: 0.5rem;" onclick="editRepStat(${i})">Editar</button>`
                : `<button id="btn-save-${i}" class="btn-primary" onclick="saveRepStat(${i}, '${dateStr}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Guardar</button>
                   <span id="saved-msg-${i}" style="display: none; color: var(--success); font-weight: bold; font-size: 0.85rem;">Guardado ✔️</span>
                   <button id="btn-edit-${i}" class="btn-secondary" style="display: none; padding: 0.2rem 0.5rem; font-size: 0.7rem; margin-left: 0.5rem;" onclick="editRepStat(${i})">Editar</button>`;
        }

        tr.innerHTML = `
            <td>
                <strong>${dias[i]}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${dateStr.substring(5).replace('-', '/')}</div>
            </td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-shots-${i}" value="${stat ? (stat.shots !== undefined ? stat.shots : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-ventas-${i}" value="${stat ? (stat.ventas !== undefined ? stat.ventas : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-ads-${i}" value="${stat ? (stat.ads !== undefined ? stat.ads : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="rep-links-${i}" value="${stat ? (stat.links !== undefined ? stat.links : 0) : ''}" class="input-field" style="width: 60px; text-align: center;" ${disabledAttr}></td>
            <td style="text-align: center; vertical-align: middle;">
                <div style="display: flex; justify-content: center; align-items: center; min-height: 40px; gap: 0.5rem;">
                    ${btnHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editRepStat(index) {
    document.getElementById(`rep-shots-${index}`).disabled = false;
    document.getElementById(`rep-ventas-${index}`).disabled = false;
    document.getElementById(`rep-ads-${index}`).disabled = false;
    document.getElementById(`rep-links-${index}`).disabled = false;
    
    document.getElementById(`btn-save-${index}`).style.display = 'block';
    document.getElementById(`btn-save-${index}`).className = 'btn-primary';
    document.getElementById(`btn-save-${index}`).innerText = 'Guardar';
    document.getElementById(`saved-msg-${index}`).style.display = 'none';
    document.getElementById(`btn-edit-${index}`).style.display = 'none';
}

async function saveRepStat(index, dateStr) {
    const shots = Math.max(0, parseInt(document.getElementById(`rep-shots-${index}`).value) || 0);
    const ventas = Math.max(0, parseInt(document.getElementById(`rep-ventas-${index}`).value) || 0);
    const ads = Math.max(0, parseInt(document.getElementById(`rep-ads-${index}`).value) || 0);
    const links = Math.max(0, parseInt(document.getElementById(`rep-links-${index}`).value) || 0);
    
    const cleanName = currentUser.name.replace(/ /g, '_');
    const docId = `${cleanName}_${dateStr}`;
    
    await firestore.collection('stats').doc(docId).set({
        name: currentUser.name,
        date: dateStr,
        shots,
        ventas,
        ads,
        links
    }, { merge: true });
    
    // Lock the row
    document.getElementById(`rep-shots-${index}`).disabled = true;
    document.getElementById(`rep-ventas-${index}`).disabled = true;
    document.getElementById(`rep-ads-${index}`).disabled = true;
    document.getElementById(`rep-links-${index}`).disabled = true;
    
    document.getElementById(`btn-save-${index}`).style.display = 'none';
    document.getElementById(`saved-msg-${index}`).style.display = 'inline-block';
    document.getElementById(`btn-edit-${index}`).style.display = 'inline-block';
}

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
    // Run migrations without blocking UI
    injectWednesdayData().catch(e => console.error(e));
    syncDexieToFirestore().catch(e => console.error(e));

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        handleAuthState();
    } else {
        navigate('login');
    }
});

async function syncDexieToFirestore() {
    if (localStorage.getItem('dexie_synced')) return;
    try {
        const localUsers = await db.users.toArray();
        for (const lu of localUsers) {
            if (lu.active === 0) {
                const cleanName = lu.name.replace(/ /g, '_');
                await firestore.collection('users').doc(cleanName).update({ active: 0 }).catch(() => {});
            }
        }
        localStorage.setItem('dexie_synced', 'true');
        console.log("Synced local statuses to Firestore");
    } catch (e) {
        console.error(e);
    }
}

function handleAuthState() {
    if (!currentUser) {
        document.getElementById('btn-logout').style.display = 'none';
        navigate('login');
        return;
    }
    
    document.getElementById('btn-logout').style.display = 'block';

    if (currentUser.role === 'admin') {
        document.getElementById('btn-dashboard').style.display = 'block';
        document.getElementById('btn-rep-weekly').style.display = 'none';
        document.getElementById('btn-daily').style.display = 'block';
        document.getElementById('btn-team').style.display = 'block';
        const savedView = localStorage.getItem('view');
        if (savedView && savedView !== 'login' && savedView !== 'rep-weekly') {
            navigate(savedView);
        } else {
            navigate('dashboard');
        }
    } else {
        document.getElementById('btn-dashboard').style.display = 'block';
        document.getElementById('btn-rep-weekly').style.display = 'block';
        document.getElementById('btn-daily').style.display = 'none';
        document.getElementById('btn-team').style.display = 'none';
        document.getElementById('rep-welcome-msg').innerText = `¡Hola ${currentUser.name}!`;
        
        const savedView = localStorage.getItem('view');
        if (savedView === 'dashboard') {
            navigate('dashboard');
        } else {
            navigate('rep-weekly');
        }
    }
}

async function login() {
    const name = document.getElementById('login-username').value.trim().toUpperCase();
    const pin = document.getElementById('login-pin').value.trim();
    const errorDiv = document.getElementById('login-error');
    
    if (name === 'ADMIN' && pin === '7777') {
        currentUser = { name: 'ADMIN', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        errorDiv.style.display = 'none';
        handleAuthState();
        return;
    }
    
    if (!name || !pin) {
        errorDiv.innerText = 'Llena ambos campos';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Check against Firestore
    try {
        const userDoc = await firestore.collection('users').doc(name).get();
        if (userDoc.exists && userDoc.data().pin === pin) {
            currentUser = { name: name, role: 'rep' };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            errorDiv.style.display = 'none';
            handleAuthState();
        } else {
            errorDiv.innerText = 'Credenciales incorrectas';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        console.error(e);
        errorDiv.innerText = 'Error al conectar con la base de datos';
        errorDiv.style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('btn-logout').style.display = 'none';
    navigate('login');
}

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
    
    // Show/hide nav links based on view
    const navLinks = document.querySelector('.nav-links');
    if (viewId === 'login') {
        navLinks.style.display = 'none';
    } else {
        navLinks.style.display = 'flex';
    }

    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if (viewId !== 'login') {
        document.getElementById(`btn-${viewId}`)?.classList.add('active');
        localStorage.setItem('view', viewId);
    }

    if (viewId === 'team') loadTeam();
    if (viewId === 'daily') loadDailyEntries();
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'rep-weekly') loadRepWeekly();
}

// --- Team Management ---
async function loadTeam() {
    const activeDiv = document.getElementById('active-users-list');
    const inactiveDiv = document.getElementById('inactive-users-list');
    activeDiv.innerHTML = ''; inactiveDiv.innerHTML = '';

    const usersSnap = await firestore.collection('users').get();
    let users = [];
    usersSnap.forEach(doc => {
        if (doc.data().role !== 'admin') {
            const data = doc.data();
            data.name = data.name || doc.id;
            users.push({ id: doc.id, ...data });
        }
    });

    users.sort((a, b) => a.name.localeCompare(b.name));
    
    let activeCount = 0;
    let inactiveCount = 0;
    
    users.forEach(u => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <strong>${u.name}</strong>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${u.active ? 
                    `<button class="btn-danger" onclick="toggleUser('${u.id}', 0)">Desactivar</button>` : 
                    `<button class="btn-success" onclick="toggleUser('${u.id}', 1)">Activar</button>`}
                <button class="btn-icon" title="Borrar permanentemente" onclick="deleteUser('${u.id}', '${u.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
        `;
        if (u.active) {
            activeDiv.appendChild(card);
            activeCount++;
        } else {
            inactiveDiv.appendChild(card);
            inactiveCount++;
        }
    });
    
    document.getElementById('active-count').innerText = `(${activeCount})`;
    document.getElementById('inactive-count').innerText = `(${inactiveCount})`;
}

async function addUser(e) {
    e.preventDefault();
    const input = document.getElementById('new-user-name');
    const name = input.value.trim().toUpperCase();
    if (name) {
        await firestore.collection('users').doc(name).set({ 
            name: name, 
            active: 1,
            role: 'rep',
            pin: '1234'
        });
        input.value = '';
        loadTeam();
    }
}

async function toggleUser(id, status) {
    await firestore.collection('users').doc(id).update({ active: status });
    loadTeam();
}

async function deleteUser(id, name) {
    if (confirm(`¿Estás súper seguro de borrar PERMANENTEMENTE a "${name}"?\n\n¡Esto eliminará todo su historial de la base de datos de inmediato!`)) {
        await firestore.collection('users').doc(id).delete();
        
        // Also delete their stats
        const statsSnap = await firestore.collection('stats').where('name', '==', name).get();
        const batch = firestore.batch();
        statsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
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

    const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
    let users = [];
    usersSnap.forEach(doc => {
        if (doc.data().role !== 'admin') users.push(doc.data());
    });
    users.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const u of users) {
        const cleanName = u.name.replace(/ /g, '_');
        const docId = `${cleanName}_${dateStr}`;
        const statDoc = await firestore.collection('stats').doc(docId).get();
        const stat = statDoc.exists ? statDoc.data() : null;
        
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
            <td style="text-align: center;"><input type="number" min="0" id="shots-${cleanName}" value="${stat ? (stat.shots !== undefined ? stat.shots : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="ventas-${cleanName}" value="${stat ? (stat.ventas !== undefined ? stat.ventas : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="ads-${cleanName}" value="${stat ? (stat.ads !== undefined ? stat.ads : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="links-${cleanName}" value="${stat ? (stat.links !== undefined ? stat.links : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center;"><input type="number" min="0" id="cxl-${cleanName}" value="${stat ? (stat.cxl !== undefined ? stat.cxl : 0) : ''}" class="input-field" style="width: 50px; text-align: center; padding: 0.2rem;" ${disabledAttr}></td>
            <td style="text-align: center; vertical-align: middle;">
                <div style="display: flex; justify-content: center; align-items: center; min-height: 40px; gap: 0.5rem;">
                    ${btnHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function editDaily(cleanName) {
    document.getElementById(`shots-${cleanName}`).disabled = false;
    document.getElementById(`ventas-${cleanName}`).disabled = false;
    document.getElementById(`ads-${cleanName}`).disabled = false;
    document.getElementById(`links-${cleanName}`).disabled = false;
    document.getElementById(`cxl-${cleanName}`).disabled = false;
    
    document.getElementById(`btn-save-admin-${cleanName}`).style.display = 'block';
    document.getElementById(`btn-save-admin-${cleanName}`).className = 'btn-primary';
    document.getElementById(`btn-save-admin-${cleanName}`).innerText = 'Guardar';
    document.getElementById(`saved-msg-admin-${cleanName}`).style.display = 'none';
    document.getElementById(`btn-edit-admin-${cleanName}`).style.display = 'none';
}

async function saveDaily(cleanName, realName) {
    const dateStr = document.getElementById('entry-date').value;
    const shots = Math.max(0, parseInt(document.getElementById(`shots-${cleanName}`).value) || 0);
    const ventas = Math.max(0, parseInt(document.getElementById(`ventas-${cleanName}`).value) || 0);
    const ads = Math.max(0, parseInt(document.getElementById(`ads-${cleanName}`).value) || 0);
    const links = Math.max(0, parseInt(document.getElementById(`links-${cleanName}`).value) || 0);
    const cxl = Math.max(0, parseInt(document.getElementById(`cxl-${cleanName}`).value) || 0);

    const docId = `${cleanName}_${dateStr}`;
    await firestore.collection('stats').doc(docId).set({
        name: realName,
        date: dateStr,
        shots, ventas, ads, links, cxl
    }, { merge: true });
    
    // Lock the row
    document.getElementById(`shots-${cleanName}`).disabled = true;
    document.getElementById(`ventas-${cleanName}`).disabled = true;
    document.getElementById(`ads-${cleanName}`).disabled = true;
    document.getElementById(`links-${cleanName}`).disabled = true;
    document.getElementById(`cxl-${cleanName}`).disabled = true;
    
    document.getElementById(`btn-save-admin-${cleanName}`).style.display = 'none';
    document.getElementById(`saved-msg-admin-${cleanName}`).style.display = 'inline-block';
    document.getElementById(`btn-edit-admin-${cleanName}`).style.display = 'inline-block';
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

    const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
    let users = [];
    usersSnap.forEach(doc => {
        if (doc.data().role !== 'admin') users.push(doc.data());
    });

    let userStats = {};
    users.forEach(u => {
        userStats[u.name] = { 
            name: u.name, 
            totals: { shots: 0, ventas: 0, ads: 0, links: 0, cxl: 0 },
            daily: {} 
        };
        matrixDates.forEach(date => {
            userStats[u.name].daily[date] = { shots: 0, ventas: 0 };
        });
    });

    const statsSnap = await firestore.collection('stats')
        .where('date', '>=', startStr)
        .where('date', '<=', endStr)
        .get();

    statsSnap.forEach(doc => {
        const s = doc.data();
        if (userStats[s.name]) {
            userStats[s.name].totals.shots += s.shots || 0;
            userStats[s.name].totals.ventas += s.ventas || 0;
            userStats[s.name].totals.ads += s.ads || 0;
            userStats[s.name].totals.links += s.links || 0;
            userStats[s.name].totals.cxl += s.cxl || 0;
            if (userStats[s.name].daily[s.date]) {
                userStats[s.name].daily[s.date].shots += s.shots || 0;
                userStats[s.name].daily[s.date].ventas += s.ventas || 0;
            }
        }
    });

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
    if (currentUser && currentUser.role === 'admin') {
        headHTML += `<th rowspan="2" onclick="sortTable('cxl')" style="vertical-align: middle; text-align: center; border-left: 1px solid var(--border);">CXL ↕</th>`;
    }
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
        `;
        
        if (currentUser && currentUser.role === 'admin') {
            rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); color: var(--danger);">${d.totals.cxl}</td>`;
        }
        
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
