import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";
import { AuthModal as AuthPage } from "@/features/auth";
import { CartItem } from "../components/CartItem";
import { CartSummary } from "../components/CartSummary";
import { EmptyCart } from "../components/EmptyCart";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { BackButton } from "@/shared/components/ui/BackButton";
import { CartMessages } from "@/shared/constants/messages/CartMessages";
import { useCartPage } from "../hooks/useCartPage";

export const CartPage = () => {
  const controller = useCartPage();
  const {
    t,
    items,
    totals,
    isLoading,
    initialized,
    removeItem,
    updateQuantity,
    applyCoupon,
    removeCoupon,
    deliverySettings,
    isCalculating,
    isSyncing,
    isItemSyncing,
    authDialogOpen,
    setAuthDialogOpen,
    availableCoupons,
    handlePlaceOrder,
    enrichedItems,
  } = controller;

  const benefits = [
    {
      icon: <Truck className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_FAST_DELIVERY),
      description: t(CartMessages.BENEFITS_FAST_DELIVERY_DESC)
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_SECURE_PAYMENT),
      description: t(CartMessages.BENEFITS_SECURE_PAYMENT_DESC)
    },
    {
      icon: <RotateCcw className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_EASY_RETURNS),
      description: t(CartMessages.BENEFITS_EASY_RETURNS_DESC)
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_SUPPORT),
      description: t(CartMessages.BENEFITS_SUPPORT_DESC)
    }
  ];

  if (isLoading && !initialized) {
    return (
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-xl">
                  <Skeleton className="h-24 w-24 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-8 w-1/4 mt-2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton to="/shop" label={t(CartMessages.CONTINUE)} />
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 animate-in fade-in duration-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight font-playfair">{t(CartMessages.TITLE)}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              {t(CartMessages.SHOPPING_BAG_COUNT, { count: items.length, item: items.length === 1 ? t(CartMessages.ITEM) : t(CartMessages.ITEMS) })}
            </p>
          </div>
          <BackButton to="/shop" label={t(CartMessages.CONTINUE)} variant="pill" className="rounded-full px-6" />
        </div>

        <div className="relative">
          {isLoading && initialized && (
            <div className="absolute inset-x-0 -top-1 z-50 transform -translate-y-full px-4">
              <div className="h-1 w-full bg-primary/20 overflow-hidden rounded-full">
                <div className="h-full bg-primary animate-progress-indeterminate w-full origin-left-right" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              <div className="space-y-6">
                {enrichedItems.map((item) => (
                  <CartItem
                    key={`${item.productId}-${item.variantId || 'base'}`}
                    item={item}
                    updateQuantity={updateQuantity}
                    removeItem={removeItem}
                    isLoading={isLoading}
                    isCalculating={isItemSyncing(item.productId, item.variantId)}
                    isFreeDelivery={totals?.deliveryCharge === 0}
                  />
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-dashed border-border/60 flex items-center justify-between">
                {items.some(item => (item.variant?.tax_applicable ?? item.product?.default_tax_applicable ?? false)) && (
                  <p className="text-sm text-muted-foreground italic">
                    {items.some(item =>
                      (item.variant?.tax_applicable ?? item.product?.default_tax_applicable ?? false) &&
                      !(item.variant?.price_includes_tax ?? item.product?.default_price_includes_tax ?? false)
                    )
                      ? t(CartMessages.TAX_DISCLAIMER_ADDITIONAL)
                      : t(CartMessages.TAX_DISCLAIMER_INCLUSIVE)}
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-1 relative lg:sticky lg:top-24">
              <CartSummary
                totals={totals}
                itemsCount={items.length}
                isLoading={isLoading}
                onApplyCoupon={applyCoupon}
                onRemoveCoupon={removeCoupon}
                onCheckout={handlePlaceOrder}
                availableCoupons={availableCoupons}
                deliverySettings={deliverySettings}
                isCalculating={isCalculating || isSyncing}
                items={enrichedItems}
              />
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-border/60 pt-16">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl hover:bg-muted/50 transition-all group border border-transparent hover:border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                {benefit.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm uppercase tracking-widest">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-4">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};
