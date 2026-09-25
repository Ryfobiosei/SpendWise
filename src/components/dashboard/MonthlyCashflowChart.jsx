import { formatCurrency } from '../../lib/formatCurrency.js'

function shortMonth(date) {
  return new Intl.DateTimeFormat('en-GH', { month: 'short' }).format(new Date(date + 'T12:00:00'))
}

function fullMonth(date) {
  return new Intl.DateTimeFormat('en-GH', { month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'))
}

export default function MonthlyCashflowChart({ rows, currency = 'GHS' }) {
  const largest = Math.max(0, ...rows.flatMap((row) => [row.income, row.expenses]))
  const chartSummary = rows.map((row) => (
    fullMonth(row.month) + ': income ' + formatCurrency(row.income, currency) + ', expenses ' + formatCurrency(row.expenses, currency)
  )).join('; ')

  return (
    <div className="cashflow-chart" role="img" aria-label={'Monthly income and expense totals. ' + chartSummary}>
      <div className="cashflow-chart-columns">
        {rows.map((row) => (
          <div className="cashflow-month-column" key={row.month}>
            <div className="cashflow-bars">
              <span className="cashflow-bar cashflow-bar-income" title={'Income: ' + formatCurrency(row.income, currency)} style={{ height: largest > 0 ? Math.max(row.income > 0 ? 3 : 0, row.income / largest * 100) + '%' : '0%' }} />
              <span className="cashflow-bar cashflow-bar-expenses" title={'Expenses: ' + formatCurrency(row.expenses, currency)} style={{ height: largest > 0 ? Math.max(row.expenses > 0 ? 3 : 0, row.expenses / largest * 100) + '%' : '0%' }} />
            </div>
            <span className="cashflow-month-label">{shortMonth(row.month)}</span>
          </div>
        ))}
      </div>
      <div className="cashflow-legend" aria-hidden="true">
        <span><i className="cashflow-legend-income" />Income</span>
        <span><i className="cashflow-legend-expenses" />Expenses</span>
      </div>
    </div>
  )
}
