import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import { SchedulerStatus } from "@/features/admin";

interface SchedulerSchedulesTableProps {
    schedStatus?: SchedulerStatus;
}

export const SchedulerSchedulesTable = ({ schedStatus }: SchedulerSchedulesTableProps) => {
    const { t } = useTranslation();
    const schedulerEnabled = schedStatus?.enabled !== false;
    const schedulerRunning = Boolean(schedStatus?.running);
    const scheduleBadgeLabel = schedulerEnabled && schedulerRunning
        ? t("admin.backgroundJobs.configuredSchedules.active")
        : t("admin.backgroundJobs.configuredSchedules.inactive");

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("admin.backgroundJobs.configuredSchedules.title")}</CardTitle>
                <CardDescription>{t("admin.backgroundJobs.configuredSchedules.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("admin.backgroundJobs.configuredSchedules.taskName")}</TableHead>
                            <TableHead>{t("admin.backgroundJobs.configuredSchedules.schedule")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schedStatus?.schedules && Object.entries(schedStatus.schedules).map(([key, value]) => (
                            <TableRow key={key}>
                                <TableCell className="font-medium font-mono">{key}</TableCell>
                                <TableCell className="font-mono text-xs">{value}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={schedulerEnabled && schedulerRunning
                                            ? "text-green-600 bg-green-50 border-green-200"
                                            : "text-amber-700 bg-amber-50 border-amber-200"}
                                    >
                                        {scheduleBadgeLabel}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
