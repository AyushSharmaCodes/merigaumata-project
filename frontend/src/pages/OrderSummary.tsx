import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, Package, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { CartItem } from "@/types";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";

const DELIVERY_THRESHOLD = 2000;
const DELIVERY_CHARGE = 50;

const OrderSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { user } = useAuthStore();

  const { addressId, orderDetails } = location.state || {};

  // Mock addresses - in real app, these would come from user profile
  const addresses = user?.addresses || [
    {
      id: "1",
      name: "Home",
      addressLine: "123 Main Street, Apartment 4B",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      pincode: "110001",
      isDefault: true,
    },
    {
      id: "2",
      name: "Office",
      addressLine: "456 Business Park, Tower A, Floor 5",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      pincode: "122001",
      isDefault: false,
    },
  ];

  const selectedAddress = addresses.find((addr) => addr.id === addressId);

  // Redirect if no order details
  if (!orderDetails || !selectedAddress) {
    navigate("/cart");
    return null;
  }

  const { items, totalMRP, totalPrice, discount, deliveryCharges, orderTotal } =
    orderDetails;

  const handleProceedToPayment = () => {
    toast.error(
      t("orderSummary.legacyFlowUnavailable", {
        defaultValue: "This payment screen is no longer available. Please complete checkout from the current checkout page.",
      })
    );
    navigate("/checkout");
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/checkout")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("orderSummary.backToCheckout")}
        </Button>

        <h1 className="text-3xl font-bold mb-8">{t("orderSummary.title")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {t("orderSummary.deliveryAddress")}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/checkout")}
                  >
                    {t("orderSummary.change")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-semibold text-base">
                    {selectedAddress.name}
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedAddress.addressLine}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAddress.city}, {selectedAddress.state} -{" "}
                    {selectedAddress.pincode}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAddress.country}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {t("orderSummary.orderItems")} ({items.length}{" "}
                  {items.length === 1 ? t("orderSummary.item") : t("orderSummary.items")})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item: CartItem) => {
                  const itemMRP = item.product.mrp || item.product.price;
                  const hasDiscount = itemMRP > item.product.price;

                  return (
                    <div
                      key={item.productId}
                      className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        loading="lazy"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                          {item.product.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          {t("orderSummary.qty")}: {item.quantity}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-base font-bold text-primary">
                            {formatAmount(item.product.price * item.quantity)}
                          </p>
                          {hasDiscount && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatAmount(itemMRP * item.quantity)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right: Payment Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>{t("orderSummary.paymentSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Items Price */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("orderSummary.itemsPrice")}</span>
                  <span className="font-medium">{formatAmount(totalMRP)}</span>
                </div>

                {/* Discount */}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("orderSummary.discountPrice")}
                    </span>
                    <span className="font-medium text-green-600">
                      -{formatAmount(discount)}
                    </span>
                  </div>
                )}

                {/* Delivery Charges */}
                {(() => {
                  let refundable = 0;
                  let nonRefundable = 0;

                  if (items && items.length > 0) {
                    items.forEach((item: any) => {
                      const meta = item.delivery_meta || {};
                      const base = item.delivery_charge || 0;
                      const gst = item.delivery_gst || 0;
                      if (meta.source !== 'global') {
                        if (meta.delivery_refund_policy === 'REFUNDABLE') {
                          refundable += base + gst;
                        } else if (meta.delivery_refund_policy === 'PARTIAL') {
                          const totalItemDelivery = base + gst;
                          const nonRefComponent = (meta.non_refundable_delivery_charge || 0) + (meta.non_refundable_delivery_gst || 0);
                          refundable += (totalItemDelivery - nonRefComponent);
                          nonRefundable += nonRefComponent;
                        } else {
                          nonRefundable += base + gst;
                        }
                      }
                    });
                  }

                  const globalDel = Math.max(0, deliveryCharges - refundable - nonRefundable);
                  nonRefundable += globalDel;

                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("orderSummary.deliveryCharges")}
                          {totalPrice < DELIVERY_THRESHOLD && (
                            <span className="block text-xs mt-0.5">
                              {t("orderSummary.freeThreshold", { amount: DELIVERY_THRESHOLD })}
                            </span>
                          )}
                        </span>
                        <span className="font-medium">
                          {deliveryCharges === 0 ? (
                            <span className="text-green-600">{t("orderSummary.free")}</span>
                          ) : (
                            formatAmount(deliveryCharges)
                          )}
                        </span>
                      </div>
                      {deliveryCharges > 0 && refundable > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2 border-l-2 border-blue-500/30 mt-1">
                          <span>{t("products.refundableSurcharge", "Refundable Surcharge")}</span>
                          <span>{formatAmount(refundable)}</span>
                        </div>
                      )}
                      {deliveryCharges > 0 && nonRefundable > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2 border-l-2 border-orange-500/30 mt-1">
                          <span>{t("products.additionalProcessing", "Additional Processing")} <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef", "Non-Refundable")})</span></span>
                          <span>{formatAmount(nonRefundable)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Separator />

                {/* Order Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold">{t("orderSummary.orderTotal")}</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatAmount(orderTotal)}
                  </span>
                </div>

                {/* Savings Info */}
                {discount > 0 && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      {t("orderSummary.savedMessage", { amount: discount })}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleProceedToPayment}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  {t("orderSummary.proceedPayment")}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {t("orderSummary.termsAgreement")}
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
