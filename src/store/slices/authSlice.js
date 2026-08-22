import { createSlice } from "@reduxjs/toolkit";
import { GUEST_MODE_KEY } from "../../constants/agents";

function readToken() {
  try {
    const saved = localStorage.getItem("legal_assist_token");
    if (saved) return saved;
    if (localStorage.getItem(GUEST_MODE_KEY)) return "guest";
  } catch {
    /* ignore */
  }
  return "";
}

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: readToken(),
    user: null,
    guestMode: typeof window !== "undefined" && !!localStorage.getItem(GUEST_MODE_KEY),
    guestCount: 0,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    incrementGuestCount(state) {
      state.guestCount += 1;
    },
    loggedOut(state) {
      state.token = "";
      state.user = null;
      state.guestMode = false;
      state.guestCount = 0;
    },
    guestStarted(state) {
      state.guestMode = true;
      state.guestCount = 0;
      state.token = "guest";
      state.user = { name: "Guest", email: "guest@local", role: "guest", user_id: "guest" };
    },
    sessionStarted(state, action) {
      const data = action.payload || {};
      state.token = data.token || "";
      state.user = data.user || null;
      state.guestMode = false;
      state.guestCount = 0;
    },
  },
});

export const { setUser, incrementGuestCount, loggedOut, guestStarted, sessionStarted } = authSlice.actions;

export default authSlice.reducer;
