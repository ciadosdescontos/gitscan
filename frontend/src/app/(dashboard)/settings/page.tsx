'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Key, Shield, Bell, Save, Eye, EyeOff, Sparkles, Cpu, Zap, Brain, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LlmProvider } from '@/types';
import * as Tabs from '@radix-ui/react-tabs';
import { apiKeyApi } from '@/lib/api';

// Modelos atualizados (Janeiro 2025)
const llmModels = {
  OPENAI: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Mais capaz, multimodal', tag: 'Recomendado' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico', tag: 'Econômico' },
    { id: 'o1-preview', name: 'o1 Preview', description: 'Raciocínio avançado', tag: 'Novo' },
    { id: 'o1-mini', name: 'o1 Mini', description: 'Raciocínio rápido', tag: 'Novo' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alta performance', tag: '' },
  ],
  ANTHROPIC: [
    { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5', description: 'Último modelo, mais inteligente', tag: 'Mais Recente' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Equilíbrio ideal', tag: 'Recomendado' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Ultra rápido', tag: 'Econômico' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Máxima capacidade', tag: 'Premium' },
  ],
  GOOGLE: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Última geração, multimodal', tag: 'Mais Recente' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Contexto de 1M tokens', tag: 'Recomendado' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Rápido e eficiente', tag: 'Econômico' },
  ],
};

const llmProviders: { value: LlmProvider; name: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'OPENAI',
    name: 'OpenAI',
    description: 'GPT-4o, o1 e modelos avançados',
    icon: <Sparkles className="h-5 w-5" />,
    color: 'from-green-500 to-emerald-600',
  },
  {
    value: 'ANTHROPIC',
    name: 'Anthropic',
    description: 'Claude Sonnet 4.5 e família Claude',
    icon: <Brain className="h-5 w-5" />,
    color: 'from-orange-500 to-amber-600',
  },
  {
    value: 'GOOGLE',
    name: 'Google AI',
    description: 'Gemini 2.0 e modelos Gemini',
    icon: <Zap className="h-5 w-5" />,
    color: 'from-blue-500 to-indigo-600',
  },
];

export default function SettingsPage() {
  const { user, updatePreferences, isAuthenticated } = useAuthStore();
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(
    user?.defaultLlmProvider || 'OPENAI'
  );
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    OPENAI: 'gpt-4o',
    ANTHROPIC: 'claude-sonnet-4-5-20250514',
    GOOGLE: 'gemini-2.0-flash',
  });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    OPENAI: '',
    ANTHROPIC: '',
    GOOGLE: '',
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    OPENAI: false,
    ANTHROPIC: false,
    GOOGLE: false,
  });
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    scanCompleted: true,
    criticalVulnerability: true,
    fixGenerated: true,
    prCreated: true,
  });

  // Fetch configured API keys from backend (only when authenticated)
  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const response = await apiKeyApi.listApiKeys();
      return response.data.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch LLM settings from backend (only when authenticated)
  const { data: llmSettings } = useQuery({
    queryKey: ['llmSettings'],
    queryFn: async () => {
      const response = await apiKeyApi.getLlmSettings();
      return response.data.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Update configured providers when data loads
  useEffect(() => {
    if (apiKeysData) {
      const providers = apiKeysData.map((k: any) => k.provider);
      setConfiguredProviders(providers);
    }
  }, [apiKeysData]);

  // Load saved models and notification preferences from localStorage on mount
  useEffect(() => {
    const savedModels = localStorage.getItem('gitscan_selected_models');
    if (savedModels) {
      try {
        setSelectedModels(JSON.parse(savedModels));
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    const savedProvider = localStorage.getItem('gitscan_default_provider');
    if (savedProvider && ['OPENAI', 'ANTHROPIC', 'GOOGLE'].includes(savedProvider)) {
      setSelectedProvider(savedProvider as LlmProvider);
    }
    const savedNotifications = localStorage.getItem('gitscan_notification_prefs');
    if (savedNotifications) {
      try {
        setNotificationPrefs(JSON.parse(savedNotifications));
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Sync with backend settings when available
  useEffect(() => {
    if (llmSettings?.defaultProvider) {
      setSelectedProvider(llmSettings.defaultProvider);
    }
    if (user?.defaultLlmProvider) {
      setSelectedProvider(user.defaultLlmProvider);
    }
  }, [llmSettings, user]);

  // Save all settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage first (always works)
      localStorage.setItem('gitscan_selected_models', JSON.stringify(selectedModels));
      localStorage.setItem('gitscan_default_provider', selectedProvider);

      // Try to save to backend if authenticated
      if (isAuthenticated) {
        await updatePreferences(selectedProvider);
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      // Still saved to localStorage, so partial success
      toast.success('Configurações salvas localmente!');
    } finally {
      setIsSaving(false);
    }
  };

  // Save API key to backend
  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const response = await apiKeyApi.saveApiKey(provider, apiKey);
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Chave ${variables.provider} salva com sucesso!`);
      setApiKeys((prev) => ({ ...prev, [variables.provider]: '' })); // Clear input
      refetchApiKeys();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao salvar chave de API');
    },
    onSettled: () => {
      setSavingKey(null);
    },
  });

  // Delete API key from backend
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiKeyApi.deleteApiKey(provider);
      return response.data;
    },
    onSuccess: (_, provider) => {
      toast.success(`Chave ${provider} removida`);
      refetchApiKeys();
    },
    onError: () => {
      toast.error('Erro ao remover chave de API');
    },
  });

  const handleSaveApiKey = (provider: string) => {
    if (apiKeys[provider] && apiKeys[provider].length >= 10) {
      setSavingKey(provider);
      saveApiKeyMutation.mutate({ provider, apiKey: apiKeys[provider] });
    } else {
      toast.error('Chave de API deve ter pelo menos 10 caracteres');
    }
  };

  const handleDeleteApiKey = (provider: string) => {
    if (confirm(`Tem certeza que deseja remover a chave ${provider}?`)) {
      deleteApiKeyMutation.mutate(provider);
    }
  };

  const isProviderConfigured = (provider: string) => configuredProviders.includes(provider);

  const handleModelChange = (provider: string, model: string) => {
    setSelectedModels((prev) => ({ ...prev, [provider]: model }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Configure provedores de IA, modelos e preferências
        </p>
      </div>

      <Tabs.Root defaultValue="llm" className="space-y-6">
        <Tabs.List className="flex gap-2 border-b">
          <Tabs.Trigger
            value="llm"
            className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Cpu className="h-4 w-4" />
            Provedores de IA
          </Tabs.Trigger>
          <Tabs.Trigger
            value="security"
            className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Shield className="h-4 w-4" />
            Segurança
          </Tabs.Trigger>
          <Tabs.Trigger
            value="notifications"
            className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Bell className="h-4 w-4" />
            Notificações
          </Tabs.Trigger>
        </Tabs.List>

        {/* LLM Providers Tab */}
        <Tabs.Content value="llm" className="space-y-6">
          {/* Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Provedor de IA Padrão
              </CardTitle>
              <CardDescription>
                Selecione o provedor principal para geração de correções de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {llmProviders.map((provider) => (
                  <button
                    key={provider.value}
                    onClick={() => setSelectedProvider(provider.value)}
                    className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all ${
                      selectedProvider === provider.value
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${provider.color} text-white`}>
                      {provider.icon}
                    </div>
                    <p className="font-semibold">{provider.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {provider.description}
                    </p>
                    {selectedProvider === provider.value && (
                      <Badge className="absolute right-2 top-2" variant="default">
                        Ativo
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Seleção de Modelos
              </CardTitle>
              <CardDescription>
                Configure o modelo específico para cada provedor (modelos atualizados Janeiro 2025)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {llmProviders.map((provider) => (
                <div key={provider.value} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br ${provider.color} text-white text-xs`}>
                      {provider.icon}
                    </div>
                    <label className="text-sm font-medium">{provider.name}</label>
                    {selectedProvider === provider.value && (
                      <Badge variant="outline" className="text-xs">Provedor Ativo</Badge>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {llmModels[provider.value].map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleModelChange(provider.value, model.id)}
                        className={`flex flex-col rounded-lg border p-3 text-left transition-all ${
                          selectedModels[provider.value] === model.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{model.name}</span>
                          {model.tag && (
                            <Badge
                              variant={model.tag === 'Mais Recente' || model.tag === 'Novo' ? 'default' : 'secondary'}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {model.tag}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{model.description}</span>
                        {selectedModels[provider.value] === model.id && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Selecionado
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Configure suas chaves de API para cada provedor. As chaves são armazenadas de forma segura no servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {llmProviders.map((provider) => (
                <div key={provider.value} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br ${provider.color} text-white text-xs`}>
                      {provider.icon}
                    </div>
                    <label className="text-sm font-medium">{provider.name}</label>
                    {isProviderConfigured(provider.value) && (
                      <Badge variant="success" className="text-xs flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Configurada
                      </Badge>
                    )}
                  </div>

                  {isProviderConfigured(provider.value) ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">••••••••••••</span>
                        <span className="text-xs text-muted-foreground">(chave configurada)</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteApiKey(provider.value)}
                          disabled={deleteApiKeyMutation.isPending}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKeys[provider.value] ? 'text' : 'password'}
                          value={apiKeys[provider.value]}
                          onChange={(e) =>
                            setApiKeys({ ...apiKeys, [provider.value]: e.target.value })
                          }
                          placeholder={`Cole sua chave ${provider.name} aqui`}
                          className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeys({
                              ...showKeys,
                              [provider.value]: !showKeys[provider.value],
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKeys[provider.value] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleSaveApiKey(provider.value)}
                        disabled={!apiKeys[provider.value] || savingKey === provider.value}
                      >
                        {savingKey === provider.value ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {provider.value === 'OPENAI' && (
                      <>
                        Obtenha sua chave em{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                      </>
                    )}
                    {provider.value === 'ANTHROPIC' && (
                      <>
                        Obtenha sua chave em{' '}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          console.anthropic.com
                        </a>
                      </>
                    )}
                    {provider.value === 'GOOGLE' && (
                      <>
                        Obtenha sua chave em{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          aistudio.google.com
                        </a>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* Security Tab */}
        <Tabs.Content value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
              <CardDescription>
                Gerencie as configurações de segurança da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Autenticação GitHub</p>
                  <p className="text-sm text-muted-foreground">
                    Conectado como @{user?.username || 'usuário'}
                  </p>
                </div>
                <Badge variant="success">Conectado</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Permissões do Repositório</p>
                  <p className="text-sm text-muted-foreground">
                    Acesso a repositórios públicos e privados
                  </p>
                </div>
                <Badge variant="secondary">Completo</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Armazenamento de Chaves</p>
                  <p className="text-sm text-muted-foreground">
                    Chaves de API criptografadas no servidor
                  </p>
                </div>
                <Badge variant="success">Criptografado</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Provedores Configurados</p>
                  <p className="text-sm text-muted-foreground">
                    {configuredProviders.length > 0
                      ? configuredProviders.join(', ')
                      : 'Nenhum provedor configurado'}
                  </p>
                </div>
                <Badge variant={configuredProviders.length > 0 ? 'success' : 'secondary'}>
                  {configuredProviders.length} ativo{configuredProviders.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* Notifications Tab */}
        <Tabs.Content value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Configure quando e como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: 'scanCompleted',
                  title: 'Scan Concluído',
                  description: 'Receber notificação quando um scan terminar',
                },
                {
                  key: 'criticalVulnerability',
                  title: 'Vulnerabilidade Crítica',
                  description: 'Alerta imediato para vulnerabilidades críticas encontradas',
                },
                {
                  key: 'fixGenerated',
                  title: 'Fix Gerado',
                  description: 'Notificar quando um fix for gerado pela IA',
                },
                {
                  key: 'prCreated',
                  title: 'Pull Request Criado',
                  description: 'Notificar quando um PR for criado automaticamente',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notificationPrefs[item.key as keyof typeof notificationPrefs]}
                      onChange={(e) => {
                        const newPrefs = {
                          ...notificationPrefs,
                          [item.key]: e.target.checked,
                        };
                        setNotificationPrefs(newPrefs);
                        localStorage.setItem('gitscan_notification_prefs', JSON.stringify(newPrefs));
                        toast.success(`Notificação "${item.title}" ${e.target.checked ? 'ativada' : 'desativada'}`);
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-ring after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              ))}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  As notificações aparecem como toast na interface. Em breve: notificações por email e webhook.
                </p>
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
