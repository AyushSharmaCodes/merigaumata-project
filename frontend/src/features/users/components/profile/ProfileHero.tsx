import { useTranslation } from "react-i18next";

export const ProfileHero = () => {
  const { t } = useTranslation();

  return (
    <section className="hidden sm:block pt-12 lg:pt-16 pb-4">
      <div className="container mx-auto px-4">
        <div className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated rounded-[2rem] sm:rounded-[2.5rem] bg-primary/5 px-5 py-6 sm:p-8 border border-primary/10">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair tracking-tight text-foreground lowercase first-letter:uppercase">
              {t("profile.title")}
            </h1>
            <p className="text-primary text-sm sm:text-base font-medium">
              {t("profile.subtitle")}
            </p>
          </div>
        </div>
        <div className="mt-6 sm:mt-10 lg:mt-12 border-t border-dashed border-border w-full"></div>
      </div>
    </section>
  );
};
