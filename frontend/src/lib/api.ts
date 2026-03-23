import { CONFIG } from "../config";
import axios, { InternalAxiosRequestConfig } from "axios";
import { logAPICall, logger } from "./logger";
import { getGuestId } from "./guestId";

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

// Base URL for your Spring Boot backend (or Node.js)
const API_BASE_URL = CONFIG.API_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Force refresh span ID for each new request
    logger.refreshSpanId();

    // Attach tracing headers
    config.headers['X-Correlation-ID'] = config.headers['X-Correlation-ID'] || (logger as any).correlationId;
    config.headers['X-Trace-ID'] = (logger as any).traceId;
    config.headers['X-Span-ID'] = (logger as any).spanId;

    // Attach Guest ID if present
    const guestId = getGuestId();
    if (guestId) {
      config.headers['x-guest-id'] = guestId;
    }

    // Track request start time
    config.metadata = {
      startTime: Date.now()
    };

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling & logging
api.interceptors.response.use(
  (response) => {
    const config = response.config;
    const duration = config.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : 0;

    logAPICall(
      config.url || 'unknown',
      config.method?.toUpperCase() || 'UNKNOWN',
      response.status,
      duration,
      config.headers['X-Correlation-ID'] as string
    );
    return response;
  },
  (error) => {
    const config = error.config as InternalAxiosRequestConfig;
    const duration = config?.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : 0;

    logAPICall(
      config?.url || 'unknown',
      config?.method?.toUpperCase() || 'UNKNOWN',
      error.response?.status || 0,
      duration,
      config?.headers?.['X-Correlation-ID'] as string
    );

    if (error.response?.status === 401) {
      // Handle unauthorized - clear auth and redirect to login
      localStorage.removeItem("auth-storage");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// API endpoints mapping for backend integration
export const endpoints = {
  // Auth
  login: "/auth/login",
  register: "/auth/register",
  verifyOtp: "/auth/verify-otp",

  // Products
  getProducts: "/products",
  getProduct: (id: string) => `/products/${id}`,
  createProduct: "/admin/products",
  updateProduct: (id: string) => `/admin/products/${id}`,
  deleteProduct: (id: string) => `/admin/products/${id}`,
  updateInventory: (id: string) => `/admin/products/${id}/inventory`,

  // Events
  getEvents: "/events",
  getEvent: (id: string) => `/events/${id}`,
  createEvent: "/admin/events",
  updateEvent: (id: string) => `/admin/events/${id}`,
  deleteEvent: (id: string) => `/admin/events/${id}`,
  registerEvent: (id: string) => `/events/${id}/register`,
  getEventRegistrations: (id: string) => `/admin/events/${id}/registrations`,

  // Blogs
  getBlogs: "/blogs",
  getBlog: (id: string) => `/blogs/${id}`,
  createBlog: "/admin/blogs",
  updateBlog: (id: string) => `/admin/blogs/${id}`,
  deleteBlog: (id: string) => `/admin/blogs/${id}`,

  // Cart & Orders
  createOrder: "/orders",
  getOrders: "/orders",
  getOrder: (id: string) => `/orders/${id}`,
  updateOrderStatus: (id: string) => `/admin/orders/${id}/status`,
  updatePaymentStatus: (id: string) => `/admin/orders/${id}/payment`,

  // Donate
  donate: "/donations",

  // Newsletter
  subscribe: "/newsletter/subscribe",

  // Gallery
  getGalleryImages: "/gallery/images",
  getGalleryVideos: "/gallery/videos",
  createGalleryImage: "/admin/gallery/images",
  updateGalleryImage: (id: string) => `/admin/gallery/images/${id}`,
  deleteGalleryImage: (id: string) => `/admin/gallery/images/${id}`,
  createGalleryVideo: "/admin/gallery/videos",
  updateGalleryVideo: (id: string) => `/admin/gallery/videos/${id}`,
  deleteGalleryVideo: (id: string) => `/admin/gallery/videos/${id}`,

  // User Profile
  updateProfile: "/users/profile",
  addAddress: "/users/addresses",
  updateAddress: (id: string) => `/users/addresses/${id}`,
  deleteAddress: (id: string) => `/users/addresses/${id}`,

  // Testimonials
  getTestimonials: "/testimonials",
  createTestimonial: "/testimonials",
  deleteTestimonial: (id: string) => `/admin/testimonials/${id}`,

  // Settings (Admin)
  getSettings: "/admin/settings",
  updateSettings: "/admin/settings",
  getDeliverySettings: "/settings/delivery",
  updateDeliverySettings: "/settings/delivery",

  // User Management (Admin)
  getAllUsers: "/admin/users",
  getUserOrders: (userId: string) => `/admin/users/${userId}/orders`,
  createAdminUser: "/admin/users",
  updateUserRole: (userId: string) => `/admin/users/${userId}/role`,
};
