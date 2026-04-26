import { FolderOpen } from "lucide-react";
import { cn } from "@/core/utils/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ 
  title, 
  description, 
  icon,
  className 
}: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)}>
      <div className="text-muted-foreground/40 mb-4">
        {icon || <FolderOpen className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
    </div>
  );
};
