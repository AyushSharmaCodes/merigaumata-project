import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Star, Quote, CheckCircle2, ShieldAlert, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Testimonial } from "@/shared/types";

interface TestimonialCardProps {
  testimonial: Testimonial;
  canApprove: boolean;
  canAdd: boolean;
  onEdit: (testimonial: Testimonial) => void;
  onDelete: (id: string) => void;
}

export const TestimonialCard = ({
  testimonial,
  canApprove,
  canAdd,
  onEdit,
  onDelete,
}: TestimonialCardProps) => {
  const { t } = useTranslation();

  return (
    <Card className="relative group">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {testimonial.image ? (
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-primary">{testimonial.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <CardTitle className="text-base">{testimonial.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{testimonial.role}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={testimonial.approved
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : "bg-amber-100 text-amber-800 hover:bg-amber-100"}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {testimonial.approved ? t("common.approved") : t("common.pending")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!canApprove && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 mb-2 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
            <ShieldAlert className="w-3 h-3" />
            <span>{t("admin.testimonials.approvalRestricted")}</span>
          </div>
        )}
        <div className="flex mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < (testimonial.rating || 5)
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
                }`}
            />
          ))}
        </div>
        <div className="relative">
          <Quote className="h-6 w-6 text-muted-foreground/20 absolute -top-2 -left-2 transform -scale-x-100" />
          <p className="text-sm text-foreground/80 line-clamp-4 pl-4 italic">
            {testimonial.content}
          </p>
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onEdit(testimonial)}
            disabled={!canApprove && (!canAdd || testimonial.approved)}
          >
            <Edit className="h-3 w-3 mr-2" />
            {t("common.edit")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onDelete(testimonial.id)}
            disabled={!canApprove}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            {t("common.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
