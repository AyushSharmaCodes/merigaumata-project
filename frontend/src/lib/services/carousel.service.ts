import { apiClient } from "@/lib/api-client";
import type { HeroCarouselSlide } from "@/types";

interface GalleryFolder {
  id: string;
  title: string;
  is_home_carousel: boolean;
}

interface GalleryItem {
  id: string;
  image_url: string;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const getCarouselSlides = async (): Promise<HeroCarouselSlide[]> => {
  // 1. Get all folders to find the one marked as home carousel
  const response = await apiClient.get<GalleryFolder[]>("/gallery-folders");
  const folders = response.data;
  const carouselFolder = folders.find((f) => f.is_home_carousel);

  if (!carouselFolder) {
    return [];
  }

  // 2. Get items from that folder
  const folderResponse = await apiClient.get(`/gallery-folders/${carouselFolder.id}`);
  const items = folderResponse.data.items || [];

  // 3. Map to HeroCarouselSlide
  return items.map((item: GalleryItem, index: number) => ({
    id: item.id,
    image: item.image_url,
    title: item.title,
    subtitle: item.description, // Using description as subtitle
    order: item.order_index || index,
    isActive: true,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
};

export const getAllCarouselSlides = async (): Promise<HeroCarouselSlide[]> => {
  // This is now effectively the same as getCarouselSlides for the frontend usage,
  // but for admin we might want to know WHICH folder is selected.
  // For backward compatibility or specific admin views, we can keep it or adjust.
  // For now, let's return the same as getCarouselSlides
  return getCarouselSlides();
};

export const getCarouselSlide = async (id: string): Promise<HeroCarouselSlide | null> => {
  // Since we don't have a specific endpoint for single slide in routes yet, 
  // we can fetch all and find one, or add the endpoint. 
  // For now, let's just fetch all admin slides and find it.
  const slides = await getAllCarouselSlides();
  return slides.find(s => s.id === id) || null;
};

export const createCarouselSlide = async (
  data: Omit<HeroCarouselSlide, "id" | "createdAt" | "updatedAt">
): Promise<HeroCarouselSlide> => {
  const response = await apiClient.post("/carousel-slides", data);
  return response.data;
};

export const updateCarouselSlide = async (
  id: string,
  data: Partial<Omit<HeroCarouselSlide, "id" | "createdAt" | "updatedAt">>
): Promise<HeroCarouselSlide> => {
  const response = await apiClient.put(`/carousel-slides/${id}`, data);
  return response.data;
};

export const deleteCarouselSlide = async (id: string): Promise<void> => {
  await apiClient.delete(`/carousel-slides/${id}`);
};

export const toggleCarouselSlideStatus = async (
  id: string,
  isActive: boolean
): Promise<HeroCarouselSlide> => {
  return updateCarouselSlide(id, { isActive });
};
