import { logger } from "@/lib/logger";
import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface ProfileImageCropperProps {
    image: string | File | null;
    onChange: (file: File) => void;
    onClear?: () => void;
}

// Helper function to create image element
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

// Helper function to get cropped image
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
        image,
        safeArea / 2 - image.width * 0.5,
        safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas is empty'));
            }
        }, 'image/jpeg', 0.95);
    });
}

export function ProfileImageCropper({ image, onChange, onClear }: ProfileImageCropperProps) {
    const { t } = useTranslation();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropping, setIsCropping] = useState(false);

    useEffect(() => {
        if (image) {
            if (image instanceof File) {
                const reader = new FileReader();
                reader.addEventListener('load', () => {
                    setImageSrc(reader.result as string);
                    setIsCropping(true);
                });
                reader.readAsDataURL(image);
            } else {
                setImageSrc(image);
                setIsCropping(false); // Existing image, don't auto-crop
            }
        } else {
            setImageSrc(null);
            setIsCropping(false);
        }
    }, [image]);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
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
