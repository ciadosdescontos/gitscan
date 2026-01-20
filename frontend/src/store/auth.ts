import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LlmProvider } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  fetchUser: () => Promise<void>;
  updatePreferences: (provider: LlmProvider) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      setToken: (token: string) => {
        localStorage.setItem('gitscan_token', token);
        set({ token, isAuthenticated: true });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      fetchUser: async () => {
        try {
          set({ isLoading: true });
          const response = await authApi.getCurrentUser();
          if (response.data.success) {
            set({ user: response.data.data, isAuthenticated: true });
          }
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          localStorage.removeItem('gitscan_token');
        } finally {
          set({ isLoading: false });
        }
      },

      updatePreferences: async (provider: LlmProvider) => {
        try {
          const response = await authApi.updatePreferences({ defaultLlmProvider: provider });
          if (response.data.success) {
            const { user } = get();
            if (user) {
              set({ user: { ...user, defaultLlmProvider: provider } });
            }
          }
        } catch (error) {
          console.error('Failed to update preferences:', error);
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('gitscan_token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'gitscan-auth',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Sync token to gitscan_token key when Zustand rehydrates from localStorage
        if (state?.token) {
          localStorage.setItem('gitscan_token', state.token);
        }
      },
    }
  )
);
