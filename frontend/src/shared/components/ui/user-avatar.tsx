import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { getUserInitials } from "@/core/utils/user-display";
import { cn } from "@/core/utils/utils";

interface UserAvatarProps {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

export function UserAvatar({
  name,
  firstName,
  lastName,
  imageUrl,
  className,
  fallbackClassName,
  alt,
}: UserAvatarProps) {
  const initials = getUserInitials({ name, firstName, lastName });
  const displayName = alt || name || [firstName, lastName].filter(Boolean).join(" ") || "User";

  return (
    <Avatar className={className}>
      <AvatarImage src={imageUrl || undefined} alt={displayName} className="object-cover" />
      <AvatarFallback className={cn("bg-primary/10 text-primary font-semibold", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

