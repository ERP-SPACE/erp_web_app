/**
 * Shared sales invoice roll-line pricing: derive and normalize tax-exclusive `ratePerRoll`
 * (amount for this roll before tax) and tax-inclusive `lineTotal` for API storage.
 */

export const toNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

/**
 * Derive tax-exclusive roll amount stored as `ratePerRoll` for one DC line + SO line.
 * Mirrors backend expectation: invoice line subtotal = qtyRolls * ratePerRoll.
 */
export function deriveRatePerRollForInvoiceRoll({ soLine, dcLine }) {
  const soLineTotalMeters = toNumber(
    soLine?.totalMeters ??
      toNumber(soLine?.qtyRolls) * toNumber(soLine?.lengthMetersPerRoll)
  );
  const soLineAmount = toNumber(soLine?.lineTotal);
  const derivedRatePerMeter =
    soLineTotalMeters > 0 ? soLineAmount / soLineTotalMeters : 0;
  const billedMeters = toNumber(dcLine?.shippedLengthMeters);

  return toNumber(
    soLine?.finalRatePerRoll ??
      dcLine?.finalRatePerRoll ??
      dcLine?.ratePerRoll ??
      soLine?.derivedRatePerRoll ??
      derivedRatePerMeter * billedMeters
  );
}

export function computeInvoiceRollLineAmounts(line) {
  const qty = toNumber(line.qtyRolls) || 1;
  const lineSubtotal = qty * toNumber(line.ratePerRoll);
  const lineDiscount = (lineSubtotal * toNumber(line.discountLine)) / 100;
  const taxableAmount = lineSubtotal - lineDiscount;
  const lineTax = (taxableAmount * toNumber(line.taxRate)) / 100;
  const lineTotal = taxableAmount + lineTax;
  return { lineSubtotal, lineDiscount, taxableAmount, lineTax, lineTotal };
}

/**
 * Ensure each roll line has `ratePerRoll` and tax-inclusive `lineTotal` for create/update payload.
 */
export function normalizeInvoiceRollLineForSave(line) {
  const amounts = computeInvoiceRollLineAmounts(line);
  return {
    ...line,
    qtyRolls: toNumber(line.qtyRolls) || 1,
    ratePerRoll: toNumber(line.ratePerRoll),
    discountLine: toNumber(line.discountLine),
    taxRate: toNumber(line.taxRate),
    lineTotal: amounts.lineTotal,
  };
}

/**
 * Reverse-calc tax-exclusive `ratePerRoll` from stored tax-inclusive SI `lineTotal` (qty=1).
 */
export function deriveRatePerRollFromTaxInclusiveLineTotal(line) {
  const qty = toNumber(line.qtyRolls) || 1;
  const taxRate = toNumber(line.taxRate);
  const discountPct = toNumber(line.discountLine);
  const lineTotal = toNumber(line.lineTotal);
  if (lineTotal <= 0 || qty <= 0) return 0;
  const taxable = taxRate > 0 ? lineTotal / (1 + taxRate / 100) : lineTotal;
  const factor = qty * (1 - discountPct / 100);
  return factor > 0 ? taxable / factor : 0;
}

/** Backfill `ratePerRoll` from stored `lineTotal` when opening saved invoices. */
export function ensureInvoiceLinesHaveRatePerRoll(lines) {
  return (lines || []).map((line) => {
    let rate = toNumber(line.ratePerRoll);
    if (rate <= 0) rate = deriveRatePerRollFromTaxInclusiveLineTotal(line);
    return normalizeInvoiceRollLineForSave({ ...line, ratePerRoll: rate });
  });
}
