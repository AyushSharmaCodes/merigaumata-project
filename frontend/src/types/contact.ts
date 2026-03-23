export interface SocialMediaLink {
  id: string;
  platform: string;
  url: string;
  icon?: string;
  order?: number;
}

export interface ContactPhone {
  id: string;
  number: string;
  label?: string;
  isPrimary?: boolean;
}

export interface ContactEmail {
  id: string;
  email: string;
  label?: string;
  isPrimary?: boolean;
}

export interface OfficeHours {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface NewsletterConfig {
  senderName: string;
  senderEmail: string;
  footerText?: string;
}

export interface BankDetails {
  id: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  upiId?: string;
  type: "general" | "donation";
}

export interface ContactSettings {
  socialMedia: SocialMediaLink[];
  phones: ContactPhone[];
  emails: ContactEmail[];
  address: string;
  newsletter: NewsletterConfig;
  bankDetails: BankDetails[];
}
