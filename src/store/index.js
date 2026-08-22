import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import catalogReducer from "./slices/catalogSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    catalog: catalogReducer,
    ui: uiReducer,
  },
});
