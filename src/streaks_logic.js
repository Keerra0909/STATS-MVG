// --- Streaks Logic ---
let globalStreaks = {};
let globalIceStreaks = {};
let globalMonthlyBlanks = {};
let globalLastWeekMvp = null;

async function fetchStreaks(baseDateStr = null) {
    globalStreaks = {};
    globalIceStreaks = {};
    globalMonthlyBlanks = {};
    globalLastWeekMvp = null;
    
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        const streakSnap = await firestore.collection('stats')
            .where('date', '>=', thirtyDaysAgoStr)
            .get();
            
        const userHistory = {}; 
        streakSnap.forEach(doc => {
            const s = doc.data();
            if (!userHistory[s.name]) userHistory[s.name] = {};
            userHistory[s.name][s.date] = s;
        });
        
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        
        const currentMonthPrefix = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        
        // Calculate last week's dates
        const dToday = baseDateStr ? new Date(baseDateStr + 'T12:00:00') : new Date();
        const dayOfWeek = dToday.getDay() === 0 ? 7 : dToday.getDay(); 
        const lastSunday = new Date(dToday);
        lastSunday.setDate(dToday.getDate() - dayOfWeek);
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);
        
        const lastWeekDates = [];
        for (let i = 0; i < 7; i++) {
            const temp = new Date(lastMonday);
            temp.setDate(lastMonday.getDate() + i);
            lastWeekDates.push(temp.toISOString().split('T')[0]);
        }
        
        const last30Dates = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last30Dates.push(d.toISOString().split('T')[0]);
        }
        
        let mvpName = null;
        let mvpVentas = -1;
        
        usersSnap.forEach(doc => {
            const name = doc.data().name;
            const history = userHistory[name] || {};
            
            // Fire Streak & Ice Streak
            let fireStreak = 0;
            let iceStreak = 0;
            let breakFire = false;
            let breakIce = false;
            
            for (const dStr of last30Dates) {
                const stat = history[dStr];
                if (stat) {
                    // Fire logic
                    if (!breakFire) {
                        if (stat.ventas > 0) fireStreak++;
                        else if (stat.ventas === 0 && stat.shots > 0) breakFire = true;
                    }
                    // Ice logic
                    if (!breakIce) {
                        if (stat.ventas === 0 && stat.shots > 0) iceStreak++;
                        else if (stat.ventas > 0) breakIce = true;
                    }
                }
            }
            
            // Monthly Blanks
            let mBlanks = 0;
            Object.values(history).forEach(stat => {
                if (stat.date.startsWith(currentMonthPrefix) && stat.ventas === 0 && stat.shots > 0) {
                    mBlanks++;
                }
            });
            
            // Last Week MVP
            let lWeekVentas = 0;
            lastWeekDates.forEach(dStr => {
                if (history[dStr]) lWeekVentas += (history[dStr].ventas || 0);
            });
            if (lWeekVentas > mvpVentas && lWeekVentas > 0) {
                mvpVentas = lWeekVentas;
                mvpName = name;
            }
            
            globalStreaks[name] = fireStreak;
            globalIceStreaks[name] = iceStreak;
            globalMonthlyBlanks[name] = mBlanks;
        });
        
        globalLastWeekMvp = mvpName;
        
    } catch (e) {
        console.error("Error fetching streaks:", e);
    }
}

let lastDashStart = null;
let lastDashEnd = null;
async function loadDashboard() {
    const startStr = document.getElementById('dash-start').value;
    const endStr = document.getElementById('dash-end').value;
    if (lastDashStart === startStr && lastDashEnd === endStr) return;
    lastDashStart = startStr;
    lastDashEnd = endStr;

    await fetchStreaks(startStr);

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
        u.totals.ventas = Math.max(0, u.totals.ventas - u.totals.cxl);
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
        regularData = regularData.filter(d => d.totals.shots > 0 || d.totals.ventas > 0 || (d.totals.ads || 0) > 0 || (d.totals.links || 0) > 0 || (d.totals.cxl || 0) > 0);
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
        if (sortCol !== 'links' && (a.totals.links || 0) !== (b.totals.links || 0)) {
            return (b.totals.links || 0) - (a.totals.links || 0);
        }
        if (sortCol !== 'ads' && (a.totals.ads || 0) !== (b.totals.ads || 0)) {
            return (b.totals.ads || 0) - (a.totals.ads || 0);
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

        const isOffline = (!isSpecial && d.totals.shots === 0 && d.totals.ventas === 0 && (d.totals.ads || 0) === 0 && (d.totals.links || 0) === 0 && (d.totals.cxl || 0) === 0);

        let streakBadge = '';
        if (!isSpecial && globalStreaks && globalStreaks[d.name] >= 2) {
            streakBadge = `<span style="display: inline-block; background: rgba(255, 100, 0, 0.15); color: #ff8c00; border: 1px solid rgba(255, 100, 0, 0.3); padding: 0px 5px; border-radius: 8px; font-size: 0.65rem; font-weight: bold; margin-left: 6px; box-shadow: 0 0 8px rgba(255, 100, 0, 0.1); vertical-align: middle;" data-html2canvas-ignore="true">🔥 x${globalStreaks[d.name]}</span>`;
        } else if (!isSpecial && globalIceStreaks && globalIceStreaks[d.name] >= 2) {
            streakBadge = `<span style="display: inline-block; background: rgba(0, 200, 255, 0.15); color: #00bfff; border: 1px solid rgba(0, 200, 255, 0.3); padding: 0px 5px; border-radius: 8px; font-size: 0.65rem; font-weight: bold; margin-left: 6px; box-shadow: 0 0 8px rgba(0, 200, 255, 0.1); vertical-align: middle;" data-html2canvas-ignore="true">🧊 x${globalIceStreaks[d.name]}</span>`;
        }
        
        let mvpBadge = '';
            if (!isSpecial && globalLastWeekMvp === d.name) {
            mvpBadge = `<span style="margin-left: 6px; font-size: 1rem; filter: drop-shadow(0 0 5px rgba(255,215,0,0.6)); vertical-align: middle;" title="MVP Semana Pasada" data-html2canvas-ignore="true">👑</span>`;
        }

        let rowHTML = `<td style="text-align: center; color: var(--text-muted); font-size: 0.85rem; border-right: 1px solid var(--border);">${idx}</td>`;
        rowHTML += `<td style="${isOffline ? 'color: var(--text-muted);' : ''}"><strong>${d.name}</strong>${mvpBadge}${streakBadge}</td>`;
        
        if (isMatrixMode) {
            matrixDates.forEach(date => {
                const s = d.daily[date].shots;
                const v = d.daily[date].ventas;
                const lobby = d.daily[date].lobby || '';
                const isEmpty = (s === 0 && v === 0);
                const sDisplay = isEmpty ? '' : s;
                const vDisplay = isEmpty ? '' : v;
                const titleAttr = lobby && !isOffline && !isEmpty ? `title="Lobby: ${lobby}"` : '';
                
                rowHTML += `<td ${titleAttr} style="text-align: center; border-left: 1px solid var(--border); font-weight: 600; color: ${s > 0 ? 'var(--text-main)' : 'var(--text-muted)'}; cursor: ${titleAttr ? 'help' : 'default'};">${isOffline ? 'OFF' : sDisplay}</td>`;
                rowHTML += `<td ${titleAttr} style="text-align: center; border-left: 1px solid var(--border); font-weight: 800; color: ${v > 0 ? 'var(--primary)' : 'var(--text-muted)'}; cursor: ${titleAttr ? 'help' : 'default'};">${isOffline ? 'OFF' : vDisplay}</td>`;
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
            rowHTML += `<td style="text-align: center; border-left: 1px solid var(--border); color: ${isOffline ? 'var(--text-muted)' : (d.totals.cxl > 0 ? 'var(--danger)' : 'var(--text-main)')}; font-weight: ${(!isOffline && d.totals.cxl > 0) ? 'bold' : 'normal'};">${isOffline ? '-' : d.totals.cxl}</td>`;
        }
        
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    };

    regularData.forEach((d, idx) => renderRow(d, idx + 1));
    
    if (enReporte) renderRow(enReporte, '', true);
    renderRow(synthTotales, '', true);
}

