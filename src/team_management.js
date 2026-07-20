// --- Team Management ---
let teamLoaded = false;
async function loadTeam() {
    if (teamLoaded) return;
    teamLoaded = true;
    const activeDiv = document.getElementById('active-users-list');
    const inactiveDiv = document.getElementById('inactive-users-list');
    if (window.teamUnsubscribe) window.teamUnsubscribe();
    window.teamUnsubscribe = firestore.collection('users').onSnapshot(async usersSnap => {
    activeDiv.innerHTML = ''; inactiveDiv.innerHTML = '';
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
    });
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
        globalActiveUsers = null;
    }
}

async function toggleUser(id, status) {
    await firestore.collection('users').doc(id).update({ active: status });
    globalActiveUsers = null;
}

function deleteUser(id, name) {
    showConfirmModal(`¿Estás súper seguro de borrar PERMANENTEMENTE a "${name}"?\n\n¡Esto eliminará todo su historial de la base de datos de inmediato!`, async () => {
        await firestore.collection('users').doc(id).delete();
        
        // Delete daily stats
        const statsSnap = await firestore.collection('stats').where('name', '==', name).get();
        const batch = firestore.batch();
        statsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Delete monthly stats
        const monthSnap = await firestore.collection('monthly_stats').where('name', '==', name).get();
        const batch2 = firestore.batch();
        monthSnap.forEach(doc => {
            batch2.delete(doc.ref);
        });
        await batch2.commit();
        
        globalActiveUsers = null;
        loadDashboard();
    });
}

