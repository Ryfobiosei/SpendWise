import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import MonthlyCashflowChart from '../components/dashboard/MonthlyCashflowChart.jsx'
import { useAuth } from '../context/useAuth.js'
import { formatCurrency, formatTransactionDate } from '../lib/formatCurrency.js'
import { getProfile } from '../services/profileService.js'
import {
  getBudgetSpending,
  listBudgets,
} from '../services/budgetService.js'
import {
  getCategorySpending,
  getFinancialTotals,
  getMonthlyCashflow,
  listRecentTransactions,
} from '../services/analyticsService.js'
import { buildSpendingInsights } from '../services/insightService.js'

function currentMonth() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
}

function previousMonth(month) {
  const date = new Date(month + '-01T12:00:00')
  date.setMonth(date.getMonth() - 1)
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-GH', { month: 'long', year: 'numeric' })
    .format(new Date(month + '-01T12:00:00'))
}

export default function Dashboard() {
  const { user } = useAuth()
  const [month] = useState(currentMonth)
  const [currency, setCurrency] = useState('GHS')
  const [profile, setProfile] = useState(null)
  const [totals, setTotals] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [cashflow, setCashflow] = useState([])
  const [categorySpending, setCategorySpending] = useState([])
  const [previousCategorySpending, setPreviousCategorySpending] = useState([])
  const [budgets, setBudgets] = useState([])
  const [spendingByCategory, setSpendingByCategory] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    Promise.all([
      getProfile(user.id),
      getFinancialTotals(user.id, month),
      listRecentTransactions(user.id, 5),
      getMonthlyCashflow(user.id, month, 6),
      getCategorySpending(user.id, month),
      getCategorySpending(user.id, previousMonth(month)),
      listBudgets(user.id, month),
      getBudgetSpending(user.id, month),
    ]).then(([profileRow, totalRows, transactionRows, cashflowRows, categoryRows, previousRows, budgetRows, spending]) => {
      if (!active) return
      setProfile(profileRow)
      setCurrency(profileRow.currency || 'GHS')
      setTotals(totalRows)
      setRecentTransactions(transactionRows)
      setCashflow(cashflowRows)
      setCategorySpending(categoryRows)
      setPreviousCategorySpending(previousRows)
      setBudgets(budgetRows)
      setSpendingByCategory(spending)
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'Could not load your financial overview.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [month, refreshVersion, user?.id])

  const balance = totals ? totals.totalIncome - totals.totalExpenses : 0
  const savings = totals ? totals.monthIncome - totals.monthExpenses : 0
  const savingsRate = totals?.monthIncome > 0 ? Math.round(savings / totals.monthIncome * 100) : null
  const insights = buildSpendingInsights({
    month,
    categorySpending,
    previousCategorySpending,
    budgets,
    spendingByCategory,
  })

  function retryLoading() {
    setLoading(true)
    setError('')
    setRefreshVersion((version) => version + 1)
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR MONEY, IN VIEW</p>
          <h1>{profile?.full_name ? 'Welcome back, ' + profile.full_name.split(' ')[0] : 'Your overview'}</h1>
          <p className="dashboard-description">Here’s where things stand for {monthLabel(month)}.</p>
        </div>
        <Link className="button button-primary" to="/dashboard/transactions">＋ Add transaction</Link>
      </div>

      {error && <div className="inline-error dashboard-error" role="alert"><span>{error}</span><button className="row-action" type="button" onClick={retryLoading}>Try again</button></div>}
      {loading && <div className="dashboard-loading transaction-loading" role="status"><span className="auth-spinner" aria-hidden="true" /><span>Loading your overview…</span></div>}

      {!loading && !error && totals && (
        <>
          <div className="dashboard-summary-grid">
            <article className="dashboard-summary-card dashboard-balance-card">
              <span>Total balance</span>
              <strong>{formatCurrency(balance, currency)}</strong>
              <small>All recorded income minus expenses</small>
            </article>
            <article className="dashboard-summary-card">
              <span>Income this month</span>
              <strong>{formatCurrency(totals.monthIncome, currency)}</strong>
              <small>{monthLabel(month)}</small>
            </article>
            <article className="dashboard-summary-card">
              <span>Expenses this month</span>
              <strong>{formatCurrency(totals.monthExpenses, currency)}</strong>
              <small>{monthLabel(month)}</small>
            </article>
            <article className={'dashboard-summary-card' + (savings < 0 ? ' is-negative' : '')}>
              <span>Net this month</span>
              <strong>{formatCurrency(savings, currency)}</strong>
              <small>{savingsRate === null ? 'No income recorded this month' : savingsRate + '% of income'}</small>
            </article>
          </div>

          <div className="dashboard-main-grid">
            <section className="dashboard-panel dashboard-cashflow-panel" aria-labelledby="dashboard-cashflow-title">
              <div className="dashboard-panel-heading">
                <div><h2 id="dashboard-cashflow-title">Income and expenses</h2><p>Monthly totals over the last six months</p></div>
                <Link to="/dashboard/analytics">View analytics <span aria-hidden="true">→</span></Link>
              </div>
              {cashflow.some((row) => row.income > 0 || row.expenses > 0)
                ? <MonthlyCashflowChart rows={cashflow} currency={currency} />
                : <div className="dashboard-panel-empty"><span className="empty-state-icon" aria-hidden="true">↗</span><p>Add a transaction to start your monthly overview.</p></div>}
            </section>

            <section className="dashboard-panel dashboard-insights-panel" aria-labelledby="dashboard-insights-title">
              <div className="dashboard-panel-heading">
                <div><h2 id="dashboard-insights-title">Spending insights</h2><p>Observations from your recorded activity</p></div>
                <Link to="/dashboard/analytics">Explore <span aria-hidden="true">→</span></Link>
              </div>
              {insights.length > 0
                ? <ul className="dashboard-insight-list">
                  {insights.slice(0, 3).map((insight) => <li className={'dashboard-insight' + (insight.tone === 'attention' ? ' is-attention' : '')} key={insight.id}><span aria-hidden="true">{insight.tone === 'attention' ? '!' : '✳'}</span><div><strong>{insight.title}</strong><p>{insight.detail}</p></div></li>)}
                </ul>
                : <div className="dashboard-panel-empty"><span className="empty-state-icon" aria-hidden="true">✳</span><p>Insights will appear as you record more income and expenses.</p></div>}
            </section>

            <section className="dashboard-panel dashboard-recent-panel" aria-labelledby="dashboard-recent-title">
              <div className="dashboard-panel-heading">
                <div><h2 id="dashboard-recent-title">Recent transactions</h2><p>Your latest recorded activity</p></div>
                <Link to="/dashboard/transactions">See all <span aria-hidden="true">→</span></Link>
              </div>
              {recentTransactions.length > 0
                ? <ul className="dashboard-transaction-list">
                  {recentTransactions.map((transaction) => <li key={transaction.id}>
                    <span className={'dashboard-transaction-mark type-' + transaction.type} aria-hidden="true">{transaction.type === 'income' ? '↗' : '↘'}</span>
                    <div className="dashboard-transaction-copy"><strong>{transaction.description || transaction.category?.name || 'Transaction'}</strong><span>{formatTransactionDate(transaction.transaction_date)} · {transaction.category?.name || 'Category'}</span></div>
                    <strong className={'dashboard-transaction-amount amount-' + transaction.type}>{transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount, currency)}</strong>
                  </li>)}
                </ul>
                : <div className="dashboard-panel-empty"><span className="empty-state-icon" aria-hidden="true">↗</span><p>No transactions yet. Add an income or expense to begin.</p><Link to="/dashboard/transactions">Add your first transaction</Link></div>}
            </section>

            <section className="dashboard-panel dashboard-budget-panel" aria-labelledby="dashboard-budget-title">
              <div className="dashboard-panel-heading">
                <div><h2 id="dashboard-budget-title">Budget progress</h2><p>{monthLabel(month)}</p></div>
                <Link to="/dashboard/budgets">Manage <span aria-hidden="true">→</span></Link>
              </div>
              {budgets.length > 0
                ? <div className="dashboard-budget-list">
                  {budgets.slice(0, 4).map((budget) => {
                    const limit = Number(budget.amount)
                    const spent = spendingByCategory[budget.category_id] ?? 0
                    const percent = limit ? spent / limit * 100 : 0
                    return <div className="dashboard-budget-row" key={budget.id}>
                      <div><strong>{budget.category?.name || 'Expense category'}</strong><span>{formatCurrency(spent, currency)} of {formatCurrency(limit, currency)}</span></div>
                      <div className={'dashboard-budget-track' + (percent >= 100 ? ' is-over' : percent >= 80 ? ' is-near' : '')}><span style={{ width: Math.min(100, percent) + '%' }} /></div>
                    </div>
                  })}
                </div>
                : <div className="dashboard-panel-empty"><span className="empty-state-icon" aria-hidden="true">◎</span><p>You haven’t set a monthly budget yet.</p><Link to="/dashboard/budgets">Create a budget</Link></div>}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
