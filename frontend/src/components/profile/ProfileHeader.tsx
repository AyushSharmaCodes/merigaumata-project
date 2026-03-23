import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Camera, Mail, Phone, ShieldCheck, Heart } from "lucide-react";
import { useState } from "react";
import ImageCropperModal from "./ImageCropperModal";

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

    const getInitials = () => {
        return name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-card shadow-soft border border-border group p-8 flex flex-col items-center text-center h-full">
                {/* User Info Section Above Avatar */}
                <div className="space-y-1 mb-6">
                    <h1 className="text-3xl font-bold font-playfair text-foreground">
                        {name}
                    </h1>
                </div>

                {/* Avatar Section (Large and Circular) */}
                <div className="relative group/avatar">
                    <div className="p-1.5 bg-muted rounded-full inline-block shadow-soft">
                        <Avatar className="h-64 w-64 border-8 border-muted shadow-inner">
                            <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                            <AvatarFallback className="text-6xl font-playfair bg-muted/50 text-muted-foreground">
                                {getInitials()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <Button
                        size="icon"
                        className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground border-4 border-card shadow-lg transition-transform hover:scale-110 active:scale-95"
                        onClick={() => setShowCropper(true)}
                    >
                        <Camera className="h-6 w-6" />
                    </Button>
                </div>

                {/* Contact Info (Optional/Subtle) */}
                <div className="mt-6 space-y-2 opacity-60">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                        <Mail className="h-3 w-3" />
                        <span>{email}</span>
                    </div>
                    {phone && (
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                            <Phone className="h-3 w-3" />
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
