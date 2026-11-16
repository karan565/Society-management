function monthOf(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
}

function nextMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
}

export function maintenanceAmountForMonth(society, month) {
  if (!society) return undefined;
  const override = society?.maintenanceOverrides?.find((item) => item.month === month);
  if (override) return Number(override.amount);
  if (society?.maintenanceEffectiveFrom && month >= society.maintenanceEffectiveFrom) {
    return Number(society.maintenanceAmount);
  }
  return Number(society.initialMaintenanceAmount);
}

export function buildMaintenanceEntries(users, society, storedBills, now = new Date()) {
  const residents = users.filter((user) => user.role === 'resident');
  const startMonths = new Map(
    residents.map((resident) => [
      resident.id,
      [monthOf(society.createdAt), monthOf(resident.createdAt)].sort().pop()
    ])
  );
  const actualBills = storedBills.filter((bill) => bill.month >= startMonths.get(bill.userId));
  const billByMonth = new Map(actualBills.map((bill) => [`${bill.userId}:${bill.month}`, bill]));
  const entries = [...actualBills];
  const endMonth = monthOf(now);

  for (const resident of residents) {
    const startMonth = startMonths.get(resident.id);
    for (let month = startMonth; month <= endMonth; month = nextMonth(month)) {
      if (billByMonth.has(`${resident.id}:${month}`)) continue;
      entries.push({
        id: `unpaid-${resident.id}-${month}`,
        societyId: resident.societyId,
        userId: resident.id,
        month,
        amount: maintenanceAmountForMonth(society, month),
        status: 'pending',
        dueDate: `${month}-10`,
        isVirtual: true
      });
    }
  }

  return entries;
}
