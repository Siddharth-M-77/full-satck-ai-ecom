export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 99;
export const GST_RATE = 0.18;

/**
 * Single source of truth for order totals. The cart preview and the order that is actually
 * charged must use this so the customer never sees one total and pays another.
 */
export function computePricing(itemsTotal: number, discountTotal = 0) {
  const discount = Math.min(Math.max(0, discountTotal), itemsTotal);
  const shippingFee = itemsTotal === 0 || itemsTotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const taxTotal = Math.round(itemsTotal * GST_RATE);
  const grandTotal = Math.max(0, itemsTotal - discount + shippingFee + taxTotal);
  return { itemsTotal, discountTotal: discount, shippingFee, taxTotal, grandTotal };
}
