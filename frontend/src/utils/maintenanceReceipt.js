function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\()]/g, '\\$&');
}

function wrapText(value, maxLength) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function text(value, x, y, size = 10, font = 'F1', color = '0.16 0.21 0.29') {
  return `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
}

function rightText(value, rightX, y, size = 10, font = 'F1', color = '0.16 0.21 0.29') {
  const estimatedWidth = ascii(value).length * size * 0.52;
  return text(value, rightX - estimatedWidth, y, size, font, color);
}

function formatCurrency(amount) {
  return `INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))}`;
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-IN');
}

export function downloadMaintenanceReceipt(bill, resident, society) {
  if (!bill || bill.status !== 'paid' || !resident) throw new Error('A paid bill and resident are required to create a receipt.');

  const residentSuffix = ascii(resident.id)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  const receiptNo = bill.receiptNo || `REC-${String(bill.month).replace('-', '')}-${residentSuffix}`;
  const monthDate = new Date(`${bill.month}-01T00:00:00`);
  const billingPeriod = Number.isNaN(monthDate.getTime())
    ? bill.month
    : monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const societyName = society?.name || 'Society Management';
  const societyNameSize = Math.min(18, 318 / (Math.max(1, ascii(societyName).length) * 0.52));
  const addressLines = wrapText(society?.address || '', 68).slice(0, 2);
  const paymentDetailLines = [
    ...(bill.paymentReference ? wrapText(`Reference: ${bill.paymentReference}`, 86).slice(0, 2) : []),
    ...(bill.paymentNotes ? wrapText(`Notes: ${bill.paymentNotes}`, 86).slice(0, 2) : []),
    ...(bill.paymentAcceptedBy ? [`Accepted by: ${ascii(bill.paymentAcceptedBy).slice(0, 78)}`] : [])
  ];
  const paymentStatusY = Math.max(230, 270 - Math.max(0, paymentDetailLines.length - 2) * 12);
  const commands = [
    '0.96 0.97 0.98 rg 0 0 595 842 re f',
    '1 1 1 rg 40 95 515 665 re f',
    '0.86 0.89 0.92 RG 40 95 515 665 re S',
    '0.10 0.29 0.43 rg 40 675 515 125 re f',
    '0.18 0.45 0.48 RG 72 717 48 48 re S',
    text((ascii(societyName).charAt(0) || 'S').toUpperCase(), 89, 731, 20, 'F2', '1 1 1'),
    text(societyName, 137, 756, societyNameSize, 'F2', '1 1 1')
  ];

  addressLines.forEach((line, index) => {
    commands.push(text(line, 137, 738 - index * 12, 9, 'F1', '0.86 0.91 0.95'));
  });

  commands.push(
    text('MAINTENANCE PAYMENT RECEIPT', 137, 697, 9, 'F2', '0.86 0.91 0.95'),
    '0.13 0.48 0.38 rg 467 729 66 25 re f',
    text('PAID', 485, 738, 10, 'F2', '1 1 1'),
    text('PAYMENT RECEIPT', 64, 645, 9, 'F2', '0.40 0.46 0.53'),
    '0.91 0.94 0.96 rg 64 573 467 53 re f',
    text('RECEIPT NUMBER', 78, 607, 8, 'F2', '0.40 0.46 0.53'),
    text(receiptNo, 78, 588, 11, 'F2'),
    text('PAYMENT DATE', 267, 607, 8, 'F2', '0.40 0.46 0.53'),
    text(formatDate(bill.paidAt), 267, 588, 11, 'F2'),
    text('BILLING PERIOD', 424, 607, 8, 'F2', '0.40 0.46 0.53'),
    text(billingPeriod, 424, 588, 10, 'F2'),
    text('RECEIVED FROM', 64, 543, 8, 'F2', '0.40 0.46 0.53'),
    text(resident.name, 64, 523, 13, 'F2'),
    text(`Apartment / Unit: ${resident.apartment || 'Not specified'}`, 64, 503, 10),
    text(`Email: ${resident.email || 'Not provided'}`, 64, 486, 10),
    '0.86 0.89 0.92 RG 64 464 m 531 464 l S',
    '0.91 0.94 0.96 rg 64 431 467 29 re f',
    text('DESCRIPTION', 76, 442, 8, 'F2', '0.40 0.46 0.53'),
    text('PERIOD', 346, 442, 8, 'F2', '0.40 0.46 0.53'),
    rightText('AMOUNT', 519, 442, 8, 'F2', '0.40 0.46 0.53'),
    text('Society maintenance', 76, 411, 10),
    text(billingPeriod, 346, 411, 10),
    rightText(formatCurrency(bill.amount), 519, 411, 10, 'F2'),
    '0.86 0.89 0.92 RG 64 396 m 531 396 l S',
    text('TOTAL AMOUNT PAID', 76, 362, 9, 'F2', '0.40 0.46 0.53'),
    rightText(formatCurrency(bill.amount), 519, 353, 19, 'F2', '0.10 0.29 0.43'),
    text(`Payment method: ${bill.paymentMethod || 'Not specified'}`, 77, 333, 10, 'F2')
  );

  paymentDetailLines.forEach((line, index) => {
    commands.push(text(line, 77, 317 - index * 12, 8, 'F1', '0.40 0.46 0.53'));
  });
  commands.push(
    `0.90 0.96 0.94 rg 64 ${paymentStatusY} 467 28 re f`,
    text('Payment status: Paid and recorded by the society', 77, paymentStatusY + 9, 9, 'F2', '0.13 0.40 0.34'),
    `0.86 0.89 0.92 RG 64 ${paymentStatusY - 22} m 531 ${paymentStatusY - 22} l S`,
    text('Thank you. This receipt confirms the maintenance payment recorded for the period above.', 64, paymentStatusY - 44, 9),
    text('This is a computer-generated receipt and does not require a signature.', 64, paymentStatusY - 61, 8, 'F1', '0.40 0.46 0.53'),
    text(societyName, 64, 125, 9, 'F2', '0.40 0.46 0.53'),
    rightText(`Generated ${formatDate(new Date().toISOString())}`, 531, 125, 8, 'F1', '0.40 0.46 0.53')
  );

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdfDocument = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdfDocument.length);
    pdfDocument += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdfDocument.length;
  pdfDocument += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdfDocument += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdfDocument += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([pdfDocument], { type: 'application/pdf' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${receiptNo}.pdf`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
