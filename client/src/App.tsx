import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'

type Customer = {
  id: number
  name: string
  phone: string | null
  address: string | null
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
  stock_quantity: number
  low_stock_threshold: number
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [aging, setAging] = useState<Aging | null>(null)

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
const [editCustomerAddress, setEditCustomerAddress] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [entryType, setEntryType] = useState<'debit' | 'credit'>('debit')
  const [entryItemName, setEntryItemName] = useState('')
  const [entryQuantity, setEntryQuantity] = useState('')
  const [entryRate, setEntryRate] = useState('')
  const [entryUnit, setEntryUnit] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [isCashSale, setIsCashSale] = useState(false)
  const [customerSummaries, setCustomerSummaries] = useState<Record<number, Summary>>({})
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false)

  const [downloadTarget, setDownloadTarget] = useState<null | 'customers' | 'ledger'>(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

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

  const loadCustomers = async () => {
    const data = await requestJson<Customer[]>('/api/customers')
    setCustomers(data)
    
    // Load summaries for all customers to show dashboard stats
    const summaryPromises = data.map(async (customer) => {
      try {
        const s = await requestJson<Summary>(`/api/customers/${customer.id}/summary`)
        return { id: customer.id, summary: s }
      } catch (e) {
        return { id: customer.id, summary: { balance: 0, totalDebit: 0, totalCredit: 0 } }
      }
    })
    const loadedSummaries = await Promise.all(summaryPromises)
    const summaryMap: Record<number, Summary> = {}
    loadedSummaries.forEach(item => {
      summaryMap[item.id] = item.summary
    })
    setCustomerSummaries(summaryMap)
  }

  const dashboardStats = useMemo(() => {
    const totalOutstanding = Object.values(customerSummaries).reduce((sum, s) => sum + s.balance, 0)
    const topDebtors = customers
      .map(c => ({ 
        name: c.name, 
        balance: customerSummaries[c.id]?.balance || 0,
        id: c.id
      }))
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)

    return { totalOutstanding, topDebtors }
  }, [customers, customerSummaries])

  const getWhatsappLink = (customer: Customer, balanceValue: number) => {
    const message = [
      `Namaste ${customer.name},`,
      `Aapka baki balance Rs. ${balanceValue.toFixed(2)} hai.`,
      'Kripya apna khata clear kar dein.',
      'Dhanyavaad.',
    ].join(' ')

    return buildWhatsappLink(customer.phone || '', message)
  }

  const buildWhatsappLink = (phoneValue: string, message: string) => {
    const phone = phoneValue.replace(/\D/g, '')
    if (!phone) {
      throw new Error('Valid phone number required for WhatsApp')
    }

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

  const loadAuditLogs = async () => {
    const data = await requestJson<AuditLog[]>('/api/audit-logs?limit=40')
    setAuditLogs(data)
  }

  useEffect(() => {
    loadCustomers()
    loadAuditLogs()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      setEditCustomerName(selectedCustomer.name)
      setEditCustomerPhone(selectedCustomer.phone || '')
      setEditCustomerAddress(selectedCustomer.address || '')
    }
  }, [selectedCustomer])

  const handleCustomerSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!customerName.trim()) {
      return
    }
    try {
      await requestJson('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName, phone: customerPhone, address: customerAddress }),
      })
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      await loadCustomers()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const resetCustomerModalState = () => {
    setPaymentAmount('')
    setPaymentNote('')
    setEntryType('debit')
    setEntryItemName('')
    setEntryQuantity('')
    setEntryRate('')
    setEntryUnit('')
    setEntryNote('')
    setIsCashSale(false)
  }

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    setEntries([])
    setSummary(null)
    setAging(null)
    setIsCustomerModalOpen(true)
    setEditCustomerName(customer.name)
    setEditCustomerPhone(customer.phone || '')
    setEditCustomerAddress(customer.address || '')
    resetCustomerModalState()
    await loadLedger(customer.id)
  }

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false)
    resetCustomerModalState()
  }

  const handleCustomerUpdateSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedCustomerId) {
      return
    }

    try {
      await requestJson(`/api/customers/${selectedCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  name: editCustomerName,
  phone: editCustomerPhone,
  address: editCustomerAddress,
}),
      })
      await loadCustomers()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
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
    if (!entryItemName.trim()) {
      alert('Item name required')
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

    const isPaidNowSale = entryType === 'credit' || isCashSale

    try {
      await requestJson(`/api/customers/${selectedCustomerId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType,
          itemName: entryItemName,
          quantity,
          rate,
          unit: entryUnit,
          affectsBalance: !isPaidNowSale,
          note: entryNote,
        }),
      })
      setEntryItemName('')
      setEntryQuantity('')
      setEntryRate('')
      setEntryUnit('')
      setEntryNote('')
      setIsCashSale(false)
      await loadLedger(selectedCustomerId)
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleEntryDelete = async (entryId: number) => {
  const ok = window.confirm('Is entry ko delete karna chahte ho?')
  if (!ok) return
  try {
    await fetch(apiUrl(`/api/customers/${selectedCustomerId}/entries/${entryId}`), { method: 'DELETE' })
    await loadLedger(selectedCustomerId!)
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Khata Manager</h1>
        <p>Hello Lala Ji.</p>
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

                        <TextField
              label="Address (optional)"
              value={customerAddress}
              onChange={setCustomerAddress}
              placeholder="Address"
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
            <h2>Customer Dashboard</h2>
            {selectedCustomerId ? (
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
            ) : null}
          </div>

          <div className="inventory-overview-grid">
            <div 
              className="inventory-stat-card danger clickable-card"
              onClick={() => setIsOutstandingModalOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <span className="inventory-stat-label">Total Outstanding</span>
              <strong>Rs. {dashboardStats.totalOutstanding.toFixed(2)}</strong>
              <p>Sabhi customers ka milakar kul udhaar. (View All)</p>
            </div>
            {dashboardStats.topDebtors.map((debtor, index) => (
              <div 
                key={debtor.id} 
                className="inventory-stat-card warning clickable-card"
                onClick={() => {
                  const customer = customers.find(c => c.id === debtor.id);
                  if (customer) handleSelectCustomer(customer);
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className="inventory-stat-label">Top Debtor #{index + 1}</span>
                <strong>{debtor.name}</strong>
                <p>Balance: Rs. {debtor.balance.toFixed(2)}</p>
              </div>
            ))}
            {dashboardStats.topDebtors.length === 0 && (
              <div className="inventory-stat-card success">
                <span className="inventory-stat-label">All Clear!</span>
                <strong>Sab Paid Hai</strong>
                <p>Abhi kisi ka koi bada udhaar baki nahi hai.</p>
              </div>
            )}
          </div>

          {selectedCustomer && summary ? (
            <div className="reminder-bar">
              <span>
                {selectedCustomer.name} outstanding: Rs. {summary.balance.toFixed(2)}
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

          {selectedCustomer && aging ? (
            <div className="summary-block">
              <div>
                Selected customer: {selectedCustomer.name}
                {summary
                  ? ` | Debit ${summary.totalDebit.toFixed(2)} | Credit ${summary.totalCredit.toFixed(2)}`
                  : ''}
                {` | Entries ${entries.length}`}
              </div>
              <div className="muted">
                Aging: Current {aging.current.toFixed(2)}, 0-30 {aging.days30.toFixed(2)}, 31-60{' '}
                {aging.days60.toFixed(2)}, 61-90 {aging.days90.toFixed(2)}, 90+ {aging.older.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="empty-state-card inventory-empty-state">
              <h3>Customer summary optional hai</h3>
              <p>
                Left side se customer select karoge to uska balance aur WhatsApp reminder
                yahin dikh jayega.
              </p>
            </div>
          )}
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

      {isCustomerModalOpen && selectedCustomer ? (
        <div className="modal-backdrop" onClick={closeCustomerModal}>
          <section className="customer-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header customer-modal-header">
              <div>
                <h2>{selectedCustomer.name} ka Khata</h2>
                <p className="muted">Customer par click karte hi full khata details yahin open hoti hain.</p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCustomerLedgerCsvDownload}
                  disabled={downloadTarget !== null}
                >
                  {downloadTarget === 'ledger' ? 'Preparing CSV...' : 'Download Ledger'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeCustomerModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="customer-modal-grid">
              <form className="panel customer-info-card" onSubmit={handleCustomerUpdateSubmit}>
                <div className="panel-header">
                  <h3>Customer Details</h3>
                  <button type="submit">Save Details</button>
                </div>
                <div className="form-grid customer-modal-form-grid">
                  <TextField
                    label="Customer name"
                    value={editCustomerName}
                    onChange={setEditCustomerName}
                    placeholder="Customer name"
                  />
                  <TextField
                    label="Phone"
                    value={editCustomerPhone}
                    onChange={setEditCustomerPhone}
                    placeholder="Phone"
                  />

                 <TextField
                    label="Address (optional)"
                        
                    value={editCustomerAddress}       
                    onChange={setEditCustomerAddress}     
                    placeholder="Address"
                  />
                </div>

                <div className="summary-block compact-summary-block">
                  {summary ? (
                    <div>
                      Balance: {summary.balance.toFixed(2)} | Debit {summary.totalDebit.toFixed(2)} | Credit{' '}
                      {summary.totalCredit.toFixed(2)}
                    </div>
                  ) : (
                    <div>Loading customer summary...</div>
                  )}
                  {aging ? (
                    <div className="muted">
                      Aging: Current {aging.current.toFixed(2)}, 0-30 {aging.days30.toFixed(2)}, 31-60{' '}
                      {aging.days60.toFixed(2)}, 61-90 {aging.days90.toFixed(2)}, 90+ {aging.older.toFixed(2)}
                    </div>
                  ) : null}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="btn-whatsapp"
                    onClick={() => sendWhatsappReminder(selectedCustomer, summary?.balance ?? 0)}
                  >
                    WhatsApp Reminder
                  </button>
                </div>
              </form>

              <form className="panel customer-payment-card" onSubmit={handlePaymentSubmit}>
                <div className="panel-header">
                  <h3>Add Payment</h3>
                </div>
                <div className="form-row">
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
                </div>
              </form>
            </div>

            <div className="panel customer-entry-card">
              <div className="panel-header">
                <h3>Khata Entry</h3>
              </div>
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
                <TextField
                  label="Item Name"
                  value={entryItemName}
                  onChange={setEntryItemName}
                  placeholder="Jaise Milk, Sugar, etc."
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
                  placeholder="Jaise kg, ltr, pkt"
                />
                <TextField
                  label="Note"
                  value={entryNote}
                  onChange={setEntryNote}
                  placeholder="Extra details"
                />
                <label className="checkbox-field span-two">
                  <input
                    type="checkbox"
                    checked={isCashSale}
                    onChange={(event) => setIsCashSale(event.target.checked)}
                    disabled={entryType !== 'debit'}
                  />
                  <span>Cash sale ko ledger me dikhaye, outstanding me na jaye.</span>
                </label>
                <button type="submit" className="span-two">
                  Add Entry
                </button>
              </form>
            </div>

            <div className="panel customer-ledger-card">
              <div className="panel-header">
                <h3>Ledger Entries</h3>
                <span className="muted">{entries.length} total rows</span>
              </div>
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
                      <th>Delete</th> 
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
                          {entry.item_name}
                          {entry.unit ? <span className="muted"> ({entry.unit})</span> : null}
                        </td>
                        <td>{entry.quantity}</td>
                        <td>{entry.rate ?? '-'}</td>
                        <td>{entry.amount.toFixed(2)}</td>
                        <td>{entry.note ?? ''}</td>
                        <td>
  <button
    type="button"
    className="btn-danger"
    onClick={() => handleEntryDelete(entry.id)}
  >
    Delete
  </button>
</td>
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
    <td></td>
  </tr>
</tfoot>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isOutstandingModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsOutstandingModalOpen(false)}>
          <section className="customer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>All Outstanding Balances</h2>
              <button type="button" className="btn-secondary" onClick={() => setIsOutstandingModalOpen(false)}>Close</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Balance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .map(c => ({ ...c, balance: customerSummaries[c.id]?.balance || 0 }))
                    .sort((a, b) => b.balance - a.balance)
                    .map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone || '-'}</td>
                        <td>{c.address || '-'}</td>
                        <td style={{ 
                          color: c.balance > 0 ? 'var(--danger-color)' : (c.balance < 0 ? 'var(--success-color)' : 'inherit'), 
                          fontWeight: 'bold' 
                        }}>
                          Rs. {Math.abs(c.balance).toFixed(2)} {c.balance > 0 ? '(Dr)' : (c.balance < 0 ? '(Cr)' : '')}
                        </td>
                        <td>
                          <button 
                            className="btn-primary" 
                            onClick={() => {
                              handleSelectCustomer(c);
                              setIsOutstandingModalOpen(false);
                            }}
                          >
                            Open Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Abhi koi customer nahi hai.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
