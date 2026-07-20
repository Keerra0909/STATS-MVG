// --- Lobbies Dashboard ---
let currentLobbiesRange = 'month';
let lobbiesChartInstance = null;

function setLobbiesRange(type) {
    currentLobbiesRange = type;
    document.querySelectorAll('#view-lobbies .dash-range-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`lobbies-btn-${type}`);
    if (btn) {
        btn.classList.add('active');
        const pill = document.getElementById('lobbies-seg-pill');
        if (pill) {
            pill.style.left = btn.offsetLeft + 'px';
            pill.style.width = btn.offsetWidth + 'px';
        }
    }
    loadLobbiesDashboard();
}

let lastLobbiesRange = null;
async function loadLobbiesDashboard() {
    if (lastLobbiesRange === currentLobbiesRange && currentLobbiesRange) return;
    lastLobbiesRange = currentLobbiesRange;
    try {
        const today = new Date();
        let start = new Date(today);
        let end = new Date(today);
        const type = currentLobbiesRange;
        let label = '';

        if (type === 'today') {
            label = 'Hoy';
        } else if (type === 'yesterday') {
            start.setDate(today.getDate() - 1);
            end = new Date(start);
            label = 'Ayer';
        } else if (type === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            label = 'Esta Semana';
        } else if (type === 'lastWeek') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff - 7);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            label = 'Semana Pasada';
        } else if (type === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            label = 'Este Mes';
        } else if (type === 'lastMonth') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            label = 'Mes Pasado';
        } else if (type === 'last2Months') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            label = 'Últimos 2 Meses';
        } else if (type === 'last4Months') {
            start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            label = 'Últimos 4 Meses';
        } else if (type === 'last6Months') {
            start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
            label = 'Últimos 6 Meses';
        } else if (type === 'year') {
            start = new Date(today.getFullYear(), 0, 1);
            label = 'Este Año';
        }

        const fmt = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const startStr = fmt(start);
        const endStr = fmt(end);

        document.getElementById('lobbies-date-range').innerText = `(${label})`;

        const snap = await firestore.collection('stats')
            .where('date', '>=', startStr)
            .where('date', '<=', endStr)
            .get();

        const lobbyData = {
            'Nizuc': { shots: 0, ventas: 0, ads: 0, reps: {} },
            'Sunrise': { shots: 0, ventas: 0, ads: 0, reps: {} },
            'The Grand': { shots: 0, ventas: 0, ads: 0, reps: {} },
            'Sin Asignar': { shots: 0, ventas: 0, ads: 0, reps: {} }
        };

        snap.forEach(doc => {
            const data = doc.data();
            if (!data.name || !data.date) return;
            const l = data.lobby || 'Sin Asignar';
            if (!lobbyData[l]) {
                lobbyData[l] = { shots: 0, ventas: 0, ads: 0, reps: {} };
            }
            lobbyData[l].shots += (Number(data.shots) || 0);
            lobbyData[l].ventas += (Number(data.ventas) || 0);
            lobbyData[l].ads += (Number(data.ads) || 0);
            
            if (data.name) {
                if (!lobbyData[l].reps[data.name]) lobbyData[l].reps[data.name] = 0;
                lobbyData[l].reps[data.name] += (Number(data.ventas) || 0);
            }
        });

        const container = document.getElementById('lobbies-cards-container');
        container.innerHTML = '';
        
        let bestCierre = -1;
        let bestLobby = null;

        const lobbiesArray = Object.keys(lobbyData).filter(k => k !== 'Sin Asignar' || lobbyData[k].shots > 0);

        const metrics = lobbiesArray.map(l => {
            const d = lobbyData[l];
            let cierre = 0;
            if (d.shots > 0) {
                cierre = (d.ventas / d.shots) * 100;
            }
            if (cierre > bestCierre && d.shots > 0 && l !== 'Sin Asignar') {
                bestCierre = cierre;
                bestLobby = l;
            }
            
            let mvp = "N/A";
            let mvpVentas = 0;
            Object.keys(d.reps).forEach(rep => {
                if (d.reps[rep] > mvpVentas) {
                    mvpVentas = d.reps[rep];
                    mvp = rep;
                }
            });

            return {
                name: l,
                shots: d.shots,
                ventas: d.ventas,
                cierre: cierre,
                mvp: mvpVentas > 0 ? `${mvp} (${mvpVentas} vts)` : "N/A"
            };
        });

        metrics.forEach(m => {
            const isWinner = m.name === bestLobby && m.shots > 0;
            const bgGradient = isWinner ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)';
            const borderCol = isWinner ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)';
            const titleCol = isWinner ? '#10b981' : '#fff';
            const shadow = isWinner ? '0 8px 24px rgba(16,185,129,0.1)' : '0 4px 10px rgba(0,0,0,0.2)';
            const icon = isWinner ? '🏆 LÍDER' : '🏨';

            const card = document.createElement('div');
            card.style = `background: ${bgGradient}; border: 1px solid ${borderCol}; border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: ${shadow};`;
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="margin: 0; color: ${titleCol}; font-size: 1.3rem;">${m.name}</h3>
                    <span style="font-size: 0.8rem; font-weight: bold; background: rgba(0,0,0,0.3); padding: 0.3rem 0.6rem; border-radius: 20px; color: ${isWinner ? '#10b981' : 'var(--text-muted)'};">${icon}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Shots</p>
                        <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">${m.shots}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Ventas</p>
                        <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: var(--primary);">${m.ventas}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Cierre</p>
                        <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: ${isWinner ? '#10b981' : 'var(--text-main)'};">${m.cierre.toFixed(1)}%</p>
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 0.8rem; margin-top: auto;">
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">MVP del Periodo</p>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.95rem; font-weight: bold; color: #f59e0b;">⭐ ${m.mvp}</p>
                </div>
            `;
            container.appendChild(card);
        });

        const ctx = document.getElementById('lobbies-chart').getContext('2d');
        if (lobbiesChartInstance) lobbiesChartInstance.destroy();

        const labels = metrics.map(m => m.name);
        const dataShots = metrics.map(m => m.shots);
        const dataVentas = metrics.map(m => m.ventas);

        lobbiesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Shots',
                        data: dataShots,
                        backgroundColor: '#4facfe',
                        borderRadius: 4
                    },
                    {
                        label: 'Ventas',
                        data: dataVentas,
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#a4b0be' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#a4b0be' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a4b0be' }
                    }
                }
            }
        });

    } catch (e) {
        console.error("Error loading lobbies", e);
    }
}
const lobbyPatchData = {
    '2026-07-01': ['ERICK', 'PAOLO', 'TONY', 'JP', 'NANCY', 'ANA', 'JOSEFINA', 'NONO', 'MONTSE', 'JAS'],
    '2026-07-02': ['ANA', 'RICARDO', 'NONO', 'RINA', 'ALEX', 'ADRIAN', 'GALAOR', 'ANDRES A', 'BRUNO'],
    '2026-07-03': ['MIKE', 'PATTY', 'RICKY M', 'ANDRES G', 'JOSEFINA', 'TONY', 'CHRIS', 'JOS'],
    '2026-07-04': ['GINA', 'JP', 'TOÑO', 'GALGO R', 'MONTSE', 'TONY', 'GONZALO', 'BONJO', 'ISA', 'JOS', 'JOSEFINA'],
    '2026-07-05': ['BRUNO', 'GALGO R', 'TOÑO', 'SERGIO', 'ERICK', 'JOSEFINA', 'PATTY', 'ANA', 'ANDRES A', 'JOS'],
    '2026-07-06': ['ADRIAN', 'ANDERSON', 'TONY', 'MIKE', 'JP', 'GONZALO', 'GALAOR', 'PAOLO'],
    '2026-07-07': ['RICKY M', 'SERGIO', 'ANDRES A', 'MIKE', 'TOÑO', 'JJ', 'SEBAS', 'CHRIS', 'PAOLO', 'TONY'],
    '2026-07-08': ['GALAOR', 'ALEX', 'ERICK', 'MONTSE', 'NONO', 'PAOLO', 'JOSEFINA', 'ANDRES A', 'ANDERSON'],
    '2026-07-09': ['PAOLO', 'TONY', 'BRUNO', 'JJ', 'ANDERSON', 'BONJO', 'ISA', 'RICARDO', 'JOSEFINA', 'ERICK', 'SERGIO', 'LEO', 'SEBAS'],
    '2026-07-10': ['SERGIO', 'RICARDO', 'MONTSE', 'BRUNO', 'BONJO', 'ERICK', 'ANA', 'GALAOR', 'NONO', 'TONY', 'MIKE', 'PAOLO'],
    '2026-07-11': ['JP', 'CHRIS', 'MICHELLE', 'NANCY', 'TOÑO', 'JOSEFINA', 'ISA', 'ANDERSON', 'RICKY M', 'ADRIAN', 'PAOLO', 'BRUNO'],
    '2026-07-12': ['NANCY', 'NONO', 'ANA', 'GALAOR', 'MONTSE', 'ALEX', 'BONJO', 'MICHELLE', 'GONZALO', 'ADRIAN', 'MIKE', 'PAOLO', 'ISA'],
    '2026-07-13': ['ADRIAN', 'ALEX', 'RICKY M', 'ANDERSON', 'NONO', 'MIKE', 'JP', 'PAOLO', 'JJ', 'ISA'],
    '2026-07-14': ['BRUNO', 'MONTSE', 'MIKE', 'ALEX', 'GONZALO', 'SERGIO', 'TONY', 'ANDRES A', 'PAOLO'],
    '2026-07-15': ['MIKE', 'MONTSE', 'NANCY', 'JJ', 'SEBAS', 'ALEX', 'RICKY M', 'ERICK', 'ADRIAN'],
    '2026-07-16': ['GALAOR', 'RICARDO', 'ADRIAN', 'ERICK', 'JJ', 'SERGIO', 'BONJO', 'ISA', 'JOSEFINA', 'PAOLO', 'GONZALO', 'HITCH'],
    '2026-07-17': ['ANA', 'GALAOR', 'CHRIS', 'SERGIO', 'TONY', 'MICHELLE', 'JOSEFINA', 'BONJO', 'NANCY', 'LEO', 'PAOLO'],
    '2026-07-18': ['NANCY', 'MICHELLE', 'NONO', 'BONJO', 'RICARDO', 'RICKY M', 'ANA', 'MONTSE', 'PAOLO', 'CHRIS', 'TONY', 'ANDERSON', 'TOÑO', 'GALAOR', 'JP', 'LEO'],
    '2026-07-19': ['TOÑO', 'RICKY M', 'MICHELLE', 'ERICK', 'ANDRES A', 'GALAOR', 'TONY', 'BRUNO', 'NONO', 'ADRIAN', 'PAOLO'],
    '2026-07-20': ['CHRIS', 'BONJO', 'GALAOR', 'NONO', 'MONTSE', 'MICHELLE', 'JP', 'RICARDO', 'TONY', 'PAOLO']
};

window.runLobbyPatch = async function() {
    if (!confirm('¿Estás seguro de asignar estos nombres al lobby Sunrise para el mes de Julio? Esto actualizará la base de datos.')) return;
    
    const btn = document.getElementById('btn-sync-lobbies');
    btn.innerText = 'Sincronizando... (por favor espera)';
    btn.disabled = true;

    try {
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        const activeUsers = [];
        usersSnap.forEach(doc => {
            activeUsers.push(doc.data().name);
        });

        const batchPromises = [];

        for (const [date, names] of Object.entries(lobbyPatchData)) {
            // Find stats docs for this date
            const statsSnap = await firestore.collection('stats').where('date', '==', date).get();
            
            statsSnap.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    // Try to match the name loosely
                    const statName = data.name.toUpperCase();
                    let matched = false;
                    
                    for (const n of names) {
                        const targetName = n.toUpperCase();
                        if (statName.includes(targetName) || targetName.includes(statName) || statName === targetName) {
                            matched = true;
                            break;
                        }
                    }

                    if (matched) {
                        // Update to Sunrise
                        batchPromises.push(firestore.collection('stats').doc(doc.id).update({ lobby: 'Sunrise' }));
                    }
                }
            });
        }

        await Promise.all(batchPromises);
        alert(`¡Sincronización completa! Se actualizaron ${batchPromises.length} registros exitosamente.`);
        btn.style.display = 'none'; // Hide button after success
        lastLobbiesRange = null; lastDashStart = null; loadLobbiesDashboard(); // Refresh
        
    } catch (e) {
        console.error("Error patching lobbies", e);
        alert("Ocurrió un error: " + e.message);
        btn.innerText = 'Reintentar Sincronización';
        btn.disabled = false;
    }
};
const grandPatchData = {
    '2026-07-01': ['BRUNO', 'GALAOR', 'RICKY M', 'PATTY', 'TOÑO', 'RICARDO', 'BONJO', 'ALEX', 'PANCHO'],
    '2026-07-02': ['TONY', 'GONZALO', 'PANCHO', 'ANDRES G', 'JP', 'RICARDO', 'PATTY', 'NANCY', 'GALA', 'MONTSE', 'BRUNO'],
    '2026-07-03': ['GINA', 'ISA', 'PAOLO', 'GALAOR', 'ADRIAN', 'MONTSE', 'BRUNO', 'PANCHO', 'JJ'],
    '2026-07-04': ['SERGIO', 'ERICK', 'JOSEFINA', 'JJ', 'ANA', 'ANDRES A', 'RICKY M', 'PAOLO', 'ALEX', 'GALAOR', 'ANDRES G'],
    '2026-07-05': ['MIKE', 'ISA', 'GONZALO', 'TONY', 'NANCY', 'NONO', 'JP', 'GALA', 'GINA', 'ANDERSON', 'ADRIAN', 'ANDRES G', 'RICARDO'],
    '2026-07-06': ['ERICK', 'ALEX', 'BONJO', 'ANA', 'ANDRES A', 'TOÑO', 'BRUNO', 'RICKY M', 'GONZALO', 'GALAOR', 'JOSEFINA'],
    '2026-07-07': ['RICARDO', 'NANCY', 'NONO', 'GONZALO', 'BRUNO', 'ANDERSON', 'GALA', 'MONTSE', 'GALAOR', 'ISA', 'PANCHO', 'ANDRES G'],
    '2026-07-08': ['BONJO', 'ADRIAN', 'CHRIS', 'GONZALO', 'RICARDO', 'NANCY', 'TONY', 'JJ', 'RICKY M', 'PANCHO'],
    '2026-07-09': ['MIKE', 'GONZALO', 'JP', 'MONTSE', 'MICHELLE', 'ALEX', 'PANCHO'],
    '2026-07-10': ['JP', 'ANDRES A', 'JJ', 'TOÑO', 'ADRIAN', 'ISA', 'RICKY M', 'PANCHO', 'MICHELLE', 'ANDERSON', 'JOSEFINA'],
    '2026-07-11': ['GALA', 'ERICK', 'ANA', 'MIKE', 'NONO', 'SERGIO', 'GALAOR', 'RICARDO', 'ALEX', 'TONY', 'PANCHO'],
    '2026-07-12': ['TOÑO', 'JOSEFINA', 'TONY', 'CHRIS', 'JJ', 'JP', 'ANDRES A', 'ERICK', 'BRUNO', 'ISA', 'SERGIO', 'GALA', 'PANCHO'],
    '2026-07-13': ['ANA', 'ANDRES A', 'BONJO', 'TOÑO', 'TONY', 'GALAOR', 'JOSEFINA', 'MICHELLE', 'JJ', 'PANCHO', 'LEO'],
    '2026-07-14': ['ADRIAN', 'CHRIS', 'JJ', 'ANDERSON', 'JP', 'RICKY M', 'NANCY', 'NONO', 'ERICK', 'GALAOR', 'SEBAS', 'PANCHO', 'JOSEFINA'],
    '2026-07-15': ['ANA', 'ANDERSON', 'TONY', 'SERGIO', 'GALA', 'GONZALO', 'PANCHO', 'RICKY M'],
    '2026-07-16': ['BRUNO', 'ANDRES A', 'MICHELLE', 'PANCHO', 'TOÑO', 'GALA', 'ALEX', 'JP', 'TONY'],
    '2026-07-17': ['NONO', 'BRUNO', 'ISA', 'ANDRES A', 'GALAOR', 'MONTSE', 'TOÑO', 'PANCHO', 'ANDERSON', 'RICARDO', 'ALEX'],
    '2026-07-18': ['GALA', 'JOSEFINA', 'GONZALO', 'JJ', 'ADRIAN', 'ERICK', 'SEBAS', 'ALEX', 'HITCH', 'ISA'],
    '2026-07-19': ['ANDERSON', 'SERGIO', 'JP', 'NANCY', 'HITCH', 'JJ', 'BONJO', 'RICARDO', 'SEBAS', 'GONZALO', 'CHRIS', 'MONTSE'],
    '2026-07-20': []
};

window.runGrandPatch = async function() {
    if (!confirm('¿Estás seguro de asignar estos nombres al lobby The Grand para el mes de Julio? Esto actualizará la base de datos.')) return;
    
    const btn = document.getElementById('btn-sync-lobbies-grand');
    btn.innerText = 'Sincronizando... (por favor espera)';
    btn.disabled = true;

    try {
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        const activeUsers = [];
        usersSnap.forEach(doc => {
            activeUsers.push(doc.data().name);
        });

        const batchPromises = [];

        for (const [date, names] of Object.entries(grandPatchData)) {
            // Find stats docs for this date
            const statsSnap = await firestore.collection('stats').where('date', '==', date).get();
            
            statsSnap.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    // Try to match the name loosely
                    const statName = data.name.toUpperCase();
                    let matched = false;
                    
                    for (const n of names) {
                        const targetName = n.toUpperCase();
                        if (statName.includes(targetName) || targetName.includes(statName) || statName === targetName) {
                            matched = true;
                            break;
                        }
                    }

                    if (matched) {
                        // Update to The Grand
                        batchPromises.push(firestore.collection('stats').doc(doc.id).update({ lobby: 'The Grand' }));
                    }
                }
            });
        }

        await Promise.all(batchPromises);
        alert(`¡Sincronización completa! Se actualizaron ${batchPromises.length} registros exitosamente a The Grand.`);
        btn.style.display = 'none'; // Hide button after success
        lastLobbiesRange = null; lastDashStart = null; loadLobbiesDashboard(); // Refresh
        
    } catch (e) {
        console.error("Error patching lobbies", e);
        alert("Ocurrió un error: " + e.message);
        btn.innerText = 'Reintentar Sincronización The Grand';
        btn.disabled = false;
    }
};

