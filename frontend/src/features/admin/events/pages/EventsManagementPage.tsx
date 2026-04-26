import { useEventsManagement, EventTable, EventDialog } from "@/features/admin/events";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Plus, Search, CalendarDays } from "lucide-react";
import { DeleteConfirmDialog } from "@/features/admin";
import { AdminTableSkeleton } from "@/shared/components/ui/page-skeletons";

export default function EventsManagement() {
  const {
    t,
    searchQuery, setSearchQuery,
    eventDialogOpen, setEventDialogOpen,
    deleteDialogOpen, setDeleteDialogOpen,
    selectedEvent, setSelectedEvent,
    events,
    isLoading,
    eventMutation,
    deleteMutation,
    cancelMutation,
  } = useEventsManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.events.title")}</h1>
          <p className="text-muted-foreground">{t("admin.events.subtitle")}</p>
        </div>
        <Button onClick={() => { setSelectedEvent(null); setEventDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.events.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{t("admin.events.listTitle")}</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="event-search"
                placeholder={t("admin.events.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <AdminTableSkeleton columns={6} /> :
           events.length === 0 ? <div className="text-center py-8 text-muted-foreground">{t("admin.events.empty")}</div> :
           <EventTable
             events={events}
             onEdit={(event) => { setSelectedEvent(event); setEventDialogOpen(true); }}
             onDelete={(event) => { setSelectedEvent(event); setDeleteDialogOpen(true); }}
             onCancel={(id) => cancelMutation.mutate(id)}
           />
          }
        </CardContent>
      </Card>

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onSave={(event) => eventMutation.mutate(event)}
        event={selectedEvent}
      />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => selectedEvent && deleteMutation.mutate(selectedEvent.id)}
        title={t("admin.events.delete.title")}
        description={t("admin.events.delete.description")}
      />
    </div>
  );
}
