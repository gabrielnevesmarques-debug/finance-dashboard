const KEY = 'fintrack_transactions';
const THEME = 'fintrack_theme';

let transactions = load();
let chart;

const $ = (selector) => document.querySelector(selector);
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(transactions));
}

function money(value) {
  return currency.format(value);
}

function icon(category) {
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
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T12:00:00`));
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function updateDashboard() {
  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = income - expenses;

  $('#balance').textContent = money(balance);
  $('#income').textContent = money(income);
  $('#expense').textContent = money(expenses);

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

  const list = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((sum, item) => sum + item[1], 0);

  $('#categoryList').innerHTML = list.length
    ? list.map(([category, value]) => `
        <div class="category-row">
          <div class="category-info">
            <span>${icon(category)} ${category}</span>
            <span>${money(value)}</span>
          </div>
          <div class="progress">
            <div style="width: ${total ? (value / total) * 100 : 0}%"></div>
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhuma despesa registrada.</div>';
}

function updateFilters() {
  const currentCategory = $('#categoryFilter').value;
  const categories = [...new Set(transactions.map((transaction) => transaction.category))].sort();

  $('#categoryFilter').innerHTML = `
    <option value="all">Todas as categorias</option>
    ${categories.map((category) => `<option value="${category}">${category}</option>`).join('')}
  `;

  if (categories.includes(currentCategory)) {
    $('#categoryFilter').value = currentCategory;
  }
}

function renderTransactions() {
  const selectedType = $('#typeFilter').value;
  const selectedCategory = $('#categoryFilter').value;

  const filteredTransactions = [...transactions]
    .filter((transaction) => {
      const typeMatches = selectedType === 'all' || transaction.type === selectedType;
      const categoryMatches = selectedCategory === 'all' || transaction.category === selectedCategory;

      return typeMatches && categoryMatches;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  $('#transactionList').innerHTML = filteredTransactions.length
    ? filteredTransactions.map((transaction) => `
        <div class="transaction">
          <div class="transaction-main">
            <div class="transaction-icon">
              ${icon(transaction.category)}
            </div>
            <div>
              <div class="transaction-title">
                ${escapeHTML(transaction.description)}
              </div>
              <div class="transaction-meta">
                ${transaction.category} • ${formatDate(transaction.date)}
              </div>
            </div>
          </div>

          <div class="transaction-amount ${transaction.type === 'income' ? 'positive' : 'negative'}">
            ${transaction.type === 'income' ? '+' : '-'} ${money(transaction.amount)}
          </div>

          <button
            class="delete-btn"
            data-id="${transaction.id}"
            title="Excluir"
            aria-label="Excluir transação"
          >
            ×
          </button>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhuma transação encontrada.</div>';
}

function renderChart() {
  if (typeof Chart === 'undefined') {
    return;
  }

  const period = $('#chartPeriod').value;

  const data = period === 'month'
    ? transactions.filter((transaction) => {
        const date = new Date(`${transaction.date}T12:00:00`);
        const now = new Date();

        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
    : transactions;

  const income = data
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = data
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + transaction.amount, 0);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart($('#financeChart'), {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas'],
      datasets: [{
        data: [income, expenses],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
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
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function openModal() {
  const modal = $('#modal');

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  $('#date').value = new Date().toISOString().split('T')[0];
  $('#description').focus();
}

function closeModal() {
  const modal = $('#modal');

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  $('#transactionForm').reset();
  $('#date').value = new Date().toISOString().split('T')[0];
}

$('#openModal').onclick = openModal;
$('#closeModal').onclick = closeModal;
$('#closeModalButton').onclick = closeModal;

document.onkeydown = (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

$('#transactionForm').onsubmit = (event) => {
  event.preventDefault();

  const transaction = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),
    description: $('#description').value.trim(),
    amount: Number($('#amount').value),
    date: $('#date').value,
    type: $('#type').value,
    category: $('#category').value
  };

  transactions.push(transaction);
  save();
  updateFilters();
  renderTransactions();
  updateDashboard();
  closeModal();
};

$('#transactionList').onclick = (event) => {
  const button = event.target.closest('.delete-btn');

  if (!button) {
    return;
  }

  transactions = transactions.filter(
    (transaction) => transaction.id !== button.dataset.id
  );

  save();
  updateFilters();
  renderTransactions();
  updateDashboard();
};

$('#typeFilter').onchange = renderTransactions;
$('#categoryFilter').onchange = renderTransactions;
$('#chartPeriod').onchange = renderChart;

$('#themeToggle').onclick = () => {
  document.body.classList.toggle('dark');

  localStorage.setItem(
    THEME,
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );

  renderChart();
};

if (localStorage.getItem(THEME) === 'dark') {
  document.body.classList.add('dark');
}

$('#date').value = new Date().toISOString().split('T')[0];

updateFilters();
renderTransactions();
updateDashboard();
