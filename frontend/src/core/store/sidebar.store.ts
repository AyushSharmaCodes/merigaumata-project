import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SidebarState {
  state: "expanded" | "collapsed";
  open: boolean;
  openMobile: boolean;
  isMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  toggleSidebar: () => void;
}

/**
 * Global store for Sidebar state.
 * Replaces the monolithic SidebarContext to enable atomic subscriptions via selectors.
 */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      state: "expanded",
      open: true,
      openMobile: false,
      isMobile: false,

      setOpen: (open) => set({ 
        open, 
        state: open ? "expanded" : "collapsed" 
      }),

      setOpenMobile: (openMobile) => set({ openMobile }),

      setIsMobile: (isMobile) => set({ isMobile }),

      toggleSidebar: () => {
        const { isMobile, openMobile, open } = get();
        if (isMobile) {
          set({ openMobile: !openMobile });
        } else {
          const nextOpen = !open;
          set({ 
            open: nextOpen, 
            state: nextOpen ? "expanded" : "collapsed" 
          });
        }
      },
    }),
    {
      name: "sidebar-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ open: state.open, state: state.state }),
    }
  )
);
