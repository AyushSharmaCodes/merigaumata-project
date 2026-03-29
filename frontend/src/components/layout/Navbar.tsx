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

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { getTotalItems, fetchCart, initialized } = useCartStore();
  const { isAuthenticated, user, logout, updateUser, isInitialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemCount = getTotalItems();
  const { selectedCurrency, supportedCurrencies, setSelectedCurrency } = useCurrency();

  // Cart fetch is handled globally by App.tsx on mount
  // This ensures cart count is available on all pages after refresh

  // Auto-open auth dialog if redirected from protected route OR via state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    const returnUrl = params.get("returnUrl");
    const state = location.state as { openAuth?: boolean } | null;

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
  }, [location.search, location.state, isAuthenticated, navigate]);

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
              phone: profile.phone
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
    <header className="sticky top-0 z-50 transition-all duration-300">
      <PromotionalBanner />
      <nav className="bg-white/95 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo - More Premium */}
            {/* Logo - More Premium */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-500 overflow-hidden relative p-1 border border-border/50">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#B85C3C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <img
                  src={import.meta.env.VITE_APP_LOGO_URL}
                  alt={t('common.brandName')}
                  className="w-full h-full object-contain relative z-10 rounded-full"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-[#2C1810] font-playfair tracking-tight leading-none">
                  {t('common.brandName')}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#B85C3C] mt-1">
                  {t("nav.brandSubtitle")}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Premium Style */}
            <div className="hidden lg:flex items-center">
              <div className="flex items-center bg-muted/30 rounded-full p-1.5">
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
                      className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 relative group/nav ${isActive
                        ? "bg-[#2C1810] text-white shadow-lg shadow-[#2C1810]/20"
                        : "text-[#2C1810]/60 hover:text-[#2C1810] hover:bg-white/80"
                        }`}
                    >
                      {link.label}
                      {!isActive && (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#B85C3C] scale-0 group-hover/nav:scale-100 transition-transform duration-300" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Side Actions - Premium Style */}
            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
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
                  className="rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
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
                      className="rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B85C3C] to-[#8B4C32] flex items-center justify-center text-white text-sm font-bold">
                        {(() => {
                          const name = user?.name;
                          const isDefault = name === 'common.user.defaultName' || name === 'AuthMessages.DEFAULT_USER_NAME';
                          const displayName = isDefault ? t('common.user.defaultName') : (name || "U");
                          return displayName.charAt(0).toUpperCase();
                        })()}
                      </div>
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
                        <Link to="/admin" className="flex items-center gap-2">
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
                  className="rounded-full px-6 font-semibold hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
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
                className="lg:hidden rounded-full h-11 w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Menu - Premium Style */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-6 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-2">
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
                      className={`px-4 py-3 rounded-2xl text-base font-semibold transition-all duration-300 ${isActive
                        ? "bg-[#2C1810] text-white"
                        : "text-[#2C1810]/70 hover:bg-muted/50 hover:text-[#2C1810]"
                        }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <Link
                  to="/donate"
                  className="mt-4"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button className="w-full rounded-full bg-gradient-to-r from-[#B85C3C] to-[#D97555] text-white font-bold shadow-lg">
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
    </header>
  );
};
