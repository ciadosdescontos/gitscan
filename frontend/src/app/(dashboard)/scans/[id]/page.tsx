'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scan,
  AlertTriangle,
  FileCode,
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  GitBranch,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Folder,
  Shield,
  Loader2,
  GitPullRequest,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scanApi, vulnerabilityApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatRelativeTime, getSeverityColor } from '@/lib/utils';
import Link from 'next/link';
import type { Scan as ScanType, Vulnerability, Severity } from '@/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

interface ScanProgress {
  scanId: string;
  status: 'PENDING' | 'CLONING' | 'SCANNING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
  step: string;
  progress: number;
  totalFiles: number;
  filesScanned: number;
  currentFile?: string;
  logs: string[];
}

const scanSteps = [
  { id: 'PENDING', label: 'Preparando', icon: Clock },
  { id: 'CLONING', label: 'Clonando Repositório', icon: GitBranch },
  { id: 'SCANNING', label: 'Analisando Código', icon: FileCode },
  { id: 'ANALYZING', label: 'Processando Resultados', icon: Shield },
  { id: 'COMPLETED', label: 'Concluído', icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  const index = scanSteps.findIndex(s => s.id === status);
  return index >= 0 ? index : 0;
}

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scanId = params.id as string;
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'ALL'>('ALL');
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [realTimeProgress, setRealTimeProgress] = useState<ScanProgress | null>(null);
  const [selectedFix, setSelectedFix] = useState<any>(null);
  const [loadingFix, setLoadingFix] = useState(false);

  // Fetch scan details
  const { data: scan, isLoading: loadingScan } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => {
      const response = await scanApi.getScan(scanId);
      return response.data.data as ScanType;
    },
    refetchInterval: (query) => {
      const data = query.state.data as ScanType | undefined;
      return data?.status === 'RUNNING' || data?.status === 'PENDING' ? 2000 : false;
    },
  });

  // Fetch scan progress with logs
  const { data: progressData } = useQuery({
    queryKey: ['scan-progress', scanId],
    queryFn: async () => {
      const response = await scanApi.getScanProgress(scanId);
      return response.data.data;
    },
    refetchInterval: () => {
      const status = scan?.status;
      return status === 'RUNNING' || status === 'PENDING' ? 1000 : false;
    },
    enabled: scan?.status === 'RUNNING' || scan?.status === 'PENDING',
  });

  // Update real-time progress when data changes
  useEffect(() => {
    if (progressData) {
      if (progressData.realTimeProgress) {
        setRealTimeProgress(progressData.realTimeProgress);
        // If progress shows completed but scan status hasn't updated, refetch scan
        if (progressData.realTimeProgress.status === 'COMPLETED' && scan?.status === 'RUNNING') {
          queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
        }
      }
      if (progressData.logs) {
        setLogs(progressData.logs);
      }
    }
  }, [progressData, scan?.status, scanId, queryClient]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // Fetch vulnerabilities
  const { data: vulnsData, isLoading: loadingVulns } = useQuery({
    queryKey: ['scan-vulnerabilities', scanId, selectedSeverity],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (selectedSeverity !== 'ALL') {
        params.severity = selectedSeverity;
      }
      const response = await scanApi.getScanVulnerabilities(scanId, params);
      return response.data;
    },
    enabled: !!scan && scan.status === 'COMPLETED',
  });

  const vulnerabilities = vulnsData?.data as Vulnerability[] || [];

  // Fetch fix history when vulnerability is selected
  useEffect(() => {
    if (selectedVuln?.id) {
      setLoadingFix(true);
      setSelectedFix(null);
      vulnerabilityApi.getFixHistory(selectedVuln.id)
        .then((response) => {
          const fixes = response.data.data;
          if (fixes && fixes.length > 0) {
            // Get the latest fix that has generated code
            const latestFix = fixes.find((f: any) => f.fixedCode && f.status !== 'FAILED');
            setSelectedFix(latestFix || null);
          }
        })
        .catch((error) => {
          console.error('Error fetching fixes:', error);
        })
        .finally(() => {
          setLoadingFix(false);
        });
    }
  }, [selectedVuln?.id]);

  // Generate fix mutation
  const generateFixMutation = useMutation({
    mutationFn: (vulnId: string) => vulnerabilityApi.generateFix(vulnId),
    onSuccess: (response) => {
      toast.success('Solicitação de fix enviada! Aguarde a geração...');
      queryClient.invalidateQueries({ queryKey: ['scan-vulnerabilities'] });
      // Poll for fix completion
      if (selectedVuln) {
        const pollFix = setInterval(async () => {
          try {
            const res = await vulnerabilityApi.getFixHistory(selectedVuln.id);
            const fixes = res.data.data;
            const latestFix = fixes?.[0];
            if (latestFix && latestFix.fixedCode && latestFix.status !== 'PENDING') {
              setSelectedFix(latestFix);
              clearInterval(pollFix);
              if (latestFix.status === 'APPLIED') {
                toast.success('Correção gerada com sucesso!');
              }
            }
          } catch (e) {
            clearInterval(pollFix);
          }
        }, 2000);
        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollFix), 120000);
      }
    },
    onError: () => {
      toast.error('Erro ao gerar fix');
    },
  });

  // Apply fix mutation
  const applyFixMutation = useMutation({
    mutationFn: ({ vulnId, fixId }: { vulnId: string; fixId: string }) =>
      vulnerabilityApi.applyFix(vulnId, fixId),
    onSuccess: (response) => {
      const data = response.data.data;
      toast.success('Correção aplicada! Pull Request criado com sucesso.');
      setSelectedFix((prev: any) => ({
        ...prev,
        status: 'APPLIED',
        prUrl: data.pullRequest?.url,
        prNumber: data.pullRequest?.number,
      }));
      queryClient.invalidateQueries({ queryKey: ['scan-vulnerabilities'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao aplicar correção';
      toast.error(message);
    },
  });

  // Cancel scan mutation
  const cancelScanMutation = useMutation({
    mutationFn: () => scanApi.cancelScan(scanId),
    onSuccess: () => {
      toast.success('Scan cancelado');
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
    },
  });

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    toast.success('Logs copiados!');
  };

  if (loadingScan) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-12">
        <p>Scan não encontrado</p>
        <Button variant="outline" onClick={() => router.push('/scans')}>
          Voltar aos Scans
        </Button>
      </div>
    );
  }

  const totalVulns =
    scan.criticalCount + scan.highCount + scan.mediumCount + scan.lowCount;

  const isRunning = scan.status === 'RUNNING' || scan.status === 'PENDING';
  const progressCompleted = realTimeProgress?.status === 'COMPLETED';
  const progressFailed = realTimeProgress?.status === 'FAILED';
  const currentStepIndex = realTimeProgress
    ? getStepIndex(realTimeProgress.status)
    : isRunning ? 0 : scanSteps.length - 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {scan.repository?.name || 'Scan'}
            </h1>
            <p className="text-muted-foreground">
              Branch: {scan.branch} • {formatDate(scan.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {scan.repository && (
            <a
              href={`https://github.com/${scan.repository.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver no GitHub
              </Button>
            </a>
          )}
          {isRunning && (
            <Button
              variant="destructive"
              onClick={() => cancelScanMutation.mutate()}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Status and Progress - Running State */}
      {isRunning && (
        <div className="space-y-4">
          {/* Steps Progress */}
          <Card className={progressCompleted ? 'border-green-500/20' : progressFailed ? 'border-destructive/20' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {progressCompleted ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-500">Scan Concluído</span>
                  </>
                ) : progressFailed ? (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-destructive">Scan Falhou</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Scan em Progresso
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {progressCompleted
                  ? `Análise concluída! ${realTimeProgress?.filesScanned || 0} arquivos analisados.`
                  : progressFailed
                  ? 'Ocorreu um erro durante a análise.'
                  : realTimeProgress?.step || 'Iniciando análise de segurança...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Progress Steps */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  {scanSteps.slice(0, -1).map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === currentStepIndex && !progressCompleted;
                    const isCompleted = index < currentStepIndex || progressCompleted;
                    const isFailed = progressFailed && index === currentStepIndex;

                    return (
                      <div key={step.id} className="flex flex-col items-center flex-1">
                        <div className="flex items-center w-full">
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                              isFailed
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : isCompleted
                                ? 'border-green-500 bg-green-500 text-white'
                                : isActive
                                ? 'border-primary bg-primary/10 text-primary animate-pulse'
                                : 'border-muted bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : isFailed ? (
                              <XCircle className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          {index < scanSteps.length - 2 && (
                            <div
                              className={`flex-1 h-1 mx-2 rounded ${
                                isCompleted ? 'bg-green-500' : 'bg-muted'
                              }`}
                            />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-xs text-center ${
                            isActive ? 'text-primary font-medium' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {realTimeProgress?.filesScanned || 0} de {realTimeProgress?.totalFiles || 0} arquivos
                  </span>
                  <span className="font-medium">{realTimeProgress?.progress || 0}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                    style={{ width: `${realTimeProgress?.progress || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs Section */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowLogs(!showLogs)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Logs do Scan
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLogs();
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {showLogs ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </div>
            </CardHeader>
            {showLogs && (
              <CardContent>
                <div className="bg-zinc-950 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">Aguardando logs...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className={`py-0.5 ${
                          log.includes('ERRO')
                            ? 'text-red-400'
                            : log.includes('Críticas') || log.includes('Altas')
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Summary Cards - Completed State */}
      {scan.status === 'COMPLETED' && (
        <>
          {/* Success Banner */}
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Scan Concluído com Sucesso</h3>
                <p className="text-sm text-muted-foreground">
                  {scan.filesScanned} arquivos analisados • {totalVulns} vulnerabilidades encontradas
                </p>
              </div>
              <Badge variant={totalVulns > 0 ? 'destructive' : 'success'} className="text-lg px-3 py-1">
                {totalVulns} vulnerabilidades
              </Badge>
            </CardContent>
          </Card>

          {/* Severity Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                selectedSeverity === 'ALL' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedSeverity('ALL')}
            >
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{totalVulns}</p>
              </CardContent>
            </Card>
            {[
              { severity: 'CRITICAL', count: scan.criticalCount, color: 'text-red-500' },
              { severity: 'HIGH', count: scan.highCount, color: 'text-orange-500' },
              { severity: 'MEDIUM', count: scan.mediumCount, color: 'text-yellow-500' },
              { severity: 'LOW', count: scan.lowCount, color: 'text-blue-500' },
            ].map(({ severity, count, color }) => (
              <Card
                key={severity}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedSeverity === severity ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedSeverity(severity as Severity)}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">{severity}</p>
                  <p className={`text-3xl font-bold ${color}`}>{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Vulnerabilities List */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* List */}
            <Card>
              <CardHeader>
                <CardTitle>Vulnerabilidades</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingVulns ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : vulnerabilities.length ? (
                  <div className="max-h-[600px] space-y-2 overflow-y-auto">
                    {vulnerabilities.map((vuln) => (
                      <button
                        key={vuln.id}
                        onClick={() => setSelectedVuln(vuln)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selectedVuln?.id === vuln.id
                            ? 'border-primary bg-primary/5'
                            : vuln.status === 'FIXED' || vuln.status === 'IN_PROGRESS'
                            ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Badge
                          variant={vuln.severity.toLowerCase() as any}
                          className="mt-0.5"
                        >
                          {vuln.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{vuln.title}</p>
                            {vuln.status === 'IN_PROGRESS' && (
                              <Badge variant="warning" className="text-xs">
                                <GitPullRequest className="mr-1 h-3 w-3" />
                                PR
                              </Badge>
                            )}
                            {vuln.status === 'FIXED' && (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Corrigido
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {vuln.filePath}:{vuln.startLine}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <CheckCircle className="mb-2 h-12 w-12 text-green-500" />
                    <p className="font-medium">Nenhuma vulnerabilidade encontrada</p>
                    <p className="text-sm text-muted-foreground">
                      Seu código está seguro!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detail */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedVuln ? (
                  <div className="space-y-4">
                    <div>
                      <Badge variant={selectedVuln.severity.toLowerCase() as any}>
                        {selectedVuln.severity}
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        {selectedVuln.category}
                      </Badge>
                      {selectedVuln.cweId && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedVuln.cweId}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">{selectedVuln.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedVuln.description}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Localização:</p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {selectedVuln.filePath}:{selectedVuln.startLine}-
                        {selectedVuln.endLine}
                      </p>
                    </div>

                    {selectedVuln.codeSnippet && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Código:</p>
                        <div className="code-block overflow-hidden rounded-lg">
                          <SyntaxHighlighter
                            language="javascript"
                            style={vscDarkPlus}
                            showLineNumbers
                            startingLineNumber={Math.max(1, selectedVuln.startLine - 2)}
                          >
                            {selectedVuln.codeSnippet}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}

                    {selectedVuln.suggestedFix && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Sugestão de Correção:</p>
                        <p className="rounded-lg bg-muted p-3 text-sm">
                          {selectedVuln.suggestedFix}
                        </p>
                      </div>
                    )}

                    {/* AI Fix Section */}
                    {loadingFix ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando correções...
                      </div>
                    ) : selectedFix ? (
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-green-500" />
                          <h4 className="font-semibold text-green-500">Correção Gerada pela IA</h4>
                          {selectedFix.prUrl && (
                            <Badge variant="success" className="ml-auto">
                              PR Criado
                            </Badge>
                          )}
                        </div>

                        {selectedFix.explanation && (
                          <div>
                            <p className="mb-2 text-sm font-medium">Explicação:</p>
                            <p className="rounded-lg bg-muted p-3 text-sm">
                              {selectedFix.explanation}
                            </p>
                          </div>
                        )}

                        {selectedFix.fixedCode && (
                          <div>
                            <p className="mb-2 text-sm font-medium">Código Corrigido:</p>
                            <div className="code-block overflow-hidden rounded-lg border border-green-500/30">
                              <SyntaxHighlighter
                                language="javascript"
                                style={vscDarkPlus}
                                showLineNumbers
                              >
                                {selectedFix.fixedCode}
                              </SyntaxHighlighter>
                            </div>
                          </div>
                        )}

                        {selectedFix.prUrl ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={selectedFix.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1"
                            >
                              <Button className="w-full" variant="outline">
                                <GitPullRequest className="mr-2 h-4 w-4" />
                                Ver Pull Request #{selectedFix.prNumber}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        ) : (
                          <Button
                            onClick={() => applyFixMutation.mutate({
                              vulnId: selectedVuln.id,
                              fixId: selectedFix.id,
                            })}
                            disabled={applyFixMutation.isPending || selectedFix.status === 'PENDING'}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            {applyFixMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <GitPullRequest className="mr-2 h-4 w-4" />
                            )}
                            Aplicar Correção no GitHub
                          </Button>
                        )}
                      </div>
                    ) : null}

                    <div className="flex gap-2 border-t pt-4">
                      <Button
                        onClick={() => generateFixMutation.mutate(selectedVuln.id)}
                        disabled={generateFixMutation.isPending}
                        variant={selectedFix ? 'outline' : 'default'}
                      >
                        {generateFixMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : selectedFix ? (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {selectedFix ? 'Gerar Nova Correção' : 'Gerar Fix com IA'}
                      </Button>
                      <Link href={`/vulnerabilities/${selectedVuln.id}`}>
                        <Button variant="outline">Ver Detalhes</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileCode className="mb-2 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Selecione uma vulnerabilidade para ver os detalhes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Failed Status */}
      {scan.status === 'FAILED' && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <XCircle className="mb-4 h-16 w-16 text-destructive" />
            <h3 className="text-xl font-semibold">Scan Falhou</h3>
            <p className="mt-2 text-muted-foreground">
              {scan.errorMessage || 'Ocorreu um erro durante a análise'}
            </p>

            {/* Show logs if available */}
            {logs.length > 0 && (
              <div className="mt-6 w-full max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Terminal className="h-4 w-4" />
                      Logs do Erro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-zinc-950 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-sm text-left">
                      {logs.map((log, index) => (
                        <div
                          key={index}
                          className={`py-0.5 ${
                            log.includes('ERRO') ? 'text-red-400' : 'text-zinc-400'
                          }`}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Button className="mt-4" onClick={() => router.push('/scans/new')}>
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancelled Status */}
      {scan.status === 'CANCELLED' && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <XCircle className="mb-4 h-16 w-16 text-yellow-500" />
            <h3 className="text-xl font-semibold">Scan Cancelado</h3>
            <p className="mt-2 text-muted-foreground">
              O scan foi cancelado pelo usuário
            </p>
            <Button className="mt-4" onClick={() => router.push('/scans/new')}>
              Iniciar Novo Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
