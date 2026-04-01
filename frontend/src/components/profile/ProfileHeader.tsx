import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Camera, Mail, Phone, ShieldCheck, Heart } from "lucide-react";
import { useState } from "react";
import ImageCropperModal from "./ImageCropperModal";
import { UserAvatar } from "@/components/ui/user-avatar";

interface ProfileHeaderProps {
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    isEmailVerified?: boolean;
    onAvatarUpdate: (file: File) => void;
    onAvatarDelete: () => void;
}

export default function ProfileHeader({
    name,
    email,
    phone,
    avatarUrl,
    isEmailVerified,
    onAvatarUpdate,
    onAvatarDelete
}: ProfileHeaderProps) {
    const { t } = useTranslation();
    const [showCropper, setShowCropper] = useState(false);

    return (
        <>
            <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-card shadow-soft border border-border group px-4 py-6 sm:p-8 flex flex-col items-center text-center h-full">
                {/* User Info Section Above Avatar */}
                <div className="space-y-1 mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-foreground break-words">
                        {name}
                    </h1>
                </div>

                {/* Avatar Section (Large and Circular) */}
                <div className="relative group/avatar">
                    <div className="p-1 sm:p-1.5 bg-muted rounded-full inline-block shadow-soft">
                        <UserAvatar
                            name={name}
                            imageUrl={avatarUrl}
                            className="h-44 w-44 sm:h-56 sm:w-56 lg:h-64 lg:w-64 border-4 sm:border-8 border-muted shadow-inner"
                            fallbackClassName="text-4xl sm:text-5xl lg:text-6xl font-playfair bg-muted/50 text-muted-foreground"
                        />
                    </div>
                    <Button
                        size="icon"
                        className="absolute bottom-1 right-1 sm:bottom-4 sm:right-4 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground border-2 sm:border-4 border-card shadow-lg transition-transform hover:scale-110 active:scale-95"
                        onClick={() => setShowCropper(true)}
                    >
                        <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </div>

                {/* Contact Info (Optional/Subtle) */}
                <div className="mt-5 sm:mt-6 space-y-2 opacity-60 w-full max-w-xs">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium min-w-0">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="break-all">{email}</span>
                    </div>
                    {phone && (
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium min-w-0">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{phone}</span>
                        </div>
                    )}
                </div>
            </div>

            <ImageCropperModal
                open={showCropper}
                onClose={() => setShowCropper(false)}
                onSave={onAvatarUpdate}
                onDelete={avatarUrl ? onAvatarDelete : undefined}
            />
        </>
    );
}
