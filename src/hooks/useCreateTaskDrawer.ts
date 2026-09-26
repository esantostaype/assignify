// src/hooks/useCreateTaskDrawer.ts
// Estado global (zustand) del drawer de Create Task: lo abre un trigger (sidebar,
// bottom nav) y lo consume el <CreateTaskDrawer/> del layout.
import { create } from 'zustand'

interface CreateTaskDrawerState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCreateTaskDrawer = create<CreateTaskDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
