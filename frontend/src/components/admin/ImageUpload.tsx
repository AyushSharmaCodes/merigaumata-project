import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { UploadType } from '@/services/upload.service';
import { IMAGE_UPLOAD_MAX_LABEL, isImageUploadWithinLimit } from '@/constants/upload';

interface ImageUploadProps {
  images: (string | File)[];
  onChange: (images: (string | File)[]) => void;
  maxImages?: number;
  type?: UploadType;
  folder?: string;
}

export function ImageUpload({ images, onChange, maxImages = 5, type = 'product', folder }: ImageUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);



  // Better implementation using Ref to track active URLs
  const activeUrlsRef = useState<Map<File, string>>(new Map())[0];

  useEffect(() => {
    const newPreviews = images.map(image => {
      if (image instanceof File) {
        if (!activeUrlsRef.has(image)) {
          const url = URL.createObjectURL(image);
          activeUrlsRef.set(image, url);
        }
        return activeUrlsRef.get(image)!;
      }
      return image;
    });

    setPreviews(newPreviews);

    // Cleanup unused URLs
    const currentFiles = new Set(images.filter(i => i instanceof File) as File[]);
    for (const [file, url] of activeUrlsRef.entries()) {
      if (!currentFiles.has(file)) {
        URL.revokeObjectURL(url);
        activeUrlsRef.delete(file);
      }
    }
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const url of activeUrlsRef.values()) {
        URL.revokeObjectURL(url);
      }
      activeUrlsRef.clear();
    };
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = maxImages - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (filesToProcess.length === 0) return;

    const oversizedFiles = filesToProcess.filter(file => file.type.startsWith('image/') && !isImageUploadWithinLimit(file));
    const validFiles = filesToProcess.filter(file => file.type.startsWith('image/') && isImageUploadWithinLimit(file));

    const skippedNonImages = filesToProcess.length - oversizedFiles.length - validFiles.length;

    if (skippedNonImages > 0) {
      toast({
        title: t("common.warning"),
        description: t("common.upload.skipNonImages"),
        variant: "destructive",
      });
    }

    if (oversizedFiles.length > 0) {
      toast({
        title: t("common.warning"),
        description: `${oversizedFiles[0].name} exceeds the ${IMAGE_UPLOAD_MAX_LABEL} limit`,
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      onChange([...images, ...validFiles]);
    }

    if (files.length > remainingSlots) {
      toast({
        title: t("common.warning"),
        description: t("common.upload.maxReached", { max: maxImages, count: remainingSlots }),
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Upload ${index + 1}`}
                loading="lazy"
                className="w-full h-32 object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  {t("common.primary")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            {t("common.upload.dragDrop")}
          </p>
          <input
            type="file"
            name="image-upload"
            aria-label={t("common.upload.selectImages", { count: images.length, max: maxImages })}
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload">
            <Button type="button" variant="outline" asChild>
              <span>
                <Plus className="h-4 w-4 mr-2" />
                {t("common.upload.selectImages", { count: images.length, max: maxImages })}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            {t("common.upload.maxImagesInfo", { max: maxImages })}
          </p>
        </div>
      )}
    </div>
  );
}
