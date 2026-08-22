import { createSlice } from "@reduxjs/toolkit";

const catalogSlice = createSlice({
  name: "catalog",
  initialState: {
    model: "",
    stores: null,
    agents: [],
    connectors: [],
  },
  reducers: {
    setHealth(state, action) {
      const data = action.payload || {};
      if (data.model) state.model = data.model;
      if (data.memory) state.stores = data.memory;
      if (data.agents) state.agents = data.agents;
      if (data.connectors) state.connectors = data.connectors;
    },
    setModel(state, action) {
      state.model = action.payload || "";
    },
  },
});

export const { setHealth, setModel } = catalogSlice.actions;

export default catalogSlice.reducer;
