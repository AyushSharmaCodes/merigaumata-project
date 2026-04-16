import { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { AddressCardSkeleton } from "@/components/ui/page-skeletons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, MapPin, Pencil, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AddressFormModal from "@/components/profile/AddressFormModal";
import { addressService } from "@/services/address.service";
import type { CheckoutAddress, CreateAddressDto } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { ProfileMessages } from "@/constants/messages/ProfileMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
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
import { TranslatedText } from "@/components/ui/TranslatedText";
import { logger } from "@/lib/logger";

interface AddressSelectorProps {
    type: 'shipping' | 'billing';
    selectedAddressId?: string;
    onSelect: (address: CheckoutAddress) => void;
    forceEditId?: string | null;
    onEditOpened?: () => void;
}

export const AddressSelector = memo(({ type, selectedAddressId, onSelect, forceEditId, onEditOpened }: AddressSelectorProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<CheckoutAddress | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: addresses = [], isLoading } = useQuery({
        queryKey: ["addresses"],
        queryFn: addressService.getAddresses,
    });

    // Handle forced edit request
    useEffect(() => {
        if (forceEditId && addresses.length > 0) {
            const addrToEdit = addresses.find(a => a.id === forceEditId);
            if (addrToEdit) {
                setEditingAddress(addrToEdit);
                setDialogOpen(true);
                if (onEditOpened) onEditOpened();
            }
        }
    }, [forceEditId, addresses, onEditOpened]);

    // Auto-select primary address only if no address is currently selected
    useEffect(() => {
        // Only auto-select if we have addresses and NO selectedAddressId is provided
        // and we are not currently loading
        if (!isLoading && addresses.length > 0 && !selectedAddressId) {
            const primary = addresses.find((addr) => addr.is_primary);
            if (primary) {
                onSelect(primary);
            } else if (addresses.length > 0) {
                onSelect(addresses[0]);
            }
        }
    }, [isLoading, addresses, selectedAddressId, onSelect]);

    const createMutation = useMutation({
        mutationFn: addressService.createAddress,
        onSuccess: (newAddress) => {
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
            toast({
                title: t("common.success"),
                description: t(ProfileMessages.ADDRESS_ADDED),
            });
            onSelect(newAddress);
            handleCloseDialog();
        },
        onError: (error) => toast({
            title: t("common.error"),
            description: getErrorMessage(error, t, ProfileMessages.FAILED_ADDRESS_ADD),
            variant: "destructive",
        }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreateAddressDto }) =>
            addressService.updateAddress(id, data),
        onSuccess: (updatedAddress) => {
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
            toast({
                title: t("common.success"),
                description: t(ProfileMessages.ADDRESS_UPDATED),
            });
            onSelect(updatedAddress);
            handleCloseDialog();
        },
        onError: (error) => toast({
            title: t("common.error"),
            description: getErrorMessage(error, t, ProfileMessages.FAILED_ADDRESS_UPDATE),
            variant: "destructive",
        }),
    });

    const deleteMutation = useMutation({
        mutationFn: addressService.deleteAddress,
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
            toast({
                title: t("common.success"),
                description: t(ProfileMessages.ADDRESS_DELETED),
            });
            if (selectedAddressId === deletedId) {
                const remaining = addresses.filter(a => a.id !== deletedId);
                if (remaining.length > 0) onSelect(remaining[0]);
            }
            setDeletingId(null);
        },
        onError: () => {
            toast({
                title: t("common.error"),
                description: t(ProfileMessages.FAILED_ADDRESS_DELETE),
                variant: "destructive",
            });
            setDeletingId(null);
        },
    });

    const handleSubmit = async (data: CreateAddressDto) => {
        if (editingAddress) {
            await updateMutation.mutateAsync({ id: editingAddress.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
    };

    const handleDelete = async (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingAddress(null);
    };

    const handleEdit = (address: CheckoutAddress, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the address when clicking edit
        setEditingAddress(address);
        setDialogOpen(true);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the address when clicking delete
        setDeletingId(id);
    };

    const isMutationLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

    const mutationMessage =
        createMutation.isPending ? t(ProfileMessages.CREATING_ADDRESS) :
            updateMutation.isPending ? t(ProfileMessages.UPDATING_ADDRESS) :
                deleteMutation.isPending ? t(ProfileMessages.REMOVING_ADDRESS) :
                    t(ProfileMessages.LOADING_ADDRESSES);

    return (
        <div className="space-y-4 relative">
            {isLoading && (
                <div className="grid gap-3 animate-in fade-in duration-500">
                    <AddressCardSkeleton />
                    <AddressCardSkeleton />
                </div>
            )}
            <RadioGroup value={selectedAddressId || ""} onValueChange={(id) => {
                const addr = addresses.find(a => a.id === id);
                if (addr) onSelect(addr);
            }}>
                <div className="grid gap-3">
                    {addresses.map((address) => (
                        <div
                            key={address.id}
                            onClick={() => onSelect(address)}
                            className={`
                                relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                                ${selectedAddressId === address.id
                                    ? "border-[#2C1810] bg-[#2C1810]/5 shadow-sm"
                                    : "border-border/40 hover:border-[#2C1810]/30 hover:bg-muted/30"
                                }
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <RadioGroupItem
                                    value={address.id}
                                    id={`${type}-${address.id}`}
                                    className="mt-1 data-[state=checked]:border-primary data-[state=checked]:text-primary"
                                />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-base text-[#2C1810]">
                                                <TranslatedText text={address.full_name} />
                                            </span>
                                            {address.is_primary && (
                                                <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-[#2C1810] hover:bg-[#2C1810]/90">{t(ProfileMessages.PRIMARY)}</Badge>
                                            )}
                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize border-[#2C1810]/20 text-[#2C1810]"> {address.type}</Badge>
                                        </div>
                                    </div>

                                    <div className="text-sm text-muted-foreground leading-relaxed pr-8">
                                        <p>
                                            <TranslatedText text={address.address_line1} />
                                            {address.address_line2 && <>, <TranslatedText text={address.address_line2} /></>}
                                        </p>
                                        <p>
                                            <TranslatedText text={address.city} />, <TranslatedText text={address.state} /> - {address.postal_code}
                                        </p>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
                                            {t(ProfileMessages.PHONE_LABEL)} <span className="text-foreground">{address.phone}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Actions - Absolute positioned for cleaner layout */}
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-white hover:text-primary shadow-sm"
                                        onClick={(e) => handleEdit(address, e)}
                                        disabled={isMutationLoading}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-white hover:text-destructive shadow-sm"
                                        onClick={(e) => handleDeleteClick(address.id, e)}
                                        disabled={isMutationLoading}
                                    >
                                        {deleteMutation.isPending && deletingId === address.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setDialogOpen(true)}
                        disabled={isMutationLoading}
                    >
                        {(createMutation.isPending) ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4 mr-2" />
                        )}
                        {t(ProfileMessages.ADD_ADDRESS)}
                    </Button>
                </div>
            </RadioGroup>

            <AddressFormModal
                open={dialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSubmit}
                initialData={editingAddress || undefined}
                availableTypes={['home', 'work', 'other']}
            />

            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t(ProfileMessages.DELETE_ADDRESS)}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(ProfileMessages.DELETE_ADDRESS_CONFIRM)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deletingId) {
                                    handleDelete(deletingId);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {(deleteMutation.isPending) ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                                    {t(ProfileMessages.REMOVING_ADDRESS)}
                                </>
                            ) : t(ProfileMessages.DELETE)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
});

AddressSelector.displayName = "AddressSelector";
