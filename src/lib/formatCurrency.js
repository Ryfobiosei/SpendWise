const LOCALES_BY_CURRENCY = {
  GHS: 'en-GH',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
}

export function formatCurrency(amount, currency = 'GHS') {
  const safeCurrency = ['GHS', 'USD', 'EUR', 'GBP'].includes(currency) ? currency : 'GHS'
  return new Intl.NumberFormat(LOCALES_BY_CURRENCY[safeCurrency], {
    style: 'currency',
    currency: safeCurrency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)
}

export function formatTransactionDate(date) {
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'))
}
