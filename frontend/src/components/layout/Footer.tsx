import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Link as LinkIcon,
  Send as SendIcon,
} from "lucide-react";

import { socialMediaService } from "@/services/social-media.service";
import { contactInfoService } from "@/services/contact-info.service";
import { bankDetailsService } from "@/services/bank-details.service";
import { aboutService } from "@/services/about.service";
import { FaWhatsapp } from "react-icons/fa";

const getSocialIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "facebook":
      return Facebook;
    case "twitter":
      return Twitter;
    case "instagram":
      return Instagram;
    case "youtube":
      return Youtube;
    case "linkedin":
      return LinkIcon;
    case "whatsapp":
      return FaWhatsapp;
    case "telegram":
      return SendIcon;
    default:
      return LinkIcon;
  }
};

export function Footer() {
  const { t, i18n } = useTranslation();

  const { data: socialMediaLinks } = useQuery({
    queryKey: ["social-media-links", i18n.language],
    queryFn: () => socialMediaService.getAll(),
  });

  const { data: contactInfo } = useQuery({
    queryKey: ["contact-info-public", i18n.language],
    queryFn: () => contactInfoService.getAll(false),
  });

  const { data: bankDetails = [] } = useQuery({
    queryKey: ["bank-details-public", i18n.language],
    queryFn: () => bankDetailsService.getAll(false),
  });

  const { data: aboutSettings } = useQuery({
    queryKey: ["aboutUs", i18n.language],
    queryFn: () => aboutService.getAll(),
  });

  // Comprehensive Fallbacks
  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0] || { number: t("footer.defaultPhone", "+91 98765 43210") };
  const primaryEmail = contactInfo?.emails.find(e => e.is_primary) || contactInfo?.emails[0] || { email: t("footer.defaultEmail", "info@merigaumata.com") };
  const address = contactInfo?.address || {
    address_line1: t("footer.defaultAddress"),
    city: t("footer.defaultCity"),
    state: t("footer.defaultState"),
    pincode: "110001"
  };
  const donationBankAccount = bankDetails.find(b => b.type === 'donation' && b.is_active) || bankDetails[0];

  const fallbackSocials = [
    { id: 'fb', platform: 'facebook', url: import.meta.env.VITE_SOCIAL_FACEBOOK_URL || 'https://facebook.com' },
    { id: 'ig', platform: 'instagram', url: import.meta.env.VITE_SOCIAL_INSTAGRAM_URL || 'https://instagram.com' },
    { id: 'tw', platform: 'twitter', url: import.meta.env.VITE_SOCIAL_TWITTER_URL || 'https://twitter.com' },
  ];

  const activeSocials = socialMediaLinks && socialMediaLinks.length > 0 ? socialMediaLinks : fallbackSocials;

  return (
    <>
      <footer className="bg-[#1A0E09] text-[#E6D5AC] pt-12 pb-6 relative overflow-hidden border-t border-[#B85C3C]/10">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#B85C3C]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#B85C3C]/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-6">
            <div className="space-y-5 lg:col-span-2 pr-0 md:pr-12">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 bg-gradient-to-br from-[#2C1810] to-[#1A0E09] rounded-xl flex items-center justify-center shadow-lg border border-white/5 group-hover:scale-105 transition-transform duration-500 overflow-hidden relative p-1.5">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#D4AF37]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img
                    src="/favicon.ico"
                    alt={t('common.brandName')}
                    className="w-full h-full object-contain relative z-10"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-white font-playfair tracking-tight leading-none">
                    {t('common.brandName')}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D4AF37] mt-1">
                    {t("nav.brandSubtitle")}
                  </span>
                </div>
              </Link>

              <p className="text-[#E6D5AC]/70 text-[12px] leading-relaxed font-light italic max-w-sm">
                "{aboutSettings?.footerDescription || t("footer.aboutDescription")}"
              </p>

              <div className="flex items-center gap-3">
                {activeSocials.map((link) => {
                  const Icon = getSocialIcon(link.platform);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[#E6D5AC]/70 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/20 transition-all duration-300"
                      aria-label={link.platform}
                    >
                      <Icon size={14} />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Quick Links Column */}
            <div className="space-y-4">
              <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                {t("footer.quickLinks")}
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "shopProducts", to: "/shop" },
                  { label: "sacredEvents", to: "/events" },
                  { label: "theJournal", to: "/blog" },
                  { label: "vedicGallery", to: "/gallery" }
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link
                      to={item.to}
                      className="text-[13px] font-light text-[#E6D5AC]/70 hover:text-[#D4AF37] transition-all duration-300 inline-block"
                    >
                      {t(`footer.${item.label}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Service Column */}
            <div className="space-y-4">
              <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                {t("footer.customerService")}
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/contact" className="text-[13px] font-light text-[#E6D5AC]/70 hover:text-[#D4AF37] transition-all duration-300 inline-block">
                    {t("footer.contactUs")}
                  </Link>
                </li>
                {[
                  { label: "shipping", to: "/shipping-and-refund-policy" },
                  { label: "privacy", to: "/privacy-policy" },
                  { label: "terms", to: "/terms-and-conditions" }
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link
                      to={item.to}
                      className="text-[13px] font-light text-[#E6D5AC]/70 hover:text-[#D4AF37] transition-all duration-300 inline-block text-left"
                    >
                      {t(`footer.${item.label}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info Column */}
            <div className="space-y-4">
              <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                {t("footer.ancientRoots")}
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-[12px] font-light text-[#E6D5AC]/70 leading-snug italic">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#D4AF37]/80" />
                  <span>
                    {address.address_line1}, {address.city}<br />
                    {address.state} - {address.pincode}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-[13px] font-medium text-[#E6D5AC]/80 transition-colors hover:text-[#D4AF37]">
                  <Phone size={13} className="text-[#D4AF37]/80" />
                  <a href={`tel:${primaryPhone.number}`}>{primaryPhone.number}</a>
                </li>
                <li className="flex items-center gap-3 text-[13px] font-medium text-[#E6D5AC]/80 transition-colors hover:text-[#D4AF37]">
                  <Mail size={13} className="text-[#D4AF37]/80" />
                  <a href={`mailto:${primaryEmail.email}`} className="break-all pr-2">{primaryEmail.email}</a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bank Details & Bottom Bar - More Compact */}
          <div className="pt-6 border-t border-white/5 flex flex-col gap-6">
            {donationBankAccount && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02] rounded-2xl p-3 md:px-5 border border-white/5">
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#D4AF37] mb-0.5">{t("footer.supportHeritage")}</h4>
                  <p className="text-[10px] text-[#E6D5AC]/50 italic font-light tracking-wide">{t("footer.bankDonations")}</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 md:gap-x-10 w-full md:w-auto">
                  {[
                    { label: "name", value: donationBankAccount.account_name },
                    { label: "bank", value: donationBankAccount.bank_name },
                    { label: "branch", value: donationBankAccount.branch_name },
                    { label: "account", value: donationBankAccount.account_number },
                    { label: "ifsc", value: donationBankAccount.ifsc_code },
                    { label: "upi", value: donationBankAccount.upi_id, color: "text-[#D4AF37]" }
                  ].map((item, idx) => item.value ? (
                    <div key={idx} className="space-y-0.5">
                      <p className="text-[8px] font-black uppercase text-white/50 tracking-widest">{t(`footer.${item.label}`)}</p>
                      <p className={`text-[10px] font-medium ${item.color || "text-[#E6D5AC]/90"}`}>{item.value}</p>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-light text-[#E6D5AC]/40 tracking-wider">
              <p>
                © {new Date().getFullYear()} {t('common.brandName')}. <span className="text-[#D4AF37]/80 font-bold uppercase tracking-widest ml-1">{t("footer.rights")}</span>
              </p>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.02] border border-white/5 opacity-40">
                  <ShieldCheck className="h-3 w-3 text-green-500/60" />
                  <span className="uppercase tracking-[0.1em] text-[9px]">{t("footer.secureCheckout")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
