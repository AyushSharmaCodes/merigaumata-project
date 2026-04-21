import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { galleryFolderService, GalleryFolder } from "@/services/gallery-folder.service";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Square } from "lucide-react";
import { GalleryFolderDialog } from "@/components/admin/GalleryFolderDialog";
import { GalleryVideoDialog } from "@/components/admin/GalleryVideoDialog";
import { GalleryItemUploadDialog } from "@/components/admin/GalleryItemUploadDialog";
import { GalleryItemEditDialog } from "@/components/admin/GalleryItemEditDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { GalleryGridSkeleton } from "@/components/ui/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function GalleryManagement() {
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

  // Selection states
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  // Delete confirmation states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'folder' | 'image' | 'video' | 'bulk-image' | 'bulk-video';
    item?: GalleryFolder | GalleryItem | GalleryVideo;
    count?: number;
  } | null>(null);

  // Fetch all folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["gallery-folders", i18n.language],
    queryFn: galleryFolderService.getAll,
  });

  // Derive selected folder from ID
  const selectedFolder = folders.find(f => f.id === selectedFolderId) || null;

  // Fetch items for selected folder
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["gallery-items", selectedFolderId, i18n.language],
    queryFn: () =>
      selectedFolderId
        ? galleryItemService.getByFolder(selectedFolderId)
        : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  // Fetch videos for selected folder
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["gallery-videos", selectedFolderId, i18n.language],
    queryFn: () =>
      selectedFolderId
        ? galleryVideoService.getByFolder(selectedFolderId)
        : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  // Folder mutations
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

  // Item mutations
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

  // Video mutations
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

  // Bulk delete mutations
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

    // Swap order_index
    // If order_index is missing, assume index based on current sort
    const currentOrder = item.order_index ?? currentIndex;
    const targetOrder = targetItem.order_index ?? targetIndex;

    updateItemMutation.mutate({ id: item.id, data: { order_index: targetOrder } });
    updateItemMutation.mutate({ id: targetItem.id, data: { order_index: currentOrder } });
  };

  // Handle folder filtering
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


  if (foldersLoading) {
    return (
      <div className="p-8">
        <GalleryGridSkeleton />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.gallery.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.gallery.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="folders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="folders">
            <FolderOpen className="h-4 w-4 mr-2" />
            {t("admin.gallery.folders")} ({folders.length})
          </TabsTrigger>
          <TabsTrigger value="images" disabled={!selectedFolder} onClick={() => setSelectedVideoIds([])}>
            <ImageIcon className="h-4 w-4 mr-2" />
            {t("admin.gallery.images")} ({items.length})
            {selectedImageIds.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 h-5 min-w-5 flex items-center justify-center">
                {selectedImageIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="videos" disabled={!selectedFolder} onClick={() => setSelectedImageIds([])}>
            <Video className="h-4 w-4 mr-2" />
            {t("admin.gallery.videos")} ({videos.length})
            {selectedVideoIds.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 h-5 min-w-5 flex items-center justify-center">
                {selectedVideoIds.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Folders Tab */}
        <TabsContent value="folders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {selectedFolder
                ? `${t("admin.gallery.folder")}: ${selectedFolder.name}`
                : t("admin.gallery.allFolders")}
            </h2>
            <Button
              onClick={() => {
                setEditingFolder(null);
                setFolderDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.newFolder")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder) => (
              <Card
                key={folder.id}
                className={`cursor-pointer transition-all ${selectedFolder?.id === folder.id
                  ? "ring-2 ring-primary"
                  : ""
                  }`}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{folder.name}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge
                          variant={folder.is_active ? "default" : "secondary"}
                        >
                          {folder.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                        <Badge variant="outline">
                          {folder.category_name || t("common.general")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {folder.cover_image && (
                    <img
                      src={folder.cover_image}
                      alt={folder.name}
                      loading="lazy"
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                  )}
                  {folder.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {folder.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderMutation.mutate({
                          id: folder.id,
                          is_active: !folder.is_active,
                        });
                      }}
                    >
                      {folder.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setFolderDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!foldersLoading && filteredFolders.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noFolders")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                {t("admin.gallery.images")} {t("common.in")} {selectedFolder?.name}
              </h2>
              {items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleSelectAllImages}
                >
                  {selectedImageIds.length === items.length ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      {t("admin.gallery.deselectAll")}
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {t("admin.gallery.selectAll")}
                    </>
                  )}
                </Button>
              )}
              {selectedImageIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={handleBulkDeleteItems}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.gallery.deleteSelected", { count: selectedImageIds.length })}
                </Button>
              )}
            </div>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.uploadImages")}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {itemsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-none shadow-sm h-64">
                   <Skeleton className="h-40 w-full" />
                   <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                   </div>
                </Card>
              ))
            ) : (
              items
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((item, index) => (
                  <Card key={item.id} className="group relative">
                    <CardContent className="p-3">
                      <div className="relative">
                        <img
                          src={item.thumbnail_url || item.image_url}
                          alt={item.title || t("admin.gallery.dialog.preview")}
                          loading="lazy"
                          className={`w-full h-40 object-cover rounded-md mb-2 transition-all ${selectedImageIds.includes(item.id) ? "opacity-50 ring-2 ring-primary" : ""
                            }`}
                          onClick={() => handleToggleImageSelection(item.id)}
                        />
                        {/* Checkbox */}
                        <div className="absolute top-2 left-2 transition-opacity">
                          <Checkbox
                            checked={selectedImageIds.includes(item.id)}
                            onCheckedChange={() => handleToggleImageSelection(item.id)}
                            className="bg-white/80 data-[state=checked]:bg-primary"
                          />
                        </div>
                        {/* Reorder Buttons */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveItem(item, "up");
                            }}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveItem(item, "down");
                            }}
                            disabled={index === items.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {item.title && (
                        <p className="text-sm font-medium mb-1 truncate">
                          {item.title}
                        </p>
                      )}
                      {item.location && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">
                          {item.location}
                        </p>
                      )}

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {item.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingItem(item);
                            setEditItemDialogOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleDeleteItem(item)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>

          {!itemsLoading && items.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noImagesInFolder")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                {t("admin.gallery.videos")} {t("common.in")} {selectedFolder?.name}
              </h2>
              {videos.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleSelectAllVideos}
                >
                  {selectedVideoIds.length === videos.length ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      {t("admin.gallery.deselectAll")}
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {t("admin.gallery.selectAll")}
                    </>
                  )}
                </Button>
              )}
              {selectedVideoIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={handleBulkDeleteVideos}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.gallery.deleteSelected", { count: selectedVideoIds.length })}
                </Button>
              )}
            </div>
            <Button
              onClick={() => {
                setEditingVideo(null);
                setVideoDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.addVideo")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videosLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-none shadow-sm h-72">
                   <Skeleton className="h-40 w-full" />
                   <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                   </div>
                </Card>
              ))
            ) : (
              videos.map((video) => (
                <Card key={video.id}>
                  <CardContent className="p-4 relative group">
                    {/* Checkbox */}
                    <div className="absolute top-6 left-6 z-10">
                      <Checkbox
                        checked={selectedVideoIds.includes(video.id)}
                        onCheckedChange={() => handleToggleVideoSelection(video.id)}
                        className="bg-white/80 data-[state=checked]:bg-primary border-primary shadow-sm"
                      />
                    </div>
                    {video.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        loading="lazy"
                        className={`w-full h-40 object-cover rounded-md mb-3 cursor-pointer transition-all ${selectedVideoIds.includes(video.id) ? "opacity-50 ring-2 ring-primary" : ""
                          }`}
                        onClick={() => handleToggleVideoSelection(video.id)}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src.includes("maxresdefault.jpg")) {
                            target.src = target.src.replace("maxresdefault.jpg", "sddefault.jpg");
                          } else if (target.src.includes("sddefault.jpg")) {
                            target.src = target.src.replace("sddefault.jpg", "hqdefault.jpg");
                          }
                        }}
                      />
                    )}
                    <h3 className="font-medium mb-2">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditingVideo(video);
                          setVideoDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDeleteVideo(video)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {!videosLoading && videos.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noVideosInFolder")}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GalleryFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        folder={editingFolder}
        onSave={(data) => saveFolderMutation.mutate(data)}
      />

      <GalleryVideoDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        video={editingVideo}
        defaultFolderId={selectedFolder?.id}
      />

      {selectedFolder && (
        <GalleryItemUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          folderId={selectedFolder.id}
          folderName={selectedFolder.title}
        />
      )}

      <GalleryItemEditDialog
        open={editItemDialogOpen}
        onOpenChange={setEditItemDialogOpen}
        item={editingItem}
        folderName={selectedFolder?.title}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={
          deleteTarget?.type === 'folder'
            ? t("admin.gallery.delete.folderTitle")
            : deleteTarget?.type === 'image'
              ? t("admin.gallery.delete.imageTitle")
              : deleteTarget?.type === 'video'
                ? t("admin.gallery.delete.videoTitle")
                : deleteTarget?.type === 'bulk-image'
                  ? t("admin.gallery.delete.bulkImageTitle")
                  : t("admin.gallery.delete.bulkVideoTitle")
        }
        description={
          deleteTarget?.type === 'folder'
            ? t("admin.gallery.delete.folderDescription", { name: (deleteTarget?.item as GalleryFolder)?.name })
            : deleteTarget?.type === 'image'
              ? t("admin.gallery.delete.imageDescription")
              : deleteTarget?.type === 'video'
                ? t("admin.gallery.delete.videoDescription")
                : deleteTarget?.type === 'bulk-image'
                  ? t("admin.gallery.delete.bulkImageDescription", { count: deleteTarget?.count })
                  : t("admin.gallery.delete.bulkVideoDescription", { count: deleteTarget?.count })
        }
        isLoading={
          deleteFolderMutation.isPending ||
          deleteItemMutation.isPending ||
          deleteVideoMutation.isPending ||
          bulkDeleteItemsMutation.isPending ||
          bulkDeleteVideosMutation.isPending
        }
      />
    </div>
  );
}
