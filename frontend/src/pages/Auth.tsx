import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { AuthMessages } from "../constants/messages/AuthMessages";
import { ProfileMessages } from "../constants/messages/ProfileMessages";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useNavigate } from "react-router-dom";
import {
  registerUser,
  loginWithGoogle,
  requestPasswordReset,
  validateCredentials,
  verifyLoginOtp,
  resendConfirmationEmail
} from "@/lib/services/auth.service";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types";
import { getErrorMessage, getErrorDetails, getApiError } from "@/lib/errorUtils";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FormError } from "@/components/ui/form-error";

type AuthStep = "login" | "register" | "forgot-password" | "success";

interface AuthPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStep?: "login" | "register";
}

export default function AuthPage({
  open,
  onOpenChange,
  defaultStep = "login",
}: AuthPageProps) {
  const { t } = useTranslation();
  const initialStep = defaultStep.includes("register") ? "register" : "login";

  const [step, setStep] = useState<AuthStep>(initialStep);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    otp: "" // Added OTP
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false); // Added OTP state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showResendConfirmationPrompt, setShowResendConfirmationPrompt] = useState(false);

  const getApiErrorCode = (error: unknown) => getApiError(error)?.code;
  const getApiErrorKey = (error: unknown) => getApiError(error)?.error;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setFormData({ email: "", password: "", name: "", phone: "", otp: "" });
      setFieldErrors({});
      setShowOtp(false); // Reset OTP screen state
      setShowResendConfirmationPrompt(false);
    }
  }, [open, initialStep]);

  // Auto-hide general errors after 5 seconds
  useEffect(() => {
    if (fieldErrors.general) {
      const timer = setTimeout(() => {
        setFieldErrors((prev) => {
          const { general, ...rest } = prev;
          return rest;
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fieldErrors.general]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (showOtp) {
        // Step 2: Verify OTP
        if (!formData.otp || formData.otp.length < 6) {
          toast.error(t(AuthMessages.INVALID_OTP_TOAST));
          setIsLoading(false);

          return;
        }

        const user = await verifyLoginOtp(formData.email, formData.otp);

        login(user);
        toast.success(t(AuthMessages.LOGIN_SUCCESS_TOAST));
        if (user.mustChangePassword) {
          toast.info(
            t("auth.forceChangePassword.description", {
              defaultValue: "For security, please change your temporary password before continuing."
            })
          );
        }
        onOpenChange(false);
        setShowOtp(false); // Reset for next time


        const returnUrl = sessionStorage.getItem("authReturnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("authReturnUrl");
          navigate(returnUrl);
        } else if (user.role === "admin") {
          navigate("/admin");
        } else if (user.role === "manager") {
          navigate("/manager");
        } else {
          navigate("/");
        }
      } else {
        // Step 1: Validate Credentials
        const res = await validateCredentials(formData.email, formData.password);
        if (res.success) {
          toast.success(t(AuthMessages.OTP_SENT_TOAST));
          setShowOtp(true);
          setFieldErrors({}); // Clear errors when moving to OTP step
          setShowResendConfirmationPrompt(false);
        } else {
          // Pass the error to the catch block to be handled by getErrorDetails/getErrorMessage
          throw new Error(res.error || t(AuthMessages.VALIDATION_FAILED));
        }

      }
    } catch (error: unknown) {
      logger.error("Login error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        const generalMessage = getErrorMessage(error, t, AuthMessages.LOGIN_FAILED);
        const errorCode = getApiErrorCode(error);
        const errorKey = getApiErrorKey(error);
        const requiresResendConfirmation = errorCode === "EMAIL_NOT_CONFIRMED" || errorKey === "errors.auth.emailNotConfirmed";

        if (showOtp || errorCode === "INVALID_OTP" || errorCode === "OTP_EXPIRED" || errorKey === "errors.auth.invalidOtp" || errorKey === "errors.auth.otpExpired") {
          setFieldErrors({ otp: generalMessage });
          toast.error(generalMessage);
        } else if (errorCode === "INVALID_PASSWORD" || errorKey === "errors.auth.invalidPassword") {
          setFieldErrors({ password: generalMessage });
          toast.error(generalMessage);
        } else {
          setFieldErrors({ general: generalMessage });
          toast.error(generalMessage);
        }
        setShowResendConfirmationPrompt(requiresResendConfirmation);
      }

    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFieldErrors({});

    // Validate phone
    if (!formData.phone || formData.phone.length < 10) {
      setFieldErrors(prev => ({ ...prev, phone: t(AuthMessages.PHONE_REQUIRED_TOAST) }));
      setIsLoading(false);
      return;
    }

    // Validate password
    const passwordErrors: string[] = [];
    if (formData.password.length < 8) {
      passwordErrors.push(t(AuthMessages.PASSWORD_LENGTH));
    }
    if (!/[A-Z]/.test(formData.password)) {
      passwordErrors.push(t(AuthMessages.PASSWORD_UPPERCASE));
    }
    if (!/[a-z]/.test(formData.password)) {
      passwordErrors.push(t(AuthMessages.PASSWORD_LOWERCASE));
    }
    if (!/[0-9]/.test(formData.password)) {
      passwordErrors.push(t(AuthMessages.PASSWORD_NUMBER));
    }
    if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      passwordErrors.push(t(AuthMessages.PASSWORD_SPECIAL));
    }

    if (passwordErrors.length > 0) {
      setFieldErrors(prev => ({ ...prev, password: passwordErrors.join("\n") }));
      setIsLoading(false);
      return;
    }

    try {
      await registerUser({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
      });

      setStep("success");
      toast.success(t(AuthMessages.ACCOUNT_CREATED_TOAST));


    } catch (error: unknown) {
      logger.error("Registration error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        const errorMsg = getErrorMessage(error, t, AuthMessages.REGISTRATION_FAILED);
        const apiError = getApiError(error);

        if (apiError?.code === 'ACCOUNT_ALREADY_EXISTS' || apiError?.error === 'errors.auth.accountAlreadyExists') {
          setFormData((prev) => ({ ...prev, otp: "" }));
          toast.error(t(AuthMessages.ACCOUNT_EXISTS_TOAST));
          setStep("login");
          setShowOtp(false);
          setShowResendConfirmationPrompt(false);
        } else if (apiError?.code === 'EMAIL_NOT_CONFIRMED' || apiError?.error === 'errors.auth.emailNotConfirmed') {
          setFormData((prev) => ({ ...prev, otp: "" }));
          toast.error(t('errors.auth.emailNotConfirmed'));
          setStep("login");
          setShowOtp(false);
          setShowResendConfirmationPrompt(true);
        } else {
          setFieldErrors({ general: errorMsg });
        }

      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await requestPasswordReset(formData.email);
      toast.success(t(AuthMessages.RESET_EMAIL_SENT_TOAST));
      setStep("login");

    } catch (error: unknown) {
      const errorCode = getApiErrorCode(error);
      const message = getErrorMessage(error, t, AuthMessages.RESET_FAILED);
      if (errorCode === "EMAIL_NOT_CONFIRMED") {
        toast.error(message);
        setStep("login");
        setShowResendConfirmationPrompt(true);
        setFieldErrors({});
      } else {
        setFieldErrors({ general: message });
      }
    } finally {

      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t, AuthMessages.GOOGLE_LOGIN_FAILED));
    }

  };

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const res = await validateCredentials(formData.email, formData.password);
      if (res.success) {
        toast.success(t(AuthMessages.OTP_SENT_TOAST));
        setResendCooldown(30);
      }

    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t, AuthMessages.OTP_FAILED));
    } finally {

      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await resendConfirmationEmail(formData.email);
      toast.success(t(AuthMessages.OTP_SENT_TOAST)); // Re-using OTP sent toast for email confirmation too
      setResendCooldown(30);
    } catch (error: unknown) {

      const msg = getErrorMessage(error, t, AuthMessages.CONFIRMATION_FAILED);
      toast.error(msg);

      const apiError = getApiError(error);
      if (apiError?.error === 'errors.auth.email_already_verified' || apiError?.code === 'EMAIL_ALREADY_VERIFIED' || msg.toLowerCase().includes("already verified")) {
        setStep("login");
      }

    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (step) {
      case "register": return t(AuthMessages.CREATE_ACCOUNT_TITLE);
      case "forgot-password": return t(AuthMessages.RESET_PASSWORD_TITLE);
      case "success": return t(AuthMessages.REG_SUCCESS_TITLE);
      default: return t(AuthMessages.WELCOME_BACK);
    }

  };

  const getDescription = () => {
    switch (step) {
      case "register": return t(AuthMessages.SIGN_UP_SUBTITLE);
      case "forgot-password": return t(AuthMessages.RESET_SUBTITLE);
      case "success": return t(AuthMessages.REG_SUCCESS_SUBTITLE);
      default: return t(AuthMessages.JOURNEY_SUBTITLE);
    }

  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(event) => {
            if (showOtp) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (showOtp) {
              event.preventDefault();
            }
          }}
        >
          <DialogTitle className="text-2xl font-bold text-center">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-center">
            {getDescription()}
          </DialogDescription>

          <div className="mt-6">
            {step !== "forgot-password" && step !== "success" && (
              <>
                <Button
                  variant="outline"
                  className="w-full mb-4 flex items-center gap-2"
                  onClick={handleGoogleLogin}
                  type="button"
                >
                  <FcGoogle className="w-5 h-5" />
                  {t(AuthMessages.GOOGLE_CONTINUE)}
                </Button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t(AuthMessages.OR_CONTINUE_WITH_EMAIL)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {fieldErrors.general && (
              <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
                {fieldErrors.general}
              </div>
            )}

            {showResendConfirmationPrompt && step === "login" && !showOtp && (
              <Button
                type="button"
                variant="outline"
                className="w-full mb-4"
                onClick={handleResendConfirmation}
                disabled={isLoading || resendCooldown > 0 || !formData.email}
              >
                {resendCooldown > 0
                  ? `${t(AuthMessages.RESEND_CONFIRMATION_EMAIL)} (${resendCooldown}${t(AuthMessages.SECONDS_SHORT)})`
                  : t(AuthMessages.RESEND_CONFIRMATION_EMAIL)}
              </Button>
            )}

            {step === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4" action="#">
                {!showOtp ? (
                  <>
                    <div>
                      <Label htmlFor="email">{t(AuthMessages.EMAIL_LABEL)}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t(AuthMessages.EMAIL_PLACEHOLDER)}
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (fieldErrors.email || fieldErrors.general) {
                            setFieldErrors(prev => ({ ...prev, email: "", general: "" }));
                          }
                          setShowResendConfirmationPrompt(false);
                        }}
                        required
                        autoComplete="email"
                        className={fieldErrors.email ? "border-destructive" : ""}
                      />
                      {fieldErrors.email && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="password">{t(AuthMessages.PASSWORD_LABEL)}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder={t(AuthMessages.PASSWORD_PLACEHOLDER)}
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            if (fieldErrors.password || fieldErrors.general) {
                              setFieldErrors(prev => ({ ...prev, password: "", general: "" }));
                            }
                            setShowResendConfirmationPrompt(false);
                          }}
                          required
                          autoComplete="current-password"
                          className={`pr-10 ${fieldErrors.password ? "border-destructive" : ""}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="link"
                        className="p-0 h-auto text-sm"
                        onClick={() => setStep("forgot-password")}
                        type="button"
                      >
                        {t(AuthMessages.FORGOT_PASSWORD)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium">{t(AuthMessages.VERIFICATION_REQUIRED)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t(AuthMessages.ENTER_OTP_SENT_TO)} {formData.email}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="otp">{t(AuthMessages.OTP_LABEL)}</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder={t(AuthMessages.OTP_PLACEHOLDER)} // This is a number, maybe fine, but let's see if there's a key

                        value={formData.otp || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, otp: val });
                          if (fieldErrors.otp || fieldErrors.general) {
                            setFieldErrors(prev => ({ ...prev, otp: "", general: "" }));
                          }
                        }}
                        required
                        maxLength={6}
                        autoComplete="one-time-code"
                        className="text-center text-2xl tracking-widest"
                        autoFocus
                      />
                      <FormError error={fieldErrors.otp} />
                    </div>
                    <div className="text-center pt-2 space-y-2">
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={handleResendOtp}
                        disabled={isLoading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `${t(AuthMessages.RESEND_AVAILABLE_IN)} ${resendCooldown}${t(AuthMessages.SECONDS_SHORT)}` : t(AuthMessages.RESEND_OTP)}
                      </Button>
                      <div>
                        <Button
                          variant="link"
                          type="button"
                          className="text-sm"
                          onClick={() => setShowOtp(false)}
                        >
                          {t(AuthMessages.CHANGE_EMAIL_PASSWORD)}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {showOtp ? t(AuthMessages.VERIFYING) : t(AuthMessages.SIGN_IN)}
                    </>
                  ) : (
                    showOtp ? t(AuthMessages.VERIFY_LOGIN) : t(AuthMessages.NEXT)
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    {t(AuthMessages.DONT_HAVE_ACCOUNT_TEXT)}{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("register")}
                    type="button"
                  >
                    {t(AuthMessages.SIGN_UP)}
                  </Button>
                </div>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reg-name">{t(ProfileMessages.FULL_NAME)}</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={t(AuthMessages.NAME_PLACEHOLDER)}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (fieldErrors.name || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, name: "", general: "" }));
                      }
                    }}
                    required
                    autoComplete="name"
                    className={fieldErrors.name ? "border-destructive" : ""}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-email">{t(AuthMessages.EMAIL_LABEL)}</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        placeholder={t(AuthMessages.EMAIL_PLACEHOLDER)}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, email: "", general: "" }));
                      }
                    }}
                    required
                    className={fieldErrors.email ? "border-destructive" : ""}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-phone">{t(ProfileMessages.PHONE)} <span className="text-destructive">*</span></Label>
                  <PhoneInput
                    id="reg-phone"
                    name="reg-phone"
                    autoComplete="tel"
                    placeholder={t(ProfileMessages.PHONE_PLACEHOLDER)}
                    value={formData.phone}
                    onChange={(value) => {
                      setFormData({ ...formData, phone: value as string });
                      if (fieldErrors.phone || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, phone: "", general: "" }));
                      }
                    }}
                    required={true}
                    error={fieldErrors.phone}
                  />
                </div>

                <div>
                  <Label htmlFor="reg-password">{t(AuthMessages.PASSWORD_LABEL)}</Label>
                  <div className="relative">
                      <Input
                        id="reg-password"
                        type={showRegisterPassword ? "text" : "password"}
                      placeholder={t(AuthMessages.CREATE_PASSWORD_PLACEHOLDER)}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (fieldErrors.password || fieldErrors.general) {
                          setFieldErrors(prev => ({ ...prev, password: "", general: "" }));
                        }
                      }}
                      required
                      autoComplete="new-password"
                      className={`pr-10 ${fieldErrors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive mt-1 whitespace-pre-line leading-relaxed font-medium transition-all duration-200 animate-in slide-in-from-top-1">{fieldErrors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t(AuthMessages.CREATING_ACCOUNT)}
                    </>
                  ) : (
                    t(AuthMessages.CREATE_ACCOUNT_TITLE)
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    {t(AuthMessages.ALREADY_HAVE_ACCOUNT)}{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("login")}
                    type="button"
                  >
                    {t(AuthMessages.SIGN_IN)}
                  </Button>
                </div>
              </form>
            )}

            {step === "forgot-password" && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reset-email">{t(AuthMessages.EMAIL_LABEL)}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t(AuthMessages.EMAIL_PLACEHOLDER)}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.general) {
                        setFieldErrors({});
                      }
                    }}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t(AuthMessages.SENDING)}
                    </>
                  ) : (
                    t(AuthMessages.SEND_RESET_LINK)
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("login")}
                  type="button"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t(AuthMessages.BACK_TO_LOGIN)}
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t(AuthMessages.REG_SUCCESS_EMAIL_SENT)}
                  <br />
                  {t(AuthMessages.REG_SUCCESS_INSTRUCTION)}

                </p>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => setStep("login")}>
                    {t(AuthMessages.PROCEED_TO_LOGIN)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleResendConfirmation}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `${t(AuthMessages.RESEND_AVAILABLE_IN)} ${resendCooldown}${t(AuthMessages.SECONDS_SHORT)}` : t(AuthMessages.RESEND_CONFIRMATION_EMAIL)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
