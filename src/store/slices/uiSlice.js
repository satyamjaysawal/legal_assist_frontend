import { createSlice } from "@reduxjs/toolkit";

export function readTheme() {
  try {
    const saved = localStorage.getItem("legal_assist_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem("legal_assist_sidebar") === "collapsed";
  } catch {
    return false;
  }
}

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    theme: readTheme(),
    view: "chat",
    showAgents: false,
    sidebarOpen: false,
    sidebarCollapsed: readSidebarCollapsed(),
    lawyerChatOpen: false,
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
    },
    setView(state, action) {
      state.view = action.payload;
    },
    toggleView(state, action) {
      state.view = state.view === action.payload ? "chat" : action.payload;
    },
    setShowAgents(state, action) {
      state.showAgents = action.payload;
    },
    toggleShowAgents(state) {
      state.showAgents = !state.showAgents;
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarOpen(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setLawyerChatOpen(state, action) {
      state.lawyerChatOpen = action.payload;
    },
    toggleLawyerChat(state) {
      state.lawyerChatOpen = !state.lawyerChatOpen;
    },
    resetUi(state) {
      state.view = "chat";
      state.showAgents = false;
      state.sidebarOpen = false;
      state.lawyerChatOpen = false;
    },
  },
});

export const {
  toggleTheme,
  setView,
  toggleView,
  setShowAgents,
  toggleShowAgents,
  setSidebarOpen,
  toggleSidebarOpen,
  toggleSidebarCollapsed,
  setLawyerChatOpen,
  toggleLawyerChat,
  resetUi,
} = uiSlice.actions;

export default uiSlice.reducer;
