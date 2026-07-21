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

    setTimeout(() => {
        if (viewId === 'team') loadTeam();
    if (viewId === 'daily') loadDailyEntries();
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'cancellations' && window.initCancellations) window.initCancellations();
    if (viewId === 'rep-weekly') loadRepWeekly();
    if (viewId === 'academy') loadAcademy();
    if (viewId === 'spiffs') loadSpiffs();
    if (viewId === 'carrera') loadCarrera();
    if (viewId === 'lobbies') loadLobbiesDashboard();
    }, 10);
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

