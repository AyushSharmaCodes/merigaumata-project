import { useLocation } from "react-router-dom";

/**
 * Hook to determine the current portal's base path.
 * Returns '/manager' if the user is in the manager portal, otherwise '/admin'.
 */
export function usePortalPath() {
  const location = useLocation();
  const basePath = location.pathname.startsWith("/manager") ? "/manager" : "/admin";
  
  return {
    basePath,
    isManagerPortal: basePath === "/manager",
    isAdminPortal: basePath === "/admin",
  };
}
