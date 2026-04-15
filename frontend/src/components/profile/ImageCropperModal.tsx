import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, X } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { useDropzone } from "react-dropzone";
import { useTranslation } from 'react-i18next';
import { MAX_USER_IMAGE_SIZE_BYTES, MAX_USER_IMAGE_SIZE_MB } from "@/constants/upload.constants";
import { toast } from "@/hooks/use-toast";
import { getCroppedImg } from "@/utils/image-optimization.utils";

interface ImageCropperModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (file: File) => void;
    onDelete?: () => void;
}

export default function ImageCropperModal({
    open,
    onClose,
    onSave,
    onDelete
}: ImageCropperModalProps) {
    const { t } = useTranslation();
    const [image, setImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [loading, setLoading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            if (file.size > MAX_USER_IMAGE_SIZE_BYTES) {
                toast({
                    title: t("common.error"),
                    description: t("common.upload.fileTooLarge", { name: file.name, max: `${MAX_USER_IMAGE_SIZE_MB}MB` }),
                    variant: "destructive"
                });
                return;
            }
            
            // Clean up previous URL if it exists
            if (image && image.startsWith('blob:')) {
                URL.revokeObjectURL(image);
            }
            
            const objectUrl = URL.createObjectURL(file);
            setImage(objectUrl);
        }
    }, [t, image]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (image && image.startsWith('blob:')) {
                URL.revokeObjectURL(image);
            }
        };
    }, [image]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.webp']
        },
        maxFiles: 1,
        multiple: false
    });

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createCroppedImage = async (): Promise<File> => {
        if (!image || !croppedAreaPixels) {
            throw new Error('No image to crop');
        }

        try {
            const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
            return new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
        } catch (error) {
            logger.error('Error in createCroppedImage:', error);
            throw error;
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const croppedFile = await createCroppedImage();
            onSave(croppedFile);
            handleClose();
        } catch (error) {
            logger.error('Error cropping image:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (image && image.startsWith('blob:')) {
            URL.revokeObjectURL(image);
        }
        setImage(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        onClose();
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete();
            handleClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('profile.updateProfilePicture')}</DialogTitle>
                    <DialogDescription>
                        {t('profile.uploadAndCrop', { defaultValue: 'Upload and crop your profile picture. Recommended size: 400x400px' })}
                    </DialogDescription>
                </DialogHeader>

                {!image ? (
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                            }`}
                    >
                        <input {...getInputProps({ id: "dropzone-file-input", name: "profileImage", "aria-label": "Upload profile picture" })} />
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                            {isDragActive
                                ? t('profile.dropImageHere', { defaultValue: 'Drop the image here' })
                                : t('profile.dragAndDrop', { defaultValue: 'Drag and drop an image, or click to select' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            {t('profile.supportedFormats', { defaultValue: `Supports: JPG, PNG, WEBP (max ${MAX_USER_IMAGE_SIZE_MB}MB)` })}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
                            <Cropper
                                image={image}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="zoom-slider" className="text-sm font-medium">{t('profile.zoom')}</label>
                            <input
                                id="zoom-slider"
                                name="zoomLevel"
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImage(null)}
                            className="w-full"
                        >
                            <X className="mr-2 h-4 w-4" />
                            {t('profile.chooseDifferentImage', { defaultValue: 'Choose Different Image' })}
                        </Button>
                    </div>
                )}

                <DialogFooter>
                    {onDelete && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="mr-auto"
                        >
                            {t('profile.deleteCurrentPicture', { defaultValue: 'Delete Current Picture' })}
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!image || loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('profile.savePicture', { defaultValue: 'Save Picture' })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
