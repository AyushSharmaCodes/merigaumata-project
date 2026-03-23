import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';

const GUEST_ID_KEY = 'guest_id';

export const getGuestId = (): string => {
    // Check cookie first (source of truth for backend)
    let guestId = Cookies.get(GUEST_ID_KEY);

    // Fallback to localStorage
    if (!guestId) {
        guestId = localStorage.getItem(GUEST_ID_KEY) || undefined;
    }

    // Generate new if missing
    if (!guestId) {
        guestId = uuidv4();
        setGuestId(guestId);
    }

    // Ensure consistency
    if (!Cookies.get(GUEST_ID_KEY)) {
        Cookies.set(GUEST_ID_KEY, guestId, { expires: 30 }); // 30 days
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
