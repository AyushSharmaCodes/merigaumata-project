import { Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

interface EventHighlightsProps {
  highlights: string[];
}

export const EventHighlights = ({ highlights }: EventHighlightsProps) => {
  const { t } = useTranslation();

  if (!highlights || highlights.length === 0) return null;

  return (
    <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="p-10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#B85C3C]">
            <Gift size={20} />
          </div>
          <CardTitle className="text-3xl font-bold text-[#2C1810] font-playfair">{t("events.public.details.highlightsHeader")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-10 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {highlights.map((highlight, index) => (
            <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FAF7F2]/50 border border-transparent hover:border-[#B85C3C]/20 transition-all group">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-[#B85C3C] group-hover:scale-150 transition-all" />
              <span className="text-muted-foreground font-medium">{highlight}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
