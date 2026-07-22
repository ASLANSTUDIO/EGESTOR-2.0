(function () {
    'use strict';

    // ─── Default Data ───
    const SECTOR_ICONS = ['store','building','handshake','laptop-code','wrench','truck','headset','chart-line','file-invoice','gear','users-gear','scale-balanced','tree-city','industry','ship','plane','credit-card','globe','rocket','gem','graduation-cap','dumbbell','heart-pulse','leaf','cart-shopping','gavel','piggy-bank','sack-dollar','oil-well','car'];

    const DEFAULT_SECTORS = [
        { id: 's1', name: 'Vendas', color: '#1a8a5c', icon: 'store' },
        { id: 's2', name: 'Serviços', color: '#d4a843', icon: 'wrench' },
        { id: 's3', name: 'Consultoria', color: '#3498db', icon: 'handshake' },
        { id: 's4', name: 'Produtos', color: '#9b59b6', icon: 'gem' },
    ];

    const DEFAULT_RULES = [
        { id: 'r1', name: 'Fundos Pessoal', percentage: 35, color: '#1a8a5c' },
        { id: 'r2', name: 'Fundos de Investimento', percentage: 30, color: '#d4a843' },
        { id: 'r3', name: 'Fundos de Caixa da Empresa', percentage: 35, color: '#3498db' },
    ];

    const DEFAULT_ADMIN = { name: 'Administrador', email: 'admin@egestor.com', password: 'admin123', role: 'admin' };

    // ─── State ───
    let transactions = [];
    let withdrawals = [];
    let sectors = [];
    let rules = [];
    let employees = [];
    let salaryPayments = [];
    let currentPage = 'dashboard';
    let currentUser = null;

    // ─── DOM refs ───
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    // ─── Storage ───
    function loadData() {
        try {
            const saved = JSON.parse(localStorage.getItem('egestor_data'));
            if (saved) {
                transactions = saved.transactions || [];
                withdrawals = saved.withdrawals || [];
                sectors = (saved.sectors || []).map(s => ({ icon: 'building', ...s }));
                rules = saved.rules || JSON.parse(JSON.stringify(DEFAULT_RULES));
                employees = saved.employees || [];
                salaryPayments = saved.salaryPayments || [];
                return;
            }
        } catch (_) { }
        transactions = [];
        withdrawals = [];
        sectors = JSON.parse(JSON.stringify(DEFAULT_SECTORS));
        rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
        employees = [];
        salaryPayments = [];
    }

    function saveData() {
        try {
            localStorage.setItem('egestor_data', JSON.stringify({ transactions, withdrawals, sectors, rules, employees, salaryPayments }));
        } catch (_) { }
    }

    function loadSession() {
        try {
            const s = JSON.parse(localStorage.getItem('egestor_session'));
            if (s && s.email) currentUser = s;
        } catch (_) { }
    }

    function saveSession(user) {
        currentUser = user;
        try { localStorage.setItem('egestor_session', JSON.stringify(user)); } catch (_) { }
    }

    function clearSession() {
        currentUser = null;
        try { localStorage.removeItem('egestor_session'); } catch (_) { }
    }

    // ─── Helpers ───
    function fmt(n) {
        return Number(n).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
    }

    function fmtDate(d) {
        const dt = new Date(d + 'T12:00:00');
        return dt.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // ─── Toast ───
    function showToast(message, type) {
        type = type || 'success';
        const container = $('#toastContainer');
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
        el.innerHTML = '<i class="fas ' + (icons[type] || icons.success) + '"></i> ' + message;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            el.style.transition = '0.3s';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }

    // ─── Modal ───
    function openModal(title, bodyHTML, footerHTML) {
        $('#modalTitle').textContent = title;
        $('#modalBody').innerHTML = bodyHTML;
        $('#modalFooter').innerHTML = footerHTML || '';
        $('#modalOverlay').classList.add('active');
    }

    function closeModal() {
        $('#modalOverlay').classList.remove('active');
    }

    // ─── Distribution Logic ───
    function distribute(amount) {
        return rules.map(r => ({
            ...r,
            allocated: (amount * r.percentage) / 100
        }));
    }

    // ─── CRUD: Entries ───
    function addTransaction(data) {
        const dist = distribute(data.amount);
        const entry = {
            id: genId(),
            type: 'entry',
            date: data.date,
            amount: data.amount,
            sectorId: data.sectorId,
            description: data.description || '',
            distribution: dist.map(d => ({ ruleId: d.id, amount: d.allocated })),
            createdAt: new Date().toISOString()
        };
        transactions.unshift(entry);
        saveData();
        refreshAll();
        showToast('Entrada registada com sucesso!', 'success');
    }

    function deleteTransaction(id) {
        if (!confirm('Tem certeza que deseja eliminar esta entrada?')) return;
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        refreshAll();
        showToast('Entrada eliminada.', 'warning');
    }

    // ─── CRUD: Withdrawals ───
    function addWithdrawal(data) {
        const entry = {
            id: genId(),
            type: 'withdraw',
            date: data.date,
            amount: data.amount,
            fundId: data.fundId,
            description: data.description || '',
            createdAt: new Date().toISOString()
        };
        withdrawals.unshift(entry);
        saveData();
        refreshAll();
        showToast('Retirada de fundos efectuada com sucesso!', 'success');
    }

    function deleteWithdrawal(id) {
        if (!confirm('Tem certeza que deseja eliminar esta retirada?')) return;
        withdrawals = withdrawals.filter(w => w.id !== id);
        saveData();
        refreshAll();
        showToast('Retirada eliminada.', 'warning');
    }

    // ─── CRUD: Employees ───
    function addEmployee(data) {
        const emp = {
            id: genId(),
            name: data.name,
            salary: data.salary,
            fundId: data.fundId,
            sectorId: data.sectorId || data.fundId,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        employees.push(emp);
        saveData();
        refreshAll();
        showToast('Funcionário cadastrado com sucesso!', 'success');
    }

    function deleteEmployee(id) {
        if (salaryPayments.some(p => p.employeeId === id)) {
            return showToast('Não pode eliminar um funcionário com pagamentos registados.', 'error');
        }
        if (!confirm('Tem certeza que deseja eliminar este funcionário?')) return;
        employees = employees.filter(e => e.id !== id);
        saveData();
        refreshAll();
        showToast('Funcionário removido.', 'warning');
    }

    function paySalary(employeeId, date) {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return showToast('Funcionário não encontrado.', 'error');
        const balance = getFundBalance(emp.fundId);
        if (emp.salary > balance) {
            return showToast('Saldo insuficiente no fundo ' + getRuleName(emp.fundId) + ' para pagar este salário.', 'error');
        }
        // Create withdrawal
        const withdrawalEntry = {
            id: genId(),
            type: 'withdraw',
            date: date,
            amount: emp.salary,
            fundId: emp.fundId,
            description: 'Salário: ' + emp.name,
            createdAt: new Date().toISOString()
        };
        withdrawals.unshift(withdrawalEntry);
        // Record payment
        salaryPayments.unshift({
            id: genId(),
            employeeId: emp.id,
            date: date,
            amount: emp.salary,
            fundId: emp.fundId,
            withdrawalId: withdrawalEntry.id,
            createdAt: new Date().toISOString()
        });
        saveData();
        refreshAll();
        showToast('Salário de ' + emp.name + ' pago com sucesso! (Debitado de ' + getRuleName(emp.fundId) + ')', 'success');
    }

    function deleteSalaryPayment(id) {
        if (!confirm('Tem certeza que deseja eliminar este pagamento?')) return;
        const payment = salaryPayments.find(p => p.id === id);
        if (payment) {
            // Also remove the corresponding withdrawal
            withdrawals = withdrawals.filter(w => w.id !== payment.withdrawalId);
        }
        salaryPayments = salaryPayments.filter(p => p.id !== id);
        saveData();
        refreshAll();
        showToast('Pagamento eliminado.', 'warning');
    }

    // ─── Calculated Totals ───
    function calcTotals() {
        const totalEntries = transactions.reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = withdrawals.reduce((s, w) => s + w.amount, 0);
        const netBalance = totalEntries - totalWithdrawals;

        const fundEntries = {};
        const fundWithdrawals = {};
        rules.forEach(r => {
            fundEntries[r.id] = 0;
            fundWithdrawals[r.id] = 0;
        });

        transactions.forEach(t => {
            t.distribution.forEach(d => {
                if (fundEntries[d.ruleId] !== undefined) {
                    fundEntries[d.ruleId] += d.amount;
                }
            });
        });

        withdrawals.forEach(w => {
            if (fundWithdrawals[w.fundId] !== undefined) {
                fundWithdrawals[w.fundId] += w.amount;
            }
        });

        const fundNet = {};
        const fundPct = {};
        const totalFundEntries = Object.values(fundEntries).reduce((s, v) => s + v, 0);
        rules.forEach(r => {
            fundNet[r.id] = (fundEntries[r.id] || 0) - (fundWithdrawals[r.id] || 0);
            fundPct[r.id] = totalFundEntries > 0 ? ((fundEntries[r.id] || 0) / totalFundEntries) * 100 : 0;
        });

        return { totalEntries, totalWithdrawals, netBalance, fundEntries, fundWithdrawals, fundNet, fundPct };
    }

    function getFundBalance(fundId) {
        const { fundEntries, fundWithdrawals } = calcTotals();
        return (fundEntries[fundId] || 0) - (fundWithdrawals[fundId] || 0);
    }

    function getSectorName(id) {
        const s = sectors.find(s => s.id === id);
        return s ? s.name : 'Desconhecido';
    }

    function getSectorColor(id) {
        const s = sectors.find(s => s.id === id);
        return s ? s.color : '#666';
    }

    function getSectorIcon(id) {
        const s = sectors.find(s => s.id === id);
        return s && s.icon ? s.icon : 'building';
    }

    function getRuleName(id) {
        const r = rules.find(r => r.id === id);
        return r ? r.name : 'Desconhecido';
    }

    function getRuleColor(id) {
        const r = rules.find(r => r.id === id);
        return r ? r.color : '#666';
    }

    // ─── Auth ───
    function getUsers() {
        let users;
        try { users = JSON.parse(localStorage.getItem('egestor_users')) || [DEFAULT_ADMIN]; }
        catch (_) { users = [DEFAULT_ADMIN]; }
        // Migrate old users without role
        users = users.map(u => {
            if (!u.role) u.role = 'admin';
            return u;
        });
        return users;
    }

    function saveUsers(users) {
        try { localStorage.setItem('egestor_users', JSON.stringify(users)); } catch (_) { }
    }

    function isAdmin() { return currentUser && currentUser.role === 'admin'; }
    function getEmployeeSectorId() { return currentUser && currentUser.role === 'employee' ? currentUser.sectorId : null; }

    function doLogin(email, password) {
        const users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            saveSession({ name: user.name, email: user.email, role: user.role || 'admin', sectorId: user.sectorId || null });
            showApp();
            return true;
        }
        return false;
    }

    function doLogout() {
        clearSession();
        hideApp();
        showToast('Sessão terminada.', 'warning');
    }

    function showApp() {
        $('#loginScreen').classList.add('hidden');
        $('#appContainer').style.display = 'flex';
        $('#userDisplayName').textContent = currentUser ? currentUser.name : 'Administrador';
        $('#entryDate').valueAsDate = new Date();
        $('#withdrawDate').valueAsDate = new Date();

        // Role-based UI
        const isAdm = isAdmin();
        document.body.classList.toggle('employee-role', !isAdm);
        const roleBadge = $('#roleBadge');
        if (isAdm) {
            roleBadge.textContent = 'Admin';
            roleBadge.className = 'role-badge admin';
            $('#userBadgeIcon').className = 'fas fa-user-tie';
        } else {
            roleBadge.textContent = 'Funcionário';
            roleBadge.className = 'role-badge employee';
            $('#userBadgeIcon').className = 'fas fa-user';
        }

        navigate(isAdm ? 'dashboard' : 'register');
    }

    function hideApp() {
        $('#loginScreen').classList.remove('hidden');
        $('#appContainer').style.display = 'none';
        $('#loginEmail').value = '';
        $('#loginPassword').value = '';
    }

    // ─── Navigation ───
    function navigate(page) {
        // Restrict employees to register page only
        if (!isAdmin() && page !== 'register') {
            page = 'register';
        }

        currentPage = page;
        $$('.page').forEach(p => p.classList.remove('active'));
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        const targetPage = $('#page-' + page);
        if (targetPage) targetPage.classList.add('active');
        const navItem = document.querySelector('.nav-item[data-page="' + page + '"]');
        if (navItem) navItem.classList.add('active');

        if (page === 'dashboard') renderDashboard();
        if (page === 'register') { populateSectorSelect(); }
        if (page === 'employees') { renderEmployees(); }
        if (page === 'withdraw') { populateWithdrawFundSelect(); renderWithdrawHistory(); }
        if (page === 'history') renderHistory();
        if (page === 'reports') renderReports();
        if (page === 'admin') renderAdmin();

        $('#sidebar').classList.remove('open');
    }

    // ─── Render: Dashboard ───
    function renderDashboard() {
        const { totalEntries, totalWithdrawals, netBalance, fundEntries, fundWithdrawals, fundNet, fundPct } = calcTotals();

        $('#totalEntries').textContent = fmt(totalEntries);
        $('#totalWithdrawals').textContent = fmt(totalWithdrawals);
        const netEl = $('#netBalance');
        netEl.textContent = fmt(Math.abs(netBalance));
        netEl.className = 'card-value' + (netBalance < 0 ? ' negative' : '');

        const grid = $('#fundsGrid');
        const fundClasses = ['fund-pessoal', 'fund-investimento', 'fund-caixa'];
        const fundIcons = ['users', 'chart-line', 'building-columns'];

        let html = '';
        rules.forEach((r, i) => {
            const entryAmt = fundEntries[r.id] || 0;
            const withdrawalAmt = fundWithdrawals[r.id] || 0;
            const netAmt = fundNet[r.id] || 0;
            const pct = fundPct[r.id] || 0;
            const cls = fundClasses[i] || 'fund-pessoal';
            const icon = fundIcons[i] || 'sack-dollar';

            html += `
                <div class="fund-card ${cls}">
                    <div class="fund-card-header">
                        <h3><i class="fas fa-${icon}"></i> ${r.name}</h3>
                        <span class="fund-percentage">${r.percentage}%</span>
                    </div>
                    <div class="fund-amount">${fmt(netAmt)}</div>
                    <div class="fund-sub-amount">
                        <span class="positive">+${fmt(entryAmt)}</span>
                        <span class="negative">-${fmt(withdrawalAmt)}</span>
                    </div>
                    <div class="fund-progress">
                        <div class="fund-progress-bar" style="width:${Math.min(pct, 100)}%"></div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;

        // Recent movements (entries + withdrawals + salary payments)
        const container = $('#recentTransactions');
        const allMovements = [
            ...transactions.map(t => ({ ...t, _label: t.sectorId, _tag: getSectorName(t.sectorId), _icon: getSectorIcon(t.sectorId) })),
            ...withdrawals.map(w => ({ ...w, _label: w.fundId, _tag: (w.description && w.description.startsWith('Salário:') ? '💰 ' : '') + getRuleName(w.fundId), _icon: null })),
            ...salaryPayments.map(p => {
                const emp = employees.find(e => e.id === p.employeeId);
                return {
                    date: p.date,
                    amount: p.amount,
                    type: 'salary',
                    createdAt: p.createdAt,
                    _tag: 'Salário: ' + (emp ? emp.name : '?'),
                    _icon: null,
                    _fundId: p.fundId
                };
            })
        ].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);

        if (allMovements.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma movimentação registada</p>';
        } else {
            container.innerHTML = allMovements.map(m => {
                const isEntry = m.type === 'entry';
                const isSalary = m.type === 'salary';
                const icon = m._icon && isEntry ? `<i class="fas fa-${m._icon}"></i>` : `<i class="fas fa-${isEntry ? 'arrow-down' : isSalary ? 'money-bill' : 'arrow-up'}"></i>`;
                const sign = isEntry ? '+' : '-';
                const cls = isEntry ? 'entry' : 'withdraw';
                return `
                    <div class="recent-item">
                        <div class="recent-item-left">
                            <div class="recent-item-icon ${cls}">${icon}</div>
                            <div class="recent-item-info">
                                <span class="recent-item-amount ${cls}">${sign}${fmt(m.amount)}</span>
                                <span class="recent-item-date">${fmtDate(m.date)} — ${m._tag}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // ─── Render: Register ───
    function populateSectorSelect() {
        const sel = $('#entrySector');
        const empSectorId = getEmployeeSectorId();

        if (empSectorId) {
            // Employee mode: locked to assigned sector
            const sector = sectors.find(s => s.id === empSectorId);
            sel.innerHTML = sector ? `<option value="${sector.id}">${sector.name}</option>` : '';
            sel.disabled = true;
            // Hide sector label/row visually but keep it functional
            const sectorGroup = sel.closest('.form-group');
            if (sectorGroup) {
                const label = sectorGroup.querySelector('label');
                if (label) label.innerHTML = '<i class="fas fa-building"></i> Sector (atribuído)';
            }
        } else {
            sel.disabled = false;
            const currentVal = sel.value;
            sel.innerHTML = sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            const exists = sectors.some(s => s.id === currentVal);
            if (currentVal && exists) sel.value = currentVal;
            const sectorGroup = sel.closest('.form-group');
            if (sectorGroup) {
                const label = sectorGroup.querySelector('label');
                if (label) label.innerHTML = '<i class="fas fa-building"></i> Sector de Entrada';
            }
        }
    }

    function getRegisterSectorId() {
        const empSectorId = getEmployeeSectorId();
        if (empSectorId) return empSectorId;
        return $('#entrySector').value;
    }

    function updateDistributionPreview(amount) {
        const preview = $('#distributionPreview');
        if (!amount || amount <= 0) { preview.style.display = 'none'; return; }
        preview.style.display = 'block';
        const dist = distribute(amount);
        const bars = $('#distributionBars');
        bars.innerHTML = dist.map(d => `
            <div class="dist-item">
                <div class="dist-header">
                    <span class="dist-name">${d.name}</span>
                    <span class="dist-values">
                        <span class="dist-percent">${d.percentage}%</span>
                        <span class="dist-amount">${fmt(d.allocated)}</span>
                    </span>
                </div>
                <div class="dist-bar">
                    <div class="dist-fill ${d.id === 'r1' ? 'green' : d.id === 'r2' ? 'gold' : 'blue'}" style="width:${d.percentage}%"></div>
                </div>
            </div>
        `).join('');
    }

    // ─── Render: Withdraw ───
    function populateWithdrawFundSelect() {
        const sel = $('#withdrawFund');
        const currentVal = sel.value;
        sel.innerHTML = rules.map(r => `<option value="${r.id}">${r.name} (${r.percentage}%)</option>`).join('');
        const exists = rules.some(r => r.id === currentVal);
        if (currentVal && exists) sel.value = currentVal;
        updateFundBalanceDisplay();
    }

    function updateFundBalanceDisplay() {
        const fundId = $('#withdrawFund').value;
        if (!fundId) return;
        const balance = getFundBalance(fundId);
        $('#fundBalanceDisplay').textContent = fmt(balance);
    }

    function renderWithdrawHistory() {
        const body = $('#withdrawHistoryBody');
        if (withdrawals.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma retirada registada</td></tr>';
            return;
        }
        body.innerHTML = withdrawals.map(w => `
            <tr>
                <td>${fmtDate(w.date)}</td>
                <td class="amount-negative">-${fmt(w.amount)}</td>
                <td>${getRuleName(w.fundId)}</td>
                <td>${w.description || '—'}</td>
                <td>
                    <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteWithdrawal('${w.id}')">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function getEmployeeAppAccess(employeeId) {
        const users = getUsers();
        return users.find(u => u.role === 'employee' && u.employeeId === employeeId) || null;
    }

    // ─── Render: Employees ───
    function renderEmployees() {
        // Populate fund select
        const fundSel = $('#empFund');
        fundSel.innerHTML = rules.map(r => `<option value="${r.id}">${r.name} (${r.percentage}%)</option>`).join('');

        // Populate sector select
        const sectorSel = $('#empSector');
        sectorSel.innerHTML = sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        // Render employee list
        const list = $('#employeeList');
        if (employees.length === 0) {
            list.innerHTML = '<div class="emp-empty"><i class="fas fa-users-slash"></i><p>Nenhum funcionário cadastrado.</p></div>';
        } else {
            list.innerHTML = employees.map(e => {
                const color = getRuleColor(e.fundId);
                const initials = e.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const hasAccess = getEmployeeAppAccess(e.id);
                const sectorName = getSectorName(e.sectorId);
                return `
                    <div class="emp-card">
                        <div class="emp-card-left">
                            <div class="emp-avatar" style="background:${color}30;color:${color}">${initials}</div>
                            <div class="emp-info">
                                <span class="emp-name">${e.name}</span>
                                <span class="emp-salary">Salário: ${fmt(e.salary)}</span>
                                <span class="emp-fund-tag"><i class="fas fa-piggy-bank"></i> Débito: ${getRuleName(e.fundId)}</span>
                                <span class="emp-fund-tag"><i class="fas fa-building"></i> Sector: ${sectorName}</span>
                                ${hasAccess ? '<span class="emp-fund-tag" style="color:var(--accent);background:rgba(26,138,92,0.1)"><i class="fas fa-check-circle"></i> Acesso App: ' + hasAccess.email + '</span>' : ''}
                            </div>
                        </div>
                        <div class="emp-card-actions">
                            <button class="btn-primary btn-sm" onclick="window.__paySalary('${e.id}')">
                                <i class="fas fa-check"></i> Pagar
                            </button>
                            ${hasAccess
                                ? '<button class="btn-secondary btn-sm" onclick="window.__revokeAppAccess(\'' + e.id + '\')" title="Revogar acesso ao App"><i class="fas fa-ban"></i> Bloquear</button>'
                                : '<button class="btn-secondary btn-sm" onclick="window.__grantAppAccess(\'' + e.id + '\')"><i class="fas fa-mobile-screen-button"></i> Dar Acesso</button>'
                            }
                            <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteEmployee('${e.id}')">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render salary payment history
        renderSalaryPaymentHistory();
    }

    function renderSalaryPaymentHistory() {
        const body = $('#salaryPaymentBody');
        if (salaryPayments.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum pagamento registado</td></tr>';
            return;
        }
        body.innerHTML = salaryPayments.map(p => {
            const emp = employees.find(e => e.id === p.employeeId);
            const empName = emp ? emp.name : 'Desconhecido';
            return `
                <tr>
                    <td>${fmtDate(p.date)}</td>
                    <td>${empName}</td>
                    <td class="amount-negative">-${fmt(p.amount)}</td>
                    <td>${getRuleName(p.fundId)}</td>
                    <td>
                        <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteSalaryPayment('${p.id}')">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ─── Render: History ───
    function renderHistory() {
        const filterDate = $('#filterDate').value;
        const filterSector = $('#filterSector').value;
        const filterType = $('#filterType').value;

        const sel = $('#filterSector');
        const currVal = sel.value;
        sel.innerHTML = '<option value="">Todos os Sectores/Fundos</option>' +
            sectors.map(s => `<option value="s_${s.id}">${s.name} (Entrada)</option>`).join('') +
            rules.map(r => `<option value="r_${r.id}">${r.name} (Retirada)</option>`).join('');
        sel.value = currVal;

        let allItems = [
            ...transactions.map(t => ({ ...t, _filterSector: 's_' + t.sectorId })),
            ...withdrawals.map(w => ({ ...w, _filterSector: 'r_' + w.fundId }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filterDate) allItems = allItems.filter(m => m.date === filterDate);
        if (filterSector) allItems = allItems.filter(m => m._filterSector === filterSector);
        if (filterType) allItems = allItems.filter(m => m.type === filterType);

        const body = $('#historyBody');
        if (allItems.length === 0) {
            body.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma movimentação encontrada</td></tr>';
            return;
        }

        body.innerHTML = allItems.map(m => {
            if (m.type === 'entry') {
                const distMap = {};
                m.distribution.forEach(d => {
                    const rule = rules.find(r => r.id === d.ruleId);
                    if (rule) distMap[rule.id] = { name: rule.name, amount: d.amount };
                });
                const r1 = rules[0] ? (distMap[rules[0].id] ? fmt(distMap[rules[0].id].amount) : '0,00 Kz') : '';
                const r2 = rules[1] ? (distMap[rules[1].id] ? fmt(distMap[rules[1].id].amount) : '0,00 Kz') : '';
                const r3 = rules[2] ? (distMap[rules[2].id] ? fmt(distMap[rules[2].id].amount) : '0,00 Kz') : '';
                return `
                    <tr>
                        <td>${fmtDate(m.date)}</td>
                        <td><span class="type-badge entry"><i class="fas fa-plus"></i> Entrada</span></td>
                        <td class="amount-positive">${fmt(m.amount)}</td>
                        <td>${getSectorName(m.sectorId)}</td>
                        <td>${m.description || '—'}</td>
                        <td>${r1}</td>
                        <td>${r2}</td>
                        <td>${r3}</td>
                        <td>
                            <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteTransaction('${m.id}')">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${fmtDate(m.date)}</td>
                        <td><span class="type-badge withdraw"><i class="fas fa-minus"></i> Retirada</span></td>
                        <td class="amount-negative">-${fmt(m.amount)}</td>
                        <td>${getRuleName(m.fundId)}</td>
                        <td>${m.description || '—'}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>
                            <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteWithdrawal('${m.id}')">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    }

    // ─── Render: Admin ───
    function renderAdmin() {
        const list = $('#sectorsList');
        list.innerHTML = sectors.map(s => `
            <div class="sector-item">
                <div class="sector-info">
                    <span class="sector-color" style="background:${s.color}"><i class="fas fa-${s.icon || 'building'}"></i></span>
                    <span class="sector-name">${s.name}</span>
                </div>
                <div class="sector-actions">
                    <button class="btn-secondary btn-sm" onclick="window.__editSector('${s.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="window.__deleteSector('${s.id}')"><i class="fas fa-trash-can"></i></button>
                </div>
            </div>
        `).join('');

        const rulesList = $('#rulesList');
        rulesList.innerHTML = rules.map(r => `
            <div class="rule-item">
                <div class="rule-info">
                    <span class="rule-color-dot" style="background:${r.color}"></span>
                    <div class="rule-details">
                        <span class="rule-name">${r.name}</span>
                        <span class="rule-percent">Percentual: <strong>${r.percentage}%</strong></span>
                    </div>
                </div>
                <div class="sector-actions">
                    <input type="number" class="rule-percent-input" id="ruleInput_${r.id}"
                        value="${r.percentage}" min="0" max="100" step="0.5"
                        onchange="window.__updateRulePercent('${r.id}', this.value)">
                </div>
            </div>
        `).join('');

        updateRulesValidation();
    }

    function updateRulesValidation() {
        const total = rules.reduce((s, r) => s + r.percentage, 0);
        const el = $('#rulesValidation');
        el.innerHTML = total === 100
            ? '<i class="fas fa-circle-check"></i> Total: <span id="rulesTotal">' + total + '</span>% — Válido'
            : '<i class="fas fa-circle-exclamation"></i> Total: <span id="rulesTotal">' + total + '</span>% — Deve ser exatamente 100%';
        el.classList.toggle('invalid', total !== 100);
    }

    // ─── Render: Reports ───
    function renderReports() {
        const period = $('#reportPeriod').value;
        const dateVal = $('#reportDate').value;
        const monthVal = $('#reportMonth').value;
        const yearVal = $('#reportYear').value;

        // Show/hide filters
        $('#reportDate').style.display = period === 'day' ? '' : 'none';
        $('#reportMonth').style.display = period === 'month' ? '' : 'none';
        $('#reportYear').style.display = period === 'year' ? '' : 'none';

        // Determine filter function
        let filterFn;
        if (period === 'day' && dateVal) {
            filterFn = (m) => m.date === dateVal;
        } else if (period === 'month' && monthVal) {
            filterFn = (m) => m.date && m.date.startsWith(monthVal);
        } else if (period === 'year' && yearVal) {
            filterFn = (m) => m.date && m.date.startsWith(String(yearVal));
        } else {
            filterFn = () => true; // show all
        }

        const filteredEntries = transactions.filter(filterFn);
        const filteredWithdrawals = withdrawals.filter(filterFn);

        const totalEntries = filteredEntries.reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = filteredWithdrawals.reduce((s, w) => s + w.amount, 0);
        const netBalance = totalEntries - totalWithdrawals;
        const totalMov = filteredEntries.length + filteredWithdrawals.length;

        $('#repTotalEntries').textContent = fmt(totalEntries);
        $('#repTotalWithdrawals').textContent = fmt(totalWithdrawals);
        $('#repNetBalance').textContent = fmt(Math.abs(netBalance));
        $('#repNetBalance').style.color = netBalance < 0 ? 'var(--danger)' : '';
        $('#repTotalMov').textContent = totalMov;

        // Entries by sector
        const sectorTotals = {};
        filteredEntries.forEach(t => {
            if (!sectorTotals[t.sectorId]) sectorTotals[t.sectorId] = 0;
            sectorTotals[t.sectorId] += t.amount;
        });
        const sectorHtml = Object.keys(sectorTotals).length === 0
            ? '<p class="empty-state">Nenhuma entrada no período</p>'
            : Object.entries(sectorTotals).sort((a, b) => b[1] - a[1]).map(([sid, amt]) => {
                const pct = totalEntries > 0 ? (amt / totalEntries) * 100 : 0;
                return `<div class="report-stat-item">
                    <div class="report-stat-left">
                        <div class="report-stat-icon" style="background:${getSectorColor(sid)}20;color:${getSectorColor(sid)}"><i class="fas fa-${getSectorIcon(sid)}"></i></div>
                        <span class="report-stat-name">${getSectorName(sid)}</span>
                    </div>
                    <div class="report-stat-values">
                        <div class="report-stat-amount">${fmt(amt)}</div>
                        <div class="report-stat-pct">${pct.toFixed(1)}%</div>
                    </div>
                </div>`;
            }).join('');
        $('#reportSectors').innerHTML = sectorHtml;

        // Distribution by fund
        const fundTotals = {};
        rules.forEach(r => fundTotals[r.id] = 0);
        filteredEntries.forEach(t => {
            t.distribution.forEach(d => {
                if (fundTotals[d.ruleId] !== undefined) fundTotals[d.ruleId] += d.amount;
            });
        });
        const fundWithdraw = {};
        rules.forEach(r => fundWithdraw[r.id] = 0);
        filteredWithdrawals.forEach(w => {
            if (fundWithdraw[w.fundId] !== undefined) fundWithdraw[w.fundId] += w.amount;
        });
        const fundHtml = rules.length === 0
            ? '<p class="empty-state">Nenhuma regra de distribuição</p>'
            : rules.map(r => {
                const entryAmt = fundTotals[r.id] || 0;
                const withdrawAmt = fundWithdraw[r.id] || 0;
                const netAmt = entryAmt - withdrawAmt;
                const pct = totalEntries > 0 ? (entryAmt / totalEntries) * 100 : 0;
                const colors = { r1: '#1a8a5c', r2: '#d4a843', r3: '#3498db' };
                return `<div class="report-stat-item">
                    <div class="report-stat-left">
                        <div class="report-stat-icon" style="background:${colors[r.id] || '#666'}20;color:${colors[r.id] || '#666'}"><i class="fas fa-${r.id === 'r1' ? 'users' : r.id === 'r2' ? 'chart-line' : 'building-columns'}"></i></div>
                        <span class="report-stat-name">${r.name}</span>
                    </div>
                    <div class="report-stat-values">
                        <div class="report-stat-amount" style="color:${netAmt >= 0 ? 'var(--accent)' : 'var(--danger)'}">${fmt(netAmt)}</div>
                        <div class="report-stat-pct">+${fmt(entryAmt)} / -${fmt(withdrawAmt)}</div>
                    </div>
                </div>`;
            }).join('');
        $('#reportFunds').innerHTML = fundHtml;

        // Movements list
        const allMov = [
            ...filteredEntries.map(t => ({ ...t, _tag: getSectorName(t.sectorId) })),
            ...filteredWithdrawals.map(w => ({ ...w, _tag: getRuleName(w.fundId) }))
        ].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

        const movBody = $('#reportMovements');
        if (allMov.length === 0) {
            movBody.innerHTML = '<p class="empty-state">Nenhuma movimentação no período</p>';
        } else {
            movBody.innerHTML = allMov.map(m => {
                const isEntry = m.type === 'entry';
                return `<div class="recent-item">
                    <div class="recent-item-left">
                        <div class="recent-item-icon ${isEntry ? 'entry' : 'withdraw'}"><i class="fas fa-${isEntry ? 'arrow-down' : 'arrow-up'}"></i></div>
                        <div class="recent-item-info">
                            <span class="recent-item-amount ${isEntry ? 'entry' : 'withdraw'}">${isEntry ? '+' : '-'}${fmt(m.amount)}</span>
                            <span class="recent-item-date">${fmtDate(m.date)} — ${m._tag}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ─── Exposed Actions ───
    window.__deleteTransaction = function (id) { deleteTransaction(id); };
    window.__deleteWithdrawal = function (id) { deleteWithdrawal(id); };
    window.__deleteEmployee = function (id) { deleteEmployee(id); };
    window.__grantAppAccess = function (id) {
        const emp = employees.find(e => e.id === id);
        if (!emp) return;
        const existing = getEmployeeAppAccess(id);
        if (existing) return showToast('Este funcionário já tem acesso.', 'warning');
        const body = `
            <div class="form-group">
                <label><i class="fas fa-user"></i> Funcionário</label>
                <input type="text" value="${emp.name}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label><i class="fas fa-building"></i> Sector de entrada atribuído</label>
                <input type="text" value="${getSectorName(emp.sectorId)}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label><i class="fas fa-envelope"></i> Email de acesso</label>
                <input type="email" id="grantEmail" placeholder="email@empresa.com" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-lock"></i> Palavra-passe</label>
                <input type="text" id="grantPassword" value="${emp.name.split(' ')[0].toLowerCase()}123" required>
            </div>
        `;
        openModal('Dar Acesso ao App — ' + emp.name, body,
            '<button class="btn-secondary" onclick="window.__closeModal()">Cancelar</button>' +
            '<button class="btn-primary" onclick="window.__confirmGrantAccess(\'' + id + '\')"><i class="fas fa-check"></i> Conceder Acesso</button>');
    };
    window.__confirmGrantAccess = function (id) {
        const emp = employees.find(e => e.id === id);
        if (!emp) return;
        const email = $('#grantEmail').value.trim();
        const password = $('#grantPassword').value.trim();
        if (!email) return showToast('Introduza o email.', 'error');
        if (!password || password.length < 3) return showToast('A palavra-passe deve ter no mínimo 3 caracteres.', 'error');
        const users = getUsers();
        if (users.some(u => u.email === email)) return showToast('Este email já está em uso.', 'error');
        users.push({
            name: emp.name,
            email: email,
            password: password,
            role: 'employee',
            sectorId: emp.sectorId,
            employeeId: emp.id
        });
        saveUsers(users);
        saveData();
        closeModal();
        renderEmployees();
        showToast('Acesso concedido a ' + emp.name + '!', 'success');
    };
    window.__revokeAppAccess = function (id) {
        if (!confirm('Tem certeza que deseja revogar o acesso ao App deste funcionário?')) return;
        const users = getUsers();
        const updated = users.filter(u => !(u.role === 'employee' && u.employeeId === id));
        saveUsers(updated);
        renderEmployees();
        showToast('Acesso revogado.', 'warning');
    };
    window.__paySalary = function (id) {
        const emp = employees.find(e => e.id === id);
        if (!emp) return showToast('Funcionário não encontrado.', 'error');
        const now = new Date().toISOString().slice(0, 10);
        const body = `
            <div class="form-group">
                <label><i class="fas fa-user"></i> Funcionário</label>
                <input type="text" value="${emp.name}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label><i class="fas fa-money-bill"></i> Valor do Salário</label>
                <input type="text" value="${fmt(emp.salary)}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label><i class="fas fa-piggy-bank"></i> Debitar de</label>
                <input type="text" value="${getRuleName(emp.fundId)}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label><i class="fas fa-calendar"></i> Data do Pagamento</label>
                <input type="date" id="payDate" value="${now}">
            </div>
        `;
        openModal('Pagar Salário', body,
            '<button class="btn-secondary" onclick="window.__closeModal()">Cancelar</button>' +
            '<button class="btn-danger" onclick="window.__confirmPaySalary(\'' + id + '\')"><i class="fas fa-check"></i> Confirmar Pagamento</button>');
    };
    window.__confirmPaySalary = function (id) {
        const date = $('#payDate').value;
        if (!date) return showToast('Seleccione a data do pagamento.', 'error');
        paySalary(id, date);
        closeModal();
    };
    window.__deleteSalaryPayment = function (id) { deleteSalaryPayment(id); };

    function iconPickerHTML(selected) {
        return '<div class="icon-picker">' + SECTOR_ICONS.map(i =>
            '<span class="icon-option' + (i === selected ? ' active' : '') + '" data-icon="' + i + '"><i class="fas fa-' + i + '"></i></span>'
        ).join('') + '</div>';
    }

    window.__editSector = function (id) {
        const sector = sectors.find(s => s.id === id);
        if (!sector) return;
        const body = `
            <div class="form-group">
                <label>Nome do Sector</label>
                <input type="text" id="modalSectorName" value="${sector.name}" placeholder="Nome do sector">
            </div>
            <div class="form-group">
                <label>Ícone / Logótipo</label>
                ${iconPickerHTML(sector.icon || 'building')}
            </div>
        `;
        openModal('Editar Sector', body,
            '<button class="btn-secondary" onclick="window.__closeModal()">Cancelar</button>' +
            '<button class="btn-primary" onclick="window.__saveSector(\'' + id + '\')">Guardar</button>');
        // Init icon picker
        setTimeout(() => {
            $$('.icon-option').forEach(el => el.addEventListener('click', function () {
                $$('.icon-option').forEach(e => e.classList.remove('active'));
                this.classList.add('active');
            }));
        }, 50);
    };

    window.__saveSector = function (id) {
        const name = $('#modalSectorName').value.trim();
        const activeIcon = document.querySelector('.icon-option.active');
        const icon = activeIcon ? activeIcon.dataset.icon : 'building';
        if (!name) return showToast('O nome do sector é obrigatório.', 'error');
        const sector = sectors.find(s => s.id === id);
        if (sector) {
            sector.name = name;
            sector.icon = icon;
            saveData();
            refreshAll();
            closeModal();
            showToast('Sector actualizado.', 'success');
        }
    };

    window.__deleteSector = function (id) {
        if (transactions.some(t => t.sectorId === id)) return showToast('Não pode eliminar um sector com entradas associadas.', 'error');
        if (sectors.length <= 1) return showToast('É necessário ter pelo menos um sector.', 'error');
        if (!confirm('Tem certeza que deseja eliminar este sector?')) return;
        sectors = sectors.filter(s => s.id !== id);
        saveData();
        refreshAll();
        showToast('Sector eliminado.', 'warning');
    };

    window.__addSector = function () {
        openModal('Novo Sector de Entrada',
            '<div class="form-group"><label>Nome do Sector</label><input type="text" id="modalSectorName" placeholder="Ex: Parcerias"></div>' +
            '<div class="form-group"><label>Ícone / Logótipo</label>' + iconPickerHTML('building') + '</div>',
            '<button class="btn-secondary" onclick="window.__closeModal()">Cancelar</button>' +
            '<button class="btn-primary" onclick="window.__confirmAddSector()">Adicionar</button>');
        setTimeout(() => {
            $$('.icon-option').forEach(el => el.addEventListener('click', function () {
                $$('.icon-option').forEach(e => e.classList.remove('active'));
                this.classList.add('active');
            }));
        }, 50);
    };

    window.__confirmAddSector = function () {
        const name = $('#modalSectorName').value.trim();
        const activeIcon = document.querySelector('.icon-option.active');
        const icon = activeIcon ? activeIcon.dataset.icon : 'building';
        if (!name) return showToast('O nome do sector é obrigatório.', 'error');
        if (sectors.some(s => s.name.toLowerCase() === name.toLowerCase())) return showToast('Já existe um sector com este nome.', 'error');
        const colors = ['#1a8a5c','#d4a843','#3498db','#9b59b6','#e74c3c','#f39c12','#2ecc71','#1abc9c','#e67e22','#2980b9'];
        const color = colors[sectors.length % colors.length];
        sectors.push({ id: genId(), name, icon, color });
        saveData();
        refreshAll();
        closeModal();
        showToast('Sector adicionado com sucesso!', 'success');
    };

    window.__updateRulePercent = function (id, val) {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 100) { showToast('O percentual deve estar entre 0 e 100.', 'error'); renderAdmin(); return; }
        const rule = rules.find(r => r.id === id);
        if (rule) {
            rule.percentage = num;
            saveData();
            updateRulesValidation();
            recalculateTransactions();
            refreshAll();
        }
    };

    function recalculateTransactions() {
        transactions.forEach(t => {
            const dist = distribute(t.amount);
            t.distribution = dist.map(d => ({ ruleId: d.id, amount: d.allocated }));
        });
        saveData();
    }

    window.__closeModal = closeModal;

    // ─── Refresh ───
    function refreshAll() {
        if (currentPage === 'dashboard') renderDashboard();
        if (currentPage === 'register') populateSectorSelect();
        if (currentPage === 'employees') renderEmployees();
        if (currentPage === 'withdraw') { populateWithdrawFundSelect(); renderWithdrawHistory(); }
        if (currentPage === 'history') renderHistory();
        if (currentPage === 'reports') renderReports();
        if (currentPage === 'admin') renderAdmin();
    }

    // ─── Init ───
    function init() {
        loadData();
        loadSession();

        const now = new Date();
        $('#currentDate').textContent = now.toLocaleDateString('pt-AO', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });

        // ─── Login Form ───
        $('#loginForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const email = $('#loginEmail').value.trim();
            const password = $('#loginPassword').value;
            if (doLogin(email, password)) {
                showToast('Bem-vindo ao EGESTOR 2.0!', 'success');
            } else {
                showToast('Email ou palavra-passe incorrectos.', 'error');
            }
        });

        // ─── Logout ───
        $('#logoutBtn').addEventListener('click', doLogout);

        // ─── Navigation ───
        $$('.nav-item').forEach(item => {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                navigate(this.dataset.page);
            });
        });

        // Menu toggle
        $('#menuToggle').addEventListener('click', function () {
            $('#sidebar').classList.toggle('open');
        });

        document.addEventListener('click', function (e) {
            const sidebar = $('#sidebar');
            const toggle = $('#menuToggle');
            if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });

        // ─── Entry Form ───
        $('#entryForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const date = $('#entryDate').value;
            const amount = parseFloat($('#entryAmount').value);
            const sectorId = getRegisterSectorId();
            const description = $('#entryDescription').value.trim();
            if (!date) return showToast('Seleccione a data de entrada.', 'error');
            if (!amount || amount <= 0) return showToast('Introduza um valor válido.', 'error');
            if (!sectorId) return showToast('Seleccione o sector de entrada.', 'error');
            addTransaction({ date, amount, sectorId, description });
            this.reset();
            document.getElementById('entryDate').valueAsDate = new Date();
            $('#distributionPreview').style.display = 'none';
        });

        $('#entryAmount').addEventListener('input', function () {
            const val = parseFloat(this.value);
            updateDistributionPreview(val > 0 ? val : 0);
        });

        // ─── Withdraw Form ───
        $('#withdrawForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const date = $('#withdrawDate').value;
            const amount = parseFloat($('#withdrawAmount').value);
            const fundId = $('#withdrawFund').value;
            const description = $('#withdrawDescription').value.trim();
            if (!date) return showToast('Seleccione a data da retirada.', 'error');
            if (!amount || amount <= 0) return showToast('Introduza um valor válido.', 'error');
            if (!fundId) return showToast('Seleccione o fundo de origem.', 'error');
            const balance = getFundBalance(fundId);
            if (amount > balance) return showToast('Saldo insuficiente neste fundo.', 'error');
            addWithdrawal({ date, amount, fundId, description });
            this.reset();
            document.getElementById('withdrawDate').valueAsDate = new Date();
            updateFundBalanceDisplay();
        });

        $('#withdrawAmount').addEventListener('input', function () {
            const fundId = $('#withdrawFund').value;
            if (fundId) updateFundBalanceDisplay();
        });

        $('#withdrawFund').addEventListener('change', updateFundBalanceDisplay);

        // ─── Employee Form ───
        $('#employeeForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const name = $('#empName').value.trim();
            const salary = parseFloat($('#empSalary').value);
            const fundId = $('#empFund').value;
            const sectorId = $('#empSector').value;
            if (!name) return showToast('Introduza o nome do funcionário.', 'error');
            if (!salary || salary <= 0) return showToast('Introduza um salário válido.', 'error');
            if (!fundId) return showToast('Seleccione o fundo para débito.', 'error');
            if (!sectorId) return showToast('Seleccione o sector de entrada.', 'error');
            addEmployee({ name, salary, fundId, sectorId });
            this.reset();
        });

        // ─── History Filters ───
        $('#filterDate').addEventListener('change', renderHistory);
        $('#filterSector').addEventListener('change', renderHistory);
        $('#filterType').addEventListener('change', renderHistory);
        $('#clearFilters').addEventListener('click', function () {
            $('#filterDate').value = '';
            $('#filterSector').value = '';
            $('#filterType').value = '';
            renderHistory();
        });

        // ─── Export CSV ───
        $('#exportCSV').addEventListener('click', function () {
            const all = [
                ...transactions.map(t => ({ ...t, _exportType: 'Entrada', _exportFund: getSectorName(t.sectorId) })),
                ...withdrawals.map(w => ({ ...w, _exportType: 'Retirada', _exportFund: getRuleName(w.fundId), distribution: [] }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            if (all.length === 0) return showToast('Não há dados para exportar.', 'warning');

            const rows = [['Data', 'Tipo', 'Valor', 'Sector/Fundo', 'Descrição',
                rules[0] ? rules[0].name : 'F. Pessoal',
                rules[1] ? rules[1].name : 'F. Investimento',
                rules[2] ? rules[2].name : 'F. Caixa'
            ]];
            all.forEach(m => {
                const distMap = {};
                (m.distribution || []).forEach(d => {
                    const rule = rules.find(r => r.id === d.ruleId);
                    if (rule) distMap[rule.id] = d.amount.toFixed(2);
                });
                rows.push([
                    m.date,
                    m._exportType,
                    (m.type === 'withdraw' ? '-' : '') + m.amount.toFixed(2),
                    m._exportFund,
                    m.description || '',
                    m.type === 'entry' ? (distMap[rules[0]?.id] || '0.00') : '—',
                    m.type === 'entry' ? (distMap[rules[1]?.id] || '0.00') : '—',
                    m.type === 'entry' ? (distMap[rules[2]?.id] || '0.00') : '—'
                ]);
            });
            const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'egestor_dados_' + new Date().toISOString().slice(0, 10) + '.csv';
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Dados exportados com sucesso!', 'success');
        });

        // ─── Reports ───
        const nowMonth = now.toISOString().slice(0, 7);
        const nowDate = now.toISOString().slice(0, 10);
        $('#reportMonth').value = nowMonth;
        $('#reportDate').value = nowDate;
        $('#reportYear').value = now.getFullYear();

        // init visibility
        $('#reportDate').style.display = 'none';
        $('#reportYear').style.display = 'none';

        $('#reportPeriod').addEventListener('change', renderReports);
        $('#reportDate').addEventListener('change', renderReports);
        $('#reportMonth').addEventListener('change', renderReports);
        $('#reportYear').addEventListener('input', renderReports);
        $('#generateReport').addEventListener('click', renderReports);

        $('#exportReportPDF').addEventListener('click', function () {
            window.print();
        });

        // ─── Admin ───
        $('#addSectorBtn').addEventListener('click', window.__addSector);

        // ─── Modal ───
        $('#modalClose').addEventListener('click', closeModal);
        $('#modalOverlay').addEventListener('click', function (e) {
            if (e.target === this) closeModal();
        });

        // ─── Auto-login or show login ───
        if (currentUser) {
            showApp();
        } else {
            hideApp();
            navigate('dashboard');
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
