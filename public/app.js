const customerList = document.getElementById("customer-list");
const customerForm = document.getElementById("customer-form");
const entryForm = document.getElementById("entry-form");
const ledgerTableBody = document.querySelector("#ledger-table tbody");
const paymentForm = document.getElementById("payment-form");
const summaryBox = document.getElementById("customer-summary");
const agingBox = document.getElementById("aging-summary");
const totalQtyCell = document.getElementById("total-qty");
const totalAmountCell = document.getElementById("total-amount");
const downloadAllButton = document.getElementById("download-all");
const downloadCustomerButton = document.getElementById("download-customer");

let selectedCustomerId = null;

const formatAmount = (value) => {
  const num = Number(value) || 0;
  return num.toFixed(2);
};

const api = {
  listCustomers: () => fetch("/api/customers").then((res) => res.json()),
  addCustomer: (payload) =>
    fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((res) => res.json()),
  listEntries: (customerId) =>
    fetch(`/api/customers/${customerId}/entries`).then((res) => res.json()),
  addEntry: (customerId, payload) =>
    fetch(`/api/customers/${customerId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((res) => res.json()),
  getSummary: (customerId) =>
    fetch(`/api/customers/${customerId}/summary`).then((res) => res.json()),
  getAging: (customerId) =>
    fetch(`/api/customers/${customerId}/aging`).then((res) => res.json())
};

const loadCustomers = async () => {
  const customers = await api.listCustomers();
  customerList.innerHTML = "";
  customers.forEach((customer) => {
    const li = document.createElement("li");
    li.textContent = `${customer.name} ${customer.phone ? "(" + customer.phone + ")" : ""}`;
    li.dataset.id = customer.id;
    li.addEventListener("click", () => selectCustomer(customer.id, customer.name));
    customerList.appendChild(li);
  });
};

const selectCustomer = async (customerId, name) => {
  selectedCustomerId = customerId;
  summaryBox.textContent = `Selected: ${name}`;
  await loadLedger(customerId);
};

const loadLedger = async (customerId) => {
  const [entries, summary, aging] = await Promise.all([
    api.listEntries(customerId),
    api.getSummary(customerId),
    api.getAging(customerId)
  ]);

  ledgerTableBody.innerHTML = "";
  let totalQty = 0;
  let totalAmount = 0;
  entries.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.created_at}</td>
      <td>${entry.entry_type}</td>
      <td>${entry.item_name}</td>
      <td>${entry.quantity}</td>
      <td>${entry.rate ?? "-"}</td>
      <td>${formatAmount(entry.amount)}</td>
      <td>${entry.note ?? ""}</td>
    `;
    ledgerTableBody.appendChild(tr);
    totalQty += Number(entry.quantity) || 0;
    const signedAmount =
      entry.entry_type === "credit"
        ? -Number(entry.amount || 0)
        : Number(entry.amount || 0);
    totalAmount += signedAmount;
  });

  totalQtyCell.textContent = totalQty.toFixed(2);
  totalAmountCell.textContent = formatAmount(totalAmount);

  summaryBox.textContent = `Balance: ${formatAmount(summary.balance)} | Debit: ${formatAmount(
    summary.totalDebit
  )} | Credit: ${formatAmount(summary.totalCredit)}`;

  agingBox.textContent = `Aging: Current ${formatAmount(aging.current)}, 0-30 ${formatAmount(
    aging.days30
  )}, 31-60 ${formatAmount(aging.days60)}, 61-90 ${formatAmount(
    aging.days90
  )}, 90+ ${formatAmount(aging.older)}`;
};

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nameInput = document.getElementById("customer-name");
  const phoneInput = document.getElementById("customer-phone");
  const name = nameInput.value.trim();
  if (!name) {
    return;
  }

  const response = await api.addCustomer({
    name,
    phone: phoneInput.value.trim()
  });
  if (response.error) {
    alert(response.error);
    return;
  }

  nameInput.value = "";
  phoneInput.value = "";
  await loadCustomers();
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedCustomerId) {
    alert("Select a customer first");
    return;
  }

  const entryType = document.getElementById("entry-type").value;
  const itemName = document.getElementById("item-name").value;
  const quantity = Number(document.getElementById("item-qty").value);
  const rateValue = document.getElementById("item-rate").value;
  const rate = rateValue ? Number(rateValue) : null;
  const note = document.getElementById("item-note").value;

  const response = await api.addEntry(selectedCustomerId, {
    entryType,
    itemName,
    quantity,
    rate,
    note
  });

  if (response.error) {
    alert(response.error);
    return;
  }

  document.getElementById("item-name").value = "";
  document.getElementById("item-qty").value = "";
  document.getElementById("item-rate").value = "";
  document.getElementById("item-note").value = "";

  await loadLedger(selectedCustomerId);
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedCustomerId) {
    alert("Select a customer first");
    return;
  }

  const amountInput = document.getElementById("payment-amount");
  const noteInput = document.getElementById("payment-note");
  const amount = Number(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Payment amount must be positive");
    return;
  }

  const response = await api.addEntry(selectedCustomerId, {
    entryType: "credit",
    itemName: "Payment",
    quantity: 1,
    rate: amount,
    note: noteInput.value
  });

  if (response.error) {
    alert(response.error);
    return;
  }

  amountInput.value = "";
  noteInput.value = "";
  await loadLedger(selectedCustomerId);
});

loadCustomers();

downloadAllButton.addEventListener("click", () => {
  window.location.href = "/api/export/customers.csv";
});

downloadCustomerButton.addEventListener("click", () => {
  if (!selectedCustomerId) {
    alert("Select a customer first");
    return;
  }
  window.location.href = `/api/export/customers/${selectedCustomerId}/ledger.csv`;
});
