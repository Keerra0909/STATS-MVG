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
firestore.enablePersistence({ synchronizeTabs: true })
    .catch(err => console.warn("Firestore persistence disabled:", err.code));

// --- Auth State ---
let currentUser = null;
let globalGoals = { ventas: 55, cierre: 30 }; // Default goals

// --- Database Setup (Legacy Local) ---


let myChart = null;
let dashTrendChart = null;
let academyModalChart = null;
let academyChartData = {}; // { repName: { months: [], shots: [], ventas: [] } }

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

        monthDocs.forEach(data => {
            if (!data) return;
            monthVentas += data.ventas || 0;
            monthShots += data.shots || 0;
        });

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
    const cleanName = currentUser.name.replace(/ /g, '_');
    const shots = Math.max(0, parseInt(document.getElementById(`rep-shots-${index}`).value) || 0);
    const ventas = Math.max(0, parseInt(document.getElementById(`rep-ventas-${index}`).value) || 0);
    const ads = Math.max(0, parseInt(document.getElementById(`rep-ads-${index}`).value) || 0);
    const links = Math.max(0, parseInt(document.getElementById(`rep-links-${index}`).value) || 0);
    const cxl = 0; // Not edited by rep directly yet

    const docId = `${cleanName}_${dateStr}`;
    const btn = document.getElementById(`btn-save-${index}`);
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        await Promise.race([
            firestore.collection('stats').doc(docId).set({
                name: currentUser.name,
                date: dateStr,
                shots, ventas, ads, links, cxl
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. El iPad podría haber perdido conexión a internet. Intenta de nuevo.")), 6000))
        ]);

        await recalculateUserMonth(cleanName, currentUser.name, dateStr).catch(e => console.error("Error updating monthly stats:", e));

        document.getElementById(`rep-shots-${index}`).disabled = true;
        document.getElementById(`rep-ventas-${index}`).disabled = true;
        document.getElementById(`rep-ads-${index}`).disabled = true;
        document.getElementById(`rep-links-${index}`).disabled = true;
        
        btn.style.display = 'none';
        btn.disabled = false;
        document.getElementById(`saved-msg-${index}`).style.display = 'inline-block';
        document.getElementById(`btn-edit-${index}`).style.display = 'inline-block';
    } catch (err) {
        alert(err.message || "Error al guardar. Revisa tu conexión a internet.");
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
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
    
    document.getElementById('entry-date').value = localStorage.getItem('entryDate') || today;
    document.getElementById('academy-start').value = today;
    document.getElementById('academy-end').value = today;
    
    const savedRange = localStorage.getItem('dashRangeType');
    if (savedRange) {
        setDashRange(savedRange);
    } else {
        setDashRange('week');
    }

    const savedAcademyRange = localStorage.getItem('academyRangeType');
    if (savedAcademyRange) {
        setAcademyRange(savedAcademyRange);
    } else {
        setAcademyRange('month'); // Defaults to month for better academy data
    }

    function initPills() {
        requestAnimationFrame(() => {
            const pill = document.getElementById('seg-pill');
            const activeBtn = document.querySelector('.dash-range-btn.active');
            if (pill && activeBtn) {
                pill.style.transition = 'none';
                pill.style.left = activeBtn.offsetLeft + 'px';
                pill.style.width = activeBtn.offsetWidth + 'px';
                requestAnimationFrame(() => { pill.style.transition = ''; });
            }
            
            const academyPill = document.getElementById('academy-seg-pill');
            const activeAcademyBtn = document.querySelector('#academy-segmented .dash-range-btn.active');
            if (academyPill && activeAcademyBtn) {
                academyPill.style.transition = 'none';
                academyPill.style.left = activeAcademyBtn.offsetLeft + 'px';
                academyPill.style.width = activeAcademyBtn.offsetWidth + 'px';
                requestAnimationFrame(() => { academyPill.style.transition = ''; });
            }

            const navPill = document.getElementById('nav-pill');
            const activeNavBtn = document.querySelector('.nav-btn.active');
            if (navPill && activeNavBtn) {
                navPill.style.transition = 'none';
                navPill.style.left = activeNavBtn.offsetLeft + 'px';
                navPill.style.width = activeNavBtn.offsetWidth + 'px';
                requestAnimationFrame(() => { navPill.style.transition = ''; });
            }
        });
    }

    // Run immediately on DOMContentLoaded
    initPills();
    
    // Run when all resources (including fonts) have fully loaded
    window.addEventListener('load', initPills);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(initPills);
    }
    
    // Run on window resize to keep pills aligned
    window.addEventListener('resize', initPills);



    // Run migrations without blocking UI
    buildMonthlyStats().catch(e => console.error(e));

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        handleAuthState();
    } else {
        navigate('login');
    }
});


async function buildMonthlyStats() {
    if (localStorage.getItem('monthly_stats_built_v3')) return;
    try {
        const statsSnap = await firestore.collection('stats').get();
        const monthlyData = {};
        statsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.name || !data.date) return;
            const month = data.date.substring(0, 7); // YYYY-MM
            const cleanName = data.name.replace(/ /g, '_');
            const docId = `${cleanName}_${month}`;
            if (!monthlyData[docId]) {
                monthlyData[docId] = {
                    name: data.name,
                    month: month,
                    shots: 0, ventas: 0, ads: 0, links: 0, cxl: 0
                };
            }
            monthlyData[docId].shots += (Number(data.shots) || 0);
            monthlyData[docId].ventas += (Number(data.ventas) || 0);
            monthlyData[docId].ads += (Number(data.ads) || 0);
            monthlyData[docId].links += (Number(data.links) || 0);
            monthlyData[docId].cxl += (Number(data.cxl) || 0);
        });
        
        let batch = firestore.batch();
        let count = 0;
        for (const docId in monthlyData) {
            const ref = firestore.collection('stats_monthly').doc(docId);
            batch.set(ref, monthlyData[docId], { merge: true });
            count++;
            if (count === 400) {
                await batch.commit();
                batch = firestore.batch();
                count = 0;
            }
        }
        if (count > 0) await batch.commit();
        localStorage.setItem('monthly_stats_built_v3', 'true');
        // Monthly stats built successfully
        // Reload dashboard so fast path (stats_monthly) kicks in immediately
        if (typeof loadDashboard === 'function') loadDashboard();
        if (typeof loadAcademy === 'function') loadAcademy();
    } catch (e) {
        console.error("Error building monthly stats:", e);
    }
}

async function recalculateUserMonth(cleanName, realName, dateStr) {
    const month = dateStr.substring(0, 7); // YYYY-MM
    const startStr = `${month}-01`;
    const endStr = `${month}-31`;
    const snap = await firestore.collection('stats')
        .where('name', '==', realName)
        .where('date', '>=', startStr)
        .where('date', '<=', endStr)
        .get();
        
    let shots = 0, ventas = 0, ads = 0, links = 0, cxl = 0;
    snap.forEach(doc => {
        const d = doc.data();
        shots += (Number(d.shots) || 0);
        ventas += (Number(d.ventas) || 0);
        ads += (Number(d.ads) || 0);
        links += (Number(d.links) || 0);
        cxl += (Number(d.cxl) || 0);
    });
    
    const docId = `${cleanName}_${month}`;
    await firestore.collection('stats_monthly').doc(docId).set({
        name: realName,
        month: month,
        shots, ventas, ads, links, cxl
    }, { merge: true });
}

function handleAuthState() {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
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
        document.getElementById('btn-academy').style.display = 'block';
        document.getElementById('btn-download-top3').style.display = 'inline-block';
        document.getElementById('btn-download').style.display = 'inline-block';
        document.getElementById('btn-export-excel').style.display = 'inline-block';
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
        document.getElementById('btn-academy').style.display = 'none';
        document.getElementById('btn-download-top3').style.display = 'none';
        document.getElementById('btn-download').style.display = 'none';
        document.getElementById('btn-export-excel').style.display = 'none';
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
        const activeBtn = document.getElementById(`btn-${viewId}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            moveNavPill(activeBtn);
        }
        localStorage.setItem('view', viewId);
    }

    if (viewId === 'team') loadTeam();
    if (viewId === 'daily') loadDailyEntries();
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'rep-weekly') loadRepWeekly();
    if (viewId === 'academy') loadAcademy();
    if (viewId === 'spiffs') loadSpiffs();
}

function moveNavPill(btn) {
    const pill = document.getElementById('nav-pill');
    const container = document.getElementById('nav-links');
    if (!pill || !btn || !container) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    pill.style.left = (btnRect.left - containerRect.left) + 'px';
    pill.style.width = btnRect.width + 'px';
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

    // Load goals
    await loadGoals();
}

async function loadGoals() {
    try {
        const doc = await firestore.collection('config').doc('metas').get();
        if (doc.exists) {
            globalGoals = doc.data();
            if (document.getElementById('goal-ventas')) {
                document.getElementById('goal-ventas').value = globalGoals.ventas;
            }
            if (document.getElementById('goal-cierre')) {
                document.getElementById('goal-cierre').value = globalGoals.cierre;
            }
        }
    } catch(e) { console.error("Error loading goals:", e); }
}

async function saveGoals() {
    const btn = document.getElementById('btn-save-goals');
    const v = parseInt(document.getElementById('goal-ventas').value) || 55;
    const c = parseInt(document.getElementById('goal-cierre').value) || 30;
    btn.innerText = 'Guardando...';
    btn.disabled = true;
    try {
        await Promise.race([
            firestore.collection('config').doc('metas').set({
                ventas: v,
                cierre: c
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. Revisa tu conexión a internet.")), 6000))
        ]);
        globalGoals = { ventas: v, cierre: c };
        btn.innerText = '¡Guardado!';
        btn.disabled = false;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        setTimeout(() => {
            btn.innerText = 'Guardar Metas';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
        }, 2000);
    } catch(e) {
        console.error(e);
        alert(e.message || "Error al guardar metas.");
        btn.innerText = 'Guardar Metas';
        btn.disabled = false;
    }
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
        globalActiveUsers = null; // Invalidate cache
        loadTeam();
    }
}

async function toggleUser(id, status) {
    await firestore.collection('users').doc(id).update({ active: status });
    globalActiveUsers = null; // Invalidate cache
    loadTeam();
}

async function deleteUser(id, name) {
    if (confirm(`¿Estás súper seguro de borrar PERMANENTEMENTE a "${name}"?\n\n¡Esto eliminará todo su historial de la base de datos de inmediato!`)) {
        await firestore.collection('users').doc(id).delete();
        
        // Delete daily stats
        const statsSnap = await firestore.collection('stats').where('name', '==', name).get();
        const batch = firestore.batch();
        statsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete monthly stats
        const monthlySnap = await firestore.collection('stats_monthly').where('name', '==', name).get();
        monthlySnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        globalActiveUsers = null; // Invalidate cache
        
        loadTeam();
        loadDashboard();
    }
}

// --- Daily Entry ---
async function loadDailyEntries() {
    const dateStr = document.getElementById('entry-date').value;
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
    if (tbody) {
        tbody.style.opacity = '1';
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
    const btn = document.getElementById(`btn-save-admin-${cleanName}`);
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        await Promise.race([
            firestore.collection('stats').doc(docId).set({
                name: realName,
                date: dateStr,
                shots, ventas, ads, links, cxl
            }, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. El iPad podría haber perdido conexión a internet. Intenta de nuevo.")), 6000))
        ]);
        
        await recalculateUserMonth(cleanName, realName, dateStr).catch(e => console.error("Error updating monthly stats:", e));
        
        // Lock the row
        document.getElementById(`shots-${cleanName}`).disabled = true;
        document.getElementById(`ventas-${cleanName}`).disabled = true;
        document.getElementById(`ads-${cleanName}`).disabled = true;
        document.getElementById(`links-${cleanName}`).disabled = true;
        document.getElementById(`cxl-${cleanName}`).disabled = true;
        
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

// --- Dashboard ---
function setAcademyRange(type) {
    if (type) localStorage.setItem('academyRangeType', type);
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    if (type === 'today') {
        // start and end are today
    } else if (type === 'yesterday') {
        start.setDate(today.getDate() - 1);
        end = new Date(start);
    } else if (type === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
    } else if (type === 'lastWeek') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (type === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === 'lastMonth') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (type === 'last2Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    } else if (type === 'last4Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    } else if (type === 'last6Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    } else if (type === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
    }

    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    document.getElementById('academy-start').value = fmt(start);
    document.getElementById('academy-end').value = fmt(end);

    // Update period label
    const labelMap = {
        week: 'Esta Semana', lastWeek: 'Semana Pasada',
        month: 'Este Mes', lastMonth: 'Mes Pasado',
        last2Months: 'Últimos 2 Meses', last4Months: 'Últimos 4 Meses',
        last6Months: 'Últimos 6 Meses', year: 'Este Año'
    };
    const labelEl = document.getElementById('academy-period-label');
    if (labelEl && type) labelEl.textContent = labelMap[type] || '';
    document.querySelectorAll('#academy-segmented .dash-range-btn').forEach(btn => btn.classList.remove('active'));
    if (type) {
        const activeBtn = document.getElementById(`academy-btn-${type}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            moveAcademyPill(activeBtn);
        }
    }
    
    loadAcademy();
}

function moveAcademyPill(btn) {
    const pill = document.getElementById('academy-seg-pill');
    if (!pill || !btn) return;
    pill.style.left = btn.offsetLeft + 'px';
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.opacity = '1';
}

function setDashRange(type) {
    if (type) localStorage.setItem('dashRangeType', type);
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today); // Default to today

    if (type === 'today') {
        // start and end are today
    } else if (type === 'yesterday') {
        start.setDate(today.getDate() - 1);
        end = new Date(start);
    } else if (type === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        start.setDate(diff);
    } else if (type === 'lastWeek') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff - 7); // Last Monday
        end = new Date(start);
        end.setDate(start.getDate() + 6); // Last Sunday
    } else if (type === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === 'lastMonth') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
    } else if (type === 'last2Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    } else if (type === 'last4Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    } else if (type === 'last6Months') {
        start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
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
    document.getElementById('dash-end').value = fmt(end);
    
    // Update active button styling + slide the pill
    document.querySelectorAll('#dash-segmented .dash-range-btn').forEach(btn => btn.classList.remove('active'));
    if (type) {
        const activeBtn = document.getElementById(`dash-btn-${type}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            movePill(activeBtn);
        }
    }
    
    loadDashboard();
}

function movePill(btn) {
    const pill = document.getElementById('seg-pill');
    if (!pill || !btn) return;
    pill.style.left = btn.offsetLeft + 'px';
    pill.style.width = btn.offsetWidth + 'px';
}

let dashData = [];
let sortCol = 'ventas';
let sortAsc = false;
let isMatrixMode = false;
let matrixDates = [];
let hideOffline = false;
let globalActiveUsers = null;

function toggleOffline() {
    hideOffline = !hideOffline;
    const btn = document.getElementById('btn-toggle-off');
    if (btn) {
        btn.innerText = hideOffline ? 'Mostrar OFFs' : 'Ocultar OFFs';
        btn.className = hideOffline ? 'btn-primary' : 'btn-secondary';
    }
    renderDashTable();
}

async function loadDashboard() {
    const startStr = document.getElementById('dash-start').value;
    const endStr = document.getElementById('dash-end').value;

    const subtitle = document.getElementById('dash-table-subtitle');
    if (subtitle && startStr && endStr) {
        const s = new Date(startStr + 'T12:00:00');
        const e = new Date(endStr + 'T12:00:00');
        const opts = { day: 'numeric', month: 'short' };
        if (s.getTime() === e.getTime()) {
            subtitle.innerText = `(${s.toLocaleDateString('es-ES', opts)})`;
        } else if (s.getDate() === 1 && new Date(e.getTime() + 86400000).getDate() === 1) {
            // It's a full month
            subtitle.innerText = `(Mes de ${s.toLocaleDateString('es-ES', {month: 'long'})})`;
        } else {
            subtitle.innerText = `(${s.toLocaleDateString('es-ES', opts)} - ${e.toLocaleDateString('es-ES', opts)})`;
        }
    }

    const tbody = document.getElementById('dash-table-body');
    if (tbody) {
        let skeletonRows = '';
        for(let i=0; i<6; i++) {
            skeletonRows += `<tr><td colspan="15" style="padding: 15px;"><div class="skeleton" style="width: 100%; height: 20px;"></div></td></tr>`;
        }
        tbody.innerHTML = skeletonRows;
        tbody.style.opacity = '1';
        tbody.style.pointerEvents = 'none';
    }

    const podium = document.getElementById('top3-podium');
    if (podium) {
        podium.innerHTML = `
            <div class="podium-bar skeleton" style="height: 120px;"></div>
            <div class="podium-bar skeleton" style="height: 160px; transform: scale(1.1); margin: 0 15px;"></div>
            <div class="podium-bar skeleton" style="height: 90px;"></div>
        `;
    }

    const chartContainer = document.getElementById('dash-chart-container');
    if (chartContainer) {
        const h = chartContainer.offsetHeight || 150;
        chartContainer.innerHTML = `<div class="skeleton" style="width: 100%; height: ${h}px;"></div><canvas id="dash-trend-chart" style="display:none;"></canvas>`;
    }

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

    let usersSnap = null;
    let statsSnap = null;
    
    const rangeType = localStorage.getItem('dashRangeType') || 'week';
    const monthlyReady = !!localStorage.getItem('monthly_stats_built_v3');
    const useMonthly = monthlyReady && !isMatrixMode && ['month', 'lastMonth', 'last2Months', 'last4Months', 'last6Months', 'year'].includes(rangeType);
    const todayMonth = new Date().toISOString().substring(0, 7); // YYYY-MM current month
    const startMonth = startStr.substring(0, 7);
    const endMonth = endStr.substring(0, 7);
    // For the current month, always use daily stats (it's incomplete); past months use rollups
    const pastEndMonth = (endMonth >= todayMonth) ? 
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 7)
        : endMonth;
    const usePastMonthly = useMonthly && startMonth <= pastEndMonth;
    
    if (!globalActiveUsers) {
        usersSnap = await firestore.collection('users').where('active', '==', 1).get();
    }
    
    if (useMonthly) {
        // Fetch in parallel: past months from rollups + current month from daily stats
        const queries = [];
        if (usePastMonthly) {
            queries.push(firestore.collection('stats_monthly')
                .where('month', '>=', startMonth)
                .where('month', '<=', pastEndMonth).get());
        }
        // Always fetch current month from daily stats if it falls in the range
        if (endMonth >= todayMonth) {
            const curMonthStart = `${todayMonth}-01`;
            queries.push(firestore.collection('stats')
                .where('date', '>=', curMonthStart)
                .where('date', '<=', endStr).get());
        }
        const snaps = await Promise.all(queries);
        // Merge all docs into a single iterable
        const allDocs = [];
        snaps.forEach(snap => snap.forEach(doc => allDocs.push(doc)));
        statsSnap = { forEach: (fn) => allDocs.forEach(fn), docs: allDocs };
    } else {
        statsSnap = await firestore.collection('stats')
            .where('date', '>=', startStr)
            .where('date', '<=', endStr).get();
    }

    let users = [];
    if (globalActiveUsers) {
        users = globalActiveUsers;
    } else {
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'admin') users.push(doc.data());
        });
        globalActiveUsers = users;
    }

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

    statsSnap.forEach(doc => {
        const s = doc.data();
        if (userStats[s.name]) {
            userStats[s.name].totals.shots += s.shots || 0;
            userStats[s.name].totals.ventas += s.ventas || 0;
            userStats[s.name].totals.ads += s.ads || 0;
            userStats[s.name].totals.links += s.links || 0;
            userStats[s.name].totals.cxl += s.cxl || 0;
            // Only accumulate daily breakdown when reading from daily stats (not monthly rollups)
            if (!useMonthly && s.date) {
                if (!userStats[s.name].daily[s.date]) {
                    userStats[s.name].daily[s.date] = { shots: 0, ventas: 0 };
                }
                userStats[s.name].daily[s.date].shots += s.shots || 0;
                userStats[s.name].daily[s.date].ventas += s.ventas || 0;
            }
        }
    });

    dashData = Object.values(userStats).map(u => {
        u.cierre = u.totals.shots > 0 ? (u.totals.ventas / u.totals.shots) : 0;
        return u;
    });

    const totVentas = dashData.reduce((sum, u) => sum + u.totals.ventas, 0);
    const totShots  = dashData.reduce((sum, u) => sum + u.totals.shots, 0);
    const totAds    = dashData.reduce((sum, u) => sum + u.totals.ads, 0);
    const totLinks  = dashData.reduce((sum, u) => sum + u.totals.links, 0);
    const totCierre = totShots > 0 ? (totVentas / totShots) : 0;

    // --- Render Trend Chart (async, runs in background) ---
    renderDashChart(startStr, endStr, rangeType);

    const animateValue = (id, start, end, duration, isPercentage = false) => {
        const obj = document.getElementById(id);
        if (!obj) return;
        
        // Remove color classes for Cierre before setting new one later
        if (id === 'stat-cierre') {
            obj.classList.remove('cierre-good', 'cierre-warn', 'cierre-bad');
        }

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = start + easeOut * (end - start);
            
            if (isPercentage) {
                obj.innerText = current.toFixed(1) + '%';
            } else {
                obj.innerText = Math.floor(current);
            }
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                if (isPercentage) {
                    const finalStr = end.toFixed(1);
                    const finalNum = parseFloat(finalStr);
                    obj.innerText = finalStr + '%';
                    
                    // Add dynamic color for Cierre
                    if (finalNum >= 30.0) obj.classList.add('cierre-good');
                    else if (finalNum >= 25.0) obj.classList.add('cierre-warn');
                    else obj.classList.add('cierre-bad');
                } else {
                    obj.innerText = Math.round(end);
                }
            }
        };
        window.requestAnimationFrame(step);
    };

    const getOldVal = (id, isPct) => {
        const text = document.getElementById(id) ? document.getElementById(id).innerText : '';
        if (!text || text === '-' || text === '') return 0;
        if (isPct) return parseFloat(text.replace('%', '')) || 0;
        return parseInt(text) || 0;
    };

    const oldVentas = getOldVal('stat-ventas', false);
    const oldShots = getOldVal('stat-shots', false);
    const oldAds = getOldVal('stat-ads', false);
    const oldLinks = getOldVal('stat-links', false);
    const oldCierre = getOldVal('stat-cierre', true);

    animateValue('stat-ventas', oldVentas, totVentas, 700, false);
    animateValue('stat-shots', oldShots, totShots, 700, false);
    animateValue('stat-ads', oldAds, totAds, 700, false);
    animateValue('stat-links', oldLinks, totLinks, 700, false);
    animateValue('stat-cierre', oldCierre, totCierre * 100, 700, true);

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
    if (tbody) {
        tbody.style.opacity = '1';
        tbody.style.pointerEvents = 'auto';
    }
    
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
    let regularData = dashData.filter(d => !specialNames.includes(d.name));
    
    // Hide offline users if toggled
    if (hideOffline) {
        regularData = regularData.filter(d => d.totals.shots > 0 || d.totals.ventas > 0);
    }
    
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
        
        // Tie-breakers
        if (sortCol !== 'shots' && a.totals.shots !== b.totals.shots) {
            return b.totals.shots - a.totals.shots; // More shots goes higher
        }
        if (sortCol !== 'ventas' && a.totals.ventas !== b.totals.ventas) {
            return b.totals.ventas - a.totals.ventas; // More ventas goes higher
        }
        return a.name.localeCompare(b.name); // Alphabetical fallback
    });

    const renderRow = (d, idx = '', isSpecial = false) => {
        if (!d) return;
        const tr = document.createElement('tr');
        if (isSpecial) tr.style.background = 'var(--nav-bg)'; // Highlight slightly
        
        const cierrePct = parseFloat((d.cierre * 100).toFixed(1));
        let badgeClass = 'badge-red';
        if (cierrePct >= 30.0) badgeClass = 'badge-green';
        else if (cierrePct >= 25.0) badgeClass = 'badge-yellow';
        
        if (isSpecial && d.totals.shots === 0) badgeClass = '';

        const isOffline = (!isSpecial && d.totals.shots === 0 && d.totals.ventas === 0);

        let rowHTML = `<td style="text-align: center; color: var(--text-muted); font-size: 0.85rem; border-right: 1px solid var(--border);">${idx}</td>`;
        rowHTML += `<td style="${isOffline ? 'color: var(--text-muted);' : ''}"><strong>${d.name}</strong></td>`;
        
        if (isMatrixMode) {
            matrixDates.forEach(date => {
                const s = d.daily[date].shots;
                const v = d.daily[date].ventas;
                const isEmpty = (s === 0 && v === 0);
                const sDisplay = isEmpty ? '' : s;
                const vDisplay = isEmpty ? '' : v;
                rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); font-weight: 600; color: ${s > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${isOffline ? 'OFF' : sDisplay}</td>`;
                rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); font-weight: 800; color: ${v > 0 ? 'var(--primary)' : 'var(--text-muted)'};">${isOffline ? 'OFF' : vDisplay}</td>`;
            });
        }
        
        let ventasColor = 'var(--primary)';
        let ventasStyle = 'font-weight: bold; font-size: 0.95rem;';
        let shotsStyle = 'font-weight: bold; font-size: 0.95rem;';
        let adsColor = isOffline ? 'var(--text-muted)' : 'inherit';
        let linksColor = isOffline ? 'var(--text-muted)' : 'inherit';

        if (!isOffline) {
            const v = d.totals.ventas;
            const currentRange = localStorage.getItem('dashRangeType') || 'week';
            
            if (currentRange === 'month' || currentRange === 'lastMonth') {
                if (v <= 29) ventasColor = '#ef4444'; // Red up to 29
                else if (v <= 54) ventasColor = '#f59e0b'; // Yellow up to 54
                else ventasColor = '#10b981'; // Green for 55+
            } else if (currentRange === 'year') {
                if (v <= 220) ventasColor = '#ef4444'; // Red up to 220
                else if (v <= 300) ventasColor = '#f59e0b'; // Yellow up to 300
                else ventasColor = '#10b981'; // Green for 301+
            } else if (currentRange === 'today' || currentRange === 'yesterday') {
                ventasColor = 'var(--primary)'; // Default blue
            } else {
                if (v <= 8) ventasColor = '#ef4444';
                else if (v <= 13) ventasColor = '#f59e0b';
                else ventasColor = '#10b981';
            }
            ventasStyle = 'font-weight: 800; font-size: 0.95rem;';
            shotsStyle = 'font-weight: 800; font-size: 0.95rem;';
            
            if (d.totals.ads === 0) adsColor = '#ef4444';
            if (d.totals.links === 0) linksColor = '#ef4444';
        }

        rowHTML += `
            <td style="text-align: center; border-left: 2px solid var(--primary); ${shotsStyle} color: ${isOffline ? 'var(--text-muted)' : 'inherit'};">${isOffline ? 'OFF' : d.totals.shots}</td>
            <td style="text-align: center; border-left: 1px solid var(--border); ${ventasStyle} color: ${isOffline ? 'var(--text-muted)' : ventasColor};">${isOffline ? 'OFF' : d.totals.ventas}</td>
            <td style="text-align: center; border-left: 1px solid var(--border);"><span class="${isOffline ? '' : 'badge ' + badgeClass}" style="${isOffline ? 'color: var(--text-muted); font-weight: normal;' : ''}">${isOffline ? '-' : (d.cierre * 100).toFixed(1) + '%'}</span></td>
            <td style="text-align: center; border-left: 1px solid var(--border); font-weight: ${(!isOffline && d.totals.ads === 0) ? 'bold' : 'normal'}; color: ${adsColor};">${isOffline ? '-' : d.totals.ads}</td>
            <td style="text-align: center; border-left: 1px solid var(--border); font-weight: ${(!isOffline && d.totals.links === 0) ? 'bold' : 'normal'}; color: ${linksColor};">${isOffline ? '-' : d.totals.links}</td>
        `;
        
        if (currentUser && currentUser.role === 'admin') {
            rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); color: ${isOffline ? 'var(--text-muted)' : 'var(--danger)'};">${isOffline ? '-' : d.totals.cxl}</td>`;
        }
        
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    };

    regularData.forEach((d, idx) => renderRow(d, idx + 1));
    
    if (enReporte) renderRow(enReporte, '', true);
    renderRow(synthTotales, '', true);
}

// --- Import Historical Data ---

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
        delay: 0
    });
    if (top3[0]) places.push({ 
        ...top3[0], 
        rank: 1, 
        icon: '👑', 
        finalHeight: 180, 
        gradient: 'linear-gradient(180deg, #00d2ff 0%, #3a7bd5 100%)',
        glow: 'rgba(0, 210, 255, 0.5)',
        textColor: '#00d2ff',
        delay: 200
    });
    if (top3[2]) places.push({ 
        ...top3[2], 
        rank: 3, 
        icon: '', 
        finalHeight: 100, 
        gradient: 'linear-gradient(180deg, #b224ef 0%, #7579ff 100%)',
        glow: 'rgba(178, 36, 239, 0.5)',
        textColor: '#d946ef',
        delay: 100
    });
    
    // Build HTML with data attributes for animation targets
    let html = '';
    places.forEach((p) => {
        html += `
            <div class="podium-card" data-rank="${p.rank}" data-ventas="${p.totals.ventas}" data-cierre="${(p.cierre * 100).toFixed(1)}" data-delay="${p.delay}"
                 style="display: flex; flex-direction: column; align-items: center; width: 140px; opacity: 0; transform: translateY(30px); transition: opacity 0.4s ease, transform 0.4s ease;">
                <div style="font-size: 1.5rem; margin-bottom: 0.2rem; filter: drop-shadow(0 0 8px ${p.textColor}); height: 24px;">${p.icon}</div>
                <strong style="font-size: 1rem; color: var(--text-main); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.2rem; text-shadow: 0 0 10px rgba(255,255,255,0.3); text-align: center;">${p.name}</strong>
                <div class="podium-cierre" style="font-size: 0.75rem; color: ${p.textColor}; font-weight: bold; margin-bottom: 0.8rem; text-shadow: 0 0 8px ${p.glow}; letter-spacing: 0.5px;">Cierre: 0%</div>
                
                <div style="width: 100%; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 0 25px ${p.glow}, inset 0 2px 10px rgba(255,255,255,0.3); overflow: hidden; background: ${p.gradient};">
                    <div class="podium-bar" style="height: 0px; display: flex; justify-content: center; align-items: flex-start; padding-top: 15px; position: relative; transition: height 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);">
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%); pointer-events: none;"></div>
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; justify-content: center; align-items: center; font-weight: 800; font-size: 0.95rem; color: #fff; box-shadow: inset 0 2px 5px rgba(255,255,255,0.4), 0 2px 5px rgba(0,0,0,0.1); z-index: 1;">
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
    
    // Logo
    const logo = document.createElement('div');
    logo.innerHTML = 'MVG <span style="color: #00d2ff;">STATS</span>';
    logo.style.color = '#fff';
    logo.style.fontSize = '2.5rem';
    logo.style.fontWeight = '900';
    logo.style.marginBottom = '2.5rem';
    logo.style.letterSpacing = '2px';
    
    // Title
    const title = document.createElement('h1');
    title.innerText = 'TOP 3 VENDEDORES';
    title.style.color = '#fff';
    title.style.fontSize = '2rem';
    title.style.marginBottom = '0.5rem';
    title.style.textShadow = '0 4px 10px rgba(0,0,0,0.5)';
    
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
    
    // Append all
    exportDiv.appendChild(logo);
    exportDiv.appendChild(title);
    exportDiv.appendChild(dateSub);
    exportDiv.appendChild(podiumClone);
    
    // Watermark
    const water = document.createElement('div');
    water.innerText = 'Generado automáticamente por StatsMaster';
    water.style.position = 'absolute';
    water.style.bottom = '2rem';
    water.style.color = '#444';
    water.style.fontSize = '0.9rem';
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
            return 0;
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

// --- Academy ---
async function loadAcademy() {
    const startStr = document.getElementById('academy-start').value;
    const endStr = document.getElementById('academy-end').value;

    if (!startStr || !endStr) return;

    let usersSnap = null;
    let statsSnap = null;
    
    const rangeType = localStorage.getItem('academyRangeType') || 'month';
    const monthlyReady = !!localStorage.getItem('monthly_stats_built_v3');
    const useMonthly = monthlyReady && ['month', 'lastMonth', 'last2Months', 'last4Months', 'last6Months', 'year'].includes(rangeType);
    const todayMonth = new Date().toISOString().substring(0, 7);
    const startMonth = startStr.substring(0, 7);
    const endMonth = endStr.substring(0, 7);
    const pastEndMonth = (endMonth >= todayMonth) ?
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 7)
        : endMonth;
    const usePastMonthly = useMonthly && startMonth <= pastEndMonth;
    
    if (!globalActiveUsers) {
        usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        let users = [];
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'admin') users.push(doc.data());
        });
        globalActiveUsers = users;
    }
    
    if (useMonthly) {
        const queries = [];
        if (usePastMonthly) {
            queries.push(firestore.collection('stats_monthly')
                .where('month', '>=', startMonth)
                .where('month', '<=', pastEndMonth).get());
        }
        if (endMonth >= todayMonth) {
            const curMonthStart = `${todayMonth}-01`;
            queries.push(firestore.collection('stats')
                .where('date', '>=', curMonthStart)
                .where('date', '<=', endStr).get());
        }
        const snaps = await Promise.all(queries);
        const allDocs = [];
        snaps.forEach(snap => snap.forEach(doc => allDocs.push(doc)));
        statsSnap = { forEach: (fn) => allDocs.forEach(fn), docs: allDocs };
    } else {
        statsSnap = await firestore.collection('stats')
            .where('date', '>=', startStr)
            .where('date', '<=', endStr).get();
    }

    let users = globalActiveUsers;
    
    let userStats = {};
    users.forEach(u => {
        userStats[u.name] = { shots: 0, ventas: 0 };
    });

    statsSnap.forEach(doc => {
        const data = doc.data();
        if (data.name && userStats[data.name]) {
            userStats[data.name].shots += (Number(data.shots) || 0);
            userStats[data.name].ventas += (Number(data.ventas) || 0);
        }
    });

    let totalShots = 0;
    let totalVentas = 0;
    let activeRepsCount = 0;

    let repsArray = [];
    for (let name in userStats) {
        const s = userStats[name];
        if (s.shots > 0) { // Only count reps that actually had traffic in this period
            totalShots += s.shots;
            totalVentas += s.ventas;
            activeRepsCount++;
            
            repsArray.push({
                name,
                shots: s.shots,
                ventas: s.ventas,
                pct: (s.ventas / s.shots) * 100
            });
        }
    }

    if (activeRepsCount === 0) {
        document.getElementById('academy-avg-shots').innerText = '0';
        document.getElementById('academy-avg-pct').innerText = '0%';
        ['rojos', 'francotiradores', 'ametralladoras', 'estrellas'].forEach(id => {
            document.getElementById(`academy-list-${id}`).innerHTML = '<li style="color:#666; font-size: 0.8rem;">Sin datos en este periodo</li>';
        });
        return;
    }

    const avgShots = totalShots / activeRepsCount;
    const avgPct = (totalVentas / totalShots) * 100;

    document.getElementById('academy-avg-shots').innerText = avgShots.toFixed(1);
    document.getElementById('academy-avg-pct').innerText = avgPct.toFixed(1) + '%';

    const lists = {
        rojos: [],
        francotiradores: [],
        ametralladoras: [],
        estrellas: []
    };

    repsArray.forEach(rep => {
        const highShots = rep.shots >= avgShots;
        const highPct = rep.pct >= avgPct;

        if (highShots && highPct) lists.estrellas.push(rep);
        else if (highShots && !highPct) lists.ametralladoras.push(rep);
        else if (!highShots && highPct) lists.francotiradores.push(rep);
        else lists.rojos.push(rep);
    });

    const renderList = (id, arr) => {
        const ul = document.getElementById(`academy-list-${id}`);
        ul.innerHTML = '';
        if (arr.length === 0) {
            ul.innerHTML = '<li style="color:#666; font-size: 0.8rem;">Ninguno</li>';
            return;
        }
        
        if (id === 'ametralladoras') {
            arr.sort((a, b) => b.shots - a.shots);
        } else if (id === 'francotiradores') {
            arr.sort((a, b) => b.pct - a.pct);
        } else if (id === 'estrellas') {
            arr.sort((a, b) => b.ventas - a.ventas);
        } else if (id === 'rojos') {
            arr.sort((a, b) => a.pct - b.pct); // Worst close % first
        }
        
        arr.forEach(rep => {
            ul.innerHTML += `<li onclick="openAcademyModal('${rep.name.replace(/'/g, "\\'")}', ${rep.shots}, ${rep.ventas}, ${rep.pct})"
                style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.4rem; cursor: pointer; transition: background 0.15s;" 
                onmouseover="this.style.background='rgba(0,210,255,0.06)'" onmouseout="this.style.background='var(--bg-color)'">
                <span style="font-weight: bold; font-size: 0.9rem; color: var(--text-main);">${rep.name}</span>
                <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${rep.shots} sh <span style="margin: 0 4px; opacity: 0.3;">|</span> <span style="color: var(--text-main); font-weight: bold;">${rep.pct.toFixed(1)}%</span></div>
                    <span style="font-size: 0.7rem; color: #00d2ff; opacity: 0.6;">📈</span>
                </div>
            </li>`;
        });
    };

    renderList('rojos', lists.rojos);
    renderList('francotiradores', lists.francotiradores);
    renderList('ametralladoras', lists.ametralladoras);
    renderList('estrellas', lists.estrellas);
}
// --- Dashboard Trend Chart ---
let dashChartInstance = null;
async function renderDashChart(startStr, endStr, rangeType) {
    const chartRanges = ['month', 'lastMonth', 'last2Months', 'last4Months', 'last6Months', 'year'];
    const container = document.getElementById('dash-chart-container');
    const canvas = document.getElementById('dash-trend-chart');
    if (!container || !canvas) return;

    if (!chartRanges.includes(rangeType)) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    const byMonth = ['last2Months', 'last4Months', 'last6Months', 'year'].includes(rangeType);

    const buckets = {};

    if (byMonth) {
        // Use stats_monthly collection — fast rollup data, grouped by month
        const todayMonth = new Date().toISOString().substring(0, 7);
        const startMonth = startStr.substring(0, 7);
        const endMonth   = endStr.substring(0, 7);
        const pastEnd    = endMonth >= todayMonth
            ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 7)
            : endMonth;

        const queries = [];
        if (startMonth <= pastEnd) {
            queries.push(firestore.collection('stats_monthly')
                .where('month', '>=', startMonth)
                .where('month', '<=', pastEnd).get());
        }
        if (endMonth >= todayMonth) {
            queries.push(firestore.collection('stats')
                .where('date', '>=', `${todayMonth}-01`)
                .where('date', '<=', endStr).get());
        }
        const snaps = await Promise.all(queries);
        
        // queries[0] is stats_monthly IF startMonth <= pastEnd
        let hasMonthlyData = false;
        if (startMonth <= pastEnd && snaps.length > 0) {
            hasMonthlyData = !snaps[0].empty;
        }

        snaps.forEach(snap => {
            snap.forEach(doc => {
                const d = doc.data();
                let key = d.month;
                if (!key && d.date) key = d.date.substring(0, 7);
                if (!key && doc.id.includes('_')) key = doc.id.split('_').pop(); 
                
                if (!key) return;
                if (!buckets[key]) buckets[key] = { shots: 0, ventas: 0 };
                buckets[key].shots  += Number(d.shots)  || 0;
                buckets[key].ventas += Number(d.ventas) || 0;
            });
        });

        // FALLBACK: If stats_monthly was completely empty (e.g. migration failed), fetch from raw stats
        if (!hasMonthlyData && startMonth <= pastEnd) {
            const fallbackSnap = await firestore.collection('stats')
                .where('date', '>=', startStr)
                .where('date', '<=', endStr).get();
            
            fallbackSnap.forEach(doc => {
                const d = doc.data();
                if (!d.date) return;
                const key = d.date.substring(0, 7);
                if (!buckets[key]) buckets[key] = { shots: 0, ventas: 0 };
                buckets[key].shots  += Number(d.shots)  || 0;
                buckets[key].ventas += Number(d.ventas) || 0;
            });
        }
    } else {
        // Fetch daily stats directly for day-by-day granularity (Este Mes, Mes Pasado)
        const snap = await firestore.collection('stats')
            .where('date', '>=', startStr)
            .where('date', '<=', endStr).get();
        snap.forEach(doc => {
            const d = doc.data();
            if (!d.date) return;
            if (!buckets[d.date]) buckets[d.date] = { shots: 0, ventas: 0 };
            buckets[d.date].shots  += Number(d.shots)  || 0;
            buckets[d.date].ventas += Number(d.ventas) || 0;
        });
    }

    const sortedKeys = Object.keys(buckets).sort();

    const labels = sortedKeys.map(k => {
        if (byMonth) {
            try {
                const parts = k.split('-');
                if (parts.length < 2) return k;
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                if (isNaN(y) || isNaN(m)) return k;
                return new Date(y, m - 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
            } catch (e) { return k; }
        } else {
            try {
                const d = new Date(k + 'T12:00:00');
                if (isNaN(d.getTime())) return k;
                return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            } catch (e) { return k; }
        }
    });

    const shotsData  = sortedKeys.map(k => buckets[k].shots);
    const ventasData = sortedKeys.map(k => buckets[k].ventas);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#888' : '#aaa';

    // Remove skeleton
    const skeleton = container.querySelector('.skeleton');
    if (skeleton) skeleton.remove();
    canvas.style.display = 'block';

    try {
        if (dashChartInstance) {
            dashChartInstance.destroy();
            dashChartInstance = null;
        }

        dashChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Shots',
                        data: shotsData,
                        borderColor: '#00d2ff',
                        backgroundColor: 'rgba(0,210,255,0.08)',
                        borderWidth: 2.5,
                        pointRadius: sortedKeys.length <= 31 ? 3 : 0,
                        pointHoverRadius: 5,
                        tension: 0.35,
                        fill: true,
                    },
                    {
                        label: 'Ventas',
                        data: ventasData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.08)',
                        borderWidth: 2.5,
                        pointRadius: sortedKeys.length <= 31 ? 3 : 0,
                        pointHoverRadius: 5,
                        tension: 0.35,
                        fill: true,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#ccc',
                        padding: 10,
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 12 } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } }, beginAtZero: true }
                }
            }
        });
    } catch (e) {
        console.error("Error drawing dash chart:", e);
    }
}

// --- Academy Modal ---
async function openAcademyModal(repName, repShots, repVentas, repPct) {
    const modal = document.getElementById('academy-modal');
    document.getElementById('academy-modal-name').textContent = repName;
    document.getElementById('academy-modal-stats').textContent =
        `${repShots} shots · ${repVentas} ventas · ${repPct.toFixed(1)}% cierre`;
    modal.style.display = 'flex';

    // Fetch last 6 months of data for this rep from stats_monthly
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const startMonth = sixMonthsAgo.toISOString().substring(0, 7);
    const todayMonth = today.toISOString().substring(0, 7);

    // Fetch past months from rollups + current month from daily without composite queries
    const [pastSnap, curSnap] = await Promise.all([
        firestore.collection('stats_monthly')
            .where('name', '==', repName)
            .get(),
        firestore.collection('stats')
            .where('name', '==', repName)
            .get()
    ]);

    const byMonth = {};
    let hasMonthlyData = false;
    pastSnap.forEach(doc => {
        const d = doc.data();
        let m = d.month;
        if (!m && doc.id.includes('_')) m = doc.id.split('_').pop();
        if (!m || m < startMonth || m > todayMonth) return;
        
        hasMonthlyData = true;
        if (!byMonth[m]) byMonth[m] = { shots: 0, ventas: 0 };
        byMonth[m].shots  += Number(d.shots)  || 0;
        byMonth[m].ventas += Number(d.ventas) || 0;
    });

    if (!hasMonthlyData) {
        // Fallback for academy modal if stats_monthly is empty
        const fallbackSnap = await firestore.collection('stats')
            .where('name', '==', repName)
            .get();
        fallbackSnap.forEach(doc => {
            const d = doc.data();
            if (!d.date || d.date < startMonth + '-01' || d.date > todayMonth + '-31') return;
            const m = d.date.substring(0, 7);
            if (!byMonth[m]) byMonth[m] = { shots: 0, ventas: 0 };
            byMonth[m].shots  += Number(d.shots)  || 0;
            byMonth[m].ventas += Number(d.ventas) || 0;
        });
    }

    // Merge current month daily (only needed if fallback wasn't triggered, but safe to do anyway as it will just overwrite/add)
    if (hasMonthlyData) {
        curSnap.forEach(doc => {
            const d = doc.data();
            if (!d.date || d.date < todayMonth + '-01' || d.date > todayMonth + '-31') return;
            const m = d.date.substring(0, 7);
            if (!m) return;
            if (!byMonth[m]) byMonth[m] = { shots: 0, ventas: 0 };
            byMonth[m].shots  += Number(d.shots)  || 0;
            byMonth[m].ventas += Number(d.ventas) || 0;
        });
    }

    const sortedMonths = Object.keys(byMonth).sort();
    const labels  = sortedMonths.map(k => {
        try {
            const parts = k.split('-');
            if (parts.length < 2) return k;
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (isNaN(y) || isNaN(m)) return k;
            return new Date(y, m - 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        } catch (e) { return k; }
    });
    const shotsArr  = sortedMonths.map(k => byMonth[k].shots);
    const ventasArr = sortedMonths.map(k => byMonth[k].ventas);

    const canvas = document.getElementById('academy-modal-chart');
    if (academyModalChart) { academyModalChart.destroy(); academyModalChart = null; }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#888' : '#999';

    try {
        academyModalChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Shots',
                        data: shotsArr,
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79,172,254,0.1)',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.35,
                        fill: true,
                    },
                    {
                        label: 'Ventas',
                        data: ventasArr,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.35,
                        fill: true,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#ccc',
                        padding: 10,
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, beginAtZero: true }
                }
            }
        });
    } catch (e) {
        console.error("Error drawing academy chart:", e);
    }
}

function closeAcademyModal(e) {
    if (e && e.target !== document.getElementById('academy-modal')) return;
    document.getElementById('academy-modal').style.display = 'none';
    if (academyModalChart) { academyModalChart.destroy(); academyModalChart = null; }
}

// --- SPIFFS ---
async function loadSpiffs() {
    const adminPanel = document.getElementById('spiff-admin-panel');
    if (currentUser && currentUser.role === 'admin') {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }
    
    const activeContainer = document.getElementById('spiffs-active-container');
    const completedContainer = document.getElementById('spiffs-completed-container');
    if(!activeContainer) return;
    
    activeContainer.innerHTML = '<div class="skeleton" style="height:150px; width:100%;"></div>';
    completedContainer.innerHTML = '<div class="skeleton" style="height:100px; width:100%;"></div>';

    try {
        const snap = await firestore.collection('spiffs').orderBy('createdAt', 'desc').get();
        activeContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        
        if (snap.empty) {
            activeContainer.innerHTML = '<p style="color:var(--text-muted);">No hay Spiffs activos.</p>';
            return;
        }

        snap.forEach(doc => {
            const s = doc.data();
            s.id = doc.id;
            const card = document.createElement('div');
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
                    let selectHtml = `<select id="winner-${s.id}" style="width:100%; margin-bottom:10px; padding:0.5rem; border-radius:6px; background:var(--bg-color); color:var(--text); border:1px solid var(--border);"><option value="">Seleccionar Ganador...</option>`;
                    
                    if (globalActiveUsers) {
                        globalActiveUsers.forEach(u => {
                            if(u.role !== 'admin') selectHtml += `<option value="${u.name}">${u.name}</option>`;
                        });
                    }
                    
                    selectHtml += `</select><button onclick="declareSpiffWinner('${s.id}')" class="btn-primary" style="width:100%; padding:0.5rem; margin-bottom: 0.5rem;">Declarar Ganador 🏆</button>
                    <button onclick="deleteSpiff('${s.id}')" class="btn-secondary" style="width:100%; padding:0.5rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Eliminar Spiff 🗑️</button>`;
                    adminControls.innerHTML = selectHtml;
                    card.appendChild(adminControls);
                }
                activeContainer.appendChild(card);
            } else {
                card.innerHTML = `<h4 style="margin-top:0; color:var(--text-muted);">✅ ${s.title} <span style="font-size:0.75rem; font-weight:normal; margin-left:5px;">(${dateStr})</span></h4>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">Premio: ${s.prize}</p>
                    <div style="background:rgba(79,172,254,0.1); color:#4facfe; padding:0.5rem; border-radius:8px; text-align:center; font-weight:bold;">
                        👑 Ganador: ${s.winner}
                    </div>`;
                
                if (currentUser && currentUser.role === 'admin') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-secondary';
                    deleteBtn.style.cssText = 'width: 100%; margin-top: 10px; padding: 0.4rem; font-size: 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);';
                    deleteBtn.innerText = 'Eliminar 🗑️';
                    deleteBtn.onclick = () => deleteSpiff(s.id);
                    card.appendChild(deleteBtn);
                }

                completedContainer.appendChild(card);
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
    const prize = document.getElementById('spiff-prize').value;
    const metric = document.getElementById('spiff-metric').value;
    const cierre = document.getElementById('spiff-cierre').value;
    
    if (!title || !prize || !metric) return alert('Por favor llena el título, premio y métrica.');
    
    try {
        await firestore.collection('spiffs').add({
            title, time, period, prize, metric, cierre, status: 'active', winner: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
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

async function deleteSpiff(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este Spiff? Esta acción no se puede deshacer.')) return;
    try {
        await firestore.collection('spiffs').doc(id).delete();
        loadSpiffs();
    } catch(e) { console.error(e); alert('Error al eliminar Spiff'); }
}
