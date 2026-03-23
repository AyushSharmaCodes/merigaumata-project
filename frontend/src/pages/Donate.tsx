import { DonationForm } from "@/components/donation/DonationForm";
import { DonationImpact } from "@/components/donation/DonationImpact";
import { AnonymousDonation } from "@/components/donation/AnonymousDonation";
import { useTranslation } from "react-i18next";
import { HandHeart } from "lucide-react";

const Donate = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* Compact Premium Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <HandHeart className="h-64 w-64 text-[#B85C3C] blur-sm" />
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                <HandHeart className="h-3 w-3" /> {t("donate.hero.badge")}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                {t("donate.title", "Support Our")} <span className="text-[#B85C3C] italic">{t("donate.cause", "Cause")}</span>
              </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:items-center max-w-xl">
              <p className="text-white/50 text-sm md:text-base font-light border-l border-[#B85C3C]/30 pl-6 hidden md:block">
                {t("donate.subtitle", "Your contribution provides food, shelter, and medical care to cows in need.")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-background relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

            {/* Left Column: Form */}
            <div className="lg:col-span-7 space-y-8 order-2 lg:order-1">
              {/* Main Donation Form */}
              <div className="relative z-10 -mt-20 lg:mt-0 space-y-6">
                <DonationForm />
              </div>

              {/* Impact Section Mobile (Hidden on Desktop, shown below form on mobile) */}
              <div className="block lg:hidden pt-8">
                <DonationImpact />
              </div>
            </div>

            {/* Right Column: Info & Anonymous */}
            <div className="lg:col-span-5 space-y-10 order-1 lg:order-2">
              {/* Anonymous Donation Card */}
              <AnonymousDonation />

              {/* Impact Section Desktop */}
              <div className="hidden lg:block">
                <DonationImpact />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default Donate;
