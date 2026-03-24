import { useState } from "react";
import { Link } from "react-router-dom";
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
import { toast } from "@/hooks/use-toast"; // Changed from "sonner" to "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/errorUtils";
import { Check, Image as ImageIcon, Loader2, EyeOff, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next"; // Ensure this import is present

export default function CarouselManagement() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Fetch all folders
    const { data: folders = [], isLoading } = useQuery({
        queryKey: ["gallery-folders"],
        queryFn: galleryFolderService.getAll,
    });

    // Find the current carousel folder
    const currentCarouselFolder = folders.find((f) => f.is_home_carousel);

    // Mutation to set home carousel folder
    const setCarouselMutation = useMutation({
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

    const handleSetFolder = (folderId: string) => {
        setCarouselMutation.mutate(folderId);
    };

    // Mutation to toggle hidden status
    const toggleHiddenMutation = useMutation({
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
                                    <SelectTrigger className="w-[300px]">
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
                                                <Label htmlFor="hide-from-gallery" className="text-sm font-medium">
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

                            {folders.length === 0 && (
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                        {t("admin.carousel.empty.noFolders")}
                                    </p>
                                    <Link to="/admin/gallery">
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
    );
}
