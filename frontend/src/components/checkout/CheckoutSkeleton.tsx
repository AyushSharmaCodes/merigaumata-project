import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const CheckoutSkeleton = () => {
    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Hero Section Skeleton */}
            <section className="bg-[#2C1810] text-white py-12 mb-8">
                <div className="container mx-auto px-4">
                    <div className="flex items-center gap-6">
                        <Skeleton className="h-10 w-24 bg-white/10" />
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-64 bg-white/20" />
                            <Skeleton className="h-4 w-48 bg-white/10" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Left Column - Addresses Skeleton */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Shipping Address Skeleton */}
                        <Card className="border-none shadow-sm">
                            <CardHeader className="bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-6 w-40" />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <Skeleton className="h-24 w-full rounded-lg" />
                                <Skeleton className="h-24 w-full rounded-lg" />
                            </CardContent>
                        </Card>

                        {/* Billing Address Skeleton */}
                        <Card className="border-none shadow-sm">
                            <CardHeader className="bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-6 w-40" />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <Skeleton className="h-12 w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Order Summary Skeleton */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-24">
                            <Card className="border-none shadow-elevated">
                                <CardContent className="p-6 space-y-4">
                                    {/* Items */}
                                    <div className="space-y-3">
                                        <Skeleton className="h-20 w-full rounded-lg" />
                                        <Skeleton className="h-20 w-full rounded-lg" />
                                    </div>

                                    <Separator className="bg-border/60 my-4" />

                                    {/* Price Breakdown */}
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-6 w-full" />
                                    </div>

                                    {/* Pay Button */}
                                    <Skeleton className="h-14 w-full rounded-lg" />

                                    {/* Security Badge */}
                                    <Skeleton className="h-8 w-full rounded-full" />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
