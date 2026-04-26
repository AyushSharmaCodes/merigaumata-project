import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/domains/auth";
import { donationsApi } from "@/domains/donation";
import { loadRazorpay } from "@/core/payments/razorpay";
import { validators } from "@/core/utils/validation";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "@/core/utils/errorUtils";

export function useDonationForm() {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // States
    const [donationType, setDonationType] = useState<"one_time" | "monthly">("one_time");
    const [amount, setAmount] = useState<string>("");
    const [customAmount, setCustomAmount] = useState<string>("");

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: ""
    });
    const [fieldErrors, setFieldErrors] = useState({
        fullName: "",
        email: "",
        phone: ""
    });
    const [recurringConsent, setRecurringConsent] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [statusDialog, setStatusDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        type: "success" | "error";
        redirectToLogin?: boolean;
    }>({
        open: false,
        title: "",
        message: "",
        type: "success",
        redirectToLogin: false
    });

    // Pre-fill user data
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                fullName: user.name || "",
                email: user.email || "",
                phone: user.phone || ""
            }));
        }
    }, [user]);

    const handleAmountSelect = (val: string) => {
        setAmount(val);
        setCustomAmount("");
    };

    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        setCustomAmount(val);
        setAmount(val);
    };

    const handleDonate = async () => {
        const finalAmount = parseInt(amount);
        const trimmedName = formData.fullName.trim();
        const trimmedEmail = formData.email.trim();
        const nextErrors = {
            fullName: trimmedName ? "" : t("donation.validation.fullNameRequired", { defaultValue: "Full name is required" }),
            email: "",
            phone: ""
        };

        if (!trimmedEmail) {
            nextErrors.email = t("donation.validation.emailRequired", { defaultValue: "Email is required" });
        } else {
            const emailError = validators.email(trimmedEmail);
            if (emailError) nextErrors.email = t(emailError);
        }

        if (!formData.phone) {
            nextErrors.phone = t("donation.validation.phoneRequired", { defaultValue: "Phone number is required" });
        } else {
            const phoneError = validators.phone(formData.phone);
            if (phoneError) nextErrors.phone = t(phoneError);
        }

        setFieldErrors(nextErrors);

        if (!finalAmount || finalAmount < 100) {
            setStatusDialog({
                open: true,
                title: t("donation.minDonationTitle"),
                message: t("donation.minDonationMsg"),
                type: "error",
                redirectToLogin: false
            });
            return;
        }

        if (donationType === "monthly" && !recurringConsent) {
            setStatusDialog({
                open: true,
                title: t("donation.consentRequiredTitle"),
                message: t("donation.consentRequiredMsg"),
                type: "error",
                redirectToLogin: false
            });
            return;
        }

        if (donationType === "monthly" && !user) {
            setStatusDialog({
                open: true,
                title: t("errors.auth.loginRequired"),
                message: t("donation.loginRequiredMsg", { defaultValue: "Please log in to start and manage recurring donations." }),
                type: "error",
                redirectToLogin: true
            });
            return;
        }

        if (nextErrors.fullName || nextErrors.email || nextErrors.phone) {
            setStatusDialog({
                open: true,
                title: t("donation.missingDetailsTitle"),
                message: t("donation.validation.fixDetails", { defaultValue: "Please correct the highlighted details before continuing." }),
                type: "error",
                redirectToLogin: false
            });
            return;
        }

        setLoading(true);

        try {
            const isLoaded = await loadRazorpay();
            if (!isLoaded) {
                setStatusDialog({
                    open: true,
                    title: t("donation.connectionErrorTitle"),
                    message: t("donation.connectionErrorMsg"),
                    type: "error",
                    redirectToLogin: false
                });
                setLoading(false);
                return;
            }

            if (donationType === "one_time") {
                const orderData = await donationsApi.donations.createOrder({
                    amount: finalAmount,
                    donorName: trimmedName,
                    donorEmail: trimmedEmail,
                    donorPhone: formData.phone,
                    isAnonymous: false
                });

                const options = {
                    key: orderData.key_id,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: t("common.orgName", "Meri Gau Mata"),
                    description: `${t("donation.refLabel")} ${orderData.donation_ref}`,
                    order_id: orderData.order_id,
                    handler: async (response: {
                        razorpay_order_id: string;
                        razorpay_payment_id: string;
                        razorpay_signature: string;
                    }) => {
                        setLoadingMessage(t("donation.verifying"));
                        setLoading(true);
                        try {
                            await donationsApi.donations.verifyPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                donation_ref: orderData.donation_ref
                            });

                            setLoading(false);
                            setLoadingMessage("");
                            setStatusDialog({
                                open: true,
                                title: t("donation.thankYouTitle"),
                                message: t("donation.thankYouMsg"),
                                type: "success",
                                redirectToLogin: false
                            });
                            setAmount("");
                            setCustomAmount("");
                        } catch (err) {
                            setLoading(false);
                            setLoadingMessage("");
                            setStatusDialog({
                                open: true,
                                title: t("donation.verificationFailedTitle"),
                                message: t("donation.verificationFailedMsg"),
                                type: "error",
                                redirectToLogin: false
                            });
                        }
                    },
                    prefill: {
                        name: trimmedName,
                        email: trimmedEmail,
                        contact: formData.phone
                    },
                    theme: {
                        color: "#C8815F"
                    }
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.on('payment.failed', () => {
                    setTimeout(() => {
                        setLoading(false);
                        setLoadingMessage("");
                        setStatusDialog({
                            open: true,
                            title: t("donation.paymentFailedTitle"),
                            message: t("donation.paymentFailedMsg"),
                            type: "error",
                            redirectToLogin: false
                        });
                    }, 300);
                });
                rzp.on('payment.error', () => {
                    setTimeout(() => {
                        setLoading(false);
                        setLoadingMessage("");
                    }, 300);
                });
                setLoading(false);
                rzp.open();
            } else {
                const subscriptionData = await donationsApi.donations.createSubscription({
                    amount: finalAmount,
                    donorName: trimmedName,
                    donorEmail: trimmedEmail,
                    donorPhone: formData.phone,
                    isAnonymous: false
                });

                const options = {
                    key: subscriptionData.key_id,
                    subscription_id: subscriptionData.subscription_id,
                    name: `${t("common.orgName", "Meri Gau Mata")} - ${t("donation.monthly")}`,
                    description: `${t("donation.monthlySupportLabel")} \u20b9${finalAmount}`,
                    handler: async (_response: unknown) => {
                        setStatusDialog({
                            open: true,
                            title: t("donation.subscriptionStartedTitle"),
                            message: t("donation.subscriptionStartedMsg"),
                            type: "success",
                            redirectToLogin: false
                        });
                        setAmount("");
                        setCustomAmount("");
                    },
                    prefill: {
                        name: trimmedName,
                        email: trimmedEmail,
                        contact: formData.phone
                    },
                    theme: {
                        color: "#C8815F"
                    }
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.on('payment.failed', () => {
                    setTimeout(() => {
                        setStatusDialog({
                            open: true,
                            title: t("donation.paymentFailedTitle"),
                            message: t("donation.paymentFailedMsg"),
                            type: "error",
                            redirectToLogin: false
                        });
                    }, 300);
                });
                setLoading(false);
                rzp.open();
            }
        } catch (error: unknown) {
            setStatusDialog({
                open: true,
                title: t("common.error"),
                message: getErrorMessage(error, t, "donation.initiateFailed"),
                type: "error",
                redirectToLogin: false
            });
            setLoading(false);
            setLoadingMessage("");
        }
    };

    const amounts = [
        { value: "500", label: "\u20b9500", desc: t("donation.amounts.day") },
        { value: "2100", label: "\u20b92,100", desc: t("donation.amounts.medical"), popular: true },
        { value: "5100", label: "\u20b95,100", desc: t("donation.amounts.fodder") }
    ];

    return {
        t,
        donationType,
        setDonationType,
        amount,
        customAmount,
        formData,
        setFormData,
        fieldErrors,
        setFieldErrors,
        recurringConsent,
        setRecurringConsent,
        loading,
        loadingMessage,
        statusDialog,
        setStatusDialog,
        handleAmountSelect,
        handleCustomAmountChange,
        handleDonate,
        amounts,
        navigate
    };
}
