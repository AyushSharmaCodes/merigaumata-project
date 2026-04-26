import { galleryFolderService } from './gallery-folder.api';
import { galleryItemService } from './gallery-item.api';
import { galleryVideoService } from './gallery-video.api';

export type { GalleryFolder } from './gallery-folder.api';
export type { GalleryItem } from './gallery-item.api';
export type { GalleryVideo } from './gallery-video.api';

export const galleryApi = {
  folders: galleryFolderService,
  items: galleryItemService,
  videos: galleryVideoService,
};
