import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useTranslation } from "react-i18next";
import { AboutUsSectionVisibility } from "@/shared/types";

interface VisibilityTabProps {
  visibility: AboutUsSectionVisibility;
  onToggle: (section: keyof AboutUsSectionVisibility, value: boolean) => void;
}

export const VisibilityTab = ({ visibility, onToggle }: VisibilityTabProps) => {
  const { t } = useTranslation();

  const sections: { key: keyof AboutUsSectionVisibility; label: string; desc: string }[] = [
    { key: "missionVision", label: "admin.about.visibility.sections.mission.label", desc: "admin.about.visibility.sections.mission.desc" },
    { key: "impactStats", label: "admin.about.visibility.sections.impact.label", desc: "admin.about.visibility.sections.impact.desc" },
    { key: "ourStory", label: "admin.about.visibility.sections.story.label", desc: "admin.about.visibility.sections.story.desc" },
    { key: "team", label: "admin.about.visibility.sections.team.label", desc: "admin.about.visibility.sections.team.desc" },
    { key: "futureGoals", label: "admin.about.visibility.sections.goals.label", desc: "admin.about.visibility.sections.goals.desc" },
    { key: "callToAction", label: "admin.about.visibility.sections.cta.label", desc: "admin.about.visibility.sections.cta.desc" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.about.visibility.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("admin.about.visibility.desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.key} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="space-y-0.5 flex-1 pr-4">
                <Label className="text-base font-semibold cursor-pointer">{t(section.label)}</Label>
                <p className="text-sm text-muted-foreground">{t(section.desc)}</p>
              </div>
              <Switch
                checked={visibility[section.key]}
                onCheckedChange={(checked) => onToggle(section.key, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
