import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2 } from "lucide-react";
import { AddressSelector } from "../components/AddressSelector";
import { PriceBreakdown } from "../components/PriceBreakdown";
import { OutOfStockModal } from "../components/OutOfStockModal";
import { CheckoutCouponSection } from "../components/CheckoutCouponSection";
import { CheckoutPaymentSection } from "../components/CheckoutPaymentSection";
import { CheckoutSkeleton } from "@/shared/components/ui/page-skeletons";
import { CheckoutHeader } from "../components/CheckoutHeader";
import { CheckoutItemsSummary } from "../components/CheckoutItemsSummary";
import { useCheckoutPage } from "../hooks/useCheckoutPage";
import { CheckoutMessages } from "@/shared/constants/messages/CheckoutMessages";
import { CartMessages } from "@/shared/constants/messages/CartMessages";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";
import { ValidationMessages } from "@/shared/constants/messages/ValidationMessages";

export function CheckoutPage() {

  const controller = useCheckoutPage();
  const {
    t,
    loading,
    processing,
    statusMessage,
    summary,
    couponBusy,
    couponsLoading,
    isBuyNow,
    shippingAddress,
    billingAddress,
    billingSameAsShipping,
    setBillingSameAsShipping,
    addressIdToEdit,
    setAddressIdToEdit,
    stockIssues,
    setStockIssues,
    showStockModal,
    setShowStockModal,
    eligibleCoupons,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleShippingAddressSelect,
    handlePayment,
    cartItems,
    user,
    removeItem,
    fetchCheckoutSummary,
    setBillingAddress,
  } = controller;

  if (loading && !summary) return <CheckoutSkeleton />;
  if (!summary) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <CheckoutHeader />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="space-y-8">
          <CheckoutItemsSummary items={cartItems} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-8 space-y-8">
              {/* Shipping Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">1</div>
                    {t(CheckoutMessages.SHIPPING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <AddressSelector
                    type="shipping"
                    selectedAddressId={shippingAddress?.id}
                    onSelect={handleShippingAddressSelect}
                    forceEditId={addressIdToEdit}
                    onEditOpened={() => setAddressIdToEdit(null)}
                    profilePhone={user?.phone}
                  />
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">2</div>
                    {t(CheckoutMessages.BILLING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center space-x-2 bg-muted/20 p-4 rounded-lg border border-border/40">
                    <input
                      type="checkbox"
                      id="billingSameAsShipping"
                      checked={billingSameAsShipping}
                      onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="billingSameAsShipping" className="text-sm font-medium leading-none cursor-pointer">
                      {t(CheckoutMessages.BILLING_SAME)}
                    </label>
                  </div>

                  {!billingSameAsShipping && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <AddressSelector
                        type="billing"
                        selectedAddressId={billingAddress?.id}
                        onSelect={setBillingAddress}
                        profilePhone={user?.phone}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coupon Section (Only for Buy Now) */}
              {isBuyNow && (
                <Card className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">3</div>
                      {t(CartMessages.COUPON_TITLE)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <CheckoutCouponSection
                      onApply={handleApplyCoupon}
                      onRemove={handleRemoveCoupon}
                      appliedCoupon={summary.totals.coupon}
                      availableCoupons={eligibleCoupons}
                      isLoading={couponBusy || couponsLoading}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Order Summary & Payment */}
            <div className="lg:col-span-4 space-y-6 sticky top-8">
              <Card className="border-none shadow-lg overflow-hidden ring-1 ring-primary/5">
                <CardHeader className="bg-primary text-primary-foreground pb-6">
                  <CardTitle className="text-xl">{t(CheckoutMessages.SUMMARY)}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <PriceBreakdown
                    totals={summary.totals}
                    items={cartItems}
                  />
                  
                  <CheckoutPaymentSection
                    onPayment={handlePayment}
                    isProcessing={processing}
                    statusMessage={statusMessage}
                    totalAmount={summary.totals.finalAmount}
                  />

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <OutOfStockModal
        open={showStockModal}
        onOpenChange={setShowStockModal}
        stockIssues={stockIssues}
        onRemoveItem={async (pid, vid) => {
          await removeItem(pid, vid || undefined);
          setTimeout(() => fetchCheckoutSummary(), 100);
          setStockIssues(prev => prev.filter(item => !(item.productId === pid && item.variantId === vid)));
        }}
      />
    </div>
  );
}
