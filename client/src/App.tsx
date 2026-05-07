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

type VendorOrderDraft = {
  itemId: number
  vendorPhone: string
  quantity: string
  note: string
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

  const [categories, setCategories] = useState<Category[]>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [adminItems, setAdminItems] = useState<Item[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
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
  const [vendorOrderDraft, setVendorOrderDraft] = useState<VendorOrderDraft | null>(null)

  const [categoryName, setCategoryName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandCategoryId, setBrandCategoryId] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemBrandId, setItemBrandId] = useState('')
  const [itemRate, setItemRate] = useState('')
  const [itemUnit, setItemUnit] = useState('')
  const [itemStockQuantity, setItemStockQuantity] = useState('')
  const [itemLowStockThreshold, setItemLowStockThreshold] = useState('5')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemCategoryId, setEditItemCategoryId] = useState('')
  const [editItemBrandId, setEditItemBrandId] = useState('')
  const [editItemRate, setEditItemRate] = useState('')
  const [editItemUnit, setEditItemUnit] = useState('')
  const [editItemStockQuantity, setEditItemStockQuantity] = useState('')
  const [editItemLowStockThreshold, setEditItemLowStockThreshold] = useState('5')
  const [downloadTarget, setDownloadTarget] = useState<null | 'customers' | 'ledger'>(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

  const vendorOrderItem = useMemo(
    () =>
      vendorOrderDraft
        ? adminItems.find((item) => item.id === vendorOrderDraft.itemId) ?? null
        : null,
    [adminItems, vendorOrderDraft]
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

  const inventorySummary = useMemo(() => {
    const outOfStock = adminItems.filter((item) => Number(item.stock_quantity) <= 0)
    const lowStock = adminItems.filter(
      (item) =>
        Number(item.stock_quantity) > 0 &&
        Number(item.stock_quantity) <= Number(item.low_stock_threshold)
    )
    const healthyStock = adminItems.filter(
      (item) => Number(item.stock_quantity) > Number(item.low_stock_threshold)
    )
    const totalUnits = adminItems.reduce(
      (sum, item) => sum + Number(item.stock_quantity || 0),
      0
    )

    return {
      outOfStock,
      lowStock,
      healthyStock,
      totalUnits,
      criticalItems: [...outOfStock, ...lowStock].sort(
        (left, right) => Number(left.stock_quantity) - Number(right.stock_quantity)
      ),
    }
  }, [adminItems])

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }))
  const adminBrandOptions = allBrands
    .filter((brand) => (itemCategoryId ? String(brand.category_id) === itemCategoryId : true))
    .map((brand) => ({
      value: String(brand.id),
      label: brand.name,
    }))
  const editBrandOptions = allBrands
    .filter((brand) =>
      editItemCategoryId ? String(brand.category_id) === editItemCategoryId : true
    )
    .map((brand) => ({
      value: String(brand.id),
      label: brand.name,
    }))
  const customerBrandOptions = allBrands
    .filter((brand) =>
      selectedCategoryId ? String(brand.category_id) === selectedCategoryId : true
    )
    .map((brand) => ({
      value: String(brand.id),
      label: brand.name,
    }))
  const customerItems = adminItems.filter((item) => {
    if (selectedCategoryId && String(item.category_id) !== selectedCategoryId) {
      return false
    }
    if (selectedBrandId && String(item.brand_id) !== selectedBrandId) {
      return false
    }
    return true
  })
  const customerItemOptions = customerItems.map((item) => ({
    value: String(item.id),
    label: `${item.name}${item.unit ? ` (${item.unit})` : ''} | Stock ${item.stock_quantity}`,
  }))
  const loadCustomers = async () => {
    const data = await requestJson<Customer[]>('/api/customers')
    setCustomers(data)
  }

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

  const getSuggestedVendorOrderQuantity = (item: Item) => {
    return Math.max(Math.ceil(Number(item.low_stock_threshold) * 2 - Number(item.stock_quantity)), 1)
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

  const openVendorOrderModal = (item: Item) => {
    setVendorOrderDraft({
      itemId: item.id,
      vendorPhone: '',
      quantity: String(getSuggestedVendorOrderQuantity(item)),
      note: '',
    })
  }

  const closeVendorOrderModal = () => {
    setVendorOrderDraft(null)
  }

  const submitVendorOrder = () => {
    if (!vendorOrderDraft || !vendorOrderItem) {
      return
    }

    const quantity = Number(vendorOrderDraft.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Order quantity positive honi chahiye')
      return
    }

    const brandName = allBrands.find((brand) => brand.id === vendorOrderItem.brand_id)?.name || 'Vendor'
    const categoryName = categories.find((category) => category.id === vendorOrderItem.category_id)?.name || ''
    const message = [
      `Namaste ${brandName},`,
      `Mujhe ${vendorOrderItem.name}${vendorOrderItem.unit ? ` (${vendorOrderItem.unit})` : ''} ka naya order place karna hai.`,
      `Required quantity: ${quantity}`,
      `Current stock: ${vendorOrderItem.stock_quantity}`,
      `Category: ${categoryName}`,
      vendorOrderDraft.note ? `Note: ${vendorOrderDraft.note}` : '',
      'Please confirm availability and delivery.',
    ]
      .filter(Boolean)
      .join(' ')

    try {
      const link = buildWhatsappLink(vendorOrderDraft.vendorPhone, message)
      window.open(link, '_blank', 'noopener,noreferrer')
      closeVendorOrderModal()
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

  const loadAllBrands = async () => {
    const data = await requestJson<Brand[]>('/api/brands')
    setAllBrands(data)
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

  useEffect(() => {
    if (!editItemCategoryId) {
      setEditItemBrandId('')
      return
    }
    if (editItemBrandId) {
      const stillValid = allBrands.some(
        (brand) =>
          String(brand.id) === editItemBrandId &&
          String(brand.category_id) === editItemCategoryId
      )
      if (!stillValid) {
        setEditItemBrandId('')
      }
    }
  }, [editItemCategoryId, editItemBrandId, allBrands])

  useEffect(() => {
    if (selectedCustomer) {
      setEditCustomerName(selectedCustomer.name)
      setEditCustomerPhone(selectedCustomer.phone || '')
    }
  }, [selectedCustomer])

  useEffect(() => {
    if (!selectedCategoryId) {
      setSelectedBrandId('')
      setSelectedItemId('')
      return
    }

    if (selectedBrandId) {
      const stillValid = allBrands.some(
        (brand) =>
          String(brand.id) === selectedBrandId &&
          String(brand.category_id) === selectedCategoryId
      )
      if (!stillValid) {
        setSelectedBrandId('')
      }
    }
  }, [selectedCategoryId, selectedBrandId, allBrands])

  useEffect(() => {
    if (!selectedBrandId) {
      setSelectedItemId('')
      return
    }

    if (selectedItemId) {
      const stillValid = customerItems.some((item) => String(item.id) === selectedItemId)
      if (!stillValid) {
        setSelectedItemId('')
      }
    }
  }, [selectedBrandId, selectedItemId, customerItems])

  useEffect(() => {
    const item = customerItems.find((entry) => String(entry.id) === selectedItemId)
    if (item) {
      setEntryRate(item.default_rate ? String(item.default_rate) : '')
      setEntryUnit(item.unit || '')
    } else {
      setEntryRate('')
      setEntryUnit('')
    }
  }, [customerItems, selectedItemId])

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

  const resetCustomerModalState = () => {
    setPaymentAmount('')
    setPaymentNote('')
    setEntryType('debit')
    setSelectedCategoryId('')
    setSelectedBrandId('')
    setSelectedItemId('')
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

    const item = customerItems.find((entry) => String(entry.id) === selectedItemId)
    if (!item) {
      alert('Invalid item selection')
      return
    }
    if (Number(item.stock_quantity) <= 0) {
      alert('Is item ka stock khatam ho gaya hai. Order create nahi ho sakta.')
      return
    }
    if (quantity > Number(item.stock_quantity)) {
      alert(
        `Sirf ${Number(item.stock_quantity)} unit stock me hai. Itni quantity ka order create nahi ho sakta.`
      )
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
      await loadAdminItems()
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
      setBrandCategoryId('')
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
    const stockQuantity = itemStockQuantity ? Number(itemStockQuantity) : 0
    const lowStockThreshold = itemLowStockThreshold ? Number(itemLowStockThreshold) : 5
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      alert('Stock quantity negative nahi ho sakti')
      return
    }
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      alert('Low stock threshold negative nahi ho sakta')
      return
    }

    try {
      await requestJson('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName,
          categoryId: Number(itemCategoryId),
          brandId: Number(itemBrandId),
          defaultRate: defaultRate === null ? undefined : defaultRate,
          unit: itemUnit,
          stockQuantity,
          lowStockThreshold,
        }),
      })
      setItemName('')
      setItemCategoryId('')
      setItemBrandId('')
      setItemRate('')
      setItemUnit('')
      setItemStockQuantity('')
      setItemLowStockThreshold('5')
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleItemEdit = (item: Item) => {
    setEditingItemId(item.id)
    setEditItemName(item.name)
    setEditItemCategoryId(String(item.category_id))
    setEditItemBrandId(String(item.brand_id))
    setEditItemRate(item.default_rate ? String(item.default_rate) : '')
    setEditItemUnit(item.unit || '')
    setEditItemStockQuantity(String(item.stock_quantity))
    setEditItemLowStockThreshold(String(item.low_stock_threshold))
  }

  const resetInlineEdit = () => {
    setEditingItemId(null)
    setEditItemName('')
    setEditItemCategoryId('')
    setEditItemBrandId('')
    setEditItemRate('')
    setEditItemUnit('')
    setEditItemStockQuantity('')
    setEditItemLowStockThreshold('5')
  }

  const handleInlineItemSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingItemId) {
      return
    }
    if (!editItemName.trim() || !editItemCategoryId || !editItemBrandId) {
      alert('Item, category, and brand required')
      return
    }

    const defaultRate = editItemRate ? Number(editItemRate) : null
    if (defaultRate !== null && (!Number.isFinite(defaultRate) || defaultRate < 0)) {
      alert('Rate should not be negative')
      return
    }
    const stockQuantity = editItemStockQuantity ? Number(editItemStockQuantity) : 0
    const lowStockThreshold = editItemLowStockThreshold
      ? Number(editItemLowStockThreshold)
      : 5
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      alert('Stock quantity negative nahi ho sakti')
      return
    }
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      alert('Low stock threshold negative nahi ho sakta')
      return
    }

    try {
      await requestJson(`/api/items/${editingItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editItemName,
          categoryId: Number(editItemCategoryId),
          brandId: Number(editItemBrandId),
          defaultRate: defaultRate === null ? undefined : defaultRate,
          unit: editItemUnit,
          stockQuantity,
          lowStockThreshold,
        }),
      })
      resetInlineEdit()
      await loadAdminItems()
      await loadAuditLogs()
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleItemDelete = async (itemId: number) => {
    const ok = window.confirm('Delete this item?')
    if (!ok) return
    try {
      await fetch(apiUrl(`/api/items/${itemId}`), { method: 'DELETE' })
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
            <h2>Inventory Dashboard</h2>
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
            <div className="inventory-stat-card danger">
              <span className="inventory-stat-label">Out of Stock</span>
              <strong>{inventorySummary.outOfStock.length}</strong>
              <p>Ye items abhi turant refill maang rahe hain.</p>
            </div>
            <div className="inventory-stat-card warning">
              <span className="inventory-stat-label">Low Stock</span>
              <strong>{inventorySummary.lowStock.length}</strong>
              <p>Threshold ke neeche ya uske paas chal rahe items.</p>
            </div>
            <div className="inventory-stat-card success">
              <span className="inventory-stat-label">Healthy Stock</span>
              <strong>{inventorySummary.healthyStock.length}</strong>
              <p>Normal stock level par available items.</p>
            </div>
            <div className="inventory-stat-card neutral">
              <span className="inventory-stat-label">Total Units</span>
              <strong>{inventorySummary.totalUnits.toFixed(0)}</strong>
              <p>Sabhi tracked items ka current stock total.</p>
            </div>
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
                yahin dikh jayega. Inventory alerts neeche hamesha visible rahenge.
              </p>
            </div>
          )}

          <div className="inventory-critical-card">
            <div className="panel-header">
              <h3>Critical Inventory Alerts</h3>
              <span className="muted">
                {inventorySummary.criticalItems.length} items ko action chahiye
              </span>
            </div>
            {inventorySummary.criticalItems.length === 0 ? (
              <div className="empty-state-card inventory-empty-state">
                <h3>Sab theek chal raha hai</h3>
                <p>Kisi bhi item ka stock abhi alert zone me nahi hai.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Brand</th>
                      <th>Stock</th>
                      <th>Threshold</th>
                      <th>Status</th>
                      <th>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventorySummary.criticalItems.map((item) => {
                      const isOut = Number(item.stock_quantity) <= 0
                      return (
                        <tr key={item.id} className={isOut ? 'stock-row-danger' : 'stock-row-warning'}>
                          <td>
                            {item.name}
                            {item.unit ? <span className="muted"> ({item.unit})</span> : null}
                          </td>
                          <td>{categoryMap.get(item.category_id) || '-'}</td>
                          <td>{brandMap.get(item.brand_id) || '-'}</td>
                          <td>{item.stock_quantity}</td>
                          <td>{item.low_stock_threshold}</td>
                          <td>
                            <span className={`stock-badge ${isOut ? 'danger' : 'warning'}`}>
                              {isOut ? 'Out of stock' : 'Low stock'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-order-vendor"
                              onClick={() => openVendorOrderModal(item)}
                            >
                              Place Vendor Order
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel admin-panel">
          <div className="panel-header">
            <h2>Admin Item Management</h2>
          </div>
          <div className="admin-grid">
            <div className="admin-action-card compact-card">
              <div className="admin-action-header">
                <h3>Add Category</h3>
                <p>Sabse pehle nayi category banao.</p>
              </div>
              <form className="form-row compact-form" onSubmit={handleAddCategory}>
                <TextField
                  label="Category name"
                  value={categoryName}
                  onChange={setCategoryName}
                  placeholder="Jaise Grocery ya Dairy"
                />
                <button type="submit" className="btn-action-primary compact-action-button">
                  Save Category
                </button>
              </form>
            </div>

            <div className="admin-action-card compact-card">
              <div className="admin-action-header">
                <h3>Add Brand</h3>
                <p>Brand ko sahi category ke andar rakho.</p>
              </div>
              <form className="form-row compact-form" onSubmit={handleAddBrand}>
                <TextField
                  label="Brand name"
                  value={brandName}
                  onChange={setBrandName}
                  placeholder="Jaise Amul ya Fortune"
                />
                <SelectField
                  label="Choose category"
                  value={brandCategoryId}
                  onChange={setBrandCategoryId}
                  options={categoryOptions}
                  placeholder="Select category"
                />
                <button type="submit" className="btn-action-primary compact-action-button">
                  Save Brand
                </button>
              </form>
            </div>

            <div className="admin-action-card wide-card">
              <div className="admin-action-header">
                <h3>Add Item</h3>
                <p>Item banate waqt category, brand, rate aur unit ek saath set karo.</p>
              </div>
              <form className="form-grid admin-item-form" onSubmit={handleItemSubmit}>
                <TextField
                  label="Item name"
                  value={itemName}
                  onChange={setItemName}
                  placeholder="Jaise Parle-G"
                />
                <SelectField
                  label="Choose category"
                  value={itemCategoryId}
                  onChange={setItemCategoryId}
                  options={categoryOptions}
                  placeholder="Select category"
                />
                <SelectField
                  label="Choose brand"
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
                  placeholder="Jaise 20"
                />
                <TextField
                  label="Unit"
                  value={itemUnit}
                  onChange={setItemUnit}
                  placeholder="Jaise packet ya 1L"
                />
                <TextField
                  label="Current stock"
                  value={itemStockQuantity}
                  onChange={setItemStockQuantity}
                  type="number"
                  placeholder="Jaise 24"
                />
                <TextField
                  label="Low stock alert"
                  value={itemLowStockThreshold}
                  onChange={setItemLowStockThreshold}
                  type="number"
                  placeholder="Jaise 5"
                />
                <div className="admin-form-note">
                  Pehle category select karo, fir brand choose karo. Stock aur alert dono yahin set karo.
                </div>
                <button type="submit" className="span-two btn-action-primary admin-submit-button">
                  Add New Item
                </button>
              </form>
            </div>
          </div>

          <div className="table-wrap admin-items-table-wrap">
            <table className="admin-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Rate</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Alert At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminItems.map((item) => (
                  <>
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{categoryMap.get(item.category_id) || ''}</td>
                      <td>{brandMap.get(item.brand_id) || ''}</td>
                      <td>{item.default_rate ?? '-'}</td>
                      <td>{item.unit ?? '-'}</td>
                      <td>{item.stock_quantity}</td>
                      <td>{item.low_stock_threshold}</td>
                      <td className="status-cell">
                        <div className="status-stack">
                          {Number(item.stock_quantity) <= 0 ? (
                            <span className="stock-badge danger">Out of stock</span>
                          ) : Number(item.stock_quantity) <= Number(item.low_stock_threshold) ? (
                            <span className="stock-badge warning">Low stock</span>
                          ) : (
                            <span className="stock-badge success">Healthy</span>
                          )}
                          {Number(item.stock_quantity) <= Number(item.low_stock_threshold) ? (
                            <button
                              type="button"
                              className="btn-order-inline"
                              onClick={() => openVendorOrderModal(item)}
                            >
                              Place vendor order
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="item-actions-cell">
                        <div className="item-actions-row compact-actions-row">
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
                        </div>
                      </td>
                    </tr>
                    {editingItemId === item.id && (
                      <tr key={`${item.id}-editor`} className="inline-editor-row">
                        <td colSpan={9}>
                          <form className="form-grid inline-editor-form" onSubmit={handleInlineItemSubmit}>
                            <TextField
                              label="Item name"
                              value={editItemName}
                              onChange={setEditItemName}
                              placeholder="Item name"
                            />
                            <SelectField
                              label="Category"
                              value={editItemCategoryId}
                              onChange={setEditItemCategoryId}
                              options={categoryOptions}
                              placeholder="Select category"
                            />
                            <SelectField
                              label="Brand"
                              value={editItemBrandId}
                              onChange={setEditItemBrandId}
                              options={editBrandOptions}
                              placeholder="Select brand"
                              disabled={!editItemCategoryId}
                            />
                            <TextField
                              label="Default rate"
                              value={editItemRate}
                              onChange={setEditItemRate}
                              type="number"
                              placeholder="Rate"
                            />
                            <TextField
                              label="Unit"
                              value={editItemUnit}
                              onChange={setEditItemUnit}
                              placeholder="Unit"
                            />
                            <TextField
                              label="Current stock"
                              value={editItemStockQuantity}
                              onChange={setEditItemStockQuantity}
                              type="number"
                              placeholder="Stock"
                            />
                            <TextField
                              label="Low stock alert"
                              value={editItemLowStockThreshold}
                              onChange={setEditItemLowStockThreshold}
                              type="number"
                              placeholder="Threshold"
                            />
                            <button type="submit">Update Item</button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={resetInlineEdit}
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
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
                  options={customerBrandOptions}
                  placeholder="Select brand"
                  disabled={!selectedCategoryId}
                />
                <SelectField
                  label="Item"
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  options={customerItemOptions}
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
            </div>
          </section>
        </div>
      ) : null}

      {vendorOrderDraft && vendorOrderItem ? (
        <div className="modal-backdrop" onClick={closeVendorOrderModal}>
          <section className="vendor-order-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Place Vendor Order</h2>
                <p className="muted">
                  {vendorOrderItem.name}
                  {vendorOrderItem.unit ? ` (${vendorOrderItem.unit})` : ''} ke liye vendor ko ready message bhejo.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeVendorOrderModal}>
                Close
              </button>
            </div>

            <div className="vendor-order-meta">
              <span className="stock-badge warning">
                Current stock {vendorOrderItem.stock_quantity}
              </span>
              <span className="stock-badge danger">
                Alert at {vendorOrderItem.low_stock_threshold}
              </span>
            </div>

            <div className="form-grid vendor-order-form-grid">
              <TextField
                label="Vendor WhatsApp number"
                value={vendorOrderDraft.vendorPhone}
                onChange={(value) =>
                  setVendorOrderDraft((current) =>
                    current ? { ...current, vendorPhone: value } : current
                  )
                }
                placeholder="Jaise 9198XXXXXXXX"
              />
              <TextField
                label="Order quantity"
                value={vendorOrderDraft.quantity}
                onChange={(value) =>
                  setVendorOrderDraft((current) =>
                    current ? { ...current, quantity: value } : current
                  )
                }
                type="number"
                placeholder="Required quantity"
              />
              <label className="field span-two">
                <FieldLabel label="Order note" />
                <textarea
                  value={vendorOrderDraft.note}
                  placeholder="Optional note for vendor"
                  onChange={(event) =>
                    setVendorOrderDraft((current) =>
                      current ? { ...current, note: event.target.value } : current
                    )
                  }
                  rows={4}
                />
              </label>
            </div>

            <div className="actions">
              <button type="button" className="btn-order-vendor" onClick={submitVendorOrder}>
                Send Order on WhatsApp
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
