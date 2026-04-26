import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Loader2, Check, EyeOff, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GalleryFolder } from "@/shared/types";

interface CarouselCardProps {
  title: string;
  description: string;
  placeholder: string;
  folders: GalleryFolder[];
  currentFolder?: GalleryFolder;
  onSetFolder: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  isSetting: boolean;
  isToggling: boolean;
  variant?: "primary" | "default";
  activeLabel: string;
  activeDescription: string;
  emptyLabel: string;
}

export const CarouselCard = ({
  title,
  description,
  placeholder,
  folders,
  currentFolder,
  onSetFolder,
  onToggleHidden,
  isSetting,
  isToggling,
  variant = "default",
  activeLabel,
  activeDescription,
  emptyLabel,
}: CarouselCardProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value={currentFolder?.id || ""} onValueChange={onSetFolder}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSetting && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>

        {currentFolder ? (
          <div className={`${variant === "primary" ? "bg-primary/5 border-primary/20" : "bg-muted/50 border"} p-4 rounded-lg border`}>
            <div className={`flex items-center gap-2 mb-2 ${variant === "primary" ? "text-primary" : "text-green-600"} font-medium`}>
              <Check className="h-4 w-4" />
              {activeLabel}
            </div>
            <p className="text-sm text-muted-foreground mb-4">{activeDescription}</p>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                {currentFolder.is_hidden ? <EyeOff className="h-4 w-4 text-orange-500" /> : <Eye className="h-4 w-4 text-blue-500" />}
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("admin.carousel.hide.label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.carousel.hide.description")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isToggling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <Switch
                  checked={currentFolder.is_hidden || false}
                  onCheckedChange={(checked) => onToggleHidden(currentFolder.id, checked)}
                  disabled={isToggling}
                />
              </div>
            </div>
          </div>
        ) : folders.length > 0 && (
          <div className={`${variant === "primary" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"} p-4 rounded-lg border`}>
            <p className="text-sm font-medium">{emptyLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
