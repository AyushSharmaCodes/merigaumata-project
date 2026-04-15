import { logger } from "@/lib/logger";
import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { MAX_USER_IMAGE_SIZE_BYTES, MAX_USER_IMAGE_SIZE_MB } from "@/constants/upload.constants";
import { toast } from "@/hooks/use-toast";
import { getCroppedImg } from "@/utils/image-optimization.utils";

interface ProfileImageCropperProps {
    image: string | File | null;
    onChange: (file: File) => void;
    onClear?: () => void;
}

// Helper functions moved to @/utils/image-optimization.utils.ts

export function ProfileImageCropper({ image, onChange, onClear }: ProfileImageCropperProps) {
    const { t } = useTranslation();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropping, setIsCropping] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;
        
        if (image) {
            if (image instanceof File) {
                objectUrl = URL.createObjectURL(image);
                setImageSrc(objectUrl);
                setIsCropping(true);
            } else {
                setImageSrc(image);
                setIsCropping(false);
            }
        } else {
            setImageSrc(null);
            setIsCropping(false);
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [image]);
    
    // Additional cleanup for cases where image changes without unmount
    useEffect(() => {
        return () => {
            if (imageSrc && imageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(imageSrc);
            }
        };
    }, [imageSrc]);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > MAX_USER_IMAGE_SIZE_BYTES) {
                toast({
                    title: t("common.error"),
                    description: t("common.upload.fileTooLarge", { name: file.name, max: `${MAX_USER_IMAGE_SIZE_MB}MB` }),
                    variant: "destructive"
                });
                return;
            }
            if (file.type.startsWith('image/')) {
                onChange(file);
                setIsCropping(true);
            }
        }
    };

    const handleApplyCrop = useCallback(async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            const croppedFile = new File([croppedBlob], 'profile.jpg', {
                type: 'image/jpeg',
            });
            onChange(croppedFile);
            setIsCropping(false);
        } catch (e) {
            logger.error('Error cropping image:', e);
        }
    }, [imageSrc, croppedAreaPixels, onChange]);

    const handleReset = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleRecrop = () => {
        setIsCropping(true);
    };

    if (!imageSrc) {
        return (
            <div className="space-y-2">
                <div
                    className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-muted-foreground/25 hover:border-primary/50"
                >
                    <div className="flex flex-col items-center justify-center">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                            {t("admin.about.cropper.uploadText")}
                        </p>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="profile-image-upload"
                        />
                        <label htmlFor="profile-image-upload">
                            <Button type="button" variant="outline" asChild>
                                <span>{t("admin.about.cropper.selectImage")}</span>
                            </Button>
                        </label>
                    </div>
                </div>
            </div>
        );
    }

    if (isCropping) {
        return (
            <div className="space-y-4">
                <div className="relative h-80 bg-black rounded-lg overflow-hidden">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>{t("admin.about.cropper.zoom")}</Label>
                            <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
                        </div>
                        <Slider
                            value={[zoom]}
                            onValueChange={(value) => setZoom(value[0])}
                            min={1}
                            max={3}
                            step={0.1}
                            className="w-full"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t("admin.about.cropper.reset")}
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleApplyCrop}
                            className="flex-1"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            {t("admin.about.cropper.applyCrop")}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Preview mode (cropped image)
    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center">
                <img
                    src={imageSrc}
                    alt={t("admin.profile.previewAlt")}
                    className="w-40 h-40 rounded-full object-cover border-4 border-border"
                />
            </div>

            <div className="flex gap-2">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="profile-image-change"
                />
                <label htmlFor="profile-image-change" className="flex-1">
                    <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                        <span>{t("admin.about.cropper.changePhoto")}</span>
                    </Button>
                </label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRecrop}
                >
                    {t("admin.about.cropper.adjustCrop")}
                </Button>
                {onClear && (
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={onClear}
                    >
                        {t("admin.about.cropper.remove")}
                    </Button>
                )}
            </div>
        </div>
    );
}
