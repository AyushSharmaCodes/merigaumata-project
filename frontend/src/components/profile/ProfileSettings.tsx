import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { User, Mail, Phone, Edit, Trash2 } from "lucide-react";
import { AddressBook } from "./AddressBook";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { profileService } from "@/services/profile.service";

export function ProfileSettings() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [editingPersonalInfo, setEditingPersonalInfo] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    gender: user?.gender || "male",
  });

  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const handleSavePersonalInfo = async () => {
    try {
      await profileService.updateProfile({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        gender: personalInfo.gender as "male" | "female" | "other",
      });

      updateUser({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        gender: personalInfo.gender as "male" | "female" | "other",
        name: `${personalInfo.firstName} ${personalInfo.lastName}`,
      });
      setEditingPersonalInfo(false);
      toast({
        title: t("profile.updateSuccess"),
        description: t("profile.profileUpdated"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("errors.auth.failedUpdate"),
        variant: "destructive",
      });
    }
  };

  const handleSaveEmail = () => {
    updateUser({ email });
    setEditingEmail(false);
    toast({
      title: t("profile.updateSuccess"),
      description: t("profile.emailUpdateSuccess"),
    });
  };

  const handleSavePhone = () => {
    if (!phone || phone.trim() === "") {
      toast({
        title: t("common.error"),
        description: t("errors.auth.phoneRequired"),
        variant: "destructive",
      });
      return;
    }
    updateUser({ phone });
    setEditingPhone(false);
    toast({
      title: t("profile.updateSuccess"),
      description: t("profile.phoneUpdateSuccess"),
    });
  };

  const handleDeleteAccount = async () => {
    setDeleteDialogOpen(false);
    navigate("/account/delete");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("profile.accountSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Personal Information Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("profile.personalInfo.title")}</h3>
              <Button
                variant="link"
                size="sm"
                className="text-primary"
                onClick={() => setEditingPersonalInfo(!editingPersonalInfo)}
              >
                {t("common.edit")}
              </Button>
            </div>

            {editingPersonalInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder={t("profile.firstNamePlaceholder")}
                    value={personalInfo.firstName}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        firstName: e.target.value,
                      })
                    }
                    className="bg-muted"
                  />
                  <Input
                    placeholder={t("profile.lastNamePlaceholder")}
                    value={personalInfo.lastName}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        lastName: e.target.value,
                      })
                    }
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">{t("profile.gender")}</Label>
                  <RadioGroup
                    value={personalInfo.gender}
                    onValueChange={(value) =>
                      setPersonalInfo({ ...personalInfo, gender: value as "male" | "female" | "other" })
                    }
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="edit-male" />
                      <Label
                        htmlFor="edit-male"
                        className="font-normal cursor-pointer"
                      >
                        {t("profile.male")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="edit-female" />
                      <Label
                        htmlFor="edit-female"
                        className="font-normal cursor-pointer"
                      >
                        {t("profile.female")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSavePersonalInfo} size="sm">
                    {t("common.save")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPersonalInfo({
                        firstName: user?.firstName || "",
                        lastName: user?.lastName || "",
                        gender: user?.gender || "male",
                      });
                      setEditingPersonalInfo(false);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      {personalInfo.firstName || t("profile.firstName")}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      {personalInfo.lastName || t("profile.lastName")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{t("profile.gender")}</Label>
                  <RadioGroup
                    value={personalInfo.gender}
                    disabled
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="view-male" />
                      <Label htmlFor="view-male" className="font-normal">
                        {t("profile.male")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="view-female" />
                      <Label htmlFor="view-female" className="font-normal">
                        {t("profile.female")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("profile.email")}</h3>
              <Button
                variant="link"
                size="sm"
                className="text-primary"
                onClick={() => setEditingEmail(!editingEmail)}
              >
                {t("common.edit")}
              </Button>
            </div>

            {editingEmail ? (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder={t("profile.emailAddress")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted max-w-md"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveEmail} size="sm">
                    {t("common.save")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmail(user?.email || "");
                      setEditingEmail(false);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-md max-w-md">
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Phone Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("profile.phone")}</h3>
              <Button
                variant="link"
                size="sm"
                className="text-primary"
                onClick={() => setEditingPhone(!editingPhone)}
              >
                {t("common.edit")}
              </Button>
            </div>

            {editingPhone ? (
              <div className="space-y-4">
                <Input
                  type="tel"
                  placeholder={t("profile.mobileNumber")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-muted max-w-md"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSavePhone} size="sm">
                    {t("common.save")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPhone(user?.phone || "");
                      setEditingPhone(false);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-md max-w-md">
                <p className="text-sm text-muted-foreground">{phone}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address Book Section */}
      <div className="mt-6">
        <AddressBook />
      </div>

      {/* Danger Zone - Delete Account */}
      <Card className="mt-6 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t("profile.dangerZone")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">{t("profile.deleteConfirm")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("profile.deleteAccountDesc")}
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("profile.deleteConfirm")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteAccount}
        userEmail={user?.email || ""}
      />
    </>
  );
}
