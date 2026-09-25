import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/useAuth.js'
import { formatCurrency } from '../lib/formatCurrency.js'
import { listCategories } from '../services/categoryService.js'
import { getProfile } from '../services/profileService.js'
import {
  createBudget,
  deleteBudget,
  getBudgetSpending,
  listBudgets,
  updateBudget,
} from '../services/budgetService.js'

function localCurrentMonth() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
}

function emptyForm(month) {
  return { categoryId: '', amount: '', budgetMonth: month }
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-GH', { month: 'long', year: 'numeric' })
    .format(new Date(month + '-01T12:00:00'))
}

export default function Budgets() {
  const { user } = useAuth()
  const [month, setMonth] = useState(localCurrentMonth)
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [spendingByCategory, setSpendingByCategory] = useState({})
  const [currency, setCurrency] = useState('GHS')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(() => emptyForm(localCurrentMonth()))
  const formCardRef = useRef(null)
  const categorySelectRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true

    Promise.all([
      listBudgets(user.id, month),
      listCategories(user.id, 'expense'),
      getBudgetSpending(user.id, month),
      getProfile(user.id),
    ]).then(([budgetRows, categoryRows, spending, profile]) => {
      if (!active) return
      setBudgets(budgetRows)
      setCategories(categoryRows)
      setSpendingByCategory(spending)
      setCurrency(profile.currency || 'GHS')
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'Could not load your budget data.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [month, refreshVersion, user?.id])

  useEffect(() => {
    if (!formOpen) return undefined

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      formCardRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      categorySelectRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editingId, formOpen])

  function openCreateForm() {
    setEditingId(null)
    setForm(emptyForm(month))
    setFormError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEditForm(budget) {
    setEditingId(budget.id)
    setForm({
      categoryId: budget.category_id,
      amount: String(budget.amount),
      budgetMonth: budget.budget_month.slice(0, 7),
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

  function changeMonth(value) {
    setLoading(true)
    setMonth(value)
    setFormOpen(false)
    setEditingId(null)
    setDeleteId(null)
    setNotice('')
    setError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!user?.id) return
    setSaving(true)
    setFormError('')
    setNotice('')

    try {
      const wasEditing = Boolean(editingId)
      if (wasEditing) await updateBudget(user.id, editingId, form)
      else await createBudget(user.id, form)
      closeForm()
      setNotice(wasEditing ? 'Budget updated.' : 'Budget created.')
      setLoading(true)
      setRefreshVersion((version) => version + 1)
    } catch (saveError) {
      setFormError(saveError?.message || 'Could not save the budget.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(budgetId) {
    if (!user?.id) return
    setDeletingId(budgetId)
    setError('')
    setNotice('')
    try {
      await deleteBudget(user.id, budgetId)
      setDeleteId(null)
      setNotice('Budget deleted.')
      setLoading(true)
      setRefreshVersion((version) => version + 1)
    } catch (deleteError) {
      setDeleteId(null)
      setError(deleteError?.message || 'Could not delete the budget.')
    } finally {
      setDeletingId(null)
    }
  }

  function retryLoading() {
    setLoading(true)
    setError('')
    setRefreshVersion((version) => version + 1)
  }

  const totalBudget = budgets.reduce((total, budget) => total + Number(budget.amount), 0)
  const trackedSpending = budgets.reduce((total, budget) => (
    total + (spendingByCategory[budget.category_id] ?? 0)
  ), 0)
  const totalRemaining = totalBudget - trackedSpending
  const usedCategories = new Set(budgets
    .filter((budget) => budget.id !== editingId)
    .map((budget) => budget.category_id))
  const availableCategories = categories.filter((category) => (
    !usedCategories.has(category.id) || category.id === form.categoryId
  ))

  return (
    <section className="budgets-page">
      <div className="budgets-heading">
        <div>
          <p className="eyebrow">PLAN WITH PURPOSE</p>
          <h1>Budgets</h1>
          <p className="budgets-description">Set a monthly limit for each expense category and keep an eye on what remains.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreateForm} disabled={categories.length === 0 || availableCategories.length === 0}>＋ Add budget</button>
      </div>
      {!loading && categories.length === 0 && <p className="budget-action-hint">Add an expense category before creating a budget. <Link to="/dashboard/categories">Manage categories</Link></p>}
      {!loading && categories.length > 0 && availableCategories.length === 0 && <p className="budget-action-hint">Every expense category has a budget for this month. Choose another month or add a category.</p>}

      <div className="budget-month-toolbar">
        <div>
          <span className="budget-month-label">MONTHLY OVERVIEW</span>
          <strong>{monthLabel(month)}</strong>
        </div>
        <label className="filter-field">
          <span>Choose month</span>
          <input type="month" value={month} onChange={(event) => event.target.value && changeMonth(event.target.value)} />
        </label>
      </div>

      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}

      <div className="budget-summary-grid" aria-label="Monthly budget summary">
        <article className="budget-summary-card">
          <span>Total planned</span>
          <strong>{loading ? '—' : formatCurrency(totalBudget, currency)}</strong>
          <small>{loading ? 'Loading…' : 'Across ' + budgets.length + (budgets.length === 1 ? ' budget' : ' budgets')}</small>
        </article>
        <article className="budget-summary-card">
          <span>Spent in budgeted categories</span>
          <strong>{loading ? '—' : formatCurrency(trackedSpending, currency)}</strong>
          <small>{loading ? 'Loading…' : 'Expenses recorded in ' + monthLabel(month)}</small>
        </article>
        <article className={'budget-summary-card' + (totalRemaining < 0 ? ' is-over' : '')}>
          <span>{totalRemaining < 0 ? 'Over planned total' : 'Remaining overall'}</span>
          <strong>{loading ? '—' : formatCurrency(Math.abs(totalRemaining), currency)}</strong>
          <small>{loading ? 'Loading…' : totalRemaining < 0 ? 'Across budgeted categories' : 'Across budgeted categories'}</small>
        </article>
      </div>

      {formOpen && (
        <section ref={formCardRef} className="budget-form-card" aria-labelledby="budget-form-title">
          <div className="transaction-form-heading">
            <div>
              <p className="eyebrow">{editingId ? 'UPDATE PLAN' : 'NEW PLAN'}</p>
              <h2 id="budget-form-title">{editingId ? 'Edit budget' : 'Create a budget'}</h2>
            </div>
            <button className="icon-button" type="button" onClick={closeForm} aria-label="Close budget form">×</button>
          </div>
          {formError && <p className="inline-error" role="alert">{formError}</p>}
          <form className="budget-form" onSubmit={submitForm}>
            <label className="data-field">
              <span>Expense category</span>
              <select ref={categorySelectRef} required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Choose a category</option>
                {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="data-field">
              <span>Monthly limit</span>
              <input type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
            </label>
            {availableCategories.length === 0 && <p className="budget-form-hint">All expense categories already have a budget for this month.</p>}
            <p className="budget-form-month">Budget month: <strong>{monthLabel(form.budgetMonth)}</strong></p>
            <div className="transaction-form-actions">
              <button className="button button-primary" type="submit" disabled={saving || availableCategories.length === 0}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create budget'}</button>
              <button className="button button-quiet" type="button" onClick={closeForm} disabled={saving}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="budget-list-card" aria-labelledby="budget-list-title">
        <div className="budget-list-heading">
          <div>
            <h2 id="budget-list-title">Category budgets</h2>
            <p>{loading ? 'Loading your plans…' : 'Usage for ' + monthLabel(month)}</p>
          </div>
          <span>{loading ? 'Loading…' : budgets.length + (budgets.length === 1 ? ' budget' : ' budgets')}</span>
        </div>

        {loading && <div className="transaction-loading"><span className="auth-spinner" aria-hidden="true" /><span>Loading budgets…</span></div>}

        {!loading && error && (
          <div className="budget-empty">
            <span className="empty-state-icon" aria-hidden="true">!</span>
            <h3>Budgets could not be loaded.</h3>
            <p>Check the database setup and your connection, then try again.</p>
            <button className="button button-quiet" type="button" onClick={retryLoading}>Try again</button>
          </div>
        )}

        {!loading && !error && budgets.length === 0 && (
          <div className="budget-empty">
            <span className="empty-state-icon" aria-hidden="true">◎</span>
            <h3>No budgets for {monthLabel(month)} yet.</h3>
            <p>Give an expense category a monthly limit to see how your spending is tracking.</p>
            {categories.length > 0
              ? <button className="button button-primary" type="button" onClick={openCreateForm}>Create your first budget</button>
              : <Link className="button button-primary" to="/dashboard/categories">Add an expense category</Link>}
          </div>
        )}

        {!loading && !error && budgets.length > 0 && (
          <div className="budget-card-grid">
            {budgets.map((budget) => {
              const limit = Number(budget.amount)
              const spent = spendingByCategory[budget.category_id] ?? 0
              const percent = limit > 0 ? (spent / limit) * 100 : 0
              const overLimit = spent > limit
              const statusClass = overLimit ? ' is-over' : percent >= 80 ? ' is-near' : ''
              const remaining = Math.abs(limit - spent)

              return (
                <article className="budget-card" key={budget.id}>
                  <div className="budget-card-heading">
                    <span className="budget-category-mark" aria-hidden="true">↘</span>
                    <div className="budget-card-title">
                      <h3>{budget.category?.name || 'Expense category'}</h3>
                      <span>Monthly limit</span>
                    </div>
                    <div className="budget-card-actions">
                      {deleteId === budget.id ? (
                        <span className="delete-confirm">
                          <span>Delete?</span>
                          <button type="button" onClick={() => confirmDelete(budget.id)} disabled={deletingId === budget.id}>{deletingId === budget.id ? 'Deleting…' : 'Yes'}</button>
                          <button type="button" onClick={() => setDeleteId(null)} disabled={deletingId === budget.id}>No</button>
                        </span>
                      ) : (
                        <>
                          <button className="row-action" type="button" onClick={() => openEditForm(budget)} aria-label={'Edit ' + (budget.category?.name || 'category') + ' budget'}>Edit</button>
                          <button className="row-action row-action-delete" type="button" onClick={() => setDeleteId(budget.id)} aria-label={'Delete ' + (budget.category?.name || 'category') + ' budget'}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="budget-card-amounts">
                    <strong>{formatCurrency(spent, currency)} <span>spent</span></strong>
                    <span>of {formatCurrency(limit, currency)}</span>
                  </div>
                  <div className={'budget-progress-track' + statusClass} role="progressbar" aria-label={(budget.category?.name || 'Category') + ' budget used'} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.round(percent))} aria-valuetext={Math.round(percent) + '% used'}>
                    <span style={{ width: Math.min(100, Math.max(0, percent)) + '%' }} />
                  </div>
                  <div className="budget-card-footer">
                    <span className={statusClass.trim()}>{Math.round(percent)}% used</span>
                    <strong className={overLimit ? 'budget-over-amount' : ''}>{overLimit ? 'Over by ' : 'Remaining '}{formatCurrency(remaining, currency)}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
