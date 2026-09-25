function monthName(month) {
  return new Intl.DateTimeFormat('en-GH', { month: 'long' })
    .format(new Date(month + '-01T12:00:00'))
}

export function buildSpendingInsights({ month, categorySpending = [], previousCategorySpending = [], budgets = [], spendingByCategory = {}, dailySpending = [] }) {
  const insights = []
  const previousById = new Map(previousCategorySpending.map((row) => [row.categoryId, row.spent]))

  for (const category of categorySpending) {
    const previous = previousById.get(category.categoryId) ?? 0
    if (previous > 0 && category.spent > previous * 1.1) {
      const change = Math.round(((category.spent - previous) / previous) * 100)
      insights.push({
        id: 'category-increase-' + category.categoryId,
        title: category.categoryName + ' spending is up ' + change + '%',
        detail: 'Compared with ' + monthName(previousMonth(month)) + ', you spent more in this category.',
        tone: 'attention',
      })
    }
  }

  for (const budget of budgets) {
    const spent = spendingByCategory[budget.category_id] ?? 0
    const limit = Number(budget.amount)
    if (limit > 0 && spent >= limit * 0.85) {
      const percent = Math.round((spent / limit) * 100)
      insights.push({
        id: 'budget-' + budget.id,
        title: (budget.category?.name || 'A category') + ' budget is ' + (percent >= 100 ? 'over its limit' : percent + '% used'),
        detail: percent >= 100 ? 'Spending is ' + percent + '% of the monthly limit.' : 'There is less than 15% of this monthly limit left.',
        tone: percent >= 100 ? 'attention' : 'steady',
      })
    }
  }

  if (categorySpending.length > 0) {
    const [largest] = categorySpending
    insights.push({
      id: 'largest-category',
      title: largest.categoryName + ' is your largest expense category',
      detail: 'You have recorded ' + largest.categoryName.toLocaleLowerCase() + ' expenses this month.',
      tone: 'steady',
    })
  }

  if (dailySpending.length > 0) {
    const total = dailySpending.reduce((sum, day) => sum + day.spent, 0)
    const weekend = dailySpending.reduce((sum, day) => {
      const dayOfWeek = new Date(day.date + 'T12:00:00').getDay()
      return dayOfWeek === 0 || dayOfWeek === 6 ? sum + day.spent : sum
    }, 0)
    if (total > 0) {
      insights.push({
        id: 'weekend-share',
        title: Math.round((weekend / total) * 100) + '% of recorded spending fell on weekends',
        detail: 'Based on the expense dates recorded for ' + monthName(month) + '.',
        tone: 'steady',
      })
    }
  }

  return insights.slice(0, 4)
}

function previousMonth(month) {
  const date = new Date(month + '-01T12:00:00')
  date.setMonth(date.getMonth() - 1)
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}
