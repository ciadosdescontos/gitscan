import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('gitscan_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gitscan_token');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  getGitHubAuthUrl: () => `${API_URL}/auth/github`,
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updatePreferences: (data: { defaultLlmProvider: string }) =>
    api.patch('/auth/preferences', data),
};

export const repositoryApi = {
  listGitHubRepos: (page = 1, perPage = 30) =>
    api.get(`/repositories/github?page=${page}&per_page=${perPage}`),
  listRepos: (page = 1, limit = 20) =>
    api.get(`/repositories?page=${page}&limit=${limit}`),
  addRepo: (data: { githubRepoId: string; autoScanEnabled?: boolean }) =>
    api.post('/repositories', data),
  getRepo: (id: string) => api.get(`/repositories/${id}`),
  updateRepo: (id: string, data: { autoScanEnabled?: boolean; scanOnPush?: boolean }) =>
    api.patch(`/repositories/${id}`, data),
  deleteRepo: (id: string) => api.delete(`/repositories/${id}`),
  getBranches: (id: string) => api.get(`/repositories/${id}/branches`),
};

export const scanApi = {
  createScan: (data: { repositoryId: string; branch?: string; scanType?: string }) =>
    api.post('/scans', data),
  listScans: (params?: { page?: number; limit?: number; status?: string; repositoryId?: string }) =>
    api.get('/scans', { params }),
  getScan: (id: string) => api.get(`/scans/${id}`),
  getScanProgress: (id: string) => api.get(`/scans/${id}/progress`),
  getScanVulnerabilities: (id: string, params?: { page?: number; limit?: number; severity?: string }) =>
    api.get(`/scans/${id}/vulnerabilities`, { params }),
  cancelScan: (id: string) => api.post(`/scans/${id}/cancel`),
  getStats: () => api.get('/scans/stats'),
};

export const vulnerabilityApi = {
  listVulnerabilities: (params?: { page?: number; limit?: number; severity?: string; status?: string; repositoryId?: string }) =>
    api.get('/vulnerabilities', { params }),
  getVulnerability: (id: string) => api.get(`/vulnerabilities/${id}`),
  updateVulnerability: (id: string, data: { status?: string; falsePositive?: boolean }) =>
    api.patch(`/vulnerabilities/${id}`, data),
  generateFix: (id: string, provider?: string, model?: string) =>
    api.post(`/vulnerabilities/${id}/fix`, { provider, model }),
  applyFix: (id: string, fixId: string) =>
    api.post(`/vulnerabilities/${id}/apply-fix`, { fixId }),
  getFixHistory: (id: string) => api.get(`/vulnerabilities/${id}/fixes`),
};

export const apiKeyApi = {
  listApiKeys: () => api.get('/api-keys'),
  saveApiKey: (provider: string, apiKey: string) =>
    api.post('/api-keys', { provider, apiKey }),
  deleteApiKey: (provider: string) => api.delete(`/api-keys/${provider}`),
  verifyApiKey: (provider: string) => api.get(`/api-keys/${provider}/verify`),
  getLlmSettings: () => api.get('/api-keys/settings'),
};
