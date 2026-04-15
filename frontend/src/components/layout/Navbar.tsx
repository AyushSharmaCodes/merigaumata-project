import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu,
  X,
  ShoppingCart,
  User,
  Languages,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { PromotionalBanner } from "@/components/PromotionalBanner";
import { logoutUser } from "@/lib/services/auth.service";
import { availableLanguages, LANGUAGE_NAMES } from "@/i18n/config";
import { profileService } from "@/services/profile.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { queryClient } from "@/lib/react-query";
import { useLanguage } from "@/hooks/useLanguage";
import { UserAvatar } from "@/components/ui/user-avatar";

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { getTotalItems, fetchCart, initialized } = useCartStore();
  const { isAuthenticated, user, logout, updateUser, isInitialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemCount = getTotalItems();
  const { selectedCurrency, supportedCurrencies, setSelectedCurrency } = useCurrency();

  // Cart fetch is handled globally by App.tsx on mount
  // This ensures cart count is available on all pages after refresh

  // Handle Scroll Effect for Floating Navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  // Auto-open auth dialog if redirected from protected route OR via state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    const returnUrl = params.get("returnUrl");
    const state = location.state as { openAuth?: boolean } | null;

    // Only handle auto-opening once auth state is initialized to avoid race conditions
    if (isInitialized) {
      if ((authParam === "login" || state?.openAuth) && !isAuthenticated) {
        setAuthDialogOpen(true);

        // Store return URL for redirect after login
        if (returnUrl) {
          sessionStorage.setItem("authReturnUrl", returnUrl);
        }

        // Clean up URL (remove query params) but stay on current page
        if (authParam === "login") {
          navigate(location.pathname, { replace: true });
        }

        // Clean up state if it exists
        if (state?.openAuth) {
          navigate(location.pathname, { replace: true, state: {} });
        }
      } 
      // If user is already authenticated but modal is somehow open, close it
      else if (isAuthenticated && authDialogOpen) {
        setAuthDialogOpen(false);
      }
    }
  }, [location.search, location.state, isAuthenticated, isInitialized, authDialogOpen, navigate]);

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = async () => {
    try {
      await logoutUser();
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    } catch (error) {
      logger.error("Logout error:", error);
      // Even if backend fails, clear frontend state
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    }
  };



  // ... existing imports

  // Inside Navbar component

  const { changeLanguage, t, i18n } = useLanguage();

  // Ensure Navbar shows translated name on initial load/refresh
  useEffect(() => {
    // Only fetch if authenticated AND fully initialized to avoid race conditions/401s
    if (isAuthenticated && isInitialized) {
      const fetchInitialProfile = async () => {
        try {
          const profile = await profileService.getProfile(i18n.language);
          if (profile && profile.name) {
            updateUser({
              name: profile.name,
              phone: profile.phone,
              image: profile.avatarUrl
            });
          }
        } catch (error: any) {
          // Ignore 401s as they are handled by the global auth listener
          if (error?.response?.status !== 401) {
            logger.error("Failed to fetch initial translated profile", { error, language: i18n.language });
          }
        }
      };

      // Small delay to ensure auth state is settled
      const timer = setTimeout(() => {
        fetchInitialProfile();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isInitialized, i18n.language]);

  const navLinks = [
    { to: "/", label: t("nav.home"), exact: true },
    {
      to: "/shop",
      label: t("nav.shop"),
      matchPaths: ["/shop", "/product", "/cart", "/checkout", "/order-summary"],
    },
    {
      to: "/events",
      label: t("nav.events"),
      matchPaths: ["/events", "/event"],
    },
    { to: "/gallery", label: t("nav.gallery"), exact: false },
    { to: "/about", label: t("nav.about"), exact: false },
    { to: "/blog", label: t("nav.blog"), matchPaths: ["/blog"] },
    { to: "/contact", label: t("nav.contact"), exact: false },
  ];

  return (
    <header className="sticky top-0 z-50">
      <PromotionalBanner />
      <nav 
        className={`mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] border-border/40 ${isScrolled ? "mt-2 sm:mt-4" : "mt-0"} ${
          isScrolled 
            ? "max-w-[95%] sm:max-w-[92%] xl:max-w-7xl rounded-[2.5rem] bg-white/90 backdrop-blur-3xl shadow-[0_20px_50px_rgba(184,92,60,0.15)] border border-[#B85C3C]/20 saturate-150" 
            : "w-full bg-white/95 backdrop-blur-xl border-b shadow-sm"
        }`}
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between gap-3 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isScrolled ? "h-14 sm:h-16" : "h-16 sm:h-22"}`}>
            {/* Logo - More Premium */}
            <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3 group shrink-0 animate-in fade-in slide-in-from-left-4 duration-1000">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-all duration-700 overflow-hidden relative p-1.5 border border-border/30 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#B85C3C]/20 via-transparent to-[#B85C3C]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <img
                  src={import.meta.env.VITE_APP_LOGO_URL}
                  alt={t('common.brandName')}
                  className="w-full h-full object-contain relative z-10 rounded-full group-hover:rotate-[8deg] transition-transform duration-1000"
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-lg sm:text-xl font-black text-[#2C1810] font-playfair tracking-tight leading-none truncate group-hover:text-[#B85C3C] transition-colors duration-500">
                  {t('common.brandName')}
                </span>
                <span className="hidden min-[420px]:block xl:block text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-[#B85C3C] mt-1 truncate opacity-70 group-hover:opacity-100 transition-all duration-500">
                  {t("nav.brandSubtitle")}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Premium Style */}
            <div className="hidden xl:flex items-center">
              <div className="flex items-center bg-muted/40 rounded-full p-1.5 backdrop-blur-md border border-border/20 animate-in fade-in slide-in-from-top-4 duration-700 delay-150">
                {navLinks.map((link, index) => {
                  let isActive = false;
                  if (link.exact) {
                    isActive = location.pathname === link.to;
                  } else if (link.matchPaths) {
                    isActive = link.matchPaths.some((path) =>
                      location.pathname.startsWith(path)
                    );
                  } else {
                    isActive = location.pathname.startsWith(link.to);
                  }
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      style={{ animationDelay: `${200 + index * 50}ms` }}
                      className={`px-5 xl:px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-500 relative group/nav animate-in fade-in slide-in-from-top-2 ${isActive
                        ? "bg-[#2C1810] text-white shadow-xl shadow-[#2C1810]/20"
                        : "text-[#2C1810]/60 hover:text-[#2C1810] hover:bg-white/90"
                        }`}
                    >
                      {link.label}
                      {!isActive && (
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#B85C3C] scale-0 group-hover/nav:scale-100 transition-transform duration-500" />
                      )}
                      {isActive && (
                        <span className="absolute -inset-0.5 rounded-full bg-[#B85C3C]/15 blur-md -z-10 animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side Actions - Premium Style */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 md:gap-3">
              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:inline-flex rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
                  >
                    <Languages className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl shadow-elevated border-border/50">
                  {availableLanguages.map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className="rounded-xl cursor-pointer"
                    >
                      {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Cart - Enhanced */}
              <Link to="/cart" className="relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#B85C3C] text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg ring-2 ring-white animate-in zoom-in-50 duration-200">
                      {cartItemCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* User Menu - Enhanced */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden sm:inline-flex rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
                    >
                      <UserAvatar
                        name={(() => {
                          const name = user?.name;
                          const isDefault = name === 'common.user.defaultName' || name === 'AuthMessages.DEFAULT_USER_NAME';
                          return isDefault ? t('common.user.defaultName') : (name || "User");
                        })()}
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        imageUrl={user?.image}
                        className="h-8 w-8 bg-gradient-to-br from-[#B85C3C] to-[#8B4C32]"
                        fallbackClassName="bg-gradient-to-br from-[#B85C3C] to-[#8B4C32] text-white text-sm font-bold"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-elevated border-border/50 p-2">
                    <DropdownMenuLabel className="text-[#2C1810] font-playfair">
                      {(() => {
                        const name = user?.name;
                        const isDefault = name === 'common.user.defaultName' || name === 'AuthMessages.DEFAULT_USER_NAME';
                        return isDefault ? t('common.user.defaultName') : name;
                      })()}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                      <Link to="/my-orders" className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        {t("nav.myOrders")}
                      </Link>
                    </DropdownMenuItem>
                    {(user?.role === "admin" || user?.role === "manager") && (
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                        <Link to={user.role === "manager" ? "/manager" : "/admin"} className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          {user.role === "manager" ? t("nav.managerPortal") : t("nav.adminPortal")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#2C1810]/70 text-[10px] font-bold uppercase tracking-[0.2em]">
                            Currency
                          </span>
                        </div>
                        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                          <SelectTrigger aria-label="Currency" className="h-11 rounded-xl border-border/60 bg-white text-[#2C1810]">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {supportedCurrencies.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.label} ({currency.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="rounded-xl cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  className="hidden sm:inline-flex rounded-full px-6 font-semibold hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
                  onClick={() => setAuthDialogOpen(true)}
                >
                  {t("nav.login")}
                </Button>
              )}

              {/* Donate Button - Premium CTA */}
              <Link to="/donate" className="hidden md:block">
                <Button className="rounded-full px-6 bg-gradient-to-r from-[#B85C3C] to-[#D97555] hover:from-[#A04D30] hover:to-[#C96545] text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  {t("nav.donate")}
                </Button>
              </Link>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="xl:hidden rounded-full h-9 w-9 sm:h-11 sm:w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Menu - Premium Overlay Style */}
          {mobileMenuOpen && (
            <div className="xl:hidden py-8 border-t border-border/40 animate-in fade-in slide-in-from-top-4 duration-500 max-h-[85dvh] overflow-y-auto">
              <div className="flex flex-col gap-3 px-2">
                <div className="flex items-center justify-between gap-4 px-2 py-4 sm:hidden bg-muted/20 rounded-3xl border border-border/40 mb-4">
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full bg-white shadow-sm border border-border/50 font-bold text-[#2C1810]"
                        >
                          <Languages className="mr-2 h-4 w-4 text-[#B85C3C]" />
                          {LANGUAGE_NAMES[i18n.language] || i18n.language.toUpperCase()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="rounded-2xl shadow-elevated border-border/50">
                        {availableLanguages.map((lang) => (
                          <DropdownMenuItem
                            key={lang}
                            onClick={() => changeLanguage(lang)}
                            className="rounded-xl cursor-pointer"
                          >
                            {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {!isAuthenticated && (
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white font-bold transition-colors"
                      onClick={() => {
                        setAuthDialogOpen(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      {t("nav.login")}
                    </Button>
                  )}
                </div>

                {isAuthenticated && (
                  <div className="grid grid-cols-2 gap-3 mb-4 sm:hidden">
                    <Link
                      to="/profile"
                      className="flex items-center justify-center gap-2 px-3 py-4 rounded-3xl text-xs font-bold transition-all duration-300 bg-white border border-border/60 text-[#2C1810] shadow-sm hover:border-[#B85C3C]/30"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-4 w-4 text-[#B85C3C]" />
                      {t("nav.profile")}
                    </Link>
                    <Link
                      to="/my-orders"
                      className="flex items-center justify-center gap-2 px-3 py-4 rounded-3xl text-xs font-bold transition-all duration-300 bg-white border border-border/60 text-[#2C1810] shadow-sm hover:border-[#B85C3C]/30"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <ShoppingCart className="h-4 w-4 text-[#B85C3C]" />
                      {t("nav.myOrders")}
                    </Link>
                    {(user?.role === "admin" || user?.role === "manager") && (
                      <Link
                        to={user.role === "manager" ? "/manager" : "/admin"}
                        className="col-span-2 flex items-center justify-center gap-2 px-3 py-4 rounded-3xl text-xs font-bold transition-all duration-300 bg-[#B85C3C]/10 border border-[#B85C3C]/30 text-[#B85C3C] shadow-sm hover:bg-[#B85C3C]/20"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        {user.role === "manager" ? t("nav.managerPortal") : t("nav.adminPortal")}
                      </Link>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  {navLinks.map((link) => {
                    let isActive = false;
                    if (link.exact) {
                      isActive = location.pathname === link.to;
                    } else if (link.matchPaths) {
                      isActive = link.matchPaths.some((path) =>
                        location.pathname.startsWith(path)
                      );
                    } else {
                      isActive = location.pathname.startsWith(link.to);
                    }
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`group px-6 py-4 rounded-[2rem] text-lg font-bold transition-all duration-500 flex items-center justify-between ${isActive
                          ? "bg-[#2C1810] text-white shadow-xl shadow-[#2C1810]/20 translate-x-1"
                          : "text-[#2C1810]/80 hover:bg-muted/50 hover:text-[#2C1810] hover:translate-x-1"
                          }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                        <div className={`w-2 h-2 rounded-full transition-all duration-500 scale-0 group-hover:scale-100 ${isActive ? "bg-[#B85C3C] scale-100" : "bg-[#B85C3C]/40"}`} />
                      </Link>
                    );
                  })}
                </div>

                <Link
                  to="/donate"
                  className="mt-6"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button className="w-full py-7 rounded-[2rem] bg-gradient-to-r from-[#B85C3C] to-[#D97555] hover:from-[#A04D30] hover:to-[#C96545] text-white text-xl font-black shadow-2xl shadow-[#B85C3C]/30 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]">
                    {t("nav.donate")}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Auth Dialog */}
        <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

        {/* Logout Confirmation Dialog */}
        <LogoutConfirmDialog
          open={logoutDialogOpen}
          onOpenChange={setLogoutDialogOpen}
          onConfirm={confirmLogout}
        />
      </nav>

      <Link
        to="/cart"
        className={`sm:hidden fixed bottom-5 right-4 z-50 ${location.pathname.startsWith("/cart") ? "hidden" : ""}`}
        aria-label={t("nav.cart", { defaultValue: "Cart" })}
      >
        <Button
          size="icon"
          className="relative h-14 w-14 rounded-full bg-gradient-to-r from-[#B85C3C] to-[#D97555] text-white shadow-xl shadow-[#B85C3C]/30 hover:from-[#A04D30] hover:to-[#C96545]"
        >
          <ShoppingCart className="h-5 w-5" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-[#B85C3C] text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-md ring-2 ring-[#B85C3C]/15">
              {cartItemCount}
            </span>
          )}
        </Button>
      </Link>
    </header>
  );
};
