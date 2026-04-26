import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { galleryApi, GalleryFolder, GalleryVideo } from "@/domains/content";

export function useGalleryPage() {
  const { t, i18n } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const galleryFolderService = galleryApi.folders;
  const galleryItemService = galleryApi.items;
  const galleryVideoService = galleryApi.videos;

  // Fetch all folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["gallery-folders-public", i18n.language],
    queryFn: galleryFolderService.getAll,
  });

  // Fetch items for selected folder
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["gallery-items-public", selectedFolder?.id, i18n.language],
    queryFn: () =>
      selectedFolder
        ? galleryItemService.getByFolder(selectedFolder.id)
        : Promise.resolve([]),
    enabled: !!selectedFolder,
  });

  // Fetch all videos
  const { data: allVideos = [], isLoading: loadingVideos } = useQuery<GalleryVideo[]>({
    queryKey: ["gallery-videos-public", i18n.language],
    queryFn: () => galleryVideoService.getAll(),
  });

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleBackToAlbums = () => {
    setSelectedFolder(null);
  };

  // Filter active and non-hidden folders only
  const activeFolders = folders.filter((f) => f.is_active && !f.is_hidden);

  return {
    t,
    i18n,
    selectedFolder,
    setSelectedFolder,
    lightboxOpen,
    setLightboxOpen,
    lightboxIndex,
    setLightboxIndex,
    selectedVideo,
    setSelectedVideo,
    folders,
    loadingFolders,
    items,
    loadingItems,
    allVideos,
    loadingVideos,
    handleImageClick,
    handleBackToAlbums,
    activeFolders
  };
}
