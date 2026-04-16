import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Clock, Copy, Loader2, ListChecks, Calendar, CheckCircle2 } from "lucide-react";
import { OfficeHour, contactInfoService } from "@/services/contact-info.service";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function buildFullWeek(existingHours: OfficeHour[]): OfficeHour[] {
  const byDay = new Map(existingHours.map((h) => [h.day_of_week, h]));
  return ALL_DAYS.map((day, index) => {
    const existing = byDay.get(day);
    if (existing) return existing;
    // Generate a temporary id for new (unsaved) days
    return {
      id: `__new__${day}`,
      day_of_week: day,
      open_time: "09:00",
      close_time: "17:00",
      is_closed: false,
      display_order: index,
    };
  });
}

interface OfficeHoursSectionProps {
  officeHours: OfficeHour[];
  onUpdate: (officeHours: OfficeHour[]) => Promise<void>;
}

export function OfficeHoursSection({
  officeHours,
  onUpdate,
}: OfficeHoursSectionProps) {
  const { t } = useTranslation();
  const fullWeek = useMemo(() => buildFullWeek(officeHours), [officeHours]);
  const [localHours, setLocalHours] = useState<OfficeHour[]>(fullWeek);
  const [activeTab, setActiveTab] = useState("bulk");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [bulkOpenTime, setBulkOpenTime] = useState("09:00");
  const [bulkCloseTime, setBulkCloseTime] = useState("17:00");
  const [bulkClosed, setBulkClosed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLocalHours(buildFullWeek(officeHours));
  }, [officeHours]);

  const handleUpdate = (id: string, updates: Partial<OfficeHour>) => {
    setLocalHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const applyBulkToLocalHours = () => {
    if (selectedDays.length === 0) return false;

    setLocalHours((prev) =>
      prev.map((h) =>
        selectedDays.includes(h.day_of_week)
          ? {
            ...h,
            open_time: bulkOpenTime,
            close_time: bulkCloseTime,
            is_closed: bulkClosed,
          }
          : h
      )
    );
    setSelectedDays([]);
    return true;
  };

  const handleApplyAndReview = () => {
    if (selectedDays.length === 0) {
      toast({
        title: t("common.error"),
        description: t("admin.contact.hours.selectDayError"),
        variant: "destructive",
      });
      return;
    }
    
    applyBulkToLocalHours();
    setActiveTab("individual"); // Switch to Detailed View
    toast({
      title: t("common.success"),
      description: t("admin.contact.hours.applied", { count: selectedDays.length }),
    });
  };

  const selectAllDays = () => {
    if (selectedDays.length === localHours.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays(localHours.map((h) => h.day_of_week));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Intelligently apply bulk changes if in bulk mode and days are selected
      if (activeTab === "bulk" && selectedDays.length > 0) {
        applyBulkToLocalHours();
      }

      const newHours = localHours.filter((h) => h.id.startsWith("__new__"));
      const existingHours = localHours.filter((h) => !h.id.startsWith("__new__"));

      // Process requests sequentially to avoid backend lock conflicts ("another step in progress")
      for (const h of newHours) {
        await contactInfoService.addOfficeHours({
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
          display_order: h.display_order,
        });
      }

      for (const h of existingHours) {
        await contactInfoService.updateOfficeHours(h.id, h);
      }

      // The parent's onUpdate will handle query invalidation
      await onUpdate(localHours);
      toast({
        title: t("common.success"),
        description: t("admin.contact.hours.updated"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.contact.hours.updateError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t("admin.contact.hours.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border border-muted-foreground/10">
          <div className="space-y-1">
            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {t("admin.contact.hours.selectMode") || "Management Mode"}
            </Label>
            <p className="text-xs text-muted-foreground/70">
              {activeTab === "bulk" 
                ? t("admin.contact.hours.bulkSetupDesc") || "Set multiple days at once"
                : t("admin.contact.hours.individualSetupDesc") || "Fine-tune individual days"}
            </p>
          </div>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full sm:w-[240px] bg-background shadow-sm border-2">
              <SelectValue placeholder={t("admin.contact.hours.selectMode")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bulk">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  <span>{t("admin.contact.hours.applyMultiple")}</span>
                </div>
              </SelectItem>
              <SelectItem value="individual">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{t("admin.contact.hours.individualSettings")}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-[400px]">
          {activeTab === "bulk" ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Day Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t("admin.contact.hours.selectDays")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllDays}
                    className="h-8 text-xs hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                  >
                    {selectedDays.length === localHours.length
                      ? t("admin.contact.hours.deselectAll")
                      : t("admin.contact.hours.selectAll")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {localHours.map((hours) => {
                    const isSelected = selectedDays.includes(hours.day_of_week);
                    const dayName = t(`admin.contact.hours.days.${hours.day_of_week.toLowerCase()}`);
                    
                    return (
                      <button
                        key={hours.id}
                        type="button"
                        onClick={() => toggleDaySelection(hours.day_of_week)}
                        className={cn(
                          "px-4 py-2 rounded-full border-2 transition-all duration-200 text-sm font-semibold min-w-[100px] flex items-center justify-center gap-2",
                          isSelected
                            ? "bg-[#B85C3C] border-[#B85C3C] text-white shadow-md scale-105"
                            : "bg-background border-muted-foreground/20 text-muted-foreground hover:border-[#B85C3C]/50 hover:bg-[#B85C3C]/5"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="h-3 w-3" />}
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bulk Settings */}
              <div className="space-y-6 pt-6 border-t">
                <Label className="text-base font-semibold">{t("admin.contact.hours.setSchedule")}</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/10 p-6 rounded-2xl border-2 border-dashed border-muted-foreground/10 h-full items-center">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">{t("admin.contact.hours.openTime")}</Label>
                    <Input
                      type="time"
                      value={bulkOpenTime}
                      onChange={(e) => setBulkOpenTime(e.target.value)}
                      disabled={bulkClosed}
                      className="bg-background border-2 focus:border-[#B85C3C] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">{t("admin.contact.hours.closeTime")}</Label>
                    <Input
                      type="time"
                      value={bulkCloseTime}
                      onChange={(e) => setBulkCloseTime(e.target.value)}
                      disabled={bulkClosed}
                      className="bg-background border-2 focus:border-[#B85C3C] transition-colors"
                    />
                  </div>
                  <div className="flex items-center space-x-3 pt-4 md:pt-6 bg-background/50 p-3 rounded-lg border">
                    <Switch
                      id="bulk-closed"
                      checked={bulkClosed}
                      onCheckedChange={setBulkClosed}
                    />
                    <Label htmlFor="bulk-closed" className="cursor-pointer font-semibold text-sm">
                      {t("admin.contact.hours.markClosed")}
                    </Label>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 text-center px-4 py-2 bg-[#B85C3C]/5 rounded-lg border border-[#B85C3C]/10">
                  <p className="text-sm text-muted-foreground italic">
                    {t("admin.contact.hours.bulkHint") || "Click 'Apply & Review' to check before saving, or hit 'Save All Changes' directly."}
                  </p>
                  <Button
                    onClick={handleApplyAndReview}
                    variant="outline"
                    className="bg-background hover:bg-[#B85C3C]/10 border-2 hover:border-[#B85C3C] transition-all"
                    disabled={selectedDays.length === 0}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t("admin.contact.hours.applyAndReview") || "Apply Locally & Review"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 gap-4">
                {localHours.map((hours) => (
                  <div
                    key={hours.id}
                    className={cn(
                      "p-5 rounded-xl border-2 transition-all duration-300",
                      hours.is_closed 
                        ? "bg-muted/10 border-muted-foreground/10 opacity-75" 
                        : "bg-background border-muted-foreground/5 shadow-sm hover:border-[#B85C3C]/30"
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-10 rounded-full",
                          hours.is_closed ? "bg-muted-foreground/30" : "bg-[#B85C3C]"
                        )} />
                        <div>
                          <h4 className="font-bold text-lg">
                            {t(`admin.contact.hours.days.${hours.day_of_week.toLowerCase()}`)}
                          </h4>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                            {hours.is_closed ? t("admin.contact.hours.closed") : t("admin.contact.hours.open")}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-6">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase">{t("admin.contact.hours.openTime")}</Label>
                          <Input
                            type="time"
                            value={hours.open_time || ""}
                            onChange={(e) =>
                              handleUpdate(hours.id, { open_time: e.target.value })
                            }
                            disabled={hours.is_closed}
                            className="w-32 bg-background h-10 border-2"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase">{t("admin.contact.hours.closeTime")}</Label>
                          <Input
                            type="time"
                            value={hours.close_time || ""}
                            onChange={(e) =>
                              handleUpdate(hours.id, { close_time: e.target.value })
                            }
                            disabled={hours.is_closed}
                            className="w-32 bg-background h-10 border-2"
                          />
                        </div>
                        <div className="flex items-center space-x-2 pb-1 bg-muted/20 p-2 rounded-lg">
                          <Switch
                            id={`closed-${hours.id}`}
                            checked={hours.is_closed}
                            onCheckedChange={(checked) =>
                              handleUpdate(hours.id, { is_closed: checked })
                            }
                          />
                          <Label
                            htmlFor={`closed-${hours.id}`}
                            className="cursor-pointer text-xs font-bold uppercase tracking-tight"
                          >
                            {t("admin.contact.hours.markClosed")}
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-8 border-t space-y-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#B85C3C] hover:bg-[#A04B2E] text-white h-16 text-xl font-black shadow-2xl transition-all active:scale-[0.98] rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                {t("admin.contact.hours.saving")}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-6 w-6" />
                {t("admin.contact.hours.saveAllChanges") || "Save All Office Hours"}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground italic">
            {t("admin.contact.hours.saveHint") || "This will permanently save all changes made in both Setup and Detailed views."}
          </p>
        </div>
      </CardContent>
      </Card>
    </>
  );
}
