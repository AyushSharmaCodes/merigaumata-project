import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { RichTextRenderer } from "@/shared/components/ui/RichTextRenderer";

interface EventAboutProps {
  description: string;
}

export const EventAbout = ({ description }: EventAboutProps) => {
  const { t } = useTranslation();

  return (
    <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white group hover:shadow-2xl transition-all duration-500">
      <CardHeader className="p-10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#B85C3C]">
            <Sparkles size={20} />
          </div>
          <CardTitle className="text-3xl font-bold text-[#2C1810] font-playfair">{t("events.public.details.aboutHeader")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-10 pt-0">
        <RichTextRenderer 
          content={description} 
          className="text-muted-foreground leading-relaxed font-light" 
        />
      </CardContent>
      <div className="h-1.5 w-0 bg-[#B85C3C] group-hover:w-full transition-all duration-700" />
    </Card>
  );
};
