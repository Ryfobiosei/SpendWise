import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import MonthlyCashflowChart from '../components/dashboard/MonthlyCashflowChart.jsx'
import { useAuth } from '../context/useAuth.js'
import { formatCurrency, formatTransactionDate } from '../lib/formatCurrency.js'
import { getProfile } from '../services/profileService.js'
import { getBudgetSpending, listBudgets } from '../services/budgetService.js'
import {
  getCategorySpending,
  getDailySpending,
  getFinancialTotals,
  getLargestExpenses,
  getMonthlyCashflow,
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

function DailySpendingChart({ month, rows, currency }) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const spending = new Map(rows.map((row) => [Number(row.date.slice(8, 10)), row.spent]))
  const largest = Math.max(0, ...rows.map((row) => row.spent))
  const chartSummary = rows.map((row) => formatTransactionDate(row.date) + ': ' + formatCurrency(row.spent, currency)).join('; ')

  return (
    <div className="daily-chart" role="img" aria-label={'Daily expenses during ' + monthLabel(month) + '. ' + (chartSummary || 'No expenses were recorded.') }>
      <div className="daily-chart-columns" style={{ '--day-count': daysInMonth }}>
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1
          const amount = spending.get(day) ?? 0
          const date = month + '-' + String(day).padStart(2, '0')
          return <div className="daily-chart-column" key={day} title={formatTransactionDate(date) + ': ' + formatCurrency(amount, currency)}>
            <span className="daily-chart-bar" style={{ height: largest > 0 ? Math.max(amount > 0 ? 3 : 0, amount / largest * 100) + '%' : '0%' }} />
            {(day === 1 || day % 5 === 0 || day === daysInMonth) && <span className="daily-chart-day">{day}</span>}
          </div>
        })}
      </div>
      <div className="daily-chart-axis"><span>Day of month</span><span>{monthLabel(month)}</span></div>
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [profile, setProfile] = useState(null)
  const [totals, setTotals] = useState(null)
  const [cashflow, setCashflow] = useState([])
  const [categorySpending, setCategorySpending] = useState([])
  const [previousCategorySpending, setPreviousCategorySpending] = useState([])
  const [dailySpending, setDailySpending] = useState([])
  const [largestExpenses, setLargestExpenses] = useState([])
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
      getMonthlyCashflow(user.id, month, 6),
      getCategorySpending(user.id, month),
      getCategorySpending(user.id, previousMonth(month)),
      getDailySpending(user.id, month),
      getLargestExpenses(user.id, month, 5),
      listBudgets(user.id, month),
      getBudgetSpending(user.id, month),
    ]).then(([profileRow, totalRows, cashflowRows, categoryRows, previousRows, dailyRows, largestRows, budgetRows, spending]) => {
      if (!active) return
      setProfile(profileRow)
      setTotals(totalRows)
      setCashflow(cashflowRows)
      setCategorySpending(categoryRows)
      setPreviousCategorySpending(previousRows)
      setDailySpending(dailyRows)
      setLargestExpenses(largestRows)
      setBudgets(budgetRows)
      setSpendingByCategory(spending)
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'Could not load analytics.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [month, refreshVersion, user?.id])

  const currency = profile?.currency || 'GHS'
  const maximumCategorySpend = Math.max(0, ...categorySpending.map((row) => row.spent))
  const totalBudget = budgets.reduce((total, budget) => total + Number(budget.amount), 0)
  const totalBudgetSpend = budgets.reduce((total, budget) => total + (spendingByCategory[budget.category_id] ?? 0), 0)
  const insights = useMemo(() => buildSpendingInsights({
    month,
    categorySpending,
    previousCategorySpending,
    budgets,
    spendingByCategory,
    dailySpending,
  }), [budgets, categorySpending, dailySpending, month, previousCategorySpending, spendingByCategory])
  const hasRecordedSpending = categorySpending.length > 0

  function changeMonth(value) {
    if (!value) return
    setLoading(true)
    setError('')
    setMonth(value)
  }

  function retryLoading() {
    setLoading(true)
    setError('')
    setRefreshVersion((version) => version + 1)
  }

  return (
    <section className="analytics-page">
      <div className="analytics-heading">
        <div>
          <p className="eyebrow">PATTERNS IN YOUR MONEY</p>
          <h1>Analytics</h1>
          <p className="analytics-description">Explore how income and expenses change over time, using your recorded activity.</p>
        </div>
        <label className="filter-field analytics-month-field">
          <span>Report month</span>
          <input type="month" value={month} onChange={(event) => changeMonth(event.target.value)} />
        </label>
      </div>

      {error && <div className="analytics-error inline-error" role="alert"><span>{error}</span><button className="row-action" type="button" onClick={retryLoading}>Try again</button></div>}
      {loading && <div className="transaction-loading" role="status"><span className="auth-spinner" aria-hidden="true" /><span>Loading your analytics…</span></div>}

      {!loading && !error && totals && (
        <>
          <div className="analytics-summary-grid">
            <article><span>Income</span><strong>{formatCurrency(totals.monthIncome, currency)}</strong><small>{monthLabel(month)}</small></article>
            <article><span>Expenses</span><strong>{formatCurrency(totals.monthExpenses, currency)}</strong><small>{monthLabel(month)}</small></article>
            <article className={totals.monthIncome - totals.monthExpenses < 0 ? 'is-negative' : ''}><span>Net cash flow</span><strong>{formatCurrency(totals.monthIncome - totals.monthExpenses, currency)}</strong><small>Income minus expenses</small></article>
            <article><span>Budgeted category spend</span><strong>{formatCurrency(totalBudgetSpend, currency)}</strong><small>Of {formatCurrency(totalBudget, currency)} planned</small></article>
          </div>

          {!hasRecordedSpending && totals.monthIncome === 0 && totals.monthExpenses === 0 && (
            <div className="analytics-empty-state">
              <span className="empty-state-icon" aria-hidden="true">▥</span>
              <h2>No activity in {monthLabel(month)} yet.</h2>
              <p>Record income and expenses to see real trends, category comparisons, and spending insights here.</p>
              <Link className="button button-primary" to="/dashboard/transactions">Add a transaction</Link>
            </div>
          )}

          <div className="analytics-chart-grid">
            <section className="analytics-card analytics-trend-card" aria-labelledby="analytics-trend-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-trend-title">Monthly income vs expenses</h2><p>Six month cash flow trend</p></div></div>
              {cashflow.some((row) => row.income > 0 || row.expenses > 0)
                ? <MonthlyCashflowChart rows={cashflow} currency={currency} />
                : <p className="analytics-chart-empty">No income or expense records across this period.</p>}
            </section>

            <section className="analytics-card" aria-labelledby="analytics-category-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-category-title">Spending by category</h2><p>Expenses in {monthLabel(month)}</p></div></div>
              {hasRecordedSpending
                ? <div className="analytics-category-list" role="list" aria-label="Expense totals by category">
                  {categorySpending.map((item) => <div className="analytics-category-row" role="listitem" key={item.categoryId}>
                    <div><strong>{item.categoryName}</strong><span>{formatCurrency(item.spent, currency)}</span></div>
                    <div className="analytics-category-track"><span style={{ width: maximumCategorySpend > 0 ? item.spent / maximumCategorySpend * 100 + '%' : '0%' }} /></div>
                  </div>)}
                </div>
                : <p className="analytics-chart-empty">No expenses recorded for this month.</p>}
            </section>

            <section className="analytics-card analytics-daily-card" aria-labelledby="analytics-daily-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-daily-title">Daily spending</h2><p>Expense totals by transaction date</p></div></div>
              {hasRecordedSpending
                ? <DailySpendingChart month={month} rows={dailySpending} currency={currency} />
                : <p className="analytics-chart-empty">Add an expense to see the daily pattern.</p>}
            </section>

            <section className="analytics-card" aria-labelledby="analytics-insights-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-insights-title">Smart insights</h2><p>Deterministic observations from your data</p></div></div>
              {insights.length > 0
                ? <ul className="analytics-insight-list">{insights.map((insight) => <li className={insight.tone === 'attention' ? 'is-attention' : ''} key={insight.id}><span aria-hidden="true">{insight.tone === 'attention' ? '!' : '✳'}</span><div><strong>{insight.title}</strong><p>{insight.detail}</p></div></li>)}</ul>
                : <p className="analytics-chart-empty">More activity is needed before SpendWise can identify reliable patterns.</p>}
            </section>

            <section className="analytics-card" aria-labelledby="analytics-budget-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-budget-title">Budget usage</h2><p>Spending against {monthLabel(month)} limits</p></div><Link to="/dashboard/budgets">Manage budgets →</Link></div>
              {budgets.length > 0
                ? <div className="analytics-category-list">
                  {budgets.map((budget) => {
                    const limit = Number(budget.amount)
                    const spent = spendingByCategory[budget.category_id] ?? 0
                    const percent = limit > 0 ? spent / limit * 100 : 0
                    return <div className="analytics-category-row" key={budget.id}>
                      <div><strong>{budget.category?.name || 'Expense category'}</strong><span>{Math.round(percent)}% · {formatCurrency(spent, currency)} / {formatCurrency(limit, currency)}</span></div>
                      <div className={'analytics-category-track' + (percent >= 100 ? ' is-over' : percent >= 80 ? ' is-near' : '')}><span style={{ width: Math.min(100, percent) + '%' }} /></div>
                    </div>
                  })}
                </div>
                : <div className="analytics-empty-inline"><p>No budgets set for this month.</p><Link to="/dashboard/budgets">Create a budget</Link></div>}
            </section>

            <section className="analytics-card" aria-labelledby="analytics-largest-title">
              <div className="analytics-card-heading"><div><h2 id="analytics-largest-title">Largest expenses</h2><p>Highest single expense records for {monthLabel(month)}</p></div></div>
              {largestExpenses.length > 0
                ? <ul className="largest-expense-list">{largestExpenses.map((expense) => <li key={expense.id}><div><strong>{expense.description || expense.category}</strong><span>{expense.category} · {formatTransactionDate(expense.date)}</span></div><strong>{formatCurrency(expense.amount, currency)}</strong></li>)}</ul>
                : <p className="analytics-chart-empty">No expenses recorded for this month.</p>}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
