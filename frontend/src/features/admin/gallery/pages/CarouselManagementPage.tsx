import { useCarouselManagement, CarouselCard } from "@/features/admin/gallery";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/page-skeletons";
import { Image as ImageIcon } from "lucide-react";

export default function CarouselManagement() {
  const {
    t,
    folders,
    isLoading,
    currentCarouselFolder,
    currentMobileCarouselFolder,
    setCarouselMutation,
    setMobileCarouselMutation,
    toggleHiddenMutation,
  } = useCarouselManagement();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.carousel.title")}</h1>
        <p className="text-muted-foreground">{t("admin.carousel.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CarouselCard
          title={t("admin.carousel.desktop.title")}
          description={t("admin.carousel.desktop.description")}
          placeholder={t("admin.carousel.desktop.placeholder")}
          folders={folders}
          currentFolder={currentCarouselFolder}
          onSetFolder={(id) => setCarouselMutation.mutate(id)}
          onToggleHidden={(id, hidden) => toggleHiddenMutation.mutate({ id, is_hidden: hidden })}
          isSetting={setCarouselMutation.isPending}
          isToggling={toggleHiddenMutation.isPending}
          variant="primary"
          activeLabel={t("admin.carousel.desktop.activeLabel")}
          activeDescription={t("admin.carousel.desktop.activeDescription")}
          emptyLabel={t("admin.carousel.desktop.emptyLabel")}
        />
        <CarouselCard
          title={t("admin.carousel.mobile.title")}
          description={t("admin.carousel.mobile.description")}
          placeholder={t("admin.carousel.mobile.placeholder")}
          folders={folders}
          currentFolder={currentMobileCarouselFolder}
          onSetFolder={(id) => setMobileCarouselMutation.mutate(id)}
          onToggleHidden={(id, hidden) => toggleHiddenMutation.mutate({ id, is_hidden: hidden })}
          isSetting={setMobileCarouselMutation.isPending}
          isToggling={toggleHiddenMutation.isPending}
          activeLabel={t("admin.carousel.mobile.activeLabel")}
          activeDescription={t("admin.carousel.mobile.activeDescription")}
          emptyLabel={t("admin.carousel.mobile.emptyLabel")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ImageIcon className="h-5 w-5" />
            {t("admin.carousel.instructions.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("admin.carousel.instructions.text")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
