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

