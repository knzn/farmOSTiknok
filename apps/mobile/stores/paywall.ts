import { create } from 'zustand'

interface PaywallStore {
  visible: boolean
  reason: 'expired' | 'suspended' | null
  show: (reason: 'expired' | 'suspended') => void
  hide: () => void
}

export const usePaywallStore = create<PaywallStore>((set) => ({
  visible: false,
  reason: null,
  show: (reason) => set({ visible: true, reason }),
  hide: () => set({ visible: false, reason: null }),
}))
