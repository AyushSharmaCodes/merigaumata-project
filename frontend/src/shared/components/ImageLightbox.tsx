import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  titles?: string[];
}

export function ImageLightbox({ images, currentIndex, onClose, titles }: ImageLightboxProps) {
  const [index, setIndex] = useState(currentIndex);

  const handlePrevious = () => {
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Previous Button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <div
        className="max-w-7xl max-h-[90vh] mx-auto px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[index]}
          alt={titles?.[index] || `Image ${index + 1}`}
          loading="lazy"
          className="max-w-full max-h-[80vh] object-contain animate-scale-in"
        />
        {titles?.[index] && (
          <p className="text-white text-center mt-4 text-lg">{titles[index]}</p>
        )}
        {images.length > 1 && (
          <p className="text-white/70 text-center mt-2">
            {index + 1} / {images.length}
          </p>
        )}
      </div>

      {/* Next Button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}
    </div>
  );
}
