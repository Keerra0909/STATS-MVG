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
        const lobbiesBtn = document.getElementById('btn-lobbies');
        if (lobbiesBtn) lobbiesBtn.style.display = 'block';
        const cfgBtn = document.getElementById('btn-config-carrera');
        if (cfgBtn) cfgBtn.style.display = 'inline-block';
        const podioBtn = document.getElementById('btn-toggle-podium');
        if (podioBtn) podioBtn.style.display = 'inline-block';
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
        const lobbiesBtn = document.getElementById('btn-lobbies');
        if (lobbiesBtn) lobbiesBtn.style.display = 'none';
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

window.logout = function() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showView('login');
    const headerEl = document.getElementById('main-header');
    if (headerEl) headerEl.style.display = 'none';
}

window.calcTotales = function(idPrefix, idSuffix, fieldChanged) {
    const singles = parseInt(document.getElementById(`${idPrefix}singles${idSuffix}`).value) || 0;
    const dobles = parseInt(document.getElementById(`${idPrefix}dobles${idSuffix}`).value) || 0;
    const triples = parseInt(document.getElementById(`${idPrefix}triples${idSuffix}`).value) || 0;
    const cuadruples = parseInt(document.getElementById(`${idPrefix}cuadruples${idSuffix}`).value) || 0;
    const quintuples = parseInt(document.getElementById(`${idPrefix}quintuples${idSuffix}`).value) || 0;
    const arpones = parseInt(document.getElementById(`${idPrefix}arpones${idSuffix}`).value) || 0;
    
    const adsInput = document.getElementById(`${idPrefix}ads${idSuffix}`);
    if (['dobles', 'triples', 'cuadruples', 'quintuples'].includes(fieldChanged)) {
        const implicitAds = (dobles * 1) + (triples * 2) + (cuadruples * 3) + (quintuples * 4);
        if (adsInput) {
            adsInput.value = implicitAds > 0 ? implicitAds : '';
        }
    }
    
    const ads = parseInt(adsInput ? adsInput.value : 0) || 0;
    const baseSales = singles + dobles + triples + cuadruples + quintuples;
    const totalVentas = baseSales + ads + arpones;
    
    const visualVts = document.getElementById(`${idPrefix}visual-vts${idSuffix}`);
    if (visualVts) {
        visualVts.innerText = totalVentas > 0 ? totalVentas : '0';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('btn-logout').style.display = 'none';
    navigate('login');
}


