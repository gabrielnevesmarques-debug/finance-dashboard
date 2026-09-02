const STORAGE_KEY = 'fintrack_transactions';
const THEME_KEY = 'fintrack_theme';

let transactions = loadTransactions();
let chart = null;
let editingId = null;

const $ = (selector) => document.querySelector(selector);

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function money(value) {
  return currency.format(value);
}

function categoryIcon(category) {
  const icons = {
    Alimentação: '🍔',
    Transporte: '🚌',
    Moradia: '🏠',
    Lazer: '🎮',
    Salário: '💼',
    Freelance: '💻',
    Outros: '📦'
  };

  return icons[category] || '📦';
}

function formatDate(value) {
  if (!value) return '--';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T12:00:00`));
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function getTotals(list = transactions) {
  return list.reduce(
    (totals, transaction) => {
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }

      return totals;
    },
    { income: 0, expense: 0 }
  );
}

function updateDashboard() {
  const { income, expense } = getTotals();
  const balance = income - expense;

  $('#balance').textContent = money(balance);
  $('#income').textContent = money(income);
  $('#expense').textContent = money(expense);

  $('#balanceStatus').textContent = balance >= 0
    ? 'Você está dentro do saldo positivo.'
    : 'Atenção: suas despesas superaram as receitas.';

  $('#balanceStatus').className = balance >= 0 ? 'positive' : 'negative';

  updateCategories();
  renderChart();
}

function updateCategories() {
  const totals = {};

  transactions
    .filter((transaction) => transaction.type === 'expense')
    .forEach((transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;
    });

  const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const totalExpenses = categories.reduce((sum, [, value]) => sum + value, 0);

  $('#categoryList').innerHTML = categories.length
    ? categories.map(([category, value]) => {
        const percentage = totalExpenses ? (value / totalExpenses) * 100 : 0;

        return `
          <div class="category-row">
            <div class="category-info">
              <span>${categoryIcon(category)} ${escapeHTML(category)}</span>
              <span>${money(value)} <small>${percentage.toFixed(0)}%</small></span>
            </div>
            <div class="progress" aria-label="${percentage.toFixed(0)}% das despesas">
              <div style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">Nenhuma despesa registrada.</div>';
}

function updateFilters() {
  const currentCategory = $('#categoryFilter').value;
  const categories = [...new Set(transactions.map((transaction) => transaction.category))].sort();

  $('#categoryFilter').innerHTML = `
    <option value="all">Todas as categorias</option>
    ${categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('')}
  `;

  if (categories.includes(currentCategory)) {
    $('#categoryFilter').value = currentCategory;
  }
}

function renderTransactions() {
  const selectedType = $('#typeFilter').value;
  const selectedCategory = $('#categoryFilter').value;

  const filtered = [...transactions]
    .filter((transaction) => {
      const matchesType = selectedType === 'all' || transaction.type === selectedType;
      const matchesCategory = selectedCategory === 'all' || transaction.category === selectedCategory;

      return matchesType && matchesCategory;
    })
    .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`));

  $('#transactionList').innerHTML = filtered.length
    ? filtered.map((transaction) => `
        <div class="transaction">
          <div class="transaction-main">
            <div class="transaction-icon">${categoryIcon(transaction.category)}</div>
            <div>
              <div class="transaction-title">${escapeHTML(transaction.description)}</div>
              <div class="transaction-meta">${escapeHTML(transaction.category)} • ${formatDate(transaction.date)}</div>
            </div>
          </div>

          <div class="transaction-amount ${transaction.type === 'income' ? 'positive' : 'negative'}">
            ${transaction.type === 'income' ? '+' : '-'} ${money(transaction.amount)}
          </div>

          <div class="transaction-actions">
            <button class="action-btn edit-btn" data-id="${transaction.id}" title="Editar" aria-label="Editar transação">✎</button>
            <button class="action-btn delete-btn" data-id="${transaction.id}" title="Excluir" aria-label="Excluir transação">×</button>
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhuma transação encontrada.</div>';
}

function renderChart() {
  if (typeof Chart === 'undefined') return;

  const period = $('#chartPeriod').value;
  const data = period === 'month'
    ? transactions.filter((transaction) => {
        const date = new Date(`${transaction.date}T12:00:00`);
        const now = new Date();

        return date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear();
      })
    : transactions;

  const { income, expense } = getTotals(data);

  if (chart) chart.destroy();

  chart = new Chart($('#financeChart'), {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas'],
      datasets: [{
        data: [income, expense],
        borderRadius: 10,
        borderSkipped: false,
        backgroundColor: ['#18a56b', '#e05252']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => money(context.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => money(value)
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function resetForm() {
  $('#transactionForm').reset();
  $('#date').value = new Date().toISOString().split('T')[0];
  $('#type').value = 'expense';
  $('#category').value = 'Alimentação';
}

function openModal(transaction = null) {
  editingId = transaction?.id || null;

  if (transaction) {
    $('#modalEyebrow').textContent = 'Editar lançamento';
    $('#modalTitle').textContent = 'Editar transação';
    $('#submitButton').textContent = 'Atualizar transação';
    $('#description').value = transaction.description;
    $('#amount').value = transaction.amount;
    $('#date').value = transaction.date;
    $('#type').value = transaction.type;
    $('#category').value = transaction.category;
  } else {
    $('#modalEyebrow').textContent = 'Novo lançamento';
    $('#modalTitle').textContent = 'Adicionar transação';
    $('#submitButton').textContent = 'Salvar transação';
    resetForm();
  }

  $('#modal').classList.remove('hidden');
  $('#modal').setAttribute('aria-hidden', 'false');
  $('#description').focus();
}

function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').setAttribute('aria-hidden', 'true');
  editingId = null;
  resetForm();
  $('#modalEyebrow').textContent = 'Novo lançamento';
  $('#modalTitle').textContent = 'Adicionar transação';
  $('#submitButton').textContent = 'Salvar transação';
}

function showToast(message, type = 'success') {
  const toast = $('#toast');

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

$('#openModal').addEventListener('click', () => openModal());
$('#closeModal').addEventListener('click', closeModal);
$('#closeModalButton').addEventListener('click', closeModal);

$('#transactionForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const description = $('#description').value.trim();
  const amount = Number($('#amount').value);

  if (!description || !Number.isFinite(amount) || amount <= 0 || !$('#date').value) {
    showToast('Preencha os campos corretamente.', 'error');
    return;
  }

  const transaction = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    description,
    amount,
    date: $('#date').value,
    type: $('#type').value,
    category: $('#category').value
  };

  if (editingId) {
    transactions = transactions.map((item) =>
      item.id === editingId ? transaction : item
    );
    showToast('Transação atualizada com sucesso!');
  } else {
    transactions.push(transaction);
    showToast('Transação adicionada com sucesso!');
  }

  saveTransactions();
  updateFilters();
  renderTransactions();
  updateDashboard();
  closeModal();
});

$('#transactionList').addEventListener('click', (event) => {
  const editButton = event.target.closest('.edit-btn');
  const deleteButton = event.target.closest('.delete-btn');

  if (editButton) {
    const transaction = transactions.find((item) => item.id === editButton.dataset.id);
    if (transaction) openModal(transaction);
    return;
  }

  if (deleteButton) {
    const transaction = transactions.find((item) => item.id === deleteButton.dataset.id);
    if (!transaction) return;

    const confirmed = window.confirm(`Excluir a transação "${transaction.description}"?`);
    if (!confirmed) return;

    transactions = transactions.filter((item) => item.id !== transaction.id);
    saveTransactions();
    updateFilters();
    renderTransactions();
    updateDashboard();
    showToast('Transação excluída.');
  }
});

$('#typeFilter').addEventListener('change', renderTransactions);
$('#categoryFilter').addEventListener('change', renderTransactions);
$('#chartPeriod').addEventListener('change', renderChart);

$('#themeToggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  $('#themeToggle').textContent = dark ? '☀️ Modo claro' : '🌙 Modo escuro';
  renderChart();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#modal').classList.contains('hidden')) {
    closeModal();
  }
});

if (localStorage.getItem(THEME_KEY) === 'dark') {
  document.body.classList.add('dark');
  $('#themeToggle').textContent = '☀️ Modo claro';
}

$('#date').value = new Date().toISOString().split('T')[0];
updateFilters();
renderTransactions();
updateDashboard();
