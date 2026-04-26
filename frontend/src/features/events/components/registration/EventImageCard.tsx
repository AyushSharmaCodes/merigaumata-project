import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EventImageCardProps {
  image?: string;
  title: string;
}

export const EventImageCard = ({ image, title }: EventImageCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="relative h-full min-h-[500px] lg:min-h-0">
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t("events.registration.noImage")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
