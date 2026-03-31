import { create } from 'zustand'

interface ToastState {
  message: string | null
  show: (msg: string) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (msg) => set({ message: msg }),
  hide: () => set({ message: null }),
}))
