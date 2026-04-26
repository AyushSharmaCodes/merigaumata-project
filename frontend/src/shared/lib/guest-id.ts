import Cookies from "js-cookie";
import { v4 as uuidv4 } from "uuid";

const GUEST_ID_KEY = "guest_id";

export const getGuestId = (): string => {
  let guestId = Cookies.get(GUEST_ID_KEY);

  if (!guestId) {
    guestId = localStorage.getItem(GUEST_ID_KEY) || undefined;
  }

  if (!guestId) {
    guestId = uuidv4();
    setGuestId(guestId);
  }

  if (!Cookies.get(GUEST_ID_KEY)) {
    Cookies.set(GUEST_ID_KEY, guestId, { expires: 30 });
  }

  if (!localStorage.getItem(GUEST_ID_KEY)) {
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  return guestId;
};

export const setGuestId = (id: string) => {
  Cookies.set(GUEST_ID_KEY, id, { expires: 30 });
  localStorage.setItem(GUEST_ID_KEY, id);
};

export const clearGuestId = () => {
  Cookies.remove(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_ID_KEY);
};
