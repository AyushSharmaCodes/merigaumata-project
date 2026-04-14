import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { faqService } from "@/services/faq.service";
import { contactService } from "@/services/contact.service";
import { publicContentService } from "@/services/public-content.service";
import { FaWhatsapp } from "react-icons/fa";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Send,
  Link as LinkIcon,
  Loader2,
  Clock,
  Heart,
} from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";
import { getGoogleMapsConfig } from "@/lib/googleMaps";
import { validators } from "@/lib/validation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Contact() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: faqs = [], isLoading: isLoadingFAQs, isError: faqError } = useQuery({
    queryKey: ["contact-faqs", i18n.language],
    queryFn: async () => {
      return await faqService.getAll(false);
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: siteContent, isLoading: isLoadingSiteContent } = useQuery({
    queryKey: ["public-site-content", i18n.language],
    queryFn: () => publicContentService.getSiteContent(false),
    staleTime: 10 * 60 * 1000,
  });

  const socialMediaLinks = siteContent?.socialMedia || [];
  const contactInfo = siteContent?.contactInfo;

  const location = useLocation();

  useEffect(() => {
    if (!isLoadingFAQs && !isLoadingSiteContent && location.hash) {
      const element = document.getElementById(location.hash.replace('#', ''));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [isLoadingFAQs, isLoadingSiteContent, location.hash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const nameError = validators.required(formData.name);
    const emailRequiredError = validators.required(formData.email);
    const emailFormatError = !emailRequiredError ? validators.email(formData.email.trim()) : null;
    const phoneRequiredError = validators.required(formData.phone);
    const phoneFormatError = !phoneRequiredError ? validators.phone(formData.phone.trim()) : null;
    const subjectError = validators.required(formData.subject);
    const messageError = validators.required(formData.message);
    const messageMinLengthError = !messageError ? validators.minLength(formData.message, 10) : null;

    if (nameError) newErrors.name = t("validation.requiredField", { field: t("contact.name") });
    if (emailRequiredError) {
      newErrors.email = t("validation.requiredField", { field: t("contact.email") });
    } else if (emailFormatError) {
      newErrors.email = t(emailFormatError);
    }
    if (phoneRequiredError) {
      newErrors.phone = t("validation.requiredField", { field: t("contact.phone") });
    } else if (phoneFormatError) {
      newErrors.phone = t(phoneFormatError);
    }
    if (subjectError) newErrors.subject = t("validation.requiredField", { field: t("contact.subject") });
    
    if (messageError) {
        newErrors.message = t("validation.requiredField", { field: t("contact.message") });
    } else if (messageMinLengthError) {
        newErrors.message = t(messageMinLengthError);
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await contactService.sendMessage({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim()
      });

      toast({
        title: t("common.success"),
        description: t("success.contact.messageReceived"),
      });
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error: unknown) {
      const details = getErrorDetails(error);
      if (details) {
        const backendErrors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          backendErrors[field] = d.message.startsWith("errors.") || d.message.startsWith("validation.")
            ? t(d.message)
            : d.message;
        });
        setErrors(backendErrors);
      } else {
        toast({
          title: t("common.error"),
          description: getErrorMessage(error, t, "errors.system.generic_error"),
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "facebook": return Facebook;
      case "twitter": return Twitter;
      case "instagram": return Instagram;
      case "youtube": return Youtube;
      case "linkedin": return LinkIcon;
      case "whatsapp": return FaWhatsapp;
      case "telegram": return Send;
      default: return LinkIcon;
    }
  };

  if (isLoadingFAQs || isLoadingSiteContent) {
    return <LoadingOverlay isLoading={true} />;
  }

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0];
  const primaryEmail = contactInfo?.emails.find(e => e.is_primary) || contactInfo?.emails[0];
  const address = contactInfo?.address;
  const mapConfig = getGoogleMapsConfig({
    address,
    fallbackQuery: t("contact.mapFallback"),
    appName: import.meta.env.VITE_APP_NAME,
  });

  // Helper function to format time from 24hr to 12hr with AM/PM
  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? t("common.pm") : t("common.am");
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/contact-hero.png"
            alt={t("contact.heroAlt")}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 font-playfair animate-in fade-in slide-in-from-bottom-8 duration-700">
            {t("contact.title")}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto font-light leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            {t("contact.subtitle")}
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl -mt-16 relative z-20">
        {/* Contact Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Phone Card */}
          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/80 backdrop-blur-md">
            <CardContent className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#B85C3C]/10 flex items-center justify-center mb-6 text-[#B85C3C]">
                <Phone className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810] mb-3">{t("contact.phone")}</h3>
              {primaryPhone ? (
                <div className="text-muted-foreground space-y-1 text-lg">
                  <a href={`tel:${primaryPhone.number}`} className="hover:text-[#B85C3C] transition-colors">
                    {primaryPhone.number}
                  </a>
                  {(contactInfo?.phones?.length ?? 0) > 1 && (
                    <p className="opacity-60 text-sm mt-1">{contactInfo?.phones?.[1]?.number}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic opacity-70">{t("contact.closed")}</p>
              )}
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/80 backdrop-blur-md">
            <CardContent className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#B85C3C]/10 flex items-center justify-center mb-6 text-[#B85C3C]">
                <Mail className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810] mb-3">{t("contact.email")}</h3>
              {primaryEmail ? (
                <div className="text-muted-foreground space-y-1 text-lg">
                  <a href={`mailto:${primaryEmail.email}`} className="hover:text-[#B85C3C] transition-colors break-all">
                    {primaryEmail.email}
                  </a>
                  {(contactInfo?.emails?.length ?? 0) > 1 && (
                    <p className="opacity-60 text-sm mt-1 break-all">{contactInfo?.emails?.[1]?.email}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic opacity-70">{t("contact.closed")}</p>
              )}
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/80 backdrop-blur-md">
            <CardContent className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#B85C3C]/10 flex items-center justify-center mb-6 text-[#B85C3C]">
                <MapPin className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810] mb-3">{t("contact.address")}</h3>
              {address ? (
                <div className="text-muted-foreground text-lg leading-relaxed">
                  <p>{address.address_line1}</p>
                  <p>{address.city}, {address.state} {address.pincode}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic opacity-70">{t("contact.closed")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-20">
          {/* Left Column: Contact Form */}
          <div className="lg:col-span-3 h-full" id="contact-form">
            <Card className="border-none shadow-2xl bg-white p-2 h-full flex flex-col">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-3xl font-bold text-[#2C1810]">
                  {t("contact.sendMessage")}
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  {t("contact.formSubtitle")}
                </p>
              </CardHeader>
              <CardContent className="p-8 pt-4 flex-1">
                <form onSubmit={handleSubmit} className="space-y-6 h-full flex flex-col">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("contact.name")} <span className="text-destructive">*</span>
                      </Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setErrors(prev => ({ ...prev, name: "" }));
                      }}
                        placeholder={t("contact.namePlaceholder")}
                        required
                        className={`h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-[#B85C3C] ${errors.name ? "ring-2 ring-destructive" : ""}`}
                      />
                      {errors.name && <p className="text-xs text-destructive font-medium mt-1">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("contact.email")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        autoComplete="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          setErrors(prev => ({ ...prev, email: "" }));
                        }}
                        placeholder={t("contact.emailPlaceholder")}
                        required
                        className={`h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-[#B85C3C] ${errors.email ? "ring-2 ring-destructive" : ""}`}
                      />
                      {errors.email && <p className="text-xs text-destructive font-medium mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("contact.phone")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      autoComplete="tel"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        setErrors(prev => ({ ...prev, phone: "" }));
                      }}
                      placeholder={t("contact.phonePlaceholder")}
                      required
                      className={`h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-[#B85C3C] ${errors.phone ? "ring-2 ring-destructive" : ""}`}
                    />
                    {errors.phone && <p className="text-xs text-destructive font-medium mt-1">{errors.phone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("contact.subject")} <span className="text-destructive">*</span>
                    </Label>
                      <Input
                        id="subject"
                        autoComplete="off"
                        maxLength={200}
                        value={formData.subject}
                        onChange={(e) => {
                          setFormData({ ...formData, subject: e.target.value });
                          setErrors(prev => ({ ...prev, subject: "" }));
                        }}
                      placeholder={t("contact.subjectPlaceholder")}
                      required
                      className={`h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-[#B85C3C] ${errors.subject ? "ring-2 ring-destructive" : ""}`}
                    />
                    {errors.subject && <p className="text-xs text-destructive font-medium mt-1">{errors.subject}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("contact.message")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      autoComplete="off"
                      value={formData.message}
                      onChange={(e) => {
                        setFormData({ ...formData, message: e.target.value });
                        setErrors(prev => ({ ...prev, message: "" }));
                      }}
                      placeholder={t("contact.messagePlaceholder")}
                      rows={10}
                      maxLength={1000}
                      required
                      className={`bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-[#B85C3C] resize-none ${errors.message ? "ring-2 ring-destructive" : ""}`}
                    />
                    {errors.message && <p className="text-xs text-destructive font-medium mt-1">{errors.message}</p>}
                    <div className="flex justify-end text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                      {formData.message.length}/1000 {t("common.characters")}
                    </div>
                  </div>

                  <div className="flex-1" />

                  <Button
                    type="submit"
                    className="w-full bg-[#B85C3C] hover:bg-[#A04B2E] text-white font-bold h-14 text-lg shadow-lg hover:shadow-xl transition-all mt-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        {t("contact.sending")}
                      </>
                    ) : (
                      <>
                        <Send className="mr-3 h-5 w-5" />
                        {t("contact.send")}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Information */}
          <div className="lg:col-span-2 space-y-8">
            {/* Map & Socials */}
            <div className="space-y-6">
              <Card className="overflow-hidden border-none shadow-xl bg-white group">
                <div className="h-64 w-full bg-muted relative">
                  <iframe
                    src={mapConfig.previewSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    title={t("contact.mapPreview")}
                  ></iframe>

                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />
                </div>
                <div className="p-4 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#2C1810]">
                    <MapPin className="h-4 w-4 text-[#B85C3C]" />
                    <span>{t("contact.address")}</span>
                  </div>
                  <Button
                    variant="link"
                    className="text-[#B85C3C] h-auto p-0 font-bold"
                    onClick={() => window.open(mapConfig.openUrl, "_blank", "noopener,noreferrer")}
                  >
                    {t("contact.openInMaps")}
                  </Button>
                </div>
              </Card>

              {/* Office Hours */}
              <Card className="border-none shadow-xl bg-white p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#B85C3C]/10 flex items-center justify-center text-[#B85C3C]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2C1810]">{t("contact.officeHours")}</h3>
                </div>

                <div className="space-y-4">
                  {contactInfo?.officeHours && contactInfo.officeHours.length > 0 ? (
                    (() => {
                      interface GroupedHours {
                        days: string[];
                        open_time: string;
                        close_time: string;
                        is_closed: boolean;
                      }

                      const groupedHours = (contactInfo?.officeHours || []).reduce((groups: GroupedHours[], current) => {
                        const lastGroup = groups[groups.length - 1];
                        if (lastGroup &&
                          lastGroup.open_time === current.open_time &&
                          lastGroup.close_time === current.close_time &&
                          lastGroup.is_closed === current.is_closed) {
                          lastGroup.days.push(current.day_of_week);
                        } else {
                          groups.push({
                            days: [current.day_of_week],
                            open_time: current.open_time || "",
                            close_time: current.close_time || "",
                            is_closed: !!current.is_closed
                          });
                        }
                        return groups;
                      }, []);

                      return (groupedHours).map((group, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-[#2C1810]/5 last:border-0">
                          <span className="font-medium text-[#2C1810]">
                            {group.days.map(day => t(`common.days.${day.substring(0, 3).toLowerCase()}`)).join(' - ')}
                          </span>
                          <span className="text-[#B85C3C] font-semibold">
                            {group.is_closed
                              ? <span className="text-destructive font-bold uppercase tracking-tighter">{t("contact.closed")}</span>
                              : `${formatTime(group.open_time)} - ${formatTime(group.close_time)}`}
                          </span>
                        </div>
                      ));
                    })()
                  ) : (
                    <p className="text-muted-foreground italic opacity-70">{t("contact.closed")}</p>
                  )}
                </div>
              </Card>

              {/* Follow Us */}
              <Card className="border-none shadow-xl bg-[#2C1810] text-white p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <LinkIcon className="h-5 w-5 text-[#B85C3C]" />
                  {t("contact.followUs")}
                </h3>
                <div className="flex gap-4 flex-wrap">
                  {socialMediaLinks.map((social) => {
                    const Icon = getSocialIcon(social.platform);
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-[#B85C3C] hover:scale-110 transition-all duration-300"
                        aria-label={social.platform}
                      >
                        <Icon className="h-6 w-6" />
                      </a>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="mt-12 py-16 bg-muted/30 rounded-[3rem] px-8 md:px-16 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Heart className="h-64 w-64 text-[#B85C3C]" />
          </div>

          <div className="text-center mb-16 relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-[#2C1810] mb-4 font-playfair">
              {t("contact.faqTitle")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t("contact.faqSubtitle")}
            </p>
          </div>

          <div className="max-w-4xl mx-auto relative z-10">
            {isLoadingFAQs ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : faqError ? (
              <p className="text-center text-destructive">{t("contact.faqError")}</p>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqs.slice(0, 6).map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border-none bg-white rounded-2xl shadow-sm overflow-hidden px-6">
                    <AccordionTrigger className="text-left py-6 hover:no-underline font-bold text-lg text-[#2C1810] hover:text-[#B85C3C] transition-colors">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            <div className="text-center mt-12">
              <Link to="/faq">
                <Button className="bg-[#B85C3C] hover:bg-[#A04B2E] text-white px-10 py-6 rounded-full font-bold shadow-lg hover:shadow-xl transition-all">
                  {t("contact.viewAllFaqs")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
