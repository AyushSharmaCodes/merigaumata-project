import { DeleteConfirmDialog } from "@/features/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import AboutCardDialog from "../components/AboutCardDialog";
import { AboutCardsTab } from "../components/AboutCardsTab";
import { FooterTab } from "../components/FooterTab";
import FutureGoalDialog from "../components/FutureGoalDialog";
import { GoalsTab } from "../components/GoalsTab";
import ImpactStatDialog from "../components/ImpactStatDialog";
import { ImpactStatsTab } from "../components/ImpactStatsTab";
import { TeamTab } from "../components/TeamTab";
import TeamMemberDialog from "../components/TeamMemberDialog";
import TimelineItemDialog from "../components/TimelineItemDialog";
import { TimelineTab } from "../components/TimelineTab";
import { VisibilityTab } from "../components/VisibilityTab";
import { useAboutUsManagement } from "../hooks/useAboutUsManagement";

export function AboutUsManagementPage() {
  const {
    t,
    activeTab,
    setActiveTab,
    editingCard,
    setEditingCard,
    cardDialogOpen,
    setCardDialogOpen,
    editingStat,
    setEditingStat,
    statDialogOpen,
    setStatDialogOpen,
    editingTimeline,
    setEditingTimeline,
    timelineDialogOpen,
    setTimelineDialogOpen,
    editingTeamMember,
    setEditingTeamMember,
    teamDialogOpen,
    setTeamDialogOpen,
    editingGoal,
    setEditingGoal,
    goalDialogOpen,
    setGoalDialogOpen,
    editingFooter,
    setEditingFooter,
    footerDescription,
    setFooterDescription,
    footerDescriptionI18n,
    setFooterDescriptionI18n,
    deleteItem,
    setDeleteItem,
    aboutContent,
    isLoading,
    handleDelete,
    handleSaveFooter,
    handleVisibilityToggle,
  } = useAboutUsManagement();

  if (isLoading || !aboutContent) {
    return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;
  }

  const sectionVisibility = aboutContent.sectionVisibility || {
    missionVision: true,
    impactStats: true,
    ourStory: true,
    team: true,
    futureGoals: true,
    callToAction: true,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("admin.about.title")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="cards">{t("admin.about.tabs.cards")}</TabsTrigger>
          <TabsTrigger value="impact">{t("admin.about.tabs.impact")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("admin.about.tabs.timeline")}</TabsTrigger>
          <TabsTrigger value="team">{t("admin.about.tabs.team")}</TabsTrigger>
          <TabsTrigger value="goals">{t("admin.about.tabs.goals")}</TabsTrigger>
          <TabsTrigger value="visibility">{t("admin.about.tabs.visibility")}</TabsTrigger>
          <TabsTrigger value="footer">{t("admin.about.tabs.footer")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="pt-4">
          <AboutCardsTab
            cards={aboutContent.cards}
            onAdd={() => {
              setEditingCard(null);
              setCardDialogOpen(true);
            }}
            onEdit={(card) => {
              setEditingCard(card);
              setCardDialogOpen(true);
            }}
            onDelete={(card) => setDeleteItem({ id: card.id, type: "card", name: card.title })}
          />
        </TabsContent>

        <TabsContent value="impact" className="pt-4">
          <ImpactStatsTab
            stats={aboutContent.impactStats}
            onAdd={() => {
              setEditingStat(null);
              setStatDialogOpen(true);
            }}
            onEdit={(stat) => {
              setEditingStat(stat);
              setStatDialogOpen(true);
            }}
            onDelete={(stat) => setDeleteItem({ id: stat.id, type: "stat", name: stat.label })}
          />
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <TimelineTab
            timeline={aboutContent.timeline}
            onAdd={() => {
              setEditingTimeline(null);
              setTimelineDialogOpen(true);
            }}
            onEdit={(item) => {
              setEditingTimeline(item);
              setTimelineDialogOpen(true);
            }}
            onDelete={(item) => setDeleteItem({ id: item.id, type: "timeline", name: item.title })}
          />
        </TabsContent>

        <TabsContent value="team" className="pt-4">
          <TeamTab
            members={aboutContent.teamMembers}
            onAdd={() => {
              setEditingTeamMember(null);
              setTeamDialogOpen(true);
            }}
            onEdit={(member) => {
              setEditingTeamMember(member);
              setTeamDialogOpen(true);
            }}
            onDelete={(member) => setDeleteItem({ id: member.id, type: "team", name: member.name })}
          />
        </TabsContent>

        <TabsContent value="goals" className="pt-4">
          <GoalsTab
            goals={aboutContent.futureGoals}
            onAdd={() => {
              setEditingGoal(null);
              setGoalDialogOpen(true);
            }}
            onEdit={(goal) => {
              setEditingGoal(goal);
              setGoalDialogOpen(true);
            }}
            onDelete={(goal) => setDeleteItem({ id: goal.id, type: "goal", name: goal.title })}
          />
        </TabsContent>

        <TabsContent value="visibility" className="pt-4">
          <VisibilityTab visibility={sectionVisibility} onToggle={handleVisibilityToggle} />
        </TabsContent>

        <TabsContent value="footer" className="pt-4">
          <FooterTab
            footerDescription={footerDescription}
            footerDescriptionI18n={footerDescriptionI18n}
            isEditing={editingFooter}
            onEdit={() => setEditingFooter(true)}
            onCancel={() => setEditingFooter(false)}
            onSave={handleSaveFooter}
            onDescriptionChange={setFooterDescription}
            onI18nChange={setFooterDescriptionI18n}
          />
        </TabsContent>
      </Tabs>

      <AboutCardDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} card={editingCard} />
      <ImpactStatDialog open={statDialogOpen} onOpenChange={setStatDialogOpen} stat={editingStat} />
      <TimelineItemDialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen} timelineItem={editingTimeline} />
      <TeamMemberDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} teamMember={editingTeamMember} />
      <FutureGoalDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen} futureGoal={editingGoal} />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title={t("common.deleteConfirm")}
        description={t("common.deleteConfirmDesc", { name: deleteItem?.name })}
      />
    </div>
  );
}
