import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/domains/content";
import {
  AboutCard,
  ImpactStat,
  TimelineItem,
  TeamMember,
  FutureGoal,
  AboutUsSectionVisibility,
} from "@/shared/types";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";

export const useAboutUsManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("cards");
  const [editingCard, setEditingCard] = useState<AboutCard | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingStat, setEditingStat] = useState<ImpactStat | null>(null);
  const [statDialogOpen, setStatDialogOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<TimelineItem | null>(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(null);
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

  const { data: aboutContent, isLoading } = useQuery({
    queryKey: ["aboutUs"],
    queryFn: () => aboutService.getAll(),
  });

  useEffect(() => {
    if (aboutContent?.footerDescription) {
      setFooterDescription(aboutContent.footerDescription);
      setFooterDescriptionI18n(aboutContent.footerDescriptionI18n || {});
    }
  }, [aboutContent]);

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteCard") });
      setDeleteItem(null);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.deleteCardError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTimeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTimeline") });
      setDeleteItem(null);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.deleteTimelineError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteTeamMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTeam") });
      setDeleteItem(null);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.deleteTeamError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteStatMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteStat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteStat") });
      setDeleteItem(null);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.deleteStatError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => aboutService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteGoal") });
      setDeleteItem(null);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.deleteGoalError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const updateFooterMutation = useMutation({
    mutationFn: (data: { description: string; i18n: Record<string, string> }) => 
      aboutService.updateSettings({ footer_description: data.description, footer_description_i18n: data.i18n }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.updateFooter") });
      setEditingFooter(false);
    },
    onError: (error) => toast({ title: t("admin.about.toasts.updateFooterError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: Partial<AboutUsSectionVisibility>) => {
      const defaultVisibility: AboutUsSectionVisibility = {
        missionVision: true, impactStats: true, ourStory: true, team: true, futureGoals: true, callToAction: true,
      };
      const currentVisibility = aboutContent?.sectionVisibility || defaultVisibility;
      return aboutService.updateSettings({ section_visibility: { ...currentVisibility, ...visibility } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.updateVisibility") });
    },
    onError: (error) => toast({ title: t("admin.about.toasts.updateVisibilityError"), description: getErrorMessage(error), variant: "destructive" }),
  });

  const handleDelete = () => {
    if (!deleteItem) return;
    const actions: Record<string, (id: string) => void> = {
      card: deleteCardMutation.mutate,
      stat: deleteStatMutation.mutate,
      timeline: deleteTimelineMutation.mutate,
      team: deleteTeamMemberMutation.mutate,
      goal: deleteGoalMutation.mutate,
    };
    actions[deleteItem.type]?.(deleteItem.id);
  };

  const handleSaveFooter = () => {
    updateFooterMutation.mutate({ description: footerDescription, i18n: footerDescriptionI18n });
  };

  const handleVisibilityToggle = (section: keyof AboutUsSectionVisibility, value: boolean) => {
    updateVisibilityMutation.mutate({ [section]: value });
  };

  return {
    t,
    activeTab, setActiveTab,
    editingCard, setEditingCard,
    cardDialogOpen, setCardDialogOpen,
    editingStat, setEditingStat,
    statDialogOpen, setStatDialogOpen,
    editingTimeline, setEditingTimeline,
    timelineDialogOpen, setTimelineDialogOpen,
    editingTeamMember, setEditingTeamMember,
    teamDialogOpen, setTeamDialogOpen,
    editingGoal, setEditingGoal,
    goalDialogOpen, setGoalDialogOpen,
    editingFooter, setEditingFooter,
    footerDescription, setFooterDescription,
    footerDescriptionI18n, setFooterDescriptionI18n,
    deleteItem, setDeleteItem,
    aboutContent, isLoading,
    handleDelete,
    handleSaveFooter,
    handleVisibilityToggle,
  };
};
