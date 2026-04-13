import { useEffect, useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { logRouteChange } from "@/lib/logger";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import { MainLayout } from "@/components/layout/MainLayout";
import { DynamicTitle } from "@/components/DynamicTitle";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CookieConsent } from "@/components/CookieConsent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useLocationStore } from "@/store/locationStore";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ForceChangePasswordDialog } from "@/components/auth/ForceChangePasswordDialog";
import { PermissionProtectedRoute } from "@/components/auth/PermissionProtectedRoute";
import { ReactivationModal } from "@/components/auth/ReactivationModal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { logger } from "@/lib/logger";
import { scheduleBackgroundTask } from "@/lib/observability";
import { queryClient } from "@/lib/react-query";
import CacheHelper from "@/utils/cacheHelper";

const Index = lazy(() => import("./pages/Index"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSummary = lazy(() => import("./pages/OrderSummary"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Profile = lazy(() => import("./pages/Profile"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Donate = lazy(() => import("./pages/Donate"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventRegistration = lazy(() => import("./pages/EventRegistration"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ShippingAndRefund = lazy(() => import("./pages/ShippingAndRefund"));
const FAQ = lazy(() => import("./pages/FAQ"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MyOrders = lazy(() => import("./pages/user/MyOrders"));
const UserOrderDetail = lazy(() => import("./pages/user/UserOrderDetail"));
const AccountDeletion = lazy(() => import("./pages/AccountDeletion"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PermissionDenied = lazy(() => import("@/pages/PermissionDenied"));

// Admin Pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ProductsManagement = lazy(() => import("./pages/admin/ProductsManagement"));
const AllCategoriesManagement = lazy(() => import("./pages/admin/AllCategoriesManagement"));
const EventsManagement = lazy(() => import("./pages/admin/EventsManagement"));
const BlogsManagement = lazy(() => import("./pages/admin/BlogsManagement"));
const GalleryManagement = lazy(() => import("./pages/admin/GalleryManagement"));
const CarouselManagement = lazy(() => import("./pages/admin/CarouselManagement"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const ManagerManagement = lazy(() => import("./pages/admin/ManagerManagement"));
const ReviewsManagement = lazy(() => import("./pages/admin/ReviewsManagement"));
const FlaggedCommentsManagement = lazy(() => import("./pages/admin/FlaggedCommentsManagement"));
const FAQsManagement = lazy(() => import("./pages/admin/FAQsManagement"));
const ContactManagement = lazy(() => import("./pages/admin/ContactManagement"));
const ContactMessages = lazy(() => import("./pages/admin/ContactMessages"));
const ContactMessageDetail = lazy(() => import("./pages/admin/ContactMessageDetail"));
const AboutUsManagement = lazy(() => import("./pages/admin/AboutUsManagement"));
const PolicyManagement = lazy(() => import("./pages/admin/PolicyManagement"));
const BackgroundJobs = lazy(() => import("./pages/admin/BackgroundJobs"));
const OrdersManagement = lazy(() => import("./pages/admin/OrdersManagementNew"));
const OrderDetail = lazy(() => import("./pages/admin/OrderDetail"));
const SettingsManagement = lazy(() => import("./pages/admin/SettingsManagement"));
const TestimonialsManagement = lazy(() => import("./pages/admin/TestimonialsManagement"));

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  logger.error(`Unhandled Window Error: ${message}`, {
    source,
    lineno,
    colno,
    stack: error?.stack
  });
};

window.onunhandledrejection = (event) => {
  logger.error(`Unhandled Promise Rejection: ${event.reason}`, {
    reason: event.reason,
    stack: event.reason?.stack
  });
};

/**
 * Route tracker component for New Relic navigation analytics
 */
function RouteTracker() {
  const location = useLocation();
  const previousRoute = useRef<string | undefined>(undefined);

  useEffect(() => {
    logRouteChange(location.pathname, previousRoute.current);
    previousRoute.current = location.pathname;
  }, [location.pathname]);

  return null;
}

const App = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchCart = useCartStore((state) => state.fetchCart);

  // Synchronize cart with server after login
  useEffect(() => {
    if (isAuthenticated) {
      void fetchCart(true);
    }
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    const cleanupTasks: Array<() => void> = [];
    const currentPath = window.location.pathname;
    const shouldWarmCartImmediately = [
      "/cart",
      "/checkout",
      "/order-summary",
      "/order-confirmation",
      "/my-orders",
      "/profile",
    ].some((path) => currentPath.startsWith(path));

    // skip initialization on auth callback route to avoid race condition with AuthCallback component
    // Restore session from JWT cookie on mount, except on auth callback route
    // to avoid race conditions with code exchange logic in AuthCallback component.
    if (window.location.pathname !== '/auth/callback') {
      initializeAuth();
    }

    cleanupTasks.push(
      scheduleBackgroundTask(() => {
        void useLocationStore.getState().initializeStore();
      }, { timeout: 2000 })
    );

    // Initialize cache management (clears cache on page reload F5/Ctrl+R)
    CacheHelper.initPageReloadHandler(true);

    const warmCart = () => {
      void useCartStore.getState().fetchCart().catch((error) => {
        logger.warn("Deferred cart bootstrap failed", { err: error });
      });
    };

    if (shouldWarmCartImmediately) {
      warmCart();
    } else {
      cleanupTasks.push(
        scheduleBackgroundTask(warmCart, { timeout: 1200 })
      );
    }

    return () => {
      cleanupTasks.forEach((cleanup) => cleanup());
    };
  }, [initializeAuth]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <CurrencyProvider>
            <TooltipProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <DynamicTitle />
                <Suspense fallback={<LoadingOverlay isLoading={true} />}>
                  <Routes>
                <Route
                  element={
                    <>
                      <RouteTracker />
                      <ScrollToTop />
                      <MainLayout />
                    </>
                  }
                >
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Navigate to="/?auth=login" replace />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:productId" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute requireAuth>
                        <Checkout />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/order-summary"
                    element={
                      <ProtectedRoute requireAuth>
                        <OrderSummary />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/order-confirmation/:id"
                    element={
                      <ProtectedRoute requireAuth>
                        <OrderConfirmation />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute requireAuth>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/donate" element={<Donate />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/event/:eventId" element={<EventDetail />} />
                  <Route
                    path="/event/register/:eventId"
                    element={
                      <ProtectedRoute requireAuth>
                        <EventRegistration />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:postId" element={<BlogPost />} />
                  <Route path="/privacy-policy" element={<Privacy />} />
                  <Route path="/terms-and-conditions" element={<Terms />} />
                  <Route path="/shipping-and-refund-policy" element={<ShippingAndRefund />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/my-orders"
                    element={
                      <ProtectedRoute requireAuth>
                        <MyOrders />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/my-orders/:id"
                    element={
                      <ProtectedRoute requireAuth>
                        <UserOrderDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/account/delete"
                    element={
                      <ProtectedRoute requireAuth>
                        <AccountDeletion />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* Admin Routes - Strictly for Admin */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="products" element={<ProductsManagement />} />
                  <Route
                    path="categories"
                    element={<AllCategoriesManagement />}
                  />
                  <Route path="orders" element={<OrdersManagement />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                  <Route path="events" element={<EventsManagement />} />
                  <Route path="blogs" element={<BlogsManagement />} />
                  <Route path="gallery" element={<GalleryManagement />} />
                  <Route path="carousel" element={<CarouselManagement />} />
                  <Route path="users" element={<UsersManagement />} />
                  <Route path="managers" element={<ManagerManagement />} />
                  <Route path="reviews" element={<ReviewsManagement />} />
                  <Route path="testimonials" element={<TestimonialsManagement />} />
                  <Route path="comments" element={<FlaggedCommentsManagement />} />
                  <Route path="faqs" element={<FAQsManagement />} />
                  <Route
                    path="contact-management"
                    element={<ContactManagement />}
                  />
                  <Route path="contact-messages" element={<ContactMessages />} />
                  <Route path="contact-messages/:id" element={<ContactMessageDetail />} />
                  <Route path="about-us" element={<AboutUsManagement />} />
                  <Route path="policies" element={<PolicyManagement />} />
                  <Route path="jobs" element={<BackgroundJobs />} />

                  <Route path="settings" element={<SettingsManagement />} />
                  <Route path="permission-denied" element={<PermissionDenied />} />
                </Route>

                {/* Manager Routes - For Managers (and Admins if they visit) */}
                <Route
                  path="/manager"
                  element={
                    <ProtectedRoute allowedRoles={["manager", "admin"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Reuse same components but accessed via /manager/... */}
                  <Route index element={<AdminDashboard />} />
                  <Route
                    path="products"
                    element={
                      <PermissionProtectedRoute permission="can_manage_products">
                        <ProductsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="categories"
                    element={
                      <PermissionProtectedRoute permission="can_manage_categories">
                        <AllCategoriesManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="orders"
                    element={
                      <PermissionProtectedRoute permission="can_manage_orders">
                        <OrdersManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="orders/:id"
                    element={
                      <PermissionProtectedRoute permission="can_manage_orders">
                        <OrderDetail />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="events"
                    element={
                      <PermissionProtectedRoute permission="can_manage_events">
                        <EventsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="blogs"
                    element={
                      <PermissionProtectedRoute permission="can_manage_blogs">
                        <BlogsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="gallery"
                    element={
                      <PermissionProtectedRoute permission="can_manage_gallery">
                        <GalleryManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="carousel"
                    element={
                      <PermissionProtectedRoute permission="can_manage_carousel">
                        <CarouselManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  {/* Managers don't manage users/managers usually, but let RBAC handle inside components if needed */}
                  {/* UsersManagement removed from Manager routes to prevent Admin Management access */}
                  {/* ManagerManagement likely SHOULD BE HIDDEN for managers - will handle in Sidebar/Layout */}
                  <Route
                    path="reviews"
                    element={
                      <PermissionProtectedRoute permission="can_manage_reviews">
                        <ReviewsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="comments"
                    element={
                      <PermissionProtectedRoute permission="can_manage_blogs">
                        <FlaggedCommentsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="faqs"
                    element={
                      <PermissionProtectedRoute permission="can_manage_faqs">
                        <FAQsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="contact-management"
                    element={
                      <PermissionProtectedRoute permission={[
                        "can_manage_contact_info",
                        "can_manage_social_media",
                        "can_manage_bank_details",
                        "can_manage_newsletter",
                        "can_manage_contact_messages",
                      ]}>
                        <ContactManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="contact-messages"
                    element={
                      <PermissionProtectedRoute permission="can_manage_contact_messages">
                        <ContactMessages />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="contact-messages/:id"
                    element={
                      <PermissionProtectedRoute permission="can_manage_contact_messages">
                        <ContactMessageDetail />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="about-us"
                    element={
                      <PermissionProtectedRoute permission="can_manage_about_us">
                        <AboutUsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="policies"
                    element={
                      <PermissionProtectedRoute permission="can_manage_policies">
                        <PolicyManagement />
                      </PermissionProtectedRoute>
                    }
                  />

                  <Route
                    path="jobs"
                    element={
                      <PermissionProtectedRoute permission="can_manage_background_jobs">
                        <BackgroundJobs />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="testimonials"
                    element={
                      <PermissionProtectedRoute permission={[
                        "can_manage_testimonials",
                        "can_add_testimonials",
                        "can_approve_testimonials",
                      ]}>
                        <TestimonialsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <PermissionProtectedRoute permission="can_manage_coupons">
                        <SettingsManagement />
                      </PermissionProtectedRoute>
                    }
                  />
                  <Route path="permission-denied" element={<PermissionDenied />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <Toaster />
                <Sonner />
                <CookieConsent />
                <ReactivationModal />
                <ForceChangePasswordDialog />
              </BrowserRouter>
            </TooltipProvider>
          </CurrencyProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
