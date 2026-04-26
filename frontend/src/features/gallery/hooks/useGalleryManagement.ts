import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryApi, GalleryFolder, GalleryItem, GalleryVideo } from "@/domains/content";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";

export function useGalleryManagement() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<GalleryFolder | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<GalleryVideo | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'folder' | 'image' | 'video' | 'bulk-image' | 'bulk-video';
    item?: GalleryFolder | GalleryItem | GalleryVideo;
    count?: number;
  } | null>(null);

  const galleryFolderService = galleryApi.folders;
  const galleryItemService = galleryApi.items;
  const galleryVideoService = galleryApi.videos;

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["gallery-folders", i18n.language],
    queryFn: galleryFolderService.getAll,
  });

  const selectedFolder = folders.find(f => f.id === selectedFolderId) || null;

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["gallery-items", selectedFolderId, i18n.language],
    queryFn: () =>
      selectedFolderId
        ? galleryItemService.getByFolder(selectedFolderId)
        : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["gallery-videos", selectedFolderId, i18n.language],
    queryFn: () =>
      selectedFolderId
        ? galleryVideoService.getByFolder(selectedFolderId)
        : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const saveFolderMutation = useMutation({
    meta: { blocking: true },
    mutationFn: (folderData: Partial<GalleryFolder>) => {
      if (folderData.id) {
        return galleryFolderService.update(folderData.id, folderData);
      } else {
        return galleryFolderService.create(folderData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast({
        title: t("common.success"),
        description: editingFolder ? t("admin.gallery.toasts.folderUpdated") : t("admin.gallery.toasts.folderCreated"),
      });
      setFolderDialogOpen(false);
      setEditingFolder(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.gallery.toasts.saveFolderError"),
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    meta: { blocking: true },
    mutationFn: galleryFolderService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      setSelectedFolderId(null);
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.folderDeleted"),
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.gallery.toasts.deleteFolderError"),
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const toggleFolderMutation = useMutation({
    meta: { blocking: true },
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      galleryFolderService.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.folderStatus"),
      });
    },
  });

  const deleteItemMutation = useMutation({
    meta: { blocking: true },
    mutationFn: galleryItemService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.imageDeleted"),
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, ("admin.gallery.toasts.deleteImageError")),
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const deleteVideoMutation = useMutation({
    meta: { blocking: true },
    mutationFn: galleryVideoService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-videos"] });
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.videoDeleted"),
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, ("admin.gallery.toasts.deleteVideoError")),
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const bulkDeleteItemsMutation = useMutation({
    meta: { blocking: true },
    mutationFn: galleryItemService.deleteBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.imageDeleted"),
      });
      setSelectedImageIds([]);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.gallery.toasts.deleteImageError"),
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const bulkDeleteVideosMutation = useMutation({
    meta: { blocking: true },
    mutationFn: galleryVideoService.deleteBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-videos"] });
      toast({
        title: t("common.success"),
        description: t("admin.gallery.toasts.videoDeleted"),
      });
      setSelectedVideoIds([]);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.gallery.toasts.deleteVideoError"),
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const updateItemMutation = useMutation({
    meta: { blocking: true },
    mutationFn: ({ id, data }: { id: string; data: Partial<GalleryItem> }) =>
      galleryItemService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
    },
  });

  const handleMoveItem = (item: GalleryItem, direction: "up" | "down") => {
    if (!items) return;
    const currentIndex = items.findIndex((i) => i.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const targetItem = items[targetIndex];
    const currentOrder = item.order_index ?? currentIndex;
    const targetOrder = targetItem.order_index ?? targetIndex;

    updateItemMutation.mutate({ id: item.id, data: { order_index: targetOrder } });
    updateItemMutation.mutate({ id: targetItem.id, data: { order_index: currentOrder } });
  };

  const filteredFolders = folders.filter((folder) => {
    const matchesSearch = folder.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || folder.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteFolder = (folder: GalleryFolder) => {
    setDeleteTarget({ type: 'folder', item: folder });
    setDeleteDialogOpen(true);
  };

  const handleDeleteItem = (item: GalleryItem) => {
    setDeleteTarget({ type: 'image', item });
    setDeleteDialogOpen(true);
  };

  const handleDeleteVideo = (video: GalleryVideo) => {
    setDeleteTarget({ type: 'video', item: video });
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteItems = () => {
    if (selectedImageIds.length === 0) return;
    setDeleteTarget({ type: 'bulk-image', count: selectedImageIds.length });
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteVideos = () => {
    if (selectedVideoIds.length === 0) return;
    setDeleteTarget({ type: 'bulk-video', count: selectedVideoIds.length });
    setDeleteDialogOpen(true);
  };

  const handleToggleImageSelection = (id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllImages = () => {
    if (selectedImageIds.length === items.length) {
      setSelectedImageIds([]);
    } else {
      setSelectedImageIds(items.map((i) => i.id));
    }
  };

  const handleToggleVideoSelection = (id: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllVideos = () => {
    if (selectedVideoIds.length === videos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(videos.map((v) => v.id));
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case 'folder':
        deleteFolderMutation.mutate((deleteTarget.item as GalleryFolder).id);
        break;
      case 'image':
        deleteItemMutation.mutate((deleteTarget.item as GalleryItem).id);
        break;
      case 'video':
        deleteVideoMutation.mutate((deleteTarget.item as GalleryVideo).id);
        break;
      case 'bulk-image':
        bulkDeleteItemsMutation.mutate(selectedImageIds);
        break;
      case 'bulk-video':
        bulkDeleteVideosMutation.mutate(selectedVideoIds);
        break;
    }
  };

  return {
    t,
    i18n,
    selectedFolderId,
    setSelectedFolderId,
    folderDialogOpen,
    setFolderDialogOpen,
    editingFolder,
    setEditingFolder,
    videoDialogOpen,
    setVideoDialogOpen,
    editingVideo,
    setEditingVideo,
    uploadDialogOpen,
    setUploadDialogOpen,
    editItemDialogOpen,
    setEditItemDialogOpen,
    editingItem,
    setEditingItem,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    selectedImageIds,
    setSelectedImageIds,
    selectedVideoIds,
    setSelectedVideoIds,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTarget,
    foldersLoading,
    folders,
    selectedFolder,
    items,
    itemsLoading,
    videos,
    videosLoading,
    saveFolderMutation,
    toggleFolderMutation,
    handleMoveItem,
    filteredFolders,
    handleDeleteFolder,
    handleDeleteItem,
    handleDeleteVideo,
    handleBulkDeleteItems,
    handleBulkDeleteVideos,
    handleToggleImageSelection,
    handleSelectAllImages,
    handleToggleVideoSelection,
    handleSelectAllVideos,
    handleConfirmDelete
  };
}
