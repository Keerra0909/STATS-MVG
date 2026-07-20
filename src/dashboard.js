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
