// Proxy: Legacy carousel service -> Content domain
export { carouselApi } from "../../api/content.api";

// Backward-compatible named exports
import { carouselApi } from "../../api/content.api";

export const getCarouselSlides = carouselApi.getSlides;
export const getAllCarouselSlides = carouselApi.getSlides;
export const getCarouselSlide = async (id: string) => {
    const slides = await carouselApi.getSlides();
    return slides.find(s => s.id === id) || null;
};
export const createCarouselSlide = carouselApi.createSlide;
export const updateCarouselSlide = carouselApi.updateSlide;
export const deleteCarouselSlide = carouselApi.deleteSlide;
export const toggleCarouselSlideStatus = carouselApi.toggleSlideStatus;
