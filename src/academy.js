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
