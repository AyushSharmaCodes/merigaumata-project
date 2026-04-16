import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryFolderService } from "@/services/gallery-folder.service";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Check, Image as ImageIcon, Loader2, EyeOff, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next"; // Ensure this import is present

export default function CarouselManagement() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const location = useLocation();
    const basePath = location.pathname.startsWith("/manager") ? "/manager" : "/admin";
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Fetch all folders
    const { data: folders = [], isLoading } = useQuery({
        queryKey: ["gallery-folders"],
        queryFn: galleryFolderService.getAll,
    });

    // Find the current carousel folder
    const currentCarouselFolder = folders.find((f) => f.is_home_carousel);
    const currentMobileCarouselFolder = folders.find((f) => f.is_mobile_carousel);

    // Mutation to set home carousel folder
    const setCarouselMutation = useMutation({
        meta: { blocking: true },
        mutationFn: galleryFolderService.setHomeCarouselFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["carousel-slides"] }); // Invalidate homepage cache
            toast({ title: t("admin.carousel.toasts.updateCarouselSuccess") }); // Updated toast
        },
        onError: (error: unknown) => {
            toast({ // Updated toast
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.carousel.toasts.updateCarouselFailed"),
                variant: "destructive",
            });
        },
    });

    // Mutation to set mobile carousel folder
    const setMobileCarouselMutation = useMutation({
        meta: { blocking: true },
        mutationFn: galleryFolderService.setMobileCarouselFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["carousel-slides"] });
            toast({ title: t("common.toasts.mobileCarouselUpdated") });
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.carousel.mobile.toasts.updateFailed"),
                variant: "destructive",
            });
        },
    });

    const handleSetFolder = (folderId: string) => {
        setCarouselMutation.mutate(folderId);
    };

    const handleSetMobileFolder = (folderId: string) => {
        setMobileCarouselMutation.mutate(folderId);
    };

    // Mutation to toggle hidden status
    const toggleHiddenMutation = useMutation({
        meta: { blocking: true },
        mutationFn: ({ id, is_hidden }: { id: string; is_hidden: boolean }) =>
            galleryFolderService.update(id, { is_hidden }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["admin-settings"] }); // Added invalidate query
            toast({ title: t("admin.carousel.toasts.updateFolderSuccess") }); // Updated toast
        },
        onError: (error: any) => { // Changed error type to any for consistency with instruction
            toast({ // Updated toast
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.carousel.toasts.updateFolderFailed"),
                variant: "destructive",
            });
        },
    });

    const handleToggleHidden = (checked: boolean) => {
        if (currentCarouselFolder) {
            toggleHiddenMutation.mutate({
                id: currentCarouselFolder.id,
                is_hidden: checked,
            });
        }
    };

    const handleToggleMobileHidden = (checked: boolean) => {
        if (currentMobileCarouselFolder) {
            toggleHiddenMutation.mutate({
                id: currentMobileCarouselFolder.id,
                is_hidden: checked,
            });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t("admin.carousel.title")}
                </h1>
                <p className="text-muted-foreground">
                    {t("admin.carousel.subtitle")}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("admin.carousel.source.title")}</CardTitle>
                        <CardDescription>
                            {t("admin.carousel.source.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Select
                                        value={currentCarouselFolder?.id || ""}
                                        onValueChange={handleSetFolder}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("admin.carousel.selectFolder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {folders.map((folder) => (
                                                <SelectItem key={folder.id} value={folder.id}>
                                                    {folder.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                                                    </Select>
                                    {setCarouselMutation.isPending && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                </div>

                                {currentCarouselFolder && (
                                    <div className="bg-muted/50 p-4 rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2 text-green-600 font-medium">
                                            <Check className="h-4 w-4" />
                                            {t("admin.carousel.active.label", { name: currentCarouselFolder.name })}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {t("admin.carousel.active.description")}
                                        </p>

                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <div className="flex items-center gap-2">
                                                {currentCarouselFolder.is_hidden ? (
                                                    <EyeOff className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                )}
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium">
                                                        {t("admin.carousel.hide.label")}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t("admin.carousel.hide.description")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {toggleHiddenMutation.isPending && (
                                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                )}
                                                <Switch
                                                    id="hide-from-gallery"
                                                    checked={currentCarouselFolder.is_hidden || false}
                                                    onCheckedChange={handleToggleHidden}
                                                    disabled={toggleHiddenMutation.isPending}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!currentCarouselFolder && folders.length > 0 && (
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-800">
                                        <p className="text-sm font-medium">
                                            {t("admin.carousel.empty.noSelected")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("admin.carousel.mobile.title")}</CardTitle>
                        <CardDescription>
                            {t("admin.carousel.mobile.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Select
                                        value={currentMobileCarouselFolder?.id || ""}
                                        onValueChange={handleSetMobileFolder}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t("admin.carousel.mobile.selectPlaceholder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {folders.map((folder) => (
                                                <SelectItem key={folder.id} value={folder.id}>
                                                    {folder.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {setMobileCarouselMutation.isPending && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                </div>
 
                                {currentMobileCarouselFolder && (
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                                        <div className="flex items-center gap-2 mb-2 text-primary font-medium">
                                            <Check className="h-4 w-4" />
                                            {t("admin.carousel.mobile.activeLabel", { name: currentMobileCarouselFolder.name })}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {t("admin.carousel.mobile.activeDescription")}
                                        </p>
 
                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <div className="flex items-center gap-2">
                                                {currentMobileCarouselFolder.is_hidden ? (
                                                    <EyeOff className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                )}
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium">
                                                        {t("admin.carousel.hide.label")}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t("admin.carousel.hide.description")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {toggleHiddenMutation.isPending && (
                                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                )}
                                                <Switch
                                                    id="hide-mobile-from-gallery"
                                                    checked={currentMobileCarouselFolder.is_hidden || false}
                                                    onCheckedChange={handleToggleMobileHidden}
                                                    disabled={toggleHiddenMutation.isPending}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
 
                                {!currentMobileCarouselFolder && folders.length > 0 && (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-blue-800">
                                        <p className="text-sm font-medium">
                                            {t("admin.carousel.mobile.noneSelected")}
                                        </p>
                                    </div>
                                )}
 
                                {folders.length === 0 && (
                                    <div className="bg-muted p-4 rounded-lg text-center">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-muted-foreground">
                                            {t("admin.carousel.empty.noFolders")}
                                        </p>
                                        <Link to={`${basePath}/gallery`}>
                                            <Button variant="link" className="mt-2">
                                                {t("admin.carousel.empty.goGallery")}
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
