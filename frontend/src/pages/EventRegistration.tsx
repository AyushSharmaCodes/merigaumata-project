import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CONFIG, APP_NAME } from "@/config";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Banknote, ArrowLeft, Loader2, User, Mail, Phone, Ticket, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { eventService } from "@/services/event.service";
import { useAuthStore } from "@/store/authStore";

import { apiClient } from "@/lib/api-client";
import { PhoneInput } from "@/components/ui/phone-input";
import { getErrorMessage } from "@/lib/errorUtils";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { loadRazorpay, prefetchRazorpay } from "@/lib/razorpay";
import { useCurrency } from "@/contexts/CurrencyContext";

const EventRegistration = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "loading";
    data?: {
      registrationNumber: string;
      eventTitle: string;
      amount: string | number;
      email: string;
    };
    onClose?: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    type: "success",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId, i18n.language],
    queryFn: () => eventService.getById(eventId || ""),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        fullName: prev.fullName || user.name || "",
        email: prev.email || user.email || "",
        // Only set phone if currently empty to avoid overwriting typed input
        phone: prev.phone || user.phone || "",
      }));
    }

    // Prefetch Razorpay script when user visits page
    prefetchRazorpay();
  }, [user]);

  // Early return for loading state
  if (isLoading) {
    return <LoadingOverlay isLoading={true} />;
  }

  // Early return if event not found
  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t("events.registration.notFound")}</h2>
          <Button onClick={() => navigate("/events")}>{t("events.registration.backToEvents")}</Button>
        </div>
      </div>
    );
  }

  // Extract event data - TypeScript now knows event exists due to the guard above
  const eventData = event;
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;
  const isRegistrationClosed =
    eventData.isRegistrationEnabled === false ||
    eventData.status === "cancelled" ||
    eventData.status === "completed";

  if (isRegistrationClosed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold">{t("events.registration.closed", { defaultValue: "Registration is closed" })}</h2>
          <p className="text-muted-foreground text-sm">
            {t("events.registration.closedDesc", { defaultValue: "This event is no longer accepting registrations." })}
          </p>
          <Button onClick={() => navigate(`/event/${eventId}`)}>{t("events.registration.backToEvent", { defaultValue: "Back to Event" })}</Button>
        </div>
      </div>
    );
  }

  // Check if event is full
  const isEventFull = eventData.capacity != null && eventData.capacity > 0 && (eventData.registrations || 0) >= eventData.capacity;
  if (isEventFull) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold">{t("events.registration.eventFull", { defaultValue: "This event is fully booked" })}</h2>
          <p className="text-muted-foreground text-sm">{t("events.registration.eventFullDesc", { defaultValue: "All available slots have been filled. Please check back later as slots may open up if cancellations occur." })}</p>
          <Button onClick={() => navigate(`/event/${eventId}`)}>{t("events.registration.backToEvent", { defaultValue: "Back to Event" })}</Button>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t("validation.required", { field: t("events.registration.fullName") });
    }

    if (!formData.email.trim()) {
      newErrors.email = t("validation.required", { field: t("events.registration.email") });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("validation.invalidEmail");
    }

    if (!formData.phone || formData.phone.trim().length < 13) {
      newErrors.phone = t("validation.minLength", { field: t("events.registration.phone"), count: 10 });
    }

    if (!agreedToTerms) {
      newErrors.terms = t("validation.required", { field: t("events.registration.terms") });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email || user.email.trim() === "") {
      setErrors((prev) => ({
        ...prev,
        email: t("events.registration.addEmailProfile"),
      }));
      return;
    }

    if (validateForm()) {
      setShowConfirmDialog(true);
    }
  };


  // Helper to ensure dialog animations complete before opening the next one
  const switchDialogs = (nextDialogAction: () => void) => {
    setShowConfirmDialog(false);
    setTimeout(() => {
      nextDialogAction();
    }, 300); // Wait for close animation
  };

  const handleConfirmRegistration = async () => {
    setIsProcessing(true);

    // Keep dialog open while processing
    try {
      // Call backend to create order using apiClient for proper auth
      const response = await apiClient.post("/event-registrations/create-order", {
        eventId,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || t("events.registration.genericError"));
      }

      // Handle free event registration
      if (data.isFree) {
        switchDialogs(() => setStatusDialog({
          open: true,
          title: t("events.registration.successTitle"),
          message: "", // Message is now rendered via data
          type: "success",
          data: {
            registrationNumber: data.registration.registrationNumber,
            eventTitle: eventData.title,
            amount: t("events.registration.free"),
            email: formData.email
          },
          onClose: () => navigate("/profile?tab=events"),
        }));
        return;
      }

      // Handle paid event - open Razorpay
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: APP_NAME || t("common.brandName"),
        description: t("events.registration.razorpayDesc", { title: eventData.title }),
        order_id: data.order_id,
        handler: async function (paymentResponse: Record<string, unknown>) {
          // Show verifying spinner
          setStatusDialog({
            open: true,
            title: t("events.registration.verifying"),
            message: t("events.registration.processing"),
            type: "loading"
          });

          // Verify payment using apiClient
          try {
            const verifyRes = await apiClient.post(
              "/event-registrations/verify-payment",
              {
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                registration_id: data.registration_id,
                razorpay_invoice_id: data.invoice_id // Pass invoice ID for fallback
              }
            );

            const verifyData = verifyRes.data;

            if (verifyData.success) {
              setStatusDialog({
                open: true,
                title: t("events.registration.paymentSuccessTitle"),
                message: "", // Message is now rendered via data
                type: "success",
                data: {
                  registrationNumber: verifyData.registration.registrationNumber,
                  eventTitle: verifyData.registration.eventTitle,
                  amount: verifyData.registration.amount,
                  email: formData.email
                },
                // Redirect to Profile > Events tab on success
                onClose: () => navigate("/profile?tab=events"),
              });
            } else {
              throw new Error(t("errors.payment.genericError"));
            }
          } catch (verifyError: unknown) {
            logger.error("Verification error:", verifyError);
            setIsProcessing(false); // Reset processing state so user can retry

            // Determine user-friendly error message
            let userMessage = t("events.registration.verificationIssue");
            const serverMsg = getErrorMessage(verifyError, t, "events.registration.verificationIssue");

            // Handle specific refund cases
            if (serverMsg && (serverMsg.includes('refunded') || serverMsg.includes('Registration failed'))) {
              userMessage = t("events.registration.failedRefunded");
            } else if (serverMsg && serverMsg.includes('timeout')) {
              userMessage = t("events.registration.verifyTimeout");
            }

            setStatusDialog({
              open: true,
              title: t("events.registration.verificationIssue"),
              message: userMessage,
              type: "error",
            });
          }
        },
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#C8815F",
        },
        modal: {
          ondismiss: function () {
            logger.debug("Payment modal closed");
            // If we are NOT in loading state (meaning payment hasn't started verification), reset processing
            // Use a timeout to check if the statusDialog was set to loading by the handler
            setTimeout(() => {
              setStatusDialog(prev => {
                if (prev.type !== 'loading' && prev.type !== 'success') {
                  setIsProcessing(false);
                  setShowConfirmDialog(false);
                }
                return prev;
              });
            }, 500);
          },
        },
      };

      // Close confirm dialog before opening Razorpay
      setShowConfirmDialog(false);

      // Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpay();

      if (!isLoaded) {
        throw new Error(t("errors.payment.gatewayError"));
      }

      if (!window.Razorpay) {
        throw new Error(t("errors.payment.gatewayError"));
      }

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

    } catch (error: unknown) {
      logger.error("Registration error:", error);
      const errorMessage = getErrorMessage(error, t, "events.registration.genericError");

      setIsProcessing(false); // Reset processing state on error
      setStatusDialog({
        open: true,
        title: t("events.registration.failedTitle"),
        message: errorMessage,
        type: "error",
      });
    } finally {
      // Don't set isProcessing false here for paid events because payment flow continues async
      // Handled in ondismiss or handler
      const isFree = event?.registrationAmount === 0;
      if (isFree) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <LoadingOverlay
        isLoading={statusDialog.open && statusDialog.type === "loading"}
        message={statusDialog.message}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Title Section */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("events.registration.title")}</h1>
          <div className="w-20 h-1 bg-primary mx-auto"></div>
        </div>

        {/* Registration Card */}
        <Card className="overflow-hidden border-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left Side - Form */}
            <div className="p-6 bg-background">
              <h2 className="text-xl font-bold mb-5">{t("events.registration.bookSeat")}</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("events.registration.fullName")}</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder={t("events.registration.fullNamePlaceholder")}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">{t("events.registration.email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={t("events.registration.emailPlaceholder")}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onChange={(val) => {
                      setFormData((prev) => ({ ...prev, phone: val }));
                      if (errors.phone) {
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    error={errors.phone}
                    label={t("events.registration.phone")}
                    required={true}
                  />
                </div>

                {/* Registration Amount Display */}
                <div className="space-y-2">
                  <Label>{t("events.registration.amount")}</Label>
                  <div className="bg-muted/50 p-4 rounded-lg border space-y-2">
                    {!isFree && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("events.registration.basePrice")}:</span>
                        <span className="font-medium">
                          {formatAmount(registrationAmount / (1 + (eventData.gstRate || 0) / 100))}
                        </span>
                      </div>
                    )}
                    {!isFree && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("events.registration.gst")} ({eventData.gstRate || 0}%):</span>
                        <span className="font-medium">
                          {formatAmount(registrationAmount - (registrationAmount / (1 + (eventData.gstRate || 0) / 100)))}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <span className="text-sm font-bold text-foreground">
                        {t("events.registration.total")} {!isFree && t("events.registration.inclusiveTax")}:
                      </span>
                      <span className="text-lg font-black text-primary">
                        {isFree ? t("events.registration.free") : formatAmount(registrationAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => {
                      setAgreedToTerms(checked as boolean);
                      if (errors.terms) {
                        setErrors((prev) => ({ ...prev, terms: "" }));
                      }
                    }}
                    className={errors.terms ? "border-destructive" : ""}
                  />
                  <Label className="text-sm cursor-pointer">
                    {t("events.registration.agreeTo")}{" "}
                    <a
                      href="/terms-and-conditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      {t("events.registration.terms")}
                    </a>
                  </Label>
                </div>
                {errors.terms && (
                  <p className="text-sm text-destructive">{errors.terms}</p>
                )}

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg">
                  {t("events.registration.confirm")}
                </Button>
              </form>
            </div>

            {/* Right Side - Event Image */}
            <div className="relative h-full min-h-[500px] lg:min-h-0">
              {eventData.image ? (
                <img
                  src={eventData.image}
                  alt={eventData.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center py-12">
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {t("events.registration.noImage")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("events.registration.confirm")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <User className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.fullName")}</p>
                      <p className="font-medium text-foreground">{formData.fullName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.email")}</p>
                      <p className="font-medium text-foreground break-all">{formData.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.phone")}</p>
                      <p className="font-medium text-foreground">{formData.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Calendar className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.event")}</p>
                      <p className="font-medium text-foreground">{eventData.title}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                  {!isFree && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{t("events.registration.basePrice")}</span>
                      <span>{formatAmount(registrationAmount / (1 + (eventData.gstRate || 0) / 100))}</span>
                    </div>
                  )}
                  {!isFree && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{t("events.registration.gst")} ({eventData.gstRate || 0}%)</span>
                      <span>{formatAmount(registrationAmount - (registrationAmount / (1 + (eventData.gstRate || 0) / 100)))}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-primary" />
                      <span className="font-bold">{t("events.registration.amountPaid")}</span>
                    </div>
                    <span className="text-2xl font-black text-primary">
                      {isFree ? t("events.registration.free") : formatAmount(registrationAmount)}
                    </span>
                  </div>
                </div>

                {!isFree && isProcessing && (
                  <p className="text-xs text-center text-muted-foreground">
                    {t("events.registration.redirecting")}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("events.registration.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => {
              if (isProcessing) {
                e.preventDefault(); // Prevent closing while processing
                return;
              }
              e.preventDefault(); // Take control of closing
              handleConfirmRegistration();
            }} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFree ? t("events.registration.confirm") : t("events.registration.proceedPayment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Dialog (Success/Error/Loading) */}
      <AlertDialog
        open={statusDialog.open && statusDialog.type !== "loading"}
        onOpenChange={(open) => {
          // Prevent closing if loading
          if (statusDialog.type === 'loading') return;
          if (!open) {
            setStatusDialog((prev) => ({ ...prev, open: false }));
            if (statusDialog.onClose) statusDialog.onClose();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={
                statusDialog.type === "error" ? "text-destructive" : "text-primary"
              }
            >
              {statusDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="w-full">


                {statusDialog.type === 'error' && (
                  <div className="space-y-6 pt-2">
                    <div className="flex justify-center">
                      <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
                        <XCircle className="h-12 w-12 text-destructive" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-lg font-semibold text-foreground">{t("events.registration.failedTitle")}</p>
                      <p className="whitespace-pre-line text-muted-foreground">{statusDialog.message}</p>
                    </div>
                  </div>
                )}

                {statusDialog.type === 'success' && statusDialog.data && (
                  <div className="space-y-6 pt-2">
                    <div className="flex justify-center">
                      <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-muted-foreground">{t("events.registration.successDesc")}</p>
                      <p className="text-sm text-muted-foreground">{t("events.registration.emailSent", { email: statusDialog.data.email })}</p>
                    </div>

                    <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("events.registration.registrationId")}</span>
                        <span className="font-mono font-medium">{statusDialog.data.registrationNumber}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("events.registration.event")}</span>
                        <span className="font-medium text-right w-1/2">{statusDialog.data.eventTitle}</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="font-medium text-primary">{t("events.registration.amountPaid")}</span>
                        <span className="font-bold text-lg text-primary">
                          {typeof statusDialog.data.amount === 'number' ? formatAmount(statusDialog.data.amount) : statusDialog.data.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statusDialog.type !== 'loading' && (
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setStatusDialog((prev) => ({ ...prev, open: false }));
                  if (statusDialog.onClose) statusDialog.onClose();
                }}
              >
                {t("events.registration.ok")}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
};

export default EventRegistration;
