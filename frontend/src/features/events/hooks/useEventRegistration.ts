import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/domains/content";
import { useAuthStore } from "@/domains/auth";
import { apiClient } from "@/core/api/api-client";
import { CONFIG, APP_NAME } from "@/app/config";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { loadRazorpay, prefetchRazorpay } from "@/core/payments/razorpay";

export const useEventRegistration = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
        phone: prev.phone || user.phone || "",
      }));
    }
    prefetchRazorpay();
  }, [user]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = t("validation.requiredField", { field: t("events.registration.fullName") });
    if (!formData.email.trim()) {
      newErrors.email = t("validation.requiredField", { field: t("events.registration.email") });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("validation.invalidEmail");
    }
    if (!formData.phone || formData.phone.trim().length < 13) newErrors.phone = t("validation.minLength", { field: t("events.registration.phone"), count: 10 });
    if (!agreedToTerms) newErrors.terms = t("events.registration.termsRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || user.email.trim() === "") {
      setErrors(prev => ({ ...prev, email: t("events.registration.addEmailProfile") }));
      return;
    }
    if (validateForm()) {
      try {
        setIsCheckingEligibility(true);
        await apiClient.get(`/event-registrations/check-eligibility`, {
          params: { eventId, email: formData.email },
          timeout: 10000,
        });
        setShowConfirmDialog(true);
      } catch (error: unknown) {
        setStatusDialog({
          open: true,
          title: t("events.registration.failedTitle"),
          message: getErrorMessage(error, t, "events.registration.genericError"),
          type: "error",
        });
      } finally {
        setIsCheckingEligibility(false);
      }
    }
  };

  const handleConfirmRegistration = async () => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const response = await apiClient.post("/event-registrations/create-order", {
        eventId,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
      });
      const data = response.data;
      if (!data.success) throw new Error(data.error || t("events.registration.genericError"));

      if (data.isFree) {
        setShowConfirmDialog(false);
        setTimeout(() => setStatusDialog({
          open: true,
          title: t("events.registration.successTitle"),
          message: "",
          type: "success",
          data: {
            registrationNumber: data.registration.registrationNumber,
            eventTitle: event.title,
            amount: t("events.registration.free"),
            email: formData.email
          },
          onClose: () => navigate("/profile?tab=events"),
        }), 300);
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: APP_NAME || t("common.brandName"),
        description: t("events.registration.razorpayDesc", { title: event.title }),
        order_id: data.order_id,
        handler: async function (paymentResponse: any) {
          setStatusDialog({ open: true, title: t("events.registration.verifying"), message: t("events.registration.processing"), type: "loading" });
          try {
            const verifyRes = await apiClient.post("/event-registrations/verify-payment", {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              registration_id: data.registration_id,
              razorpay_invoice_id: data.invoice_id
            });
            if (verifyRes.data.success) {
              setStatusDialog({
                open: true,
                title: t("events.registration.paymentSuccessTitle"),
                message: "",
                type: "success",
                data: {
                  registrationNumber: verifyRes.data.registration.registrationNumber,
                  eventTitle: verifyRes.data.registration.eventTitle,
                  amount: verifyRes.data.registration.amount,
                  email: formData.email
                },
                onClose: () => navigate("/profile?tab=events"),
              });
            } else throw new Error(t("errors.payment.genericError"));
          } catch (verifyError: unknown) {
            setIsProcessing(false);
            setStatusDialog({
              open: true,
              title: t("events.registration.verificationIssue"),
              message: getErrorMessage(verifyError, t, "events.registration.verificationIssue"),
              type: "error",
            });
          }
        },
        prefill: { name: formData.fullName, email: formData.email, contact: formData.phone },
        theme: { color: "#C8815F" },
        modal: {
          ondismiss: () => {
            setTimeout(() => {
              setStatusDialog(prev => {
                if (prev.type !== 'loading' && prev.type !== 'success') {
                  setIsProcessing(false);
                  setShowConfirmDialog(false);
                }
                return prev;
              });
            }, 500);
          }
        }
      };

      setShowConfirmDialog(false);
      const isLoaded = await loadRazorpay();
      if (!isLoaded || !window.Razorpay) throw new Error(t("errors.payment.gatewayError"));
      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (error: unknown) {
      setIsProcessing(false);
      setStatusDialog({
        open: true,
        title: t("events.registration.failedTitle"),
        message: getErrorMessage(error, t, "events.registration.genericError"),
        type: "error",
      });
    } finally {
      if (event?.registrationAmount === 0) setIsProcessing(false);
    }
  };

  return {
    t, event, isLoading, navigate,
    formData, setFormData,
    agreedToTerms, setAgreedToTerms,
    showConfirmDialog, setShowConfirmDialog,
    errors,
    isCheckingEligibility,
    isProcessing,
    statusDialog, setStatusDialog,
    handleInputChange,
    handleSubmit,
    handleConfirmRegistration,
  };
};
