// Cleaned: No unused Category, Brand, Item types or loadAdminItems references present. Build errors should be resolved.
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import api from './api'
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

type AuditLog = {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  summary: string
  created_at: string
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const getDownloadFilename = (response: any, fallback: string) => {
  const disposition = response.headers['content-disposition'] || ''
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
    try {
      const response = await api.get(url, { responseType: 'blob' })

      const blob = new Blob([response.data], { type: response.headers['content-type'] as string || 'text/csv' })
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
    } catch (err: any) {
      if ((err.response?.status === 502 || err.response?.status === 503) && attempt < retries) {
        await wait(2500)
        continue
      }
      lastError = new Error(err.response?.data?.error || 'Download failed')
      break
    }
  }

  throw lastError || new Error('Download failed')
}

const FieldLabel = ({ label }: { label: string }) => (
  <span className="field-label">{label}</span>
)

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="currentColor"
    viewBox="0 0 16 16"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
  </svg>
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
    try {
      const resp = await api.get('/customers')
      const data = resp.data as Customer[]
      setCustomers(data)

      const summaryPromises = data.map(async (customer) => {
        try {
          const sResp = await api.get(`/customers/${customer.id}/summary`)
          return { id: customer.id, summary: sResp.data }
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
    } catch (error) {
      console.error('Failed to load customers', error)
    }
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
    const message = `Namaste ${customer.name}, Aapka baki balance Rs. ${balanceValue.toFixed(2)} hai. Kripya apna khata clear kar dein. Dhanyavaad.`
    const phone = (customer.phone || '').replace(/\D/g, '')
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
    try {
      const [entriesResp, summaryResp, agingResp] = await Promise.all([
        api.get(`/customers/${customerId}/entries`),
        api.get(`/customers/${customerId}/summary`),
        api.get(`/customers/${customerId}/aging`),
      ])
      setEntries(entriesResp.data)
      setSummary(summaryResp.data)
      setAging(agingResp.data)
    } catch (e) {
      console.error('Failed to load ledger context')
    }
  }

  const loadAuditLogs = async () => {
    try {
      const resp = await api.get('/audit-logs?limit=40')
      setAuditLogs(resp.data)
    } catch (e) {
      console.error('Failed to load audit logs')
    }
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

    const isDuplicate = customers.some(
      (c) =>
        c.name.toLowerCase() === customerName.trim().toLowerCase() &&
        (c.phone || '') === customerPhone.trim()
    )

    if (isDuplicate) {
      alert('This customer already exists with the same name and phone number!')
      return
    }

    const isPhoneDuplicate = customerPhone.trim() !== '' && customers.some(
      (c) => (c.phone || '') === customerPhone.trim()
    )

    if (isPhoneDuplicate) {
      alert('This phone number already exists!')
      return
    }

    try {
      await api.post('/customers', { name: customerName, phone: customerPhone, address: customerAddress })
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      await loadCustomers()
      await loadAuditLogs()
    } catch (error: any) {
      alert(error.response?.data?.error || error.message)
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
      await api.put(`/customers/${selectedCustomerId}`, {
        name: editCustomerName,
        phone: editCustomerPhone,
        address: editCustomerAddress,
      })
      await loadCustomers()
      await loadAuditLogs()
    } catch (error: any) {
      alert(error.response?.data?.error || error.message)
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
      await api.post(`/customers/${selectedCustomerId}/entries`, {
        entryType: 'credit',
        itemName: 'Payment',
        quantity: 1,
        rate: amount,
        affectsBalance: true,
        note: paymentNote,
      })
      setPaymentAmount('')
      setPaymentNote('')
      await loadLedger(selectedCustomerId)
      await loadCustomers() // Refresh total outstanding
      await loadAuditLogs()
    } catch (error: any) {
      alert(error.response?.data?.error || error.message)
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
      await api.post(`/customers/${selectedCustomerId}/entries`, {
        entryType,
        itemName: entryItemName,
        quantity,
        rate,
        unit: entryUnit,
        affectsBalance: !isPaidNowSale,
        note: entryNote,
      })
      setEntryItemName('')
      setEntryQuantity('')
      setEntryRate('')
      setEntryUnit('')
      setEntryNote('')
      setIsCashSale(false)
      await loadLedger(selectedCustomerId)
      await loadCustomers() // Refresh total outstanding
      await loadAuditLogs()
    } catch (error: any) {
      alert(error.response?.data?.error || error.message)
    }
  }

  const handleEntryDelete = async (entryId: number) => {
    const ok = window.confirm('Is entry ko delete karna chahte ho?')
    if (!ok) return
    try {
      await api.delete(`/customers/${selectedCustomerId}/entries/${entryId}`)
      await loadLedger(selectedCustomerId!)
      await loadCustomers() // Refresh total outstanding
      await loadAuditLogs()
    } catch (error: any) {
      alert(error.response?.data?.error || error.message)
    }
  }

  const handleCustomersCsvDownload = async () => {
    try {
      setDownloadTarget('customers')
      await downloadFile('/export/customers.csv', 'customers-summary.csv', 1)
    } catch (error: any) {
      alert(error.message)
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
        `/export/ledger/${selectedCustomerId}.csv`,
        `customer-${selectedCustomerId}-ledger.csv`,
        1
      )
    } catch (error: any) {
      alert(error.message)
    } finally {
      setDownloadTarget(null)
    }
  }

  return (
    <div className="app-container">
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
              onChange={(val) => setCustomerPhone(val.replace(/\D/g, ''))}
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
                className={`list-item ${selectedCustomerId === customer.id ? 'selected' : ''}`}
                onClick={() => handleSelectCustomer(customer)}
              >
                <div className="list-item-content">
                  <span>{customer.name}</span>
                  <span className="muted">{customer.phone || ''}</span>
                </div>
                <button
                  type="button"
                  className="btn-whatsapp btn-icon"
                  onClick={(event) => {
                    event.stopPropagation()
                    const bal = customerSummaries[customer.id]?.balance ?? 0
                    sendWhatsappReminder(customer, bal)
                  }}
                  title="WhatsApp Reminder"
                >
                  <WhatsAppIcon size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Customer Dashboard</h2>
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
                <WhatsAppIcon size={18} /> Send Reminder
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
              <h3></h3>

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
                    onChange={(val) => setEditCustomerPhone(val.replace(/\D/g, ''))}
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
                    <WhatsAppIcon size={18} /> WhatsApp Reminder
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
