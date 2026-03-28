import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Home, Languages } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { availableLanguages, LANGUAGE_NAMES } from "@/i18n/config";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/lib/react-query";
import { localizeAllCachedQueries } from "@/utils/localizeCachedData";

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const seenDeletionJobStatusesRef = useRef<Map<string, string>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager, isAdmin } = useManagerPermissions();

  const changeLanguage = async (lng: string) => {
    localStorage.setItem("language", lng);
    await i18n.changeLanguage(lng);
    localizeAllCachedQueries(queryClient, lng);
    await queryClient.refetchQueries({
      type: "active",
    });
  };

  const { data: deletionJobsData } = useQuery({
    queryKey: ["admin-layout-deletion-jobs"],
    queryFn: async () => {
      const response = await apiClient.get("/admin/jobs?type=ACCOUNT_DELETION&page=1&limit=20");
      return response.data as { jobs?: Array<{ id: string; status: string }> };
    },
    enabled: isAdmin,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!isAdmin || !deletionJobsData?.jobs) {
      return;
    }

    const previousStatuses = seenDeletionJobStatusesRef.current;
    const nextStatuses = new Map(previousStatuses);

    deletionJobsData.jobs.forEach((job) => {
      const previousStatus = previousStatuses.get(job.id);

      if (previousStatus && previousStatus !== job.status) {
        const jobId = job.id.slice(0, 8);

        if (job.status === "COMPLETED") {
          toast.success(t("admin.layout.accountDeletion.jobCompleted"), {
            description: t("admin.layout.accountDeletion.jobCompletedDesc", { id: jobId })
          });
        } else if (job.status === "FAILED") {
          toast.error(t("admin.layout.accountDeletion.jobFailed"), {
            description: t("admin.layout.accountDeletion.jobFailedDesc", { id: jobId })
          });
        }
      }

      nextStatuses.set(job.id, job.status);
    });

    seenDeletionJobStatusesRef.current = nextStatuses;
  }, [deletionJobsData, isAdmin, t]);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        isPinned={sidebarPinned}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onPin={() => setSidebarPinned(!sidebarPinned)}
      />

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${sidebarOpen ? (sidebarPinned || !sidebarCollapsed ? "md:ml-64" : "md:ml-16") : "ml-0"
          }`}
      >
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-6 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-left-2 duration-500">
                {isManager ? t('admin.layout.managerPortal') : t('admin.layout.adminPortal')}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                {t('admin.layout.welcome', { name: user?.name || t('common.user.defaultName') })}
              </span>

              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                  >
                    <Languages className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl shadow-elevated border-border/50">
                  {availableLanguages.map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className="rounded-lg cursor-pointer"
                    >
                      {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                title={t('admin.layout.backToWebsite')}
                className="hover:scale-110 transition-transform duration-200"
              >
                <Home className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
