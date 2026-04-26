import { Badge } from "@/shared/components/ui/badge";
import { User, RotateCcw, Mail, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

interface JobTypeBadgeProps {
  type: string;
}

export const JobTypeBadge = ({ type }: JobTypeBadgeProps) => {
  const { t } = useTranslation();

  if (type === "ACCOUNT_DELETION") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <User className="h-3 w-3 mr-1" />
        {t("admin.backgroundJobs.types.accountDeletion")}
      </Badge>
    );
  } else if (type === "REFUND") {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
        <RotateCcw className="h-3 w-3 mr-1" />
        {t("admin.backgroundJobs.types.refund")}
      </Badge>
    );
  } else if (type === "EMAIL_NOTIFICATION") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Mail className="h-3 w-3 mr-1" />
        {t("admin.backgroundJobs.types.emailNotification")}
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
      <Calendar className="h-3 w-3 mr-1" />
      {t("admin.backgroundJobs.types.eventCancellation")}
    </Badge>
  );
};
