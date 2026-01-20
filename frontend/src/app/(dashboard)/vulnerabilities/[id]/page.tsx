'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AlertTriangle,
  FileCode,
  Sparkles,
  Copy,
  Check,
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { vulnerabilityApi, llmApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Vulnerability, Fix, LlmProvider, LlmModel, LlmProviderConfig } from '@/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as Select from '@radix-ui/react-select';
import * as Tabs from '@radix-ui/react-tabs';

export default function VulnerabilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vulnId = params.id as string;

  const { user } = useAuthStore();
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(
    user?.defaultLlmProvider || 'OPENAI'
  );
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFix, setSelectedFix] = useState<Fix | null>(null);

  // Fetch LLM providers and models
  const { data: providersData } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: async () => {
      const response = await llmApi.getProviders();
      return response.data.data as Record<string, LlmProviderConfig>;
    },
  });

  // Update selected model when provider changes
  useEffect(() => {
    if (providersData && selectedProvider) {
      const provider = providersData[selectedProvider];
      if (provider) {
        const defaultModel = provider.models.find((m) => m.is_default);
        setSelectedModel(defaultModel?.id || provider.models[0]?.id || '');
      }
    }
  }, [selectedProvider, providersData]);

  // Fetch vulnerability details
  const { data: vulnerability, isLoading } = useQuery({
    queryKey: ['vulnerability', vulnId],
    queryFn: async () => {
      const response = await vulnerabilityApi.getVulnerability(vulnId);
      return response.data.data as Vulnerability;
    },
  });

  // Generate fix mutation
  const generateFixMutation = useMutation({
    mutationFn: () => vulnerabilityApi.generateFix(vulnId, selectedProvider, selectedModel),
    onSuccess: () => {
      toast.success('Fix gerado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vulnerability', vulnId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Erro ao gerar fix');
    },
  });

  // Apply fix mutation
  const applyFixMutation = useMutation({
    mutationFn: (fixId: string) => vulnerabilityApi.applyFix(vulnId, fixId),
    onSuccess: (response) => {
      const data = response.data.data;
      if (data?.pullRequest?.url) {
        toast.success(
          <div>
            <p>Pull Request #{data.pullRequest.number} criado!</p>
            <a
              href={data.pullRequest.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Ver no GitHub
            </a>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.success('Fix aplicado com sucesso!');
      }
      queryClient.invalidateQueries({ queryKey: ['vulnerability', vulnId] });
      queryClient.invalidateQueries({ queryKey: ['fixes', vulnId] });
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message;

      if (status === 401) {
        toast.error('Token do GitHub expirado. Por favor, faça login novamente.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else if (status === 403) {
        toast.error('Permissões insuficientes. Seu token precisa de acesso "repo" para criar PRs.', {
          duration: 6000,
        });
      } else {
        toast.error(message || 'Erro ao aplicar fix');
      }
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => vulnerabilityApi.updateVulnerability(vulnId, { status }),
    onSuccess: () => {
      toast.success('Status atualizado!');
      queryClient.invalidateQueries({ queryKey: ['vulnerability', vulnId] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Código copiado!');
  };

  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      java: 'java',
      go: 'go',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
    };
    return langMap[ext || ''] || 'javascript';
  };

  // Get current provider config
  const currentProvider = providersData?.[selectedProvider];
  const currentModels = currentProvider?.models || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin border-4 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!vulnerability) {
    return (
      <div className="text-center py-12">
        <p>Vulnerabilidade não encontrada</p>
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
      </div>
    );
  }

  const language = getLanguage(vulnerability.filePath);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black uppercase tracking-tight">{vulnerability.title}</h1>
              <Badge variant={vulnerability.severity.toLowerCase() as any}>
                {vulnerability.severity}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              {vulnerability.filePath}:{vulnerability.startLine}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex gap-2">
          <Select.Root
            value={vulnerability.status}
            onValueChange={(value) => updateStatusMutation.mutate(value)}
          >
            <Select.Trigger className="flex h-10 items-center gap-2 border-2 border-foreground bg-background px-4 text-sm font-bold uppercase">
              <Select.Value />
              <ChevronDown className="h-4 w-4" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="border-2 border-foreground bg-card p-1 shadow-brutal">
                <Select.Viewport>
                  {['OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'FALSE_POSITIVE'].map(
                    (status) => (
                      <Select.Item
                        key={status}
                        value={status}
                        className="cursor-pointer px-4 py-2 text-sm font-bold uppercase hover:bg-foreground hover:text-background focus:outline-none focus:bg-foreground focus:text-background"
                      >
                        <Select.ItemText>{status.replace('_', ' ')}</Select.ItemText>
                      </Select.Item>
                    )
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vulnerability Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>DETALHES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-bold uppercase text-muted-foreground">Descrição</p>
                <p className="mt-1">{vulnerability.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold uppercase text-muted-foreground">Categoria</p>
                  <Badge variant="outline" className="mt-1">
                    {vulnerability.category}
                  </Badge>
                </div>
                {vulnerability.cweId && (
                  <div>
                    <p className="text-sm font-bold uppercase text-muted-foreground">CWE</p>
                    <a
                      href={`https://cwe.mitre.org/data/definitions/${vulnerability.cweId.replace(
                        'CWE-',
                        ''
                      )}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-foreground font-bold hover:underline"
                    >
                      {vulnerability.cweId}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-bold uppercase text-muted-foreground">Localização</p>
                <p className="mt-1 font-mono text-sm bg-foreground text-background px-2 py-1 inline-block">
                  {vulnerability.filePath}:{vulnerability.startLine}-{vulnerability.endLine}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Code Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>CÓDIGO VULNERÁVEL</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(vulnerability.codeSnippet || '')}
              >
                {copiedCode ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                COPIAR
              </Button>
            </CardHeader>
            <CardContent>
              {vulnerability.codeSnippet ? (
                <div className="code-block overflow-hidden border-2 border-foreground">
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    showLineNumbers
                    startingLineNumber={Math.max(1, vulnerability.startLine - 2)}
                    wrapLines
                    lineProps={(lineNumber) => {
                      const isVulnerable =
                        lineNumber >= vulnerability.startLine &&
                        lineNumber <= vulnerability.endLine;
                      return {
                        style: {
                          backgroundColor: isVulnerable
                            ? 'rgba(239, 68, 68, 0.3)'
                            : undefined,
                          display: 'block',
                        },
                      };
                    }}
                  >
                    {vulnerability.codeSnippet}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <p className="text-muted-foreground">Código não disponível</p>
              )}
            </CardContent>
          </Card>

          {/* Fixes Card */}
          {vulnerability.fixes && vulnerability.fixes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>FIXES GERADOS</CardTitle>
                <CardDescription>
                  Correções sugeridas pela IA para esta vulnerabilidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs.Root
                  defaultValue={vulnerability.fixes[0]?.id}
                  onValueChange={(value) => {
                    const fix = vulnerability.fixes?.find((f) => f.id === value);
                    setSelectedFix(fix || null);
                  }}
                >
                  <Tabs.List className="mb-4 flex gap-2 border-b-2 border-foreground">
                    {vulnerability.fixes.map((fix, index) => (
                      <Tabs.Trigger
                        key={fix.id}
                        value={fix.id}
                        className="border-b-4 border-transparent px-4 py-2 text-sm font-bold uppercase data-[state=active]:border-foreground"
                      >
                        Fix #{index + 1} ({fix.llmProvider})
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>

                  {vulnerability.fixes.map((fix) => (
                    <Tabs.Content key={fix.id} value={fix.id} className="space-y-4">
                      {/* Fix Info */}
                      <div className="flex items-center justify-between border-2 border-foreground p-4">
                        <div>
                          <p className="text-sm font-bold uppercase">
                            {fix.llmProvider} • {fix.llmModel}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatDate(fix.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              fix.status === 'APPLIED'
                                ? 'success'
                                : fix.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {fix.status}
                          </Badge>
                          {fix.prUrl && (
                            <a href={fix.prUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm">
                                <GitPullRequest className="mr-2 h-4 w-4" />
                                PR #{fix.prNumber}
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Explanation */}
                      {fix.explanation && (
                        <div>
                          <p className="mb-2 text-sm font-bold uppercase">Explicação</p>
                          <p className="border-l-4 border-foreground bg-secondary p-4 text-sm">
                            {fix.explanation}
                          </p>
                        </div>
                      )}

                      {/* Fixed Code */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-bold uppercase">Código Corrigido</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(fix.fixedCode)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            COPIAR
                          </Button>
                        </div>
                        <div className="code-block overflow-hidden border-2 border-foreground">
                          <SyntaxHighlighter
                            language={language}
                            style={vscDarkPlus}
                            showLineNumbers
                          >
                            {fix.fixedCode}
                          </SyntaxHighlighter>
                        </div>
                      </div>

                      {/* Apply Fix Button */}
                      {fix.status === 'PENDING' && (
                        <Button
                          className="w-full"
                          onClick={() => applyFixMutation.mutate(fix.id)}
                          isLoading={applyFixMutation.isPending}
                        >
                          <GitPullRequest className="mr-2 h-4 w-4" />
                          CRIAR PULL REQUEST
                        </Button>
                      )}
                    </Tabs.Content>
                  ))}
                </Tabs.Root>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Generate Fix Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                GERAR FIX COM IA
              </CardTitle>
              <CardDescription>
                Use inteligência artificial para gerar uma correção automática
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="mb-2 block text-sm font-bold uppercase">
                  Provedor de IA
                </label>
                <div className="space-y-2">
                  {providersData && Object.entries(providersData).map(([key, provider]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedProvider(key as LlmProvider)}
                      className={`flex w-full items-center justify-between border-2 p-3 text-left transition-all duration-150 ${
                        selectedProvider === key
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-foreground hover:bg-secondary'
                      }`}
                    >
                      <div>
                        <p className="font-bold uppercase text-sm">{provider.display_name}</p>
                        <p className="text-xs opacity-70">
                          {provider.models.length} modelos disponíveis
                        </p>
                      </div>
                      {selectedProvider === key && (
                        <Check className="h-5 w-5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              {currentModels.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-bold uppercase">
                    Modelo
                  </label>
                  <Select.Root value={selectedModel} onValueChange={setSelectedModel}>
                    <Select.Trigger className="flex h-12 w-full items-center justify-between border-2 border-foreground bg-background px-4 text-sm font-bold">
                      <Select.Value placeholder="Selecione um modelo" />
                      <ChevronDown className="h-4 w-4" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="border-2 border-foreground bg-card shadow-brutal max-h-[300px] overflow-auto">
                        <Select.Viewport>
                          {currentModels.map((model) => (
                            <Select.Item
                              key={model.id}
                              value={model.id}
                              className="cursor-pointer px-4 py-3 hover:bg-foreground hover:text-background focus:outline-none focus:bg-foreground focus:text-background"
                            >
                              <Select.ItemText>
                                <div>
                                  <p className="font-bold text-sm">{model.name}</p>
                                  <p className="text-xs opacity-70">{model.description}</p>
                                </div>
                              </Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>

                  {/* Model Info */}
                  {selectedModel && (
                    <div className="mt-2 text-xs text-muted-foreground border-l-2 border-foreground pl-2">
                      {currentModels.find(m => m.id === selectedModel)?.description}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => generateFixMutation.mutate()}
                isLoading={generateFixMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                GERAR FIX
              </Button>

              {vulnerability.suggestedFix && (
                <div className="border-2 border-foreground p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                    Sugestão Inicial
                  </p>
                  <p className="text-sm">{vulnerability.suggestedFix}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>INFORMAÇÕES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-foreground/20 pb-2">
                <span className="text-muted-foreground font-bold uppercase text-xs">Repositório</span>
                <span className="font-bold">
                  {vulnerability.scan?.repository?.name}
                </span>
              </div>
              <div className="flex justify-between border-b border-foreground/20 pb-2">
                <span className="text-muted-foreground font-bold uppercase text-xs">Branch</span>
                <span className="font-mono">{vulnerability.scan?.branch}</span>
              </div>
              <div className="flex justify-between border-b border-foreground/20 pb-2">
                <span className="text-muted-foreground font-bold uppercase text-xs">Criado em</span>
                <span className="font-mono text-xs">
                  {formatDate(vulnerability.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-bold uppercase text-xs">Fixes gerados</span>
                <span className="font-bold">
                  {vulnerability.fixes?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
