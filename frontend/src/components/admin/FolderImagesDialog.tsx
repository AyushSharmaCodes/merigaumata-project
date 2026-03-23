import { logger } from "@/lib/logger";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { GalleryFolder } from "@/types";
import { uploadService } from "@/services/upload.service";
import { useTranslation } from 'react-i18next';

interface FolderImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: GalleryFolder | null;
  onAddImages: (folderId: string, imageUrls: string[]) => void;
  onDeleteImage: (folderId: string, imageUrl: string) => void;
}

export function FolderImagesDialog({
  open,
  onOpenChange,
  folder,
  onAddImages,
  onDeleteImage,
}: FolderImagesDialogProps) {
  const { t } = useTranslation();
  const [newImages, setNewImages] = useState<(string | File)[]>([]);
  const [isAddingMode, setIsAddingMode] = useState(false);

  const handleAddImages = async () => {
    if (folder && newImages.length > 0) {
      const processedImages: string[] = [];

      try {
        for (const img of newImages) {
          if (img instanceof File) {
            const response = await uploadService.uploadImage(img, 'gallery', folder.title);
            processedImages.push(response.url);
          } else if (typeof img === 'string') {
            processedImages.push(img);
          }
        }

        onAddImages(folder.id, processedImages);
        setNewImages([]);
        setIsAddingMode(false);
      } catch (error) {
        logger.error("Error uploading folder images:", error);
        // Handle error
      }
    }
  };

  const handleDeleteImage = (imageUrl: string) => {
    if (
      folder &&
      window.confirm("Are you sure you want to delete this image?")
    ) {
      onDeleteImage(folder.id, imageUrl);
    }
  };

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div>
            <DialogTitle className="text-2xl font-semibold">
              {folder.title}
            </DialogTitle>
            <DialogDescription>
              {folder.description || "Manage images in this folder"}
            </DialogDescription>
            {folder.description && (
              <p className="text-sm text-muted-foreground mt-1 sr-only">
                {folder.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {folder.images.length}{" "}
              {folder.images.length === 1 ? "image" : "images"} in this folder
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Add Images Section */}
          {!isAddingMode ? (
            <Button onClick={() => setIsAddingMode(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.gallery.addImagesToFolder', { defaultValue: 'Add Images to Folder' })}
            </Button>
          ) : (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('admin.gallery.uploadNewImages')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingMode(false);
                    setNewImages([]);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
              <ImageUpload
                images={newImages}
                onChange={setNewImages}
                maxImages={50}
              />
              {newImages.length > 0 && (
                <Button onClick={handleAddImages} className="w-full">
                  Add {newImages.length}{" "}
                  {newImages.length === 1 ? "Image" : "Images"}
                </Button>
              )}
            </div>
          )}

          {/* Existing Images Grid */}
          {folder.images.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('admin.gallery.noImagesYet', { defaultValue: 'No images in this folder yet' })}
              </p>
              <p className="text-sm text-muted-foreground">
                Click "Add Images to Folder" to upload
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {folder.images.map((imageUrl, index) => (
                <Card key={index} className="overflow-hidden group relative">
                  <div className="aspect-square relative">
                    <img
                      src={imageUrl}
                      alt={`${folder.title} - ${index + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDeleteImage(imageUrl)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
