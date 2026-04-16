import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePortalPath } from "@/hooks/usePortalPath";
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
  FileCheck,
  Pin,
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
  const { hasPermission, hasTestimonialAccess, isManager, isAdmin } = useManagerPermissions();
  const { basePath } = usePortalPath();

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
      show: hasTestimonialAccess()
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

        || hasPermission("can_manage_contact_messages")
    },
    {
      icon: Info,
      label: t("admin.sidebar.aboutUs"),
      path: `${basePath}/about-us`,
      show: hasPermission("can_manage_about_us")
    },
    {
      icon: FileCheck,
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
        className={`fixed left-0 top-0 z-50 h-screen bg-[#F9F5F0] border-r border-[#2C1810]/5 transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${isEffectivelyExpanded ? "w-64" : "w-16"} ${isCollapsed && isHovered && !isPinned ? "shadow-2xl shadow-[#2C1810]/10" : ""}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className={`flex h-16 items-center border-b border-[#2C1810]/5 px-4 mb-4 transition-all duration-300 ${isEffectivelyExpanded ? "justify-between" : "justify-center"}`}>
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${!isEffectivelyExpanded ? "w-9" : ""}`}>
              <div className="w-9 h-9 flex-shrink-0 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden p-0.5 border border-border/50 transition-all duration-500">
                <img
                  src={import.meta.env.VITE_APP_LOGO_URL}
                  alt={t("common.logoAlt", { defaultValue: "Logo" })}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              {isEffectivelyExpanded && (
                <div className="flex flex-col min-w-0 animate-in fade-in duration-300">
                  <span className="text-[11px] font-black text-[#2C1810] tracking-tight truncate leading-none">
                    {t('common.brandName')}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#B85C3C] mt-0.5 truncate opacity-70">
                    {isManager ? t("admin.managerPanel") : t("admin.adminPanel")}
                  </span>
                </div>
              )}
            </div>

            {isEffectivelyExpanded && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPin}
                  className={`hidden md:flex hover:bg-muted ${isPinned ? "text-[#B85C3C]" : "text-[#2C1810]/40"} transition-all duration-300`}
                  title={isPinned ? t("admin.unpinSidebar") : t("admin.pinSidebar")}
                >
                  <Pin className={`h-4 w-4 transition-transform duration-300 ${isPinned ? "rotate-0 scale-110" : "-rotate-45"}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="md:hidden"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === basePath}
                    className={({ isActive }) => `flex items-center rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 group relative ${!isEffectivelyExpanded ? "justify-center px-2" : "gap-3 px-4 mx-2"
                      } ${isActive
                        ? "bg-[#B85C3C] text-white shadow-lg shadow-[#B85C3C]/20"
                        : "hover:bg-[#B85C3C]/5 hover:text-[#B85C3C] text-[#2C1810]/60"
                      }`}
                    title={!isEffectivelyExpanded ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:translate-x-1"}`} />
                        {isEffectivelyExpanded && <span className="truncate transition-all duration-300">{item.label}</span>}
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
