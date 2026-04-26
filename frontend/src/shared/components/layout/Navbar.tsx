import { logger } from "@/core/observability/logger";
import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import {
  Menu,
  X,
  ShoppingCart,
  User,
  Languages,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCartStore } from "@/domains/cart";
import { useAuthStore } from "@/domains/auth";
import AuthPage from "@/pages/Auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/features/auth";
import { PromotionalBanner } from "@/features/home";
import { logoutUser } from "@/domains/auth";
import { availableLanguages, LANGUAGE_NAMES } from "@/app/i18n/config";
import { profileService } from "@/domains/user/api/profile.api";
import { useCurrency } from "@/app/providers/currency-provider";
import { useLanguage } from "@/shared/hooks/useLanguage";
import { UserAvatar } from "@/shared/components/ui/user-avatar";

// --- ATOMIC SUB-COMPONENTS (MEMOIZED) ---

/**
 * BrandLogo - Memoized to prevent re-renders during scroll/mobile menu toggles
 */
const BrandLogo = memo(({ t }: { t: any }) => (
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
      <span className="text-lg sm:text-xl font-bold text-[#2C1810] font-playfair tracking-tighter leading-none truncate group-hover:text-primary transition-all duration-500">
        {t('common.brandName')}
      </span>
      <span className="hidden min-[420px]:block xl:block text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-primary mt-1 truncate opacity-70 group-hover:opacity-100 transition-all duration-500">
        {t("nav.brandSubtitle")}
      </span>
    </div>
  </Link>
));

BrandLogo.displayName = "BrandLogo";

/**
 * NavLinks - Extracted to isolate route-match logic from parent scroll state
 */
const NavLinks = memo(({ navLinks, pathname }: { navLinks: any[], pathname: string }) => (
  <div className="hidden xl:flex items-center">
    <div className="flex items-center bg-muted/40 rounded-full p-1.5 backdrop-blur-md border border-border/20 animate-in fade-in slide-in-from-top-4 duration-700 delay-150">
      {navLinks.map((link, index) => {
        const isActive = link.exact 
          ? pathname === link.to 
          : (link.matchPaths ? link.matchPaths.some((p: string) => pathname.startsWith(p)) : pathname.startsWith(link.to));
        
        return (
          <Link
            key={link.to}
            to={link.to}
            style={{ animationDelay: `${200 + index * 50}ms` }}
            className={`px-5 xl:px-6 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-500 relative group/nav animate-in fade-in slide-in-from-top-2 ${isActive
              ? "bg-[#2C1810] text-white shadow-lg"
              : "text-[#2C1810]/70 hover:text-[#2C1810] hover:bg-white/90"
              }`}
          >
            {link.label}
            {!isActive && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary scale-0 group-hover/nav:scale-100 transition-transform duration-500" />
            )}
            {isActive && (
              <span className="absolute -inset-0.5 rounded-full bg-primary/10 blur-md -z-10 animate-pulse" />
            )}
          </Link>
        );
      })}
    </div>
  </div>
));

NavLinks.displayName = "NavLinks";

/**
 * NavbarActions - Memoized collection of cart, language, and user controls
 */
const NavbarActions = memo(({ 
  isAuthenticated, 
  user, 
  cartItemCount, 
  onLogoutClick, 
  onAuthClick, 
  t 
}: { 
  isAuthenticated: boolean, 
  user: any, 
  cartItemCount: number, 
  onLogoutClick: () => void, 
  onAuthClick: () => void, 
  t: any 
}) => {
  const { selectedCurrency, supportedCurrencies, setSelectedCurrency } = useCurrency();
  const { changeLanguage, i18n } = useLanguage();

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 md:gap-3">
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
                imageUrl={user?.image}
                className="h-8 w-8 bg-gradient-to-br from-[#B85C3C] to-[#8B4C32]"
                fallbackClassName="bg-gradient-to-br from-[#B85C3C] to-[#8B4C32] text-white text-sm font-bold"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-elevated border-border/50 p-2">
            <DropdownMenuLabel className="text-[#2C1810] font-playfair truncate">
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
                <span className="text-[#2C1810]/70 text-[10px] font-bold uppercase tracking-[0.2em] block">
                  Currency
                </span>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-white shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {supportedCurrencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label} ({c.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogoutClick} className="rounded-xl cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          className="hidden sm:inline-flex rounded-full px-6 font-semibold hover:bg-[#B85C3C]/10 hover:text-[#B85C3C] transition-all duration-300"
          onClick={onAuthClick}
        >
          {t("nav.login")}
        </Button>
      )}

      <Link to="/donate" className="hidden md:block">
        <Button className="rounded-full px-7 bg-gradient-to-r from-[#B85C3C] to-[#D97555] hover:from-[#A04D30] hover:to-[#C96545] text-white font-bold tracking-wide shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          {t("nav.donate")}
        </Button>
      </Link>
    </div>
  );
});

NavbarActions.displayName = "NavbarActions";

// --- MAIN NAVBAR COMPONENT ---

export const NavbarContent = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // ATOMIC SUBSCRIPTIONS: Re-render only when relevant slice changes
  // Optimized selector calculates items aggregate safely
  const cartItemCount = useCartStore(useShallow(state => 
    state.items.reduce((acc, item) => acc + item.quantity, 0)
  ));
  
  const { isAuthenticated, isInitialized, user } = useAuthStore(
    useShallow(state => ({
      isAuthenticated: state.isAuthenticated,
      isInitialized: state.isInitialized,
      user: state.user
    }))
  );
  
  const logout = useAuthStore(state => state.logout);
  const updateUser = useAuthStore(state => state.updateUser);

  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useLanguage();

  // Throttled Scroll Effect for Performance
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileMenuOpen]);

  // Auth Dialog Redirect Logic (Stable)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    const returnUrl = params.get("returnUrl");
    const state = location.state as { openAuth?: boolean } | null;

    if (isInitialized) {
      if ((authParam === "login" || state?.openAuth) && !isAuthenticated) {
        setAuthDialogOpen(true);
        if (returnUrl) sessionStorage.setItem("authReturnUrl", returnUrl);
        
        if (authParam === "login") navigate(location.pathname, { replace: true });
        if (state?.openAuth) navigate(location.pathname, { replace: true, state: {} });
      } else if (isAuthenticated && authDialogOpen) {
        setAuthDialogOpen(false);
      }
    }
  }, [location.search, location.state, isAuthenticated, isInitialized, authDialogOpen, navigate, location.pathname]);

  const confirmLogout = useCallback(async () => {
    try {
      await logoutUser();
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    } catch (error) {
      logger.error("Logout error:", error);
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    }
  }, [logout, navigate]);

  // Sync profile data on language change
  useEffect(() => {
    if (isAuthenticated && isInitialized) {
      const fetchInitialProfile = async () => {
        try {
          const profile = await profileService.getProfile(i18n.language);
          if (profile?.name) {
            updateUser({
              name: profile.name,
              phone: profile.phone,
              image: profile.avatarUrl
            });
          }
        } catch (error: any) {
          if (error?.response?.status !== 401) {
            logger.error("Failed to fetch initial translated profile", { error, language: i18n.language });
          }
        }
      };

      const timer = setTimeout(fetchInitialProfile, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isInitialized, i18n.language, updateUser]);

  // Memoize nav link data
  const navLinks = useMemo(() => [
    { to: "/", label: t("nav.home"), exact: true },
    { to: "/shop", label: t("nav.shop"), matchPaths: ["/shop", "/product", "/cart", "/checkout", "/order-summary"] },
    { to: "/events", label: t("nav.events"), matchPaths: ["/events", "/event"] },
    { to: "/gallery", label: t("nav.gallery"), exact: false },
    { to: "/about", label: t("nav.about"), exact: false },
    { to: "/blog", label: t("nav.blog"), matchPaths: ["/blog"] },
    { to: "/contact", label: t("nav.contact"), exact: false },
  ], [t]);

  const handleAuthDialogOpen = useCallback(() => setAuthDialogOpen(true), []);
  const handleLogoutDialogOpen = useCallback(() => setLogoutDialogOpen(true), []);

  return (
    <header className="sticky top-0 z-50 promote-gpu">
      <PromotionalBanner />
      <nav 
        className={`mx-auto transition-all duration-700 border-border/40 ${isScrolled ? "mt-2 sm:mt-4" : "mt-0"} ${
          isScrolled 
            ? "max-w-[95%] sm:max-w-[92%] xl:max-w-7xl rounded-[2.5rem] bg-white/90 backdrop-blur-3xl shadow-elevated border border-primary/20 saturate-150" 
            : "w-full bg-white/95 backdrop-blur-xl border-b shadow-sm"
        }`}
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between gap-3 transition-all duration-700 ${isScrolled ? "h-14 sm:h-16" : "h-16 sm:h-22"}`}>
            
            <BrandLogo t={t} />

            <NavLinks navLinks={navLinks} pathname={location.pathname} />

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 md:gap-3">
              <NavbarActions 
                isAuthenticated={isAuthenticated}
                user={user}
                cartItemCount={cartItemCount}
                onLogoutClick={handleLogoutDialogOpen}
                onAuthClick={handleAuthDialogOpen}
                t={t}
              />

              <Button
                variant="ghost"
                size="icon"
                className="xl:hidden rounded-full h-9 w-9 sm:h-11 sm:w-11 hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="xl:hidden py-8 border-t border-border/40 animate-in fade-in slide-in-from-top-4 duration-500 max-h-[85dvh] overflow-y-auto">
              <div className="flex flex-col gap-3 px-2">
                <div className="flex items-center justify-between gap-4 px-2 py-4 sm:hidden bg-muted/20 rounded-3xl border border-border/40 mb-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-full bg-white shadow-sm border border-border/50 font-bold">
                        <Languages className="mr-2 h-4 w-4 text-[#B85C3C]" />
                        {LANGUAGE_NAMES[i18n.language] || i18n.language.toUpperCase()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-2xl">
                      {availableLanguages.map((lang) => (
                        <DropdownMenuItem key={lang} onClick={() => i18n.changeLanguage(lang)}>{LANGUAGE_NAMES[lang]}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {!isAuthenticated && (
                    <Button size="sm" className="rounded-full bg-[#2C1810]" onClick={() => { setAuthDialogOpen(true); setMobileMenuOpen(false); }}>
                      {t("nav.login")}
                    </Button>
                  )}
                </div>

                <div className="grid gap-2">
                  {navLinks.map((link) => {
                    const isActive = link.exact 
                      ? location.pathname === link.to 
                      : (link.matchPaths ? link.matchPaths.some(p => location.pathname.startsWith(p)) : location.pathname.startsWith(link.to));
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`px-6 py-4 rounded-[2rem] text-lg font-bold transition-all flex items-center justify-between ${isActive ? "bg-[#2C1810] text-white" : "text-[#2C1810]/80 hover:bg-muted/50"}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-[#B85C3C]" : "bg-transparent"}`} />
                      </Link>
                    );
                  })}
                </div>
                <Link to="/donate" className="mt-6" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full py-7 rounded-[2rem] bg-gradient-to-r from-[#B85C3C] to-[#D97555] text-white text-xl font-black">
                    {t("nav.donate")}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      <LogoutConfirmDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen} onConfirm={confirmLogout} />

      <Link
        to="/cart"
        className={`sm:hidden fixed bottom-5 right-4 z-50 ${location.pathname.startsWith("/cart") ? "hidden" : ""}`}
      >
        <Button size="icon" className="h-14 w-14 rounded-full bg-gradient-to-r from-[#B85C3C] to-[#D97555] text-white shadow-xl">
          <ShoppingCart className="h-5 w-5" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-[#B85C3C] text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-[#B85C3C]/15">
              {cartItemCount}
            </span>
          )}
        </Button>
      </Link>
    </header>
  );
};

export const Navbar = memo(NavbarContent);
