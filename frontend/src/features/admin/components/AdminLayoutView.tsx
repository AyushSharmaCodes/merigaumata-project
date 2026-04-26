import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/domains/auth";
import { AdminSidebar } from "@/features/admin";
import { Button } from "@/shared/components/ui/button";
import { Menu, Home, Languages } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useManagerPermissions } from "@/shared/hooks/useManagerPermissions";
import { useToast } from "@/shared/hooks/use-toast";
import { useLanguage } from "@/shared/hooks/useLanguage";
import { availableLanguages, LANGUAGE_NAMES } from "@/app/i18n/config";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/core/api/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

export function AdminLayoutView() {
  const { changeLanguage, t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const seenDeletionJobStatusesRef = useRef<Map<string, string>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager, isAdmin } = useManagerPermissions();

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
          toast({
            title: t("admin.layout.accountDeletion.jobCompleted"),
            description: t("admin.layout.accountDeletion.jobCompletedDesc", { id: jobId }),
          });
        } else if (job.status === "FAILED") {
          toast({
            title: t("admin.layout.accountDeletion.jobFailed"),
            description: t("admin.layout.accountDeletion.jobFailedDesc", { id: jobId }),
            variant: "destructive",
          });
        }
      }

      nextStatuses.set(job.id, job.status);
    });

    seenDeletionJobStatusesRef.current = nextStatuses;
  }, [deletionJobsData, isAdmin, t, toast]);

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
        <header className="sticky top-0 z-30 border-b border-[#2C1810]/5 bg-[#F9F5F0]/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-4 px-6 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1 px-4">
              <h1 className="text-xl font-black uppercase tracking-[0.2em] text-[#2C1810]">
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
