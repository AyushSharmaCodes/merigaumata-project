import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  Calendar,
  FileText,
  Image,
  ShoppingCart,
  Users,
  Contact,
  LogOut,
  X,

  ChevronLeft,
  ChevronRight,
  Folder,
  Tag,
  HelpCircle,
  Info,
  Star,
  Flag,
  Settings,
  Shield,
  Loader2,
  Quote,
  UserCheck,
} from "lucide-react";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";

interface AdminSidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onPin: () => void;
}

export function AdminSidebar({
  isOpen,
  isCollapsed,
  isPinned,
  onToggle,
  onCollapse,
  onPin,
}: AdminSidebarProps) {
  const { t } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { hasPermission, isManager, isAdmin } = useManagerPermissions();

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logout();
    navigate("/");
    setLogoutDialogOpen(false);
  };

  // Sidebar is effectively expanded if pinned OR if collapsed but being hovered
  const isEffectivelyExpanded = isPinned || !isCollapsed || (isCollapsed && isHovered);

  // Determine base path from current location
  const location = useLocation();
  const basePath = location.pathname.startsWith('/manager') ? '/manager' : '/admin';

  const allMenuItems = [
    {
      icon: LayoutDashboard,
      label: t("admin.sidebar.dashboard"),
      path: `${basePath}`,
      show: true // Always show dashboard
    },
    {
      icon: Package,
      label: t("admin.sidebar.products"),
      path: `${basePath}/products`,
      show: hasPermission("can_manage_products")
    },
    {
      icon: Folder,
      label: t("admin.sidebar.categories"),
      path: `${basePath}/categories`,
      show: hasPermission("can_manage_categories")
    },
    {
      icon: Calendar,
      label: t("admin.sidebar.events"),
      path: `${basePath}/events`,
      show: hasPermission("can_manage_events")
    },
    {
      icon: FileText,
      label: t("admin.sidebar.blogs"),
      path: `${basePath}/blogs`,
      show: hasPermission("can_manage_blogs")
    },
    {
      icon: Image,
      label: t("admin.sidebar.gallery"),
      path: `${basePath}/gallery`,
      show: hasPermission("can_manage_gallery")
    },
    {
      icon: Image,
      label: t("admin.sidebar.carousel"),
      path: `${basePath}/carousel`,
      show: hasPermission("can_manage_carousel")
    },
    {
      icon: ShoppingCart,
      label: t("admin.sidebar.orders"),
      path: `${basePath}/orders`,
      show: hasPermission("can_manage_orders")
    },
    {
      icon: Users,
      label: t("admin.sidebar.users"),
      path: `${basePath}/users`,
      show: isAdmin // Only admins can manage users
    },
    {
      icon: UserCheck, // Using UserCheck for managers as Users is now for general user management
      label: t("admin.sidebar.managers"),
      path: `${basePath}/managers`,
      show: isAdmin // Only admins can manage managers
    },
    {
      icon: Star,
      label: t("admin.sidebar.reviews"),
      path: `${basePath}/reviews`,
      show: hasPermission("can_manage_reviews")
    },
    {
      icon: Quote,
      label: t("admin.sidebar.testimonials"),
      path: `${basePath}/testimonials`,
      show: hasPermission("can_manage_testimonials")
    },
    {
      icon: Flag,
      label: t("admin.sidebar.moderation"),
      path: `${basePath}/comments`,
      show: hasPermission("can_manage_blogs"),
    },
    {
      icon: HelpCircle,
      label: t("admin.sidebar.faqs"),
      path: `${basePath}/faqs`,
      show: hasPermission("can_manage_faqs")
    },
    {
      icon: Contact,
      label: t("admin.sidebar.contactInfo"),
      path: `${basePath}/contact-management`,
      show: hasPermission("can_manage_contact_info")
        || hasPermission("can_manage_social_media")
        || hasPermission("can_manage_bank_details")
        || hasPermission("can_manage_newsletter")
        || hasPermission("can_manage_contact_messages")
    },
    {
      icon: Info,
      label: t("admin.sidebar.aboutUs"),
      path: `${basePath}/about-us`,
      show: hasPermission("can_manage_about_us")
    },
    {
      icon: Shield,
      label: t("admin.sidebar.policies"),
      path: `${basePath}/policies`,
      show: isAdmin || hasPermission("can_manage_policies")
    },
    {
      icon: Loader2,
      label: t("admin.sidebar.jobs"),
      path: `${basePath}/jobs`,
      show: isAdmin || hasPermission("can_manage_background_jobs")
    },
    {
      icon: Settings,
      label: t("admin.sidebar.settings"),
      path: `${basePath}/settings`,
      show: isAdmin || hasPermission("can_manage_coupons")
    },
  ];

  const menuItems = allMenuItems.filter(item => item.show);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-0 top-0 z-50 h-screen bg-card/95 backdrop-blur-sm border-r transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${isEffectivelyExpanded ? "w-64" : "w-16"} ${isCollapsed && isHovered && !isPinned ? "shadow-2xl" : ""}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-2xl transition-transform hover:scale-110 duration-200">🐄</span>
              {isEffectivelyExpanded && <span className="font-bold truncate animate-in fade-in duration-300">{isManager ? t("admin.managerPanel") : t("admin.adminPanel")}</span>}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPin}
                className={`hidden md:flex hover:bg-muted ${isPinned ? "text-primary" : "text-muted-foreground"}`}
                title={isPinned ? t("admin.unpinSidebar") : t("admin.pinSidebar")}
              >
                <Shield className={`h-4 w-4 transition-transform duration-200 ${isPinned ? "rotate-0 scale-110" : "-rotate-45"}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={isCollapsed ? onCollapse : onToggle}
                className="md:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCollapse}
                className="hidden md:flex hover:bg-muted"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === basePath}
                    className={({ isActive }) => `flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden ${!isEffectivelyExpanded ? "justify-center px-2" : "gap-3 px-3"
                      } ${isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted hover:text-foreground text-muted-foreground"
                      }`}
                    title={!isEffectivelyExpanded ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />}
                        <item.icon className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                        {isEffectivelyExpanded && <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className={`w-full ${!isEffectivelyExpanded ? "justify-center px-2" : "justify-start gap-3 px-3"
                }`}
              onClick={handleLogout}
              title={!isEffectivelyExpanded ? t("nav.logout") : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {isEffectivelyExpanded && <span>{t("nav.logout")}</span>}
            </Button>
          </div>
        </div>
      </aside>

      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={confirmLogout}
      />
    </>
  );
}
