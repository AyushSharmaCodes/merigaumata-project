import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Play, ArrowLeft, FolderOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Tag } from "@/components/ui/Tag";
import { galleryFolderService, GalleryFolder } from "@/services/gallery-folder.service";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { BackButton } from "@/components/ui/BackButton";
import { YOUTUBE_EMBED_BASE_URL, YOUTUBE_THUMBNAIL_BASE_URL } from "@/lib/externalUrls";
import { getLocalizedContent } from "@/utils/localizationUtils";

export default function Gallery() {
  const { t, i18n } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Fetch all folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["gallery-folders-public", i18n.language],
    queryFn: galleryFolderService.getAll,
  });

  // Fetch items for selected folder
  const { data: items = [] } = useQuery({
    queryKey: ["gallery-items-public", selectedFolder?.id, i18n.language],
    queryFn: () =>
      selectedFolder
        ? galleryItemService.getByFolder(selectedFolder.id)
        : Promise.resolve([]),
    enabled: !!selectedFolder,
  });

  // Fetch all videos
  const { data: allVideos = [] } = useQuery<GalleryVideo[]>({
    queryKey: ["gallery-videos-public", i18n.language],
    queryFn: () => galleryVideoService.getAll(),
  });

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Filter active and non-hidden folders only
  const activeFolders = folders.filter((f) => f.is_active && !f.is_hidden);

  if (loadingFolders) {
    return (
      <div className="min-h-screen bg-background relative">
        <LoadingOverlay message={t("gallery.unveiling")} isLoading={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <LoadingOverlay message={t("gallery.unveiling")} isLoading={loadingFolders} />

      {/* Premium Compact Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <FolderOpen className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                <Sparkles className="h-3 w-3" /> {t("gallery.heritageBadge")}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                {t("gallery.title")} <span className="text-[#B85C3C]">{t("gallery.archive")}</span>
              </h1>
            </div>
            <p className="text-white/50 text-sm md:text-base max-w-md font-light border-l border-[#B85C3C]/30 pl-6 hidden md:block">
              {t("gallery.subtitle")}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        {/* Gallery Content - Modernized Overlapping Tabs */}
        <Tabs defaultValue="photos" className="w-full">
          {!selectedFolder && (
            <div className="flex justify-center mb-12">
              <TabsList className="h-16 rounded-full bg-white shadow-elevated p-1.5 border border-border/50">
                <TabsTrigger value="photos" className="rounded-full px-12 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-sm uppercase tracking-[0.2em]">
                  {t("gallery.photos")}
                </TabsTrigger>
                <TabsTrigger value="videos" className="rounded-full px-12 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-sm uppercase tracking-[0.2em]">
                  {t("gallery.videos")}
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          {/* Photos Tab */}
          <TabsContent value="photos" className="mt-0 focus-visible:outline-none">
            {selectedFolder ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Sticky Back Navigation Bar - Enhanced */}
                <div className="sticky top-20 z-30 bg-white/95 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-8 border-b border-border/30 shadow-sm">
                  <div className="container mx-auto flex items-center justify-between">
                    <BackButton
                      onClick={() => setSelectedFolder(null)}
                      label={t("gallery.backToAlbums")}
                    />
                    <div className="text-sm font-bold uppercase tracking-[0.2em] text-[#B85C3C] bg-[#B85C3C]/10 px-4 py-2 rounded-full">
                      {items.length} {t("gallery.photosCount")}
                    </div>
                  </div>
                </div>
                {/* Folder header info - Modernized */}
                <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-border/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <FolderOpen className="h-24 w-24 text-[#B85C3C]" />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-widest">
                        {getLocalizedContent(selectedFolder, i18n.language, 'category_name') || t("common.general")}
                      </div>
                      <h2 className="text-3xl md:text-5xl font-bold font-playfair text-[#2C1810]">
                        {getLocalizedContent(selectedFolder, i18n.language, 'name')}
                      </h2>
                      {getLocalizedContent(selectedFolder, i18n.language, 'description') && (
                        <p className="text-muted-foreground text-lg font-light max-w-2xl leading-relaxed">
                          {getLocalizedContent(selectedFolder, i18n.language, 'description')}
                        </p>
                      )}
                    </div>
                    <div className="text-sm font-bold uppercase tracking-[0.2em] text-[#B85C3C] whitespace-nowrap bg-muted/50 px-6 py-3 rounded-2xl">
                      {items.length} {t("gallery.elementsCount")}
                    </div>
                  </div>
                </div>

                {/* Images grid - Refined */}
                {items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-[2rem] aspect-square cursor-pointer transition-all duration-500 shadow-soft hover:shadow-elevated bg-muted/20"
                        onClick={() => handleImageClick(index)}
                      >
                        <img
                          src={item.thumbnail_url || item.image_url}
                          alt={getLocalizedContent(item, i18n.language, 'title') || t("gallery.photosCount")}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500">
                          <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                            {getLocalizedContent(item, i18n.language, 'title') && (
                              <h3 className="text-white font-bold font-playfair text-xl mb-1">
                                {getLocalizedContent(item, i18n.language, 'title')}
                              </h3>
                            )}
                            {getLocalizedContent(item, i18n.language, 'description') && (
                              <p className="text-white/80 text-xs line-clamp-2 font-light">
                                {getLocalizedContent(item, i18n.language, 'description')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-24 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
                    <p className="text-muted-foreground font-light text-lg italic">
                      {t("gallery.noImages")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group relative overflow-hidden rounded-[2.5rem] aspect-[4/3] cursor-pointer shadow-soft hover:shadow-elevated transition-all duration-500 bg-white"
                    onClick={() => setSelectedFolder(folder)}
                  >
                    {/* Folder thumbnail */}
                    {folder.cover_image ? (
                      <img
                        src={folder.cover_image}
                        alt={folder.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : folder.gallery_items && folder.gallery_items.length > 0 ? (
                      <img
                        src={folder.gallery_items[0].thumbnail_url || folder.gallery_items[0].image_url}
                        alt={folder.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                        <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Overlay gradient - Premium */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/90 via-[#2C1810]/20 to-transparent"></div>

                    {/* Folder details */}
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-[#B85C3C] text-white rounded-full p-1.5 shadow-lg group-hover:bg-white group-hover:text-[#B85C3C] transition-colors">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                          {getLocalizedContent(folder, i18n.language, 'category_name') || t("common.general")}
                        </span>
                      </div>
                      <h3 className="text-white font-bold font-playfair text-2xl group-hover:text-[#B85C3C] transition-colors duration-300">
                        {getLocalizedContent(folder, i18n.language, 'name')}
                      </h3>
                      {getLocalizedContent(folder, i18n.language, 'description') && (
                        <p className="text-white/60 text-sm line-clamp-2 mt-2 font-light leading-relaxed">
                          {getLocalizedContent(folder, i18n.language, 'description')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFolders.length === 0 && !selectedFolder && (
              <div className="text-center py-24 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50 max-w-4xl mx-auto">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-light text-lg italic">
                  {t("gallery.emptyState")}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="mt-0 focus-visible:outline-none">
            {allVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {allVideos.map((video) => (
                  <div
                    key={video.id}
                    className="group relative overflow-hidden rounded-[2.5rem] aspect-video cursor-pointer shadow-soft hover:shadow-elevated transition-all duration-500 bg-black"
                    onClick={() => setSelectedVideo(video.youtube_id)}
                  >
                    <img
                      src={
                        video.thumbnail_url ||
                        `${YOUTUBE_THUMBNAIL_BASE_URL}/${video.youtube_id}/maxresdefault.jpg`
                      }
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src.includes("maxresdefault.jpg")) {
                          target.src = target.src.replace("maxresdefault.jpg", "sddefault.jpg");
                        } else if (target.src.includes("sddefault.jpg")) {
                          target.src = target.src.replace("sddefault.jpg", "hqdefault.jpg");
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#B85C3C] transition-all duration-500 shadow-2xl">
                        <Play
                          className="h-10 w-10 text-white ml-2"
                          fill="currentColor"
                        />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#2C1810] to-transparent">
                      <h3 className="text-white font-bold font-playfair text-xl group-hover:text-[#B85C3C] transition-colors duration-300">
                        {getLocalizedContent(video, i18n.language, 'title')}
                      </h3>
                      {getLocalizedContent(video, i18n.language, 'description') && (
                        <p className="text-white/60 text-sm line-clamp-1 mt-2 font-light">
                          {getLocalizedContent(video, i18n.language, 'description')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50 max-w-4xl mx-auto">
                <Play className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-light text-lg italic">{t("gallery.noVideos")}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {
        lightboxOpen && items.length > 0 && (
          <ImageLightbox
            images={items.map((item) => item.image_url)}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            titles={items.map((item) => getLocalizedContent(item, i18n.language, 'title') || "")}
          />
        )
      }

      {/* Video Modal */}
      {
        selectedVideo && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/10"
              onClick={() => setSelectedVideo(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <div
              className="w-full max-w-4xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`${YOUTUBE_EMBED_BASE_URL}/${selectedVideo}?autoplay=1`}
                title={t("gallery.videoPlayer")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              />
            </div>
          </div>
        )
      }
    </div >
  );
}
