import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { formatCurrency, formatTransactionDate } from '../lib/formatCurrency.js'
import { listCategories } from '../services/categoryService.js'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../services/transactionService.js'

function todayAsInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function blankForm(type = 'expense') {
  return {
    type,
    amount: '',
    categoryId: '',
    description: '',
    transactionDate: todayAsInputValue(),
  }
}

function initialFilters() {
  return {
    search: '',
    type: '',
    categoryId: '',
    amount: '',
    fromDate: '',
    toDate: '',
    sort: 'newest',
  }
}

export default function Transactions() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(blankForm())

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true

    Promise.all([
      listCategories(user.id),
      listTransactions(user.id, filters, 0),
    ]).then(([categoryRows, transactionResult]) => {
      if (!active) return
      setCategories(categoryRows)
      setTransactions(transactionResult.transactions)
      setTotalCount(transactionResult.count)
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'Could not load your finance data.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [filters, user?.id])

  async function reloadTransactions({ append = false } = {}) {
    if (!user?.id) return
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError('')
    }

    try {
      const { transactions: rows, count } = await listTransactions(
        user.id,
        filters,
        append ? transactions.length : 0,
      )
      setTransactions((current) => append ? [...current, ...rows] : rows)
      setTotalCount(count)
    } catch (loadError) {
      setError(loadError?.message || 'Could not load transactions.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function updateFilter(key, value) {
    setLoading(true)
    setError('')
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setLoading(true)
    setError('')
    setFilters(initialFilters())
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(blankForm('expense'))
    setFormError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEditForm(transaction) {
    setEditingId(transaction.id)
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      categoryId: transaction.category_id,
      description: transaction.description ?? '',
      transactionDate: transaction.transaction_date,
    })
    setFormError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setFormError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!user?.id) return
    setSaving(true)
    setFormError('')
    setNotice('')

    try {
      const wasEditing = Boolean(editingId)
      if (wasEditing) await updateTransaction(user.id, editingId, form)
      else await createTransaction(user.id, form)
      closeForm()
      setNotice(wasEditing ? 'Transaction updated.' : 'Transaction added.')
      await reloadTransactions()
    } catch (saveError) {
      setFormError(saveError?.message || 'Could not save the transaction.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(transactionId) {
    if (!user?.id) return
    setDeletingId(transactionId)
    setError('')
    setNotice('')
    try {
      await deleteTransaction(user.id, transactionId)
      setDeleteId(null)
      setNotice('Transaction deleted.')
      await reloadTransactions()
    } catch (deleteError) {
      setDeleteId(null)
      setError(deleteError?.message || 'Could not delete the transaction.')
    } finally {
      setDeletingId(null)
    }
  }

  const categoriesForType = categories.filter((category) => category.type === form.type)
  const canLoadMore = transactions.length < totalCount
  const visibleFrom = totalCount === 0 ? 0 : 1
  const visibleTo = Math.min(transactions.length, totalCount)

  return (
    <section className="transactions-page">
      <div className="transactions-heading">
        <div>
          <p className="eyebrow">YOUR MONEY, IN VIEW</p>
          <h1>Transactions</h1>
          <p className="transactions-description">Keep income and spending organized, one entry at a time.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreateForm}>＋ Add transaction</button>
      </div>

      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}

      {formOpen && (
        <section className="transaction-form-card" aria-labelledby="transaction-form-title">
          <div className="transaction-form-heading">
            <div>
              <p className="eyebrow">{editingId ? 'UPDATE ENTRY' : 'NEW ENTRY'}</p>
              <h2 id="transaction-form-title">{editingId ? 'Edit transaction' : 'Add a transaction'}</h2>
            </div>
            <button className="icon-button" type="button" onClick={closeForm} aria-label="Close transaction form">×</button>
          </div>

          {formError && <p className="inline-error" role="alert">{formError}</p>}
          <form className="transaction-form" onSubmit={submitForm}>
            <label className="data-field">
              <span>Type</span>
              <select required value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, categoryId: '' }))}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="data-field">
              <span>Amount</span>
              <input type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
            </label>
            <label className="data-field">
              <span>Category</span>
              <select required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Choose a category</option>
                {categoriesForType.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="data-field">
              <span>Date</span>
              <input type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
            </label>
            <label className="data-field data-field-wide">
              <span>Description <span className="optional-label">optional</span></span>
              <input type="text" maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What was this for?" />
            </label>
            <div className="transaction-form-actions">
              <button className="button button-primary" type="submit" disabled={saving || categoriesForType.length === 0}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save transaction'}</button>
              <button className="button button-quiet" type="button" onClick={closeForm} disabled={saving}>Cancel</button>
            </div>
            {categoriesForType.length === 0 && <p className="form-hint">There are no {form.type} categories yet. Add a category first.</p>}
          </form>
        </section>
      )}

      <section className="transaction-list-card">
        <div className="transaction-list-heading">
          <div>
            <h2>All transactions</h2>
            <p>{loading ? 'Loading your records…' : 'Showing ' + visibleFrom + '–' + visibleTo + ' of ' + totalCount}</p>
          </div>
        </div>

        <div className="transaction-filters">
          <label className="filter-field filter-search">
            <span>Search description</span>
            <input type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="e.g. groceries" />
          </label>
          <label className="filter-field">
            <span>Type</span>
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
              <option value="">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Category</span>
            <select value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.type}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Amount equals</span>
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={filters.amount} onChange={(event) => updateFilter('amount', event.target.value)} placeholder="Any amount" />
          </label>
          <label className="filter-field">
            <span>From</span>
            <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} />
          </label>
          <label className="filter-field">
            <span>To</span>
            <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Sort by</span>
            <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-high">Amount: high to low</option>
              <option value="amount-low">Amount: low to high</option>
            </select>
          </label>
          <button className="filter-reset" type="button" onClick={clearFilters}>Clear filters</button>
        </div>

        {error && !loading && <div className="transaction-empty"><span className="empty-state-icon" aria-hidden="true">!</span><h3>We couldn’t load your transactions.</h3><p>Check your connection and try again.</p><button className="button button-quiet" type="button" onClick={() => reloadTransactions()}>Try again</button></div>}

        {loading && <div className="transaction-loading"><span className="auth-spinner" aria-hidden="true" /><span>Loading transactions…</span></div>}

        {!loading && !error && transactions.length === 0 && (
          <div className="transaction-empty">
            <span className="empty-state-icon" aria-hidden="true">↗</span>
            <h3>{totalCount ? 'No matching transactions.' : 'No transactions yet.'}</h3>
            <p>{totalCount ? 'Try changing or clearing your filters.' : 'Add your first income or expense to start your money history.'}</p>
            {totalCount === 0 && <button className="button button-primary" type="button" onClick={openCreateForm}>Add your first transaction</button>}
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <>
            <div className="transaction-table-wrap">
              <table className="transaction-table">
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Type</th><th scope="col" className="amount-cell">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="date-cell">{formatTransactionDate(transaction.transaction_date)}</td>
                      <td className="description-cell">{transaction.description || <span className="muted-cell">No description</span>}</td>
                      <td><span className="category-pill">{transaction.category?.name || 'Uncategorized'}</span></td>
                      <td><span className={'type-pill type-' + transaction.type}>{transaction.type === 'income' ? 'Income' : 'Expense'}</span></td>
                      <td className={'amount-cell amount-' + transaction.type}>{transaction.type === 'expense' ? '−' : '+'}{formatCurrency(transaction.amount)}</td>
                      <td className="row-actions">
                        {deleteId === transaction.id ? (
                          <span className="delete-confirm"><span>Delete?</span><button type="button" onClick={() => confirmDelete(transaction.id)} disabled={deletingId === transaction.id}>{deletingId === transaction.id ? 'Deleting…' : 'Yes'}</button><button type="button" onClick={() => setDeleteId(null)} disabled={deletingId === transaction.id}>No</button></span>
                        ) : (
                          <>
                            <button className="row-action" type="button" onClick={() => openEditForm(transaction)}>Edit</button>
                            <button className="row-action row-action-delete" type="button" onClick={() => setDeleteId(transaction.id)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canLoadMore && <div className="load-more-row"><button className="button button-quiet" type="button" onClick={() => reloadTransactions({ append: true })} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more transactions'}</button></div>}
          </>
        )}
      </section>
    </section>
  )
}
