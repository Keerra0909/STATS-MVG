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

