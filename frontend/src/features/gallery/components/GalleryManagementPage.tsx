import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
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
  CheckSquare,
  Square,
} from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { GalleryFolderDialog } from "@/features/admin/gallery";
import { GalleryVideoDialog } from "@/features/admin/gallery";
import { GalleryItemUploadDialog } from "@/features/admin/gallery";
import { GalleryItemEditDialog } from "@/features/admin/gallery";
import { DeleteConfirmDialog } from "@/features/admin";
import { GalleryGridSkeleton } from "@/shared/components/ui/page-skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useGalleryManagement } from "../hooks/useGalleryManagement";
import { GalleryFolder, GalleryItem, GalleryVideo } from "@/domains/content";

export const GalleryManagementPage = () => {
    const {
        t,
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
        categoryFilter,
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
        handleConfirmDelete,
        deleteFolderMutation,
        deleteItemMutation,
        deleteVideoMutation,
        bulkDeleteItemsMutation,
        bulkDeleteVideosMutation
    } = useGalleryManagement();

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
                                                <div className="absolute top-2 left-2 transition-opacity">
                                                    <Checkbox
                                                        checked={selectedImageIds.includes(item.id)}
                                                        onCheckedChange={() => handleToggleImageSelection(item.id)}
                                                        className="bg-white/80 data-[state=checked]:bg-primary"
                                                    />
                                                </div>
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
                    folderName={selectedFolder.name}
                />
            )}

            <GalleryItemEditDialog
                open={editItemDialogOpen}
                onOpenChange={setEditItemDialogOpen}
                item={editingItem}
                folderName={selectedFolder?.name}
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
};
