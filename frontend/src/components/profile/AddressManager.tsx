import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Plus, Pencil, Trash2, Truck, CreditCard, Package, ChevronRight, Home, Briefcase, Globe, Phone, Loader2 } from "lucide-react";
import type { CheckoutAddress, CreateAddressDto } from "@/types";
import { useState } from "react";
import AddressFormModal from "./AddressFormModal";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AddressManagerProps {
    addresses: CheckoutAddress[];
    onAdd: (data: CreateAddressDto) => Promise<CheckoutAddress | void>;
    onUpdate: (id: string, data: CreateAddressDto) => Promise<CheckoutAddress | void>;
    onDelete: (id: string) => Promise<void>;
    onSetPrimary: (id: string) => Promise<CheckoutAddress | void>;
    /** Profile-level phone number to pre-fill on new addresses */
    profilePhone?: string;
    /** Called when a new address is saved with a phone not yet on the profile */
    onProfilePhoneUpdate?: (phone: string) => void;
}

export default function AddressManager({
    addresses,
    onAdd,
    onUpdate,
    onDelete,
    onSetPrimary,
    profilePhone,
    onProfilePhoneUpdate
}: AddressManagerProps) {
    const { t } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [editingAddress, setEditingAddress] = useState<CheckoutAddress | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'home':
                return <Home className="h-4 w-4" />;
            case 'work':
                return <Briefcase className="h-4 w-4" />;
            case 'shipping':
                return <Truck className="h-4 w-4" />;
            case 'billing':
                return <CreditCard className="h-4 w-4" />;
            default:
                return <Globe className="h-4 w-4" />;
        }
    };

    const getAvailableTypes = (): Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'> => {
        return ['home', 'work', 'other'];
    };

    const handleEdit = (address: CheckoutAddress) => {
        setEditingAddress(address);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingAddress(null);
    };

    const handleSetPrimary = async (id: string) => {
        try {
            setSettingPrimaryId(id);
            await onSetPrimary(id);
        } finally {
            setSettingPrimaryId(null);
        }
    };

    return (
        <>
            <Card className="rounded-[2.5rem] border border-border shadow-soft overflow-hidden bg-card text-card-foreground mt-8">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-playfair">{t("profile.address.manageTitle")}</CardTitle>
                                <CardDescription className="text-muted-foreground">{t("profile.address.sanctuaryDesc")}</CardDescription>
                            </div>
                        </div>
                        <Button
                            onClick={() => setShowForm(true)}
                            className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary-hover transition-all font-bold text-[10px] uppercase tracking-widest px-8 shadow-lg"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {t("profile.address.addNew")}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 px-6 md:px-8">
                    {addresses.length === 0 ? (
                        <div className="text-center py-16 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border">
                            <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <MapPin className="h-10 w-10 text-primary/30" />
                            </div>
                            <h3 className="text-foreground font-bold text-lg">{t("profile.address.noAddresses")}</h3>
                            <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 mb-8 italic">
                                {t("profile.address.mappingPath")}
                            </p>
                            <Button
                                variant="outline"
                                className="rounded-full border-primary/20 text-primary hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest px-8"
                                onClick={() => setShowForm(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" /> {t("profile.address.firstSanctuary")}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {addresses.map((address) => (
                                <div
                                    key={address.id}
                                    className={`group border border-border/50 rounded-[2rem] p-6 relative transition-all duration-300 shadow-soft hover:shadow-elevated hover:bg-muted/30 ${address.is_primary ? 'ring-2 ring-primary/20 border-primary/40 bg-muted/50 shadow-md' : 'bg-muted/10'
                                        } ${settingPrimaryId === address.id ? 'animate-pulse bg-primary/5 border-primary/30' : ''}`}
                                >
                                    {/* Action buttons in top-right corner */}
                                    <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-full bg-white/80 border border-border hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                            onClick={() => handleEdit(address)}
                                            disabled={!!settingPrimaryId}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-full bg-white/80 border border-border hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
                                            onClick={() => setDeletingId(address.id)}
                                            disabled={!!settingPrimaryId}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Address header with type */}
                                    <div className="flex items-center gap-3 mb-4 pr-16">
                                        <div className={`p-2 rounded-xl shadow-sm ${address.is_primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            {getTypeIcon(address.type)}
                                        </div>
                                        <div>
                                            <span className="font-bold text-foreground capitalize line-clamp-1 block">
                                                {address.full_name}
                                            </span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="capitalize text-[9px] font-bold tracking-widest py-0 px-2 rounded-full border-border text-muted-foreground">
                                                    {address.type}
                                                </Badge>
                                                {address.is_primary && (
                                                    <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[9px] font-bold tracking-widest py-0 px-2 rounded-full">
                                                        {t("profile.default").toUpperCase()}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address details */}
                                    <div className="text-xs space-y-1.5 mb-6 text-muted-foreground leading-relaxed h-[80px]">
                                        <p className="font-bold text-foreground line-clamp-1">{address.address_line1}</p>
                                        {address.address_line2 && <p className="line-clamp-1">{address.address_line2}</p>}
                                        <p className="line-clamp-1">
                                            {address.city}, {address.state} {address.postal_code}
                                        </p>
                                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground/80 mt-2">
                                            <Phone className="h-3 w-3" /> {address.phone}
                                        </div>
                                    </div>

                                    {/* Set as primary button */}
                                    {!address.is_primary && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-between items-center rounded-2xl bg-muted/50 hover:bg-primary hover:text-primary-foreground group/btn transition-all font-bold text-[10px] uppercase tracking-widest h-10 px-4 text-muted-foreground"
                                            onClick={() => handleSetPrimary(address.id)}
                                            disabled={!!settingPrimaryId}
                                        >
                                            <div className="flex items-center gap-2">
                                                {settingPrimaryId === address.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Star className="h-3.5 w-3.5 group-hover/btn:fill-current" />
                                                )}
                                                {settingPrimaryId === address.id ? t("profile.address.sanctifying") : t("profile.setAsDefault")}
                                            </div>
                                            <ChevronRight className={`h-3.5 w-3.5 ${settingPrimaryId === address.id ? 'opacity-0' : ''}`} />
                                        </Button>
                                    )}
                                    {address.is_primary && (
                                        <div className="flex items-center justify-center gap-2 w-full h-10 rounded-2xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
                                            <Truck className="h-4 w-4" /> {t("profile.address.defaultHaven")}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddressFormModal
                open={showForm}
                onClose={handleCloseForm}
                onSave={editingAddress
                    ? (data) => onUpdate(editingAddress.id, data)
                    : async (data) => {
                        const result = await onAdd(data);
                        // If this new address has a phone and the profile doesn't, sync it back
                        if (!editingAddress && data.phone && !profilePhone && onProfilePhoneUpdate) {
                            onProfilePhoneUpdate(data.phone);
                        }
                        return result;
                    }
                }
                initialData={editingAddress || undefined}
                availableTypes={getAvailableTypes()}
                profilePhone={profilePhone}
            />

            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent className="rounded-[2.5rem] border border-border shadow-elevated p-8 max-w-md bg-card text-card-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-playfair text-foreground">{t("profile.address.abolishTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2 text-muted-foreground">
                            {t("profile.address.abolishDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-8 gap-3">
                        <AlertDialogCancel className="rounded-full px-8 bg-muted border-border text-foreground hover:bg-muted/80">{t("profile.address.remain")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deletingId) {
                                    onDelete(deletingId);
                                    setDeletingId(null);
                                }
                            }}
                            className="bg-red-600 text-white hover:bg-red-700 rounded-full px-8 shadow-lg shadow-red-600/20"
                        >
                            {t("profile.address.abolish")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );

}
