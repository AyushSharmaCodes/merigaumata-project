export type Role = "customer" | "admin" | "manager";

export interface Address {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  locality: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  landmark?: string;
  alternatePhone?: string;
  addressType: "home" | "work" | "other" | "shipping" | "billing" | "both";
  isDefault?: boolean;
  type?: "shipping" | "billing";
}

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  role: Role;
  addresses: Address[];
  createdBy?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  authProvider?: "LOCAL" | "GOOGLE";
  isActive?: boolean;
  isDeleted?: boolean;
  deletionStatus?: string;
  scheduledDeletionAt?: string;
  createdAt?: string;
  updatedAt?: string;
  mustChangePassword?: boolean;
  image?: string;
  language?: string;
  preferredCurrency?: string;
}

export interface CreateUserDto extends Partial<User> {
  password?: string;
}

export interface AuthSession {
    user: User | null;
    isAuthenticated: boolean;
    token?: string;
}
