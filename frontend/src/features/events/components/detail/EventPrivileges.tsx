import { Gift, Sparkles, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

interface EventPrivilegesProps {
  privileges: string[];
}

export const EventPrivileges = ({ privileges }: EventPrivilegesProps) => {
  const { t } = useTranslation();

  if (!privileges || privileges.length === 0) return null;

  return (
    <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-[#2C1810] text-white relative">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Gift size={120} />
      </div>
      <CardHeader className="p-10 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#D4AF37]">
            <Sparkles size={20} />
          </div>
          <CardTitle className="text-3xl font-bold font-playfair">{t("events.public.details.privilegesHeader")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-10 pt-4 relative z-10">
        <div className="grid grid-cols-1 gap-4">
          {privileges.map((privilege, index) => (
            <div key={index} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <CheckCircle2 className="h-5 w-5 text-[#D4AF37] flex-shrink-0" />
              <span className="text-white/80 font-light">{privilege}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
