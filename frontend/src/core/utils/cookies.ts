// Cookie utility functions for auth token management
import Cookies from "js-cookie";
import type { User } from "../../shared/types";

const AUTH_TOKEN_KEY = "auth_token";
const USER_DATA_KEY = "user_data";

const COOKIE_OPTIONS = {
  expires: 7, // 7 days
  secure: import.meta.env.PROD, // HTTPS only in production
  sameSite: "strict" as const,
};

// Set auth token in cookie
export const setAuthToken = (token: string) => {
  Cookies.set(AUTH_TOKEN_KEY, token, COOKIE_OPTIONS);
};

// Get auth token from cookie
export const getAuthToken = (): string | undefined => {
  return Cookies.get(AUTH_TOKEN_KEY);
};

// Remove auth token
export const removeAuthToken = () => {
  Cookies.remove(AUTH_TOKEN_KEY);
};

// Set user data
export const setUserData = (userData: User) => {
  Cookies.set(USER_DATA_KEY, JSON.stringify(userData), COOKIE_OPTIONS);
};

// Get user data
export const getUserData = (): User | null => {
  const data = Cookies.get(USER_DATA_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// Remove user data
export const removeUserData = () => {
  Cookies.remove(USER_DATA_KEY);
};

// Clear all auth cookies
export const clearAuth = () => {
  Cookies.remove(AUTH_TOKEN_KEY);
  Cookies.remove(USER_DATA_KEY);
};
