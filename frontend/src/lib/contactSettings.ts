import { ContactSettings } from "@/types/contact";

const CONTACT_SETTINGS_KEY = "admin_contact_settings";

const defaultContactSettings: ContactSettings = {
  socialMedia: [],
  phones: [
    {
      id: "1",
      number: "+91 1234567890",
      label: "Main Office",
      isPrimary: true,
    },
  ],
  emails: [
    {
      id: "1",
      email: "info@goshala.com",
      label: "General Inquiries",
      isPrimary: true,
    },
  ],
  address: "Goshala Address, City, State - PIN",
  newsletter: {
    senderName: "Goshala Newsletter",
    senderEmail: "newsletter@goshala.com",
    footerText: "",
  },
  bankDetails: [
    {
      id: "1",
      accountName: "Goshala Trust",
      accountNumber: "1234567890",
      ifscCode: "BANK0001234",
      bankName: "Bank Name",
      branchName: "Branch Name",
      upiId: "goshala@upi",
      type: "general",
    },
  ],
};

export const contactSettingsStorage = {
  get: (): ContactSettings => {
    const data = localStorage.getItem(CONTACT_SETTINGS_KEY);
    if (!data) {
      localStorage.setItem(
        CONTACT_SETTINGS_KEY,
        JSON.stringify(defaultContactSettings)
      );
      return defaultContactSettings;
    }
    return JSON.parse(data);
  },

  update: (settings: ContactSettings): void => {
    localStorage.setItem(CONTACT_SETTINGS_KEY, JSON.stringify(settings));
  },

  reset: (): ContactSettings => {
    localStorage.setItem(
      CONTACT_SETTINGS_KEY,
      JSON.stringify(defaultContactSettings)
    );
    return defaultContactSettings;
  },
};
