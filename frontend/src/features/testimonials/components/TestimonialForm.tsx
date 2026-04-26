import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/domains/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { testimonialService } from "@/domains/content";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Star } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";

export function TestimonialForm() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [role, setRole] = useState("");
  const [content, setContent] = useState("");

  const createTestimonialMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      name: string;
      email?: string;
      role: string;
      content: string;
      rating: number;
      image?: string;
    }) => {
      return testimonialService.create(data);
    },
    onSuccess: () => {
      toast({
        title: t("common.thankYou"),
        description: t("testimonials.form.successDesc"),
      });
      // Reset form
      setRole("");
      setContent("");
      setRating(5);
      // Invalidate testimonials query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "testimonials.form.submitError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: t("auth.authRequired"),
        description: t("testimonials.form.loginRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!role.trim()) {
      toast({
        title: t("common.missingInfo"),
        description: t("testimonials.form.roleRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: t("common.missingInfo"),
        description: t("testimonials.form.contentRequired"),
        variant: "destructive",
      });
      return;
    }

    if (content.trim().length < 150) {
      toast({
        title: t("common.tooShort"),
        description: t("testimonials.form.minCharsError"),
        variant: "destructive",
      });
      return;
    }

    createTestimonialMutation.mutate({
      user_id: user.id,
      name: user.name || user.firstName || user.email.split("@")[0],
      email: user.email,
      role: role.trim(),
      content: content.trim(),
      rating,
      image: user.image || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{t("testimonials.form.title")}</CardTitle>
          <CardDescription>
            {t("testimonials.form.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            {t("testimonials.form.loginPrompt")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{t("testimonials.form.title")}</CardTitle>
        <CardDescription>
          {t("testimonials.form.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name (Read-only, from user profile) */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("profile.personalInfo.name")}</Label>
            <Input
              id="name"
              value={user?.name || user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">{t("testimonials.form.fromProfile")}</p>
          </div>

          {/* Role/Title */}
          <div className="space-y-2">
            <Label htmlFor="role">
              {t("testimonials.form.roleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role"
              placeholder={t("testimonials.form.rolePlaceholder")}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("testimonials.form.roleHelp")}
            </p>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label>
              {t("common.rating")} <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 rounded"
                >
                  <Star
                    className={`h-9 w-9 ${star <= (hoveredRating || rating)
                      ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                      : "text-[#D4AF37]/20"
                      }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {rating} {rating === 1 ? t("common.star") : t("common.stars")}
              </span>
            </div>
          </div>

          {/* Testimonial Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              {t("testimonials.form.contentLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder={t("testimonials.form.contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={500}
              required
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("testimonials.form.minChars")}</span>
              <span>{content.length}/500 {t("common.characters")}</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRole("");
                setContent("");
                setRating(5);
              }}
              disabled={createTestimonialMutation.isPending}
            >
              {t("common.clear")}
            </Button>
            <Button
              type="submit"
              disabled={createTestimonialMutation.isPending}
            >
              {createTestimonialMutation.isPending
                ? t("common.submitting")
                : t("testimonials.form.submitBtn")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
