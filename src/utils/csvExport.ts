import { Booking, LoadItem, Settlement } from '../types';

/**
 * Helper to escape CSV cell content properly (handles commas, quotes, and newlines)
 */
function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Triggers a browser download of a CSV file with BOM for UTF-8 compatibility with Excel
 */
function downloadCsvFile(csvContent: string, fileName: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Customer Booking History to CSV for accounting, GST reconciliation, and record-keeping
 */
export function exportCustomerBookingsToCsv(loads: LoadItem[], bookings: Booking[]) {
  const headers = [
    'Booking ID',
    'Load ID',
    'Date',
    'Origin City',
    'Origin State',
    'Pickup Address',
    'Destination City',
    'Destination State',
    'Delivery Address',
    'Goods Category',
    'Goods Description',
    'Weight (kg)',
    'Package Count',
    'Declared Value (INR)',
    'e-Way Bill Number',
    'Vehicle Category',
    'Shipment Status',
    'Freight Amount (INR)',
    'Payment Status',
    'Payment Mode',
    'Consignor Contact',
    'Consignee Contact'
  ];

  const rows = loads.map((load) => {
    const booking = bookings.find((b) => b.loadId === load.id || b.id === load.assignedBookingId);
    const dateFormatted = new Date(load.createdAt).toISOString().split('T')[0];
    const freightAmount = booking ? booking.totalAgreedAmountInr : load.targetBudgetInr || 0;
    const paymentStatus = booking ? booking.paymentStatus : 'pending';
    const paymentMode = booking ? booking.paymentMode : 'direct_settlement';

    return [
      escapeCsvCell(booking?.id || 'UNASSIGNED'),
      escapeCsvCell(load.id),
      escapeCsvCell(dateFormatted),
      escapeCsvCell(load.pickup.city),
      escapeCsvCell(load.pickup.state),
      escapeCsvCell(load.pickup.address),
      escapeCsvCell(load.delivery.city),
      escapeCsvCell(load.delivery.state),
      escapeCsvCell(load.delivery.address),
      escapeCsvCell(load.goodsCategory),
      escapeCsvCell(load.goodsDescription),
      escapeCsvCell(load.weightKg),
      escapeCsvCell(load.packageCount),
      escapeCsvCell(load.declaredValueInr),
      escapeCsvCell(load.specialRequirements.eWayBillNumber || 'EXEMPT'),
      escapeCsvCell(load.requiredVehicleCategory),
      escapeCsvCell(load.status.toUpperCase()),
      escapeCsvCell(freightAmount),
      escapeCsvCell(paymentStatus.toUpperCase()),
      escapeCsvCell(paymentMode.replace('_', ' ').toUpperCase()),
      escapeCsvCell(`${load.pickup.contactName} (${load.pickup.contactPhone})`),
      escapeCsvCell(`${load.delivery.contactName} (${load.delivery.contactPhone})`)
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsvFile(csvString, `Zuggi_Customer_Booking_History_${dateStr}.csv`);
}

/**
 * Export Driver Earnings and Bank Settlements Report to CSV for accounting & tax filing
 */
export function exportDriverEarningsToCsv(settlements: Settlement[], bookings: Booking[]) {
  const headers = [
    'Settlement Reference',
    'Settlement Date',
    'Booking ID',
    'Trip Route',
    'Gross Freight (INR)',
    'Platform Fee 5% (INR)',
    'TDS u/s 194C 1% (INR)',
    'Net Disbursed (INR)',
    'Bank Name',
    'Account Number',
    'IFSC Code',
    'UPI ID',
    'Bank UTR Number',
    'Settlement Status'
  ];

  const rows = settlements.map((s) => {
    const booking = bookings.find((b) => b.id === s.bookingId);
    const dateFormatted = new Date(s.settledAt).toISOString().split('T')[0];
    const route = booking ? `${booking.pickup.city} to ${booking.delivery.city}` : 'Intercity Freight Corridor';

    return [
      escapeCsvCell(s.settlementRef),
      escapeCsvCell(dateFormatted),
      escapeCsvCell(s.bookingId),
      escapeCsvCell(route),
      escapeCsvCell(s.grossFreight),
      escapeCsvCell(s.commission),
      escapeCsvCell(s.tdsDeduction),
      escapeCsvCell(s.netDisbursed),
      escapeCsvCell(s.bankAccount.bankName),
      escapeCsvCell(s.bankAccount.accountNumberMasked),
      escapeCsvCell(s.bankAccount.ifsc),
      escapeCsvCell(s.bankAccount.upiId),
      escapeCsvCell(s.utrNumber || 'CMS_AUTOCREDIT'),
      escapeCsvCell(s.status.toUpperCase())
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsvFile(csvString, `Zuggi_Driver_Earnings_Report_${dateStr}.csv`);
}

/**
 * Export Driver Completed Trip History & Consignment Delivery Statement to CSV
 */
export function exportTripHistoryToCsv(bookings: Booking[], settlements: Settlement[]) {
  const headers = [
    'Trip / Booking ID',
    'Completion Date',
    'Origin City',
    'Origin Address',
    'Destination City',
    'Destination Address',
    'Consignor Contact',
    'Consignee Contact',
    'Goods Category',
    'Goods Description',
    'Weight (kg)',
    'Assigned Vehicle ID',
    'Total Agreed Fare (Gross INR)',
    'Zuggi Platform Fee 5% (INR)',
    'Net Driver Earnings 95% (INR)',
    'Stage 1 Payout 90% (INR)',
    'Stage 1 Status',
    'Stage 2 Payout 10% (INR)',
    'Stage 2 Status',
    'Cashfree Advance Order ID',
    'Cashfree Balance Order ID',
    'e-Way Bill Number',
    'Delivery OTP Verified',
    'Shipment Status'
  ];

  const rows = bookings.map((b) => {
    const completedDate = b.completedAt
      ? new Date(b.completedAt).toISOString().split('T')[0]
      : new Date(b.createdAt).toISOString().split('T')[0];

    return [
      escapeCsvCell(b.id),
      escapeCsvCell(completedDate),
      escapeCsvCell(b.pickup.city),
      escapeCsvCell(b.pickup.address),
      escapeCsvCell(b.delivery.city),
      escapeCsvCell(b.delivery.address),
      escapeCsvCell(`${b.pickup.contactName} (${b.pickup.contactPhone})`),
      escapeCsvCell(`${b.delivery.contactName} (${b.delivery.contactPhone})`),
      escapeCsvCell(b.goodsDescription),
      escapeCsvCell(b.goodsDescription),
      escapeCsvCell(b.weightKg),
      escapeCsvCell(b.vehicleId || 'AS-01-MC-7822'),
      escapeCsvCell(b.totalAgreedAmountInr),
      escapeCsvCell(b.platformCommissionInr),
      escapeCsvCell(b.netDriverPayableInr),
      escapeCsvCell(b.driverFirstPayoutInr),
      escapeCsvCell(b.payoutStage1Status.toUpperCase()),
      escapeCsvCell(b.driverFinalPayoutInr),
      escapeCsvCell(b.payoutStage2Status.toUpperCase()),
      escapeCsvCell(b.cashfreeAdvanceOrderId || 'CF_ORD_DIRECT'),
      escapeCsvCell(b.cashfreeBalanceOrderId || 'CF_ORD_DIRECT'),
      escapeCsvCell(b.eWayBillNumber || 'EXEMPT'),
      escapeCsvCell(b.deliveryOtp || 'VERIFIED'),
      escapeCsvCell(b.status.toUpperCase())
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsvFile(csvString, `Zuggi_Driver_Trip_History_${dateStr}.csv`);
}

/**
 * Export Master Super Admin Financial & Operational Dispatch Report
 */
export function exportAdminMasterReportCsv(
  bookings: Booking[],
  loads: LoadItem[]
) {
  const headers = [
    'Booking ID',
    'Load ID',
    'Created Date',
    'Pickup City',
    'Delivery City',
    'Weight (kg)',
    'Trip Status',
    'Payment Status',
    'Gross Freight (INR)',
    'Platform 5% Commission (INR)',
    'Net Partner Payable (INR)',
    'Stage 1 Payout Status',
    'Stage 2 Payout Status',
    'Vehicle ID',
    'Driver ID',
    'Shipper ID'
  ];

  const rows = bookings.map((b) => {
    const load = loads.find((l) => l.id === b.loadId);
    const createdDate = new Date(b.createdAt).toISOString().split('T')[0];
    return [
      escapeCsvCell(b.id),
      escapeCsvCell(b.loadId),
      escapeCsvCell(createdDate),
      escapeCsvCell(b.pickup.city),
      escapeCsvCell(b.delivery.city),
      escapeCsvCell(b.weightKg),
      escapeCsvCell(b.status.toUpperCase()),
      escapeCsvCell(b.paymentStatus.toUpperCase()),
      escapeCsvCell(b.totalAgreedAmountInr),
      escapeCsvCell(b.platformCommissionInr),
      escapeCsvCell(b.netDriverPayableInr),
      escapeCsvCell(b.payoutStage1Status.toUpperCase()),
      escapeCsvCell(b.payoutStage2Status.toUpperCase()),
      escapeCsvCell(b.vehicleId),
      escapeCsvCell(b.driverId),
      escapeCsvCell(load?.customerName || b.customerId)
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsvFile(csvString, `Zuggi_Master_Admin_Dispatch_Report_${dateStr}.csv`);
}


