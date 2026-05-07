import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'

type Customer = {
  id: number
  name: string
  phone: string | null
}

type LedgerEntry = {
  id: number
  item_id: number | null
  item_name: string
  quantity: number
  rate: number | null
  amount: number
  unit: string | null
  entry_type: 'debit' | 'credit'
  affects_balance: number
  note: string | null
  created_at: string
}

type Summary = {
  balance: number
  totalDebit: number
  totalCredit: number
}

type Aging = {
  current: number
  days30: number
  days60: number
  days90: number
  older: number
}

type Category = { id: number; name: string }
type Brand = { id: number; name: string; category_id: number }
type Item = {
  id: number
  name: string
  category_id: number
  brand_id: number
  default_rate: number | null
  unit: string | null
}

type AuditLog = {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  summary: string
  created_at: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const apiUrl = (path: string) => {
  if (!apiBaseUrl) {
    return path
  }
  return `${apiBaseUrl}${path}`
}

const requestJson = async <T,>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const response = await fetch(apiUrl(url), options)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const getDownloadFilename = (response: Response, fallback: string) => {
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] || fallback
}

const downloadFile = async (
  url: string,
  fallbackFileName: string,
  retries = 1
) => {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(apiUrl(url))

    if (response.ok) {
      const blob = await response.blob()
      const fileName = getDownloadFilename(response, fallbackFileName)
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
      return
    }

    if ((response.status === 502 || response.status === 503) && attempt < retries) {
      await wait(2500)
      continue
    }

    let message = 'Download failed'
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = (await response.json()) as { error?: string }
      message = data.error || message
    } else if (response.status === 502 || response.status === 503) {
      message = 'Server wake ho raha hai, 5-10 second baad dubara try karein'
    }

    lastError = new Error(message)
    break
  }

  throw lastError || new Error('Download failed')
}

const FieldLabel = ({ label }: { label: string }) => (
  <span className="field-label">{label}</span>
)

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
}) => (
  <label className="field">
    <FieldLabel label={label} />
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  </label>
)

const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
}) => (
  <label className="field">
    <FieldLabel label={label} />
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder || 'Select'}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
)

function App() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  )
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [aging, setAging] = useState<Aging | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [adminItems, setAdminItems] = useState<Item[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const [entryType, setEntryType] = useState<'debit' | 'credit'>('debit')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [entryQuantity, setEntryQuantity] = useState('')
  const [entryRate, setEntryRate] = useState('')
  const [entryUnit, setEntryUnit] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [isCashSale, setIsCashSale] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandCategoryId, setBrandCategoryId] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemBrandId, setItemBrandId] = useState('')
  const [itemRate, setItemRate] = useState('')
  const [itemUnit, setItemUnit] = useState('')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [downloadTarget, setDownloadTarget] = useState<null | 'customers' | 'ledger'>(null)

  const totalRow = useMemo(() => {
    const qty = entries.reduce(
      (sum, entry) =>
        entry.affects_balance === 1 ? sum + Number(entry.quantity || 0) : sum,
      0
    )
    const amount = entries.reduce((sum, entry) => {
      if (entry.affects_balance !== 1) {
        return sum
      }
      const signed = entry.entry_type === 'credit' ? -entry.amount : entry.amount
      return sum + Number(signed || 0)
    }, 0)
    return { qty, amount }
  }, [entries])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }))
  const brandOptions = brands.map((brand) => ({
    value: String(brand.id),
    label: brand.name,
  }))
  const adminBrandOptions = allBrands
    .filter((brand) => (itemCategoryId ? String(brand.category_id) === itemCategoryId : true))
    .map((brand) => ({
      value: String(brand.id),
      label: brand.name,
    }))
  const itemOptions = items.map((item) => ({
    value: String(item.id),
    label: `${item.name}${item.unit ? ` (${item.unit})` : ''}`,
  }))

  const loadCustomers = async () => {
    const data = await requestJson<Customer[]>('/api/customers')
    setCustomers(data)
  }

  const getWhatsappLink = (customer: Customer, balanceValue: number) => {
    const phone = (customer.phone || '').replace(/\D/g, '')
    if (!phone) {
      throw new Error('Customer phone number required for WhatsApp reminder')
    }

    const message = [
      `Namaste ${customer.name},`,
      `Aapka baki balance Rs. ${balanceValue.toFixed(2)} hai.`,
      'Kripya apna khata clear kar dein.',
      'Dhanyavaad.',
    ].join(' ')

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }

  const sendWhatsappReminder = (customer: Customer, balanceValue: number) => {
    if (balanceValue <= 0) {
      alert('Is customer ka outstanding balance nahi hai')
      return
    }

    try {
      const link = getWhatsappLink(customer, balanceValue)
      window.open(link, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const loadLedger = async (customerId: number) => {
    const [entriesData, summaryData, agingData] = await Promise.all([
      requestJson<LedgerEntry[]>(`/api/customers/${customerId}/entries`),
      requestJson<Summary>(`/api/customers/${customerId}/summary`),
      requestJson<Aging>(`/api/customers/${customerId}/aging`),
    ])
    setEntries(entriesData)
    setSummary(summaryData)
    setAging(agingData)
  }

  const loadCategories = async () => {
    const data = await requestJson<Category[]>('/api/categories')
    setCategories(data)
  }

  const loadBrands = async (categoryId?: string) => {
    if (!categoryId) {
      setBrands([])
      return
    }
    const data = await requestJson<Brand[]>(`/api/brands?categoryId=${categoryId}`)
    setBrands(data)
  }

  const loadAllBrands = async () => {
    const data = await requestJson<Brand[]>('/api/brands')
    setAllBrands(data)
  }

  const loadItems = async (categoryId?: string, brandId?: string) => {
    const params = new URLSearchParams()
    if (categoryId) params.set('categoryId', categoryId)
    if (brandId) params.set('brandId', brandId)
    const query = params.toString()
    const data = await requestJson<Item[]>(`/api/items${query ? `?${query}` : ''}`)
    setItems(data)
  }

  const loadAdminItems = async () => {
    const data = await requestJson<Item[]>('/api/items')
    setAdminItems(data)
  }

  const loadAuditLogs = async () => {
    const data = await requestJson<AuditLog[]>('/api/audit-logs?limit=40')
    setAuditLogs(data)
  }

  useEffect(() => {
    loadCustomers()
    loadCategories()
    loadAllBrands()
    loadAdminItems()
    loadAuditLogs()
  }, [])

  useEffect(() => {
    loadBrands(selectedCategoryId)
    setSelectedBrandId('')
    setSelectedItemId('')
    setItems([])
  }, [selectedCategoryId])

  useEffect(() => {
    loadItems(selectedCategoryId, selectedBrandId)
    setSelectedItemId('')
  }, [selectedBrandId, selectedCategoryId])

  useEffect(() => {
    const item = items.find((entry) => String(entry.id) === selectedItemId)
    if (item) {
      setEntryRate(item.default_rate ? String(item.default_rate) : '')
      setEntryUnit(item.unit || '')
    } else {
      setEntryRate('')
      setEntryUnit('')
    }
  }, [items, selectedItemId])

  useEffect(() => {
    if (!itemCategoryId) {
      setItemBrandId('')
      return
    }
    if (itemBrandId) {
      const stillValid = allBrands.some(
        (brand) => String(brand.id) === itemBrandId && String(brand.category_id) === itemCategoryId
      )
      if (!stillValid) {
        setItemBrandId('')
      }
    }
  }, [itemCategoryId, itemBrandId, allBrands])

  const handleCustomerSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!customerName.trim()) {
      return
    }
    try {
      await requestJson('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName, phone: customerPhone }),
      })
      setCustomerName('')
      setCustomerPhone('')
      await loadCustomers()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    setSelectedCustomerName(customer.name)
    await loadLedger(customer.id)
  }

  const handlePaymentSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedCustomerId) {
      alert('Select a customer first')
      return
    }
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Payment amount must be positive')
      return
    }
    try {
      await requestJson(`/api/customers/${selectedCustomerId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: 'credit',
          itemName: 'Payment',
          quantity: 1,
          rate: amount,
          affectsBalance: true,
          note: paymentNote,
        }),
      })
      setPaymentAmount('')
      setPaymentNote('')
      await loadLedger(selectedCustomerId)
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleEntrySubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedCustomerId) {
      alert('Select a customer first')
      return
    }
    if (!selectedItemId) {
      alert('Item selection required')
      return
    }
    const quantity = Number(entryQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Quantity should be required')
      return
    }
    const rate = entryRate ? Number(entryRate) : 0
    if (!Number.isFinite(rate) || rate < 0) {
      alert('Rate should not be negative')
      return
    }

    const item = items.find((entry) => String(entry.id) === selectedItemId)
    if (!item) {
      alert('Invalid item selection')
      return
    }

    const isPaidNowSale = entryType === 'credit' || isCashSale

    try {
      await requestJson(`/api/customers/${selectedCustomerId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType,
          itemId: item.id,
          itemName: item.name,
          quantity,
          rate,
          unit: entryUnit,
          affectsBalance: !isPaidNowSale,
          note: entryNote,
        }),
      })
      setEntryQuantity('')
      setEntryNote('')
      setIsCashSale(false)
      await loadLedger(selectedCustomerId)
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!categoryName.trim()) return
    try {
      await requestJson('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      })
      setCategoryName('')
      await loadCategories()
      await loadAllBrands()
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleAddBrand = async (event: FormEvent) => {
    event.preventDefault()
    if (!brandName.trim() || !brandCategoryId) return
    try {
      await requestJson('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName,
          categoryId: Number(brandCategoryId),
        }),
      })
      setBrandName('')
      await loadBrands(brandCategoryId)
      await loadAllBrands()
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleItemSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!itemName.trim() || !itemCategoryId || !itemBrandId) {
      alert('Item, category, and brand required')
      return
    }
    const defaultRate = itemRate ? Number(itemRate) : null
    if (defaultRate !== null && (!Number.isFinite(defaultRate) || defaultRate < 0)) {
      alert('Rate should not be negative')
      return
    }

    try {
      const method = editingItemId ? 'PUT' : 'POST'
      const url = editingItemId ? `/api/items/${editingItemId}` : '/api/items'
      await requestJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName,
          categoryId: Number(itemCategoryId),
          brandId: Number(itemBrandId),
          defaultRate: defaultRate === null ? undefined : defaultRate,
          unit: itemUnit,
        }),
      })
      setItemName('')
      setItemCategoryId('')
      setItemBrandId('')
      setItemRate('')
      setItemUnit('')
      setEditingItemId(null)
      await loadItems()
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleItemEdit = (item: Item) => {
    setEditingItemId(item.id)
    setItemName(item.name)
    setItemCategoryId(String(item.category_id))
    setItemBrandId(String(item.brand_id))
    setItemRate(item.default_rate ? String(item.default_rate) : '')
    setItemUnit(item.unit || '')
  }

  const handleItemDelete = async (itemId: number) => {
    const ok = window.confirm('Delete this item?')
    if (!ok) return
    try {
      await fetch(apiUrl(`/api/items/${itemId}`), { method: 'DELETE' })
      await loadItems()
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleCustomersCsvDownload = async () => {
    try {
      setDownloadTarget('customers')
      await downloadFile('/api/export/customers.csv', 'customers-summary.csv', 1)
    } catch (error) {
      alert((error as Error).message)
    } finally {
      setDownloadTarget(null)
    }
  }

  const handleCustomerLedgerCsvDownload = async () => {
    if (!selectedCustomerId) {
      alert('Select a customer first')
      return
    }

    try {
      setDownloadTarget('ledger')
      await downloadFile(
        `/api/export/customers/${selectedCustomerId}/ledger.csv`,
        `customer-${selectedCustomerId}-ledger.csv`,
        1
      )
    } catch (error) {
      alert((error as Error).message)
    } finally {
      setDownloadTarget(null)
    }
  }

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>()
    categories.forEach((category) => map.set(category.id, category.name))
    return map
  }, [categories])

  const brandMap = useMemo(() => {
    const map = new Map<number, string>()
    allBrands.forEach((brand) => map.set(brand.id, brand.name))
    return map
  }, [allBrands])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Khata Manager</h1>
        <p>Hinglish UI: customers ka khata, entries, aur aging summary.</p>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Customer List</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCustomersCsvDownload}
              disabled={downloadTarget !== null}
            >
              {downloadTarget === 'customers' ? 'Preparing CSV...' : 'Download All (CSV)'}
            </button>
          </div>
          <form className="form-row" onSubmit={handleCustomerSubmit}>
            <TextField
              label="Customer name"
              value={customerName}
              onChange={setCustomerName}
              placeholder="Customer name"
            />
            <TextField
              label="Phone (optional)"
              value={customerPhone}
              onChange={setCustomerPhone}
              placeholder="Phone"
            />
            <button type="submit">Add Customer</button>
          </form>
          <ul className="list">
            {customers.map((customer) => (
              <li
                key={customer.id}
                className={`list-item${
                  selectedCustomerId === customer.id ? ' selected' : ''
                }`}
                onClick={() => handleSelectCustomer(customer)}
              >
                <div className="list-item-content">
                  <span>{customer.name}</span>
                  <span className="muted">{customer.phone || ''}</span>
                </div>
                <button
                  type="button"
                  className="btn-whatsapp"
                  onClick={(event) => {
                    event.stopPropagation()
                    const customerSummary = selectedCustomerId === customer.id && summary
                      ? summary
                      : null
                    const balanceValue = customerSummary?.balance ?? 0
                    if (selectedCustomerId !== customer.id) {
                      alert('Pehle is customer ko select karke uska current balance load kar lo')
                      return
                    }
                    sendWhatsappReminder(customer, balanceValue)
                  }}
                >
                  WhatsApp
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Khata Entry</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCustomerLedgerCsvDownload}
              disabled={downloadTarget !== null}
            >
              {downloadTarget === 'ledger'
                ? 'Preparing CSV...'
                : 'Download Customer (CSV)'}
            </button>
          </div>
          <div className="summary">
            {selectedCustomerId
              ? `Selected: ${selectedCustomerName}`
              : 'Select a customer.'}
          </div>

          {selectedCustomer && summary ? (
            <div className="reminder-bar">
              <span>
                Outstanding reminder: Rs. {summary.balance.toFixed(2)}
              </span>
              <button
                type="button"
                className="btn-whatsapp"
                onClick={() => sendWhatsappReminder(selectedCustomer, summary.balance)}
              >
                Send WhatsApp Reminder
              </button>
            </div>
          ) : null}

          <form className="form-row" onSubmit={handlePaymentSubmit}>
            <TextField
              label="Payment amount"
              value={paymentAmount}
              onChange={setPaymentAmount}
              type="number"
              placeholder="Payment amount"
            />
            <TextField
              label="Payment note"
              value={paymentNote}
              onChange={setPaymentNote}
              placeholder="Payment note"
            />
            <button type="submit">Add Payment</button>
          </form>

          <form className="form-grid" onSubmit={handleEntrySubmit}>
            <SelectField
              label="Entry type"
              value={entryType}
              onChange={(value) => setEntryType(value as 'debit' | 'credit')}
              options={[
                { value: 'debit', label: 'Udhaar (Debit)' },
                { value: 'credit', label: 'Payment (Credit)' },
              ]}
            />
            <SelectField
              label="Category"
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              options={categoryOptions}
              placeholder="Select category"
            />
            <SelectField
              label="Brand"
              value={selectedBrandId}
              onChange={setSelectedBrandId}
              options={brandOptions}
              placeholder="Select brand"
              disabled={!selectedCategoryId}
            />
            <SelectField
              label="Item"
              value={selectedItemId}
              onChange={setSelectedItemId}
              options={itemOptions}
              placeholder="Select item"
              disabled={!selectedBrandId}
            />
            <TextField
              label="Quantity"
              value={entryQuantity}
              onChange={setEntryQuantity}
              type="number"
              placeholder="Quantity"
            />
            <TextField
              label="Rate"
              value={entryRate}
              onChange={setEntryRate}
              type="number"
              placeholder="Rate"
            />
            <TextField
              label="Unit"
              value={entryUnit}
              onChange={setEntryUnit}
              placeholder="Unit"
              disabled
            />
            <TextField
              label="Note"
              value={entryNote}
              onChange={setEntryNote}
              placeholder="Note"
            />
            <label className="checkbox-field span-two">
              <input
                type="checkbox"
                checked={isCashSale}
                onChange={(event) => setIsCashSale(event.target.checked)}
                disabled={entryType !== 'debit'}
              />
              <span>
                Cash sale (debit entry ko ledger me dikhaye, outstanding me na jaye)
              </span>
            </label>
            <button type="submit" className="span-two">
              Add Entry
            </button>
          </form>

          <div className="summary-block">
            {summary && (
              <div>
                Balance: {summary.balance.toFixed(2)} | Debit:{' '}
                {summary.totalDebit.toFixed(2)} | Credit:{' '}
                {summary.totalCredit.toFixed(2)}
              </div>
            )}
            {aging && (
              <div className="muted">
                Aging: Current {aging.current.toFixed(2)}, 0-30{' '}
                {aging.days30.toFixed(2)}, 31-60 {aging.days60.toFixed(2)},
                61-90 {aging.days90.toFixed(2)}, 90+ {aging.older.toFixed(2)}
              </div>
            )}
          </div>

          <h3>Ledger Entries</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.created_at}</td>
                    <td>
                      {entry.entry_type}
                      {entry.affects_balance === 0 ? (
                        <span className="cash-tag">cash</span>
                      ) : null}
                    </td>
                    <td>
                      {entry.item_name}{' '}
                      {entry.unit ? <span className="muted">({entry.unit})</span> : null}
                    </td>
                    <td>{entry.quantity}</td>
                    <td>{entry.rate ?? '-'}</td>
                    <td>{entry.amount.toFixed(2)}</td>
                    <td>{entry.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td>{totalRow.qty.toFixed(2)}</td>
                  <td>-</td>
                  <td>{totalRow.amount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="panel admin-panel">
          <div className="panel-header">
            <h2>Admin Item Management</h2>
          </div>
          <div className="admin-grid">
            <form className="form-row" onSubmit={handleAddCategory}>
              <TextField
                label="New category"
                value={categoryName}
                onChange={setCategoryName}
                placeholder="Category name"
              />
              <button type="submit">Add Category</button>
            </form>

            <form className="form-row" onSubmit={handleAddBrand}>
              <TextField
                label="New brand"
                value={brandName}
                onChange={setBrandName}
                placeholder="Brand name"
              />
              <SelectField
                label="Category"
                value={brandCategoryId}
                onChange={setBrandCategoryId}
                options={categoryOptions}
                placeholder="Select category"
              />
              <button type="submit">Add Brand</button>
            </form>

            <form className="form-grid" onSubmit={handleItemSubmit}>
              <TextField
                label="Item name"
                value={itemName}
                onChange={setItemName}
                placeholder="Item name"
              />
              <SelectField
                label="Category"
                value={itemCategoryId}
                onChange={setItemCategoryId}
                options={categoryOptions}
                placeholder="Select category"
              />
              <SelectField
                label="Brand"
                value={itemBrandId}
                onChange={setItemBrandId}
                options={adminBrandOptions}
                placeholder="Select brand"
                disabled={!itemCategoryId}
              />
              <TextField
                label="Default rate"
                value={itemRate}
                onChange={setItemRate}
                type="number"
                placeholder="Rate"
              />
              <TextField
                label="Unit"
                value={itemUnit}
                onChange={setItemUnit}
                placeholder="Unit"
              />
              <button type="submit" className="span-two">
                {editingItemId ? 'Update Item' : 'Add Item'}
              </button>
              {editingItemId && (
                <button
                  type="button"
                  className="btn-secondary span-two"
                  onClick={() => {
                    setEditingItemId(null)
                    setItemName('')
                    setItemCategoryId('')
                    setItemBrandId('')
                    setItemRate('')
                    setItemUnit('')
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Rate</th>
                  <th>Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{categoryMap.get(item.category_id) || ''}</td>
                    <td>{brandMap.get(item.brand_id) || ''}</td>
                    <td>{item.default_rate ?? '-'}</td>
                    <td>{item.unit ?? '-'}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleItemEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleItemDelete(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel admin-panel">
          <div className="panel-header">
            <h2>Audit Logs</h2>
            <button type="button" className="btn-secondary" onClick={loadAuditLogs}>
              Refresh Logs
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.created_at}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ''}
                    </td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
