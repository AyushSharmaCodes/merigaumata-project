import { useMemo } from "react";

interface TaxItem {
  quantity: number;
  variant?: { gst_rate?: number; hsn_code?: string };
  gst_rate?: number;
  product?: { gst_rate?: number; default_gst_rate?: number; hsn_code?: string; title?: string };
  taxable_amount?: number;
  total_amount?: number;
  price_per_unit?: number;
  price?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  title?: string;
  hsn_code?: string;
}

interface UseTaxBreakdownProps {
  totalTaxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  items: TaxItem[];
  deliveryCharge: number;
  deliveryGST: number;
}

export const useTaxBreakdown = ({
  totalTaxableAmount,
  totalCgst,
  totalSgst,
  totalIgst,
  totalAmount,
  items,
  deliveryCharge,
  deliveryGST,
}: UseTaxBreakdownProps) => {
  const calculations = useMemo(() => {
    // 1. Calculate Product-only tax from items
    const productTaxableFromItems = items.reduce((sum, item) => {
      const qty = item.quantity || 1;
      const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
      const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
      return sum + itemTaxable;
    }, 0);

    const productTaxFromItems = items.reduce((sum, item) => {
      const qty = item.quantity || 1;
      const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
      const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
      const totalItemTaxSnapshot = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      const itemTax = totalItemTaxSnapshot > 0 ? totalItemTaxSnapshot : ((item.total_amount || (item.price_per_unit * qty)) - itemTaxable);
      return sum + Math.max(0, itemTax);
    }, 0);

    // 2. Identification Logic
    const isInterState = (totalIgst || 0) > 0;

    // Reconciliation logic: ensure summary components sum up correctly
    const derivedTotalTaxable = productTaxableFromItems + deliveryCharge;

    // Use derived values if passed-in ones are zero or significantly mismatched
    const effectiveTaxable = totalTaxableAmount > 0 ? totalTaxableAmount : derivedTotalTaxable;

    // Fix Double Counting: 
    // If totalCgst/Igst already include delivery (which they often do in new orders), 
    // we don't add deliveryGST again.
    const rawTotalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
    const taxMismatched = Math.abs(totalAmount - (effectiveTaxable + rawTotalTax)) > 1.0;

    // If mismatched, it means the passed-in buckets don't include delivery GST. 
    const effectiveDeliveryGstInBuckets = taxMismatched ? deliveryGST : 0;

    const displayCgst = isInterState ? 0 : (totalCgst + (effectiveDeliveryGstInBuckets / 2));
    const displaySgst = isInterState ? 0 : (totalSgst + (effectiveDeliveryGstInBuckets / 2));
    const displayIgst = isInterState ? (totalIgst + effectiveDeliveryGstInBuckets) : 0;

    const displayTotalTax = isInterState ? displayIgst : (displayCgst + displaySgst);

    return {
      productTaxableFromItems,
      productTaxFromItems,
      isInterState,
      effectiveTaxable,
      displayCgst,
      displaySgst,
      displayIgst,
      displayTotalTax,
    };
  }, [totalTaxableAmount, totalCgst, totalSgst, totalIgst, totalAmount, items, deliveryCharge, deliveryGST]);

  return calculations;
};
