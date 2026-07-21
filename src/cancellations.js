let unsubscribeCancellations = null;
let currentCancellations = [];
let activeCancellationId = null;

async function initCancellations() {
    await setupCancellationsUI();
    loadCancellations();
}


async function setupCancellationsUI() {
    let usersToUse = [];
    if (typeof globalActiveUsers !== 'undefined' && globalActiveUsers && globalActiveUsers.length > 0) {
        usersToUse = globalActiveUsers;
    } else {
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'admin') usersToUse.push(doc.data());
        });
    }

    const repSelect = document.getElementById('cxl-filter-rep');
    if (repSelect) {
        repSelect.innerHTML = '<option value="">Todos los vendedores</option>';
        usersToUse.forEach(u => {
            if (u.name !== 'EN REPORTE' && u.name !== 'TOTALES') {
                repSelect.innerHTML += <option value=""></option>;
            }
        });
    }

    // Set default dates to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const startInput = document.getElementById('cxl-filter-start');
    const endInput = document.getElementById('cxl-filter-end');
    if(startInput) startInput.value = firstDay.toISOString().split('T')[0];
    if(endInput) endInput.value = lastDay.toISOString().split('T')[0];
}

function loadCancellations() {
    if (unsubscribeCancellations) unsubscribeCancellations();
    
    unsubscribeCancellations = firestore.collection('cancellations')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            currentCancellations = [];
            snap.forEach(doc => {
                currentCancellations.push({ id: doc.id, ...doc.data() });
            });
            renderCancellationsTable();
        }, err => {
            console.error("Error loading cancellations:", err);
        });
}

function renderCancellationsTable() {
    const tbody = document.getElementById('cxl-table-body');
    if (!tbody) return;

    const repFilter = document.getElementById('cxl-filter-rep').value;
    const startFilter = document.getElementById('cxl-filter-start').value;
    const endFilter = document.getElementById('cxl-filter-end').value;

    let filtered = currentCancellations.filter(c => {
        if (repFilter && c.repName !== repFilter) return false;
        if (startFilter && c.date < startFilter) return false;
        if (endFilter && c.date > endFilter) return false;
        return true;
    });

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888; padding:20px;">No hay cancelaciones registradas en este periodo.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openCxlDetails(c.id);
        
        const statusColor = c.status === 'Recuperada' ? '#10b981' : (c.status === 'Pendiente' ? '#f59e0b' : '#ef4444');

        tr.innerHTML = `
            <td style="text-align:center;">${c.date}</td>
            <td style="font-weight:bold; color:var(--primary);">${c.repName}</td>
            <td>${c.clientName || '-'}</td>
            <td>${c.reason || '-'}</td>
            <td style="text-align:center;"><span style="background:${statusColor}20; color:${statusColor}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${c.status}</span></td>
            <td style="text-align:center;"><button class="btn-secondary" style="font-size:0.8rem; padding: 0.2rem 0.5rem;" onclick="event.stopPropagation(); openCxlDetails('${c.id}')">Ver Detalle</button></td>
        `;
        tbody.appendChild(tr);
    });
}


async function openNewCxlModal() {
    document.getElementById('modal-new-cxl').style.display = 'flex';
    document.getElementById('new-cxl-date').value = new Date().toISOString().split('T')[0];
    
    const repSelect = document.getElementById('new-cxl-rep');
    repSelect.innerHTML = '<option value="">Selecciona un vendedor...</option>';
    
    let usersToUse = [];
    if (typeof globalActiveUsers !== 'undefined' && globalActiveUsers && globalActiveUsers.length > 0) {
        usersToUse = globalActiveUsers;
    } else {
        const usersSnap = await firestore.collection('users').where('active', '==', 1).get();
        usersSnap.forEach(doc => {
            if (doc.data().role !== 'admin') usersToUse.push(doc.data());
        });
    }
    
    usersToUse.forEach(u => {
        if (u.name !== 'EN REPORTE' && u.name !== 'TOTALES') {
            repSelect.innerHTML += <option value=""></option>;
        }
    });
}

function closeNewCxlModal() {
    document.getElementById('modal-new-cxl').style.display = 'none';
}

async function saveNewCxl() {
    const repName = document.getElementById('new-cxl-rep').value;
    const date = document.getElementById('new-cxl-date').value;
    const clientName = document.getElementById('new-cxl-client').value;
    const reason = document.getElementById('new-cxl-reason').value;
    
    if (!repName || !date) {
        alert("El vendedor y la fecha son obligatorios.");
        return;
    }
    
    const btn = document.getElementById('btn-save-cxl');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    try {
        await firestore.collection('cancellations').add({
            repName,
            date,
            clientName,
            reason,
            status: 'Pendiente',
            comments: [],
            createdAt: new Date()
        });
        closeNewCxlModal();
        alert("Cancelación registrada exitosamente.");
    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
    
    btn.disabled = false;
    btn.innerText = 'Guardar';
}

function openCxlDetails(id) {
    const cxl = currentCancellations.find(c => c.id === id);
    if (!cxl) return;
    
    activeCancellationId = id;
    
    document.getElementById('detail-cxl-client').innerText = cxl.clientName || 'Sin Nombre';
    document.getElementById('detail-cxl-rep').innerText = 'Vendedor: ' + cxl.repName;
    document.getElementById('detail-cxl-date').innerText = 'Fecha CXL: ' + cxl.date;
    document.getElementById('detail-cxl-reason').innerText = 'Motivo: ' + (cxl.reason || '-');
    document.getElementById('detail-cxl-status').value = cxl.status || 'Pendiente';
    
    renderCxlComments(cxl.comments || []);
    
    document.getElementById('modal-cxl-detail').style.display = 'flex';
}

function closeCxlDetails() {
    document.getElementById('modal-cxl-detail').style.display = 'none';
    activeCancellationId = null;
}

async function updateCxlStatus() {
    if (!activeCancellationId) return;
    const newStatus = document.getElementById('detail-cxl-status').value;
    
    try {
        await firestore.collection('cancellations').doc(activeCancellationId).update({
            status: newStatus
        });
    } catch(e) {
        console.error(e);
        alert("Error actualizando status.");
    }
}

function renderCxlComments(comments) {
    const container = document.getElementById('cxl-comments-container');
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<div style="color:#888; font-size:0.9rem; font-style:italic;">No hay notas aún.</div>';
        return;
    }
    
    comments.forEach(c => {
        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        div.style.marginBottom = '10px';
        
        const dateObj = c.createdAt ? (c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt)) : new Date();
        const dateStr = dateObj.toLocaleString();
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--primary); font-size:0.85rem;">${c.author || 'Usuario'}</strong>
                <span style="font-size:0.75rem; color:#888;">${dateStr}</span>
            </div>
            <div style="font-size:0.95rem; white-space: pre-wrap;">${c.text}</div>
        `;
        container.appendChild(div);
    });
    
    container.scrollTop = container.scrollHeight;
}

async function addCxlComment() {
    if (!activeCancellationId) return;
    const input = document.getElementById('new-cxl-comment');
    const text = input.value.trim();
    
    if (!text) return;
    
    const btn = document.getElementById('btn-add-cxl-comment');
    btn.disabled = true;
    
    const author = (window.currentUser && window.currentUser.name) ? window.currentUser.name : 'Admin';
    
    try {
        const docRef = firestore.collection('cancellations').doc(activeCancellationId);
        const doc = await docRef.get();
        if (doc.exists) {
            let comments = doc.data().comments || [];
            comments.push({
                text,
                author,
                createdAt: new Date()
            });
            await docRef.update({ comments });
            input.value = '';
        }
    } catch(e) {
        console.error(e);
        alert("Error al guardar nota.");
    }
    
    btn.disabled = false;
}
window.initCancellations = initCancellations;
window.renderCancellationsTable = renderCancellationsTable;
