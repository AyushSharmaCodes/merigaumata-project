import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./card";
import { Separator } from "./separator";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function ShopSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full md:w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-3xl border border-border/50 p-4">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-6 py-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/4" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="pt-8 space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlogSkeleton() {
    return (
      <div className="container mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-1/3 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-3xl overflow-hidden border border-border/40">
              <Skeleton className="aspect-[16/9] w-full" />
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}
export function GridSkeleton({ columns = 3, count = 6 }) {
  return (
    <div className="container mx-auto px-4 py-12 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-3xl overflow-hidden border border-border/40 p-4">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex justify-between pt-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ columns = 5, rows = 10 }) {
  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500">
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="bg-muted/30 p-4 border-b border-border/40 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-6 flex-1" />
          ))}
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-10 flex-1 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 rounded-3xl border border-border/40 bg-card space-y-3">
          <div className="flex justify-between items-start">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function AccordionSkeleton({ count = 5 }) {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-500">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border/40 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
}

export function MissionSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="p-10 rounded-3xl border border-border/40 bg-card space-y-6">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AboutPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 space-y-20 animate-in fade-in duration-500">
      <Skeleton className="h-[40vh] w-full" />
      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <MissionSkeleton />
      </div>
      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-6 w-3/4" />
          <div className="space-y-12 pl-8 border-l border-dashed border-border/40">
             {Array.from({ length: 3 }).map((_, i) => (
               <div key={i} className="space-y-2">
                 <Skeleton className="h-6 w-1/4" />
                 <Skeleton className="h-8 w-1/2" />
                 <Skeleton className="h-16 w-full" />
               </div>
             ))}
          </div>
        </div>
        <Skeleton className="h-[500px] w-full rounded-[3rem]" />
      </div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 space-y-8 animate-in fade-in duration-500">
      <div className="bg-[#2C1810] py-12">
        <div className="container mx-auto px-4 space-y-4">
          <Skeleton className="h-10 w-1/4 bg-white/10" />
          <Skeleton className="h-12 w-1/2 bg-white/10" />
        </div>
      </div>
      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="p-8 rounded-3xl border border-border/40 bg-card space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>
          <div className="p-8 rounded-3xl border border-border/40 bg-card space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="p-8 rounded-3xl border border-border/40 bg-card space-y-6 sticky top-24">
            <Skeleton className="h-8 w-1/2" />
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Separator />
              <div className="flex justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddressCardSkeleton() {
  return (
    <div className="relative p-4 rounded-xl border border-border/40 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-5 w-5 rounded-full mt-1" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-4 w-24 mt-2" />
        </div>
      </div>
    </div>
  );
}


export function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 space-y-8 animate-in fade-in duration-500">
      <Skeleton className="h-[50vh] w-full" />
      <div className="container mx-auto px-4 max-w-4xl -mt-32 relative z-10">
        <Card className="p-8 md:p-12 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Separator />
          <div className="space-y-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20 animate-in fade-in duration-500">
      <Skeleton className="h-[60vh] w-full" />
      <div className="container mx-auto px-4 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <Card className="p-8 space-y-8">
              <div className="space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>
              <div className="space-y-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            </Card>
          </div>
          <div className="lg:col-span-4">
            <Card className="p-6 space-y-6 sticky top-24">
              <Skeleton className="h-8 w-1/2" />
              <div className="space-y-4">
                <Skeleton className="h-12 w-full rounded-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-64" />
        <div className="ml-auto flex gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Separator />
              <div className="flex justify-between">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <Skeleton className="h-[70vh] w-full" />
      <div className="container mx-auto px-4 space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-96" />
          </div>
          <Skeleton className="h-12 w-32 rounded-full" />
        </div>
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[320px] space-y-4">
              <Skeleton className="aspect-square w-full rounded-[2rem]" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#FAF7F2] py-20">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center space-y-4">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-12 space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3 flex flex-col items-center space-y-6">
          <Skeleton className="h-64 w-64 rounded-full shadow-lg" />
          <Skeleton className="h-10 w-48" />
          <div className="w-full space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="w-full lg:w-2/3 space-y-8">
          <div className="p-8 rounded-3xl border border-border/40 bg-card space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
            <Skeleton className="h-12 w-32 rounded-full ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactSkeleton() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <Skeleton className="h-[60vh] w-full" />
      <div className="container mx-auto px-4 -mt-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3">
            <Skeleton className="h-[600px] rounded-3xl" />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardStatSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-in fade-in duration-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-none shadow-sm bg-white overflow-hidden p-5">
          <div className="flex items-start gap-5">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
          <Skeleton className="h-16 mt-6 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function DashboardChartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-500">
      <Card className="lg:col-span-8 border-none shadow-sm bg-white/50 p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="flex gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </Card>
      <Card className="lg:col-span-4 border-none shadow-sm bg-white/50 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="flex flex-col items-center justify-center h-[240px] relative">
          <Skeleton className="w-48 h-48 rounded-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
        <div className="space-y-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-border/30 bg-background/50">
              <div className="flex items-center gap-3">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function OrderActivitySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12 animate-in fade-in duration-500">
      <Card className="lg:col-span-8 border-none shadow-sm bg-white/50 overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="px-1 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-5 px-8">
              <Skeleton className="h-4 w-16" />
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-sm bg-white/50 p-6 space-y-6">
           <Skeleton className="h-7 w-40" />
           <Skeleton className="h-[240px] w-full rounded-xl" />
        </Card>
        <Card className="border-none shadow-lg bg-[#2C1810] p-6 space-y-6">
           <Skeleton className="h-7 w-40 bg-white/10" />
           <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                   <Skeleton className="w-11 h-11 rounded-xl bg-white/10" />
                   <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3 bg-white/10" />
                      <Skeleton className="h-4 w-full bg-white/10" />
                   </div>
                </div>
              ))}
           </div>
        </Card>
      </div>
    </div>
  );
}

export function GalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-none shadow-sm">
          <Skeleton className="aspect-square w-full" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-6 border-none shadow-sm bg-white/50">
          <div className="flex gap-6">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="flex-1 space-y-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
