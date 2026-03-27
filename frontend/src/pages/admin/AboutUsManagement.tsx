import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import {
  AboutCard,
  ImpactStat,
  TimelineItem,
  TeamMember,
  FutureGoal,
  AboutUsSectionVisibility,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { I18nInput } from "@/components/admin/I18nInput";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import AboutCardDialog from "@/components/admin/AboutCardDialog";
import ImpactStatDialog from "@/components/admin/ImpactStatDialog";
import TimelineItemDialog from "@/components/admin/TimelineItemDialog";
import TeamMemberDialog from "@/components/admin/TeamMemberDialog";
import FutureGoalDialog from "@/components/admin/FutureGoalDialog";

export default function AboutUsManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("cards");
  const [editingCard, setEditingCard] = useState<AboutCard | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingStat, setEditingStat] = useState<ImpactStat | null>(null);
  const [statDialogOpen, setStatDialogOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<TimelineItem | null>(
    null
  );
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(
    null
  );
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FutureGoal | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingFooter, setEditingFooter] = useState(false);
  const [footerDescription, setFooterDescription] = useState("");
  const [footerDescriptionI18n, setFooterDescriptionI18n] = useState<Record<string, string>>({});
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    type: string;
    name: string;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: aboutContent } = useQuery({
    queryKey: ["aboutUs"],
    queryFn: () => aboutService.getAll(),
  });

  // Delete mutations
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteCard") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteCardError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteCardError"),
        variant: "destructive",
      });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTimeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTimeline") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteTimelineError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteTimelineError"),
        variant: "destructive",
      });
    },
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTeamMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTeam") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteTeamError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteTeamError"),
        variant: "destructive"
      });
    },
  });

  const deleteStatMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteStat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteStat") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteStatError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteStatError"),
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteGoal") });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteGoalError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteGoalError"),
        variant: "destructive",
      });
    },
  });

  const updateFooterMutation = useMutation({
    mutationFn: (data: { description: string; i18n: Record<string, string> }) => {
      return aboutService.updateSettings({
        footer_description: data.description,
        footer_description_i18n: data.i18n
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.updateFooter") });
      setEditingFooter(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.updateFooterError"),
        description: getErrorMessage(error, t, "admin.about.toasts.updateFooterError"),
        variant: "destructive",
      });
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: Partial<AboutUsSectionVisibility>) => {
      const defaultVisibility: AboutUsSectionVisibility = {
        missionVision: true,
        impactStats: true,
        ourStory: true,
        team: true,
        futureGoals: true,
        callToAction: true,
      };
      const currentVisibility = aboutContent?.sectionVisibility || defaultVisibility;
      const newVisibility = { ...currentVisibility, ...visibility };
      return aboutService.updateSettings({ section_visibility: newVisibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.updateVisibility") });
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.updateVisibilityError"),
        description: getErrorMessage(error, t, "admin.about.toasts.updateVisibilityError"),
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (!deleteItem) return;

    switch (deleteItem.type) {
      case "card":
        deleteCardMutation.mutate(deleteItem.id);
        break;
      case "stat":
        deleteStatMutation.mutate(deleteItem.id);
        break;
      case "timeline":
        deleteTimelineMutation.mutate(deleteItem.id);
        break;
      case "team":
        deleteTeamMemberMutation.mutate(deleteItem.id);
        break;
      case "goal":
        deleteGoalMutation.mutate(deleteItem.id);
        break;
    }
  };

  const handleSaveFooter = () => {
    updateFooterMutation.mutate({
      description: footerDescription,
      i18n: footerDescriptionI18n
    });
  };

  const handleVisibilityToggle = (
    section: keyof AboutUsSectionVisibility,
    value: boolean
  ) => {
    updateVisibilityMutation.mutate({ [section]: value });
  };

  if (!aboutContent) {
    return <div>{t("common.loading")}</div>;
  }

  // Ensure sectionVisibility exists with defaults
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

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.cards.title")}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCard(null);
                    setCardDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.about.cards.add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.about.cards.table.title")}</TableHead>
                    <TableHead>{t("admin.about.cards.table.desc")}</TableHead>
                    <TableHead>{t("admin.about.cards.table.icon")}</TableHead>
                    <TableHead>{t("admin.about.cards.table.order")}</TableHead>
                    <TableHead className="text-right">{t("admin.categories.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.cards
                    .sort((a, b) => a.order - b.order)
                    .map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">
                          {card.title}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {card.description}
                        </TableCell>
                        <TableCell>{card.icon}</TableCell>
                        <TableCell>{card.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCard(card);
                                setCardDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: card.id,
                                  type: "card",
                                  name: card.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impact Stats Tab */}
        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.impact.title")}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingStat(null);
                    setStatDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.about.impact.add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.about.impact.table.value")}</TableHead>
                    <TableHead>{t("admin.about.impact.table.label")}</TableHead>
                    <TableHead>{t("admin.about.impact.table.icon")}</TableHead>
                    <TableHead>{t("admin.about.impact.table.order")}</TableHead>
                    <TableHead className="text-right">{t("admin.about.impact.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.impactStats
                    .sort((a, b) => a.order - b.order)
                    .map((stat) => (
                      <TableRow key={stat.id}>
                        <TableCell className="font-medium">
                          {stat.value}
                        </TableCell>
                        <TableCell>{stat.label}</TableCell>
                        <TableCell>{stat.icon}</TableCell>
                        <TableCell>{stat.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingStat(stat);
                                setStatDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: stat.id,
                                  type: "stat",
                                  name: stat.label,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.timeline.title")}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTimeline(null);
                    setTimelineDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.about.timeline.add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.about.timeline.table.date")}</TableHead>
                    <TableHead>{t("admin.about.timeline.table.title")}</TableHead>
                    <TableHead>{t("admin.about.timeline.table.desc")}</TableHead>
                    <TableHead>{t("admin.about.timeline.table.order")}</TableHead>
                    <TableHead className="text-right">{t("admin.about.timeline.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.timeline
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.month} {item.year}
                        </TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {item.description}
                        </TableCell>
                        <TableCell>{item.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTimeline(item);
                                setTimelineDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: item.id,
                                  type: "timeline",
                                  name: item.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.team.title")}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTeamMember(null);
                    setTeamDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.about.team.add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.about.team.table.image")}</TableHead>
                    <TableHead>{t("admin.about.team.table.name")}</TableHead>
                    <TableHead>{t("admin.about.team.table.role")}</TableHead>
                    <TableHead>{t("admin.about.team.table.bio")}</TableHead>
                    <TableHead>{t("admin.about.team.table.order")}</TableHead>
                    <TableHead className="text-right">{t("admin.about.team.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.teamMembers
                    .sort((a, b) => a.order - b.order)
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="relative group">
                            <img
                              src={member.image}
                              alt={member.name}
                              loading="lazy"
                              className="w-10 h-10 rounded-full object-cover border-2 border-border"
                            />
                            {/* Hover Preview */}
                            <div className="absolute left-0 top-12 z-50 hidden group-hover:block">
                              <div className="bg-popover border shadow-lg rounded-lg p-2">
                                <img
                                  src={member.image}
                                  alt={member.name}
                                  loading="lazy"
                                  className="w-32 h-32 rounded-lg object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {member.name}
                        </TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {member.bio}
                        </TableCell>
                        <TableCell>{member.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTeamMember(member);
                                setTeamDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: member.id,
                                  type: "team",
                                  name: member.name,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Future Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.goals.title")}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGoal(null);
                    setGoalDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.about.goals.add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.about.goals.table.title")}</TableHead>
                    <TableHead>{t("admin.about.goals.table.desc")}</TableHead>
                    <TableHead>{t("admin.about.goals.table.order")}</TableHead>
                    <TableHead className="text-right">{t("admin.about.goals.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aboutContent.futureGoals
                    .sort((a, b) => a.order - b.order)
                    .map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">
                          {goal.title}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {goal.description}
                        </TableCell>
                        <TableCell>{goal.order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingGoal(goal);
                                setGoalDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteItem({
                                  id: goal.id,
                                  type: "goal",
                                  name: goal.title,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section Visibility Tab */}
        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.about.visibility.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("admin.about.visibility.desc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.mission.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.mission.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-mission"
                    checked={sectionVisibility.missionVision}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("missionVision", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.impact.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.impact.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-impact"
                    checked={sectionVisibility.impactStats}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("impactStats", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.story.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.story.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-story"
                    checked={sectionVisibility.ourStory}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("ourStory", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.team.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.team.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-team"
                    checked={sectionVisibility.team}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("team", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.goals.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.goals.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-goals"
                    checked={sectionVisibility.futureGoals}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("futureGoals", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <Label className="text-base font-semibold cursor-pointer">
                      {t("admin.about.visibility.sections.cta.label")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.about.visibility.sections.cta.desc")}
                    </p>
                  </div>
                  <Switch
                    id="visibility-cta"
                    checked={sectionVisibility.callToAction}
                    onCheckedChange={(checked) =>
                      handleVisibilityToggle("callToAction", checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer Tab */}
        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("admin.about.footer.title")}</CardTitle>
                {!editingFooter && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setFooterDescription(aboutContent.footerDescription);
                      setFooterDescriptionI18n(aboutContent.footerDescription_i18n || {});
                      setEditingFooter(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("admin.about.footer.edit")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingFooter ? (
                <div className="space-y-4">
                  <I18nInput
                    label={t("admin.about.footer.label")}
                    type="textarea"
                    value={footerDescription}
                    i18nValue={footerDescriptionI18n}
                    onChange={(val: string, i18n: Record<string, string>) => {
                      setFooterDescription(val);
                      setFooterDescriptionI18n(i18n);
                    }}
                    rows={6}
                    placeholder={t("admin.about.footer.placeholder")}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveFooter}>{t("admin.about.footer.save")}</Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingFooter(false)}
                    >
                      {t("admin.about.footer.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {aboutContent.footerDescription}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title={t("admin.about.common.deleteItem")}
        description={t("admin.about.common.deleteConfirmDesc", { name: deleteItem?.name })}
      />

      <AboutCardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        card={editingCard}
      />

      <ImpactStatDialog
        open={statDialogOpen}
        onOpenChange={setStatDialogOpen}
        stat={editingStat}
      />

      <TimelineItemDialog
        open={timelineDialogOpen}
        onOpenChange={setTimelineDialogOpen}
        item={editingTimeline}
      />

      <TeamMemberDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        member={editingTeamMember}
      />

      <FutureGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
      />
    </div>
  );
}
