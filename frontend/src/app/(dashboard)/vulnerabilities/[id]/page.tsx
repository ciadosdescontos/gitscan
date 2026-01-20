'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { vulnerabilityApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Vulnerability, Fix, LlmProvider } from '@/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as Select from '@radix-ui/react-select';
import * as Tabs from '@radix-ui/react-tabs';

const providers: { value: LlmProvider; label: string; description: string }[] = [
  { value: 'OPENAI', label: 'OpenAI GPT-4', description: 'Modelo mais preciso para código' },
  { value: 'ANTHROPIC', label: 'Claude 3', description: 'Excelente para análise de contexto' },
  { value: 'GOOGLE', label: 'Gemini Pro', description: 'Rápido e eficiente' },
];

export default function VulnerabilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vulnId = params.id as string;

  const { user } = useAuthStore();
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(
    user?.defaultLlmProvider || 'OPENAI'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFix, setSelectedFix] = useState<Fix | null>(null);

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
    mutationFn: () => vulnerabilityApi.generateFix(vulnId, selectedProvider),
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
    onSuccess: () => {
      toast.success('Criando Pull Request...');
      queryClient.invalidateQueries({ queryKey: ['vulnerability', vulnId] });
    },
    onError: () => {
      toast.error('Erro ao aplicar fix');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
              <h1 className="text-2xl font-bold">{vulnerability.title}</h1>
              <Badge variant={vulnerability.severity.toLowerCase() as any}>
                {vulnerability.severity}
              </Badge>
            </div>
            <p className="text-muted-foreground">
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
            <Select.Trigger className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="rounded-md border bg-card p-1 shadow-lg">
                <Select.Viewport>
                  {['OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'FALSE_POSITIVE'].map(
                    (status) => (
                      <Select.Item
                        key={status}
                        value={status}
                        className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent"
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
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                <p className="mt-1">{vulnerability.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Categoria</p>
                  <Badge variant="outline" className="mt-1">
                    {vulnerability.category}
                  </Badge>
                </div>
                {vulnerability.cweId && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CWE</p>
                    <a
                      href={`https://cwe.mitre.org/data/definitions/${vulnerability.cweId.replace(
                        'CWE-',
                        ''
                      )}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-primary hover:underline"
                    >
                      {vulnerability.cweId}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Localização</p>
                <p className="mt-1 font-mono text-sm">
                  {vulnerability.filePath}:{vulnerability.startLine}-{vulnerability.endLine}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Code Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Código Vulnerável</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(vulnerability.codeSnippet || '')}
              >
                {copiedCode ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copiar
              </Button>
            </CardHeader>
            <CardContent>
              {vulnerability.codeSnippet ? (
                <div className="code-block overflow-hidden rounded-lg">
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
                            ? 'rgba(239, 68, 68, 0.2)'
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
                <CardTitle>Fixes Gerados</CardTitle>
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
                  <Tabs.List className="mb-4 flex gap-2 border-b">
                    {vulnerability.fixes.map((fix, index) => (
                      <Tabs.Trigger
                        key={fix.id}
                        value={fix.id}
                        className="border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary"
                      >
                        Fix #{index + 1} ({fix.llmProvider})
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>

                  {vulnerability.fixes.map((fix) => (
                    <Tabs.Content key={fix.id} value={fix.id} className="space-y-4">
                      {/* Fix Info */}
                      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                        <div>
                          <p className="text-sm font-medium">
                            Gerado por: {fix.llmProvider} ({fix.llmModel})
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                          <p className="mb-2 text-sm font-medium">Explicação</p>
                          <p className="rounded-lg bg-muted p-3 text-sm">
                            {fix.explanation}
                          </p>
                        </div>
                      )}

                      {/* Fixed Code */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">Código Corrigido</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(fix.fixedCode)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar
                          </Button>
                        </div>
                        <div className="code-block overflow-hidden rounded-lg">
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
                          Criar Pull Request com este Fix
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
                Gerar Fix com IA
              </CardTitle>
              <CardDescription>
                Use inteligência artificial para gerar uma correção automática
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Provedor de IA
                </label>
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => setSelectedProvider(provider.value)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        selectedProvider === provider.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{provider.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                      {selectedProvider === provider.value && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => generateFixMutation.mutate()}
                isLoading={generateFixMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Fix
              </Button>

              {vulnerability.suggestedFix && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
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
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repositório</span>
                <span className="font-medium">
                  {vulnerability.scan?.repository?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span className="font-medium">{vulnerability.scan?.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span className="font-medium">
                  {formatDate(vulnerability.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fixes gerados</span>
                <span className="font-medium">
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
