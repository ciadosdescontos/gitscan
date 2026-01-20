'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FolderGit2,
  ExternalLink,
  Settings,
  Scan,
  Shield,
  GitBranch,
  Clock,
  AlertTriangle,
  Trash2,
  Loader2,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { repositoryApi, scanApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { Repository, Scan as ScanType } from '@/types';

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const repoId = params.id as string;

  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scanOnPush, setScanOnPush] = useState(false);

  // Fetch repository details (includes last 5 scans from backend)
  const { data: repository, isLoading: loadingRepo } = useQuery({
    queryKey: ['repository', repoId],
    queryFn: async () => {
      const response = await repositoryApi.getRepo(repoId);
      const repo = response.data.data;
      setAutoScanEnabled(repo.autoScanEnabled);
      setScanOnPush(repo.scanOnPush);
      return repo;
    },
  });

  // Use scans from repository response (backend includes last 5 scans)
  const scansData = repository?.scans as ScanType[] | undefined;
  const loadingScans = loadingRepo;

  // Update repository settings
  const updateMutation = useMutation({
    mutationFn: (data: { autoScanEnabled?: boolean; scanOnPush?: boolean }) =>
      repositoryApi.updateRepo(repoId, data),
    onSuccess: () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries({ queryKey: ['repository', repoId] });
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  // Delete repository
  const deleteMutation = useMutation({
    mutationFn: () => repositoryApi.deleteRepo(repoId),
    onSuccess: () => {
      toast.success('Repositório removido');
      router.push('/repositories');
    },
    onError: () => {
      toast.error('Erro ao remover repositório');
    },
  });

  // Create new scan
  const createScanMutation = useMutation({
    mutationFn: () => scanApi.createScan({ repositoryId: repoId }),
    onSuccess: (response) => {
      toast.success('Scan iniciado!');
      router.push(`/scans/${response.data.data.id}`);
    },
    onError: () => {
      toast.error('Erro ao iniciar scan');
    },
  });

  const handleToggleAutoScan = (enabled: boolean) => {
    setAutoScanEnabled(enabled);
    updateMutation.mutate({ autoScanEnabled: enabled });
  };

  const handleToggleScanOnPush = (enabled: boolean) => {
    setScanOnPush(enabled);
    updateMutation.mutate({ scanOnPush: enabled });
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja remover este repositório? Todos os scans e vulnerabilidades associados serão excluídos.')) {
      deleteMutation.mutate();
    }
  };

  if (loadingRepo) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="text-center py-12">
        <p>Repositório não encontrado</p>
        <Button variant="outline" onClick={() => router.push('/repositories')}>
          Voltar aos Repositórios
        </Button>
      </div>
    );
  }

  const scans = scansData || [];
  const totalVulnerabilities = scans.reduce(
    (acc, scan) => acc + scan.criticalCount + scan.highCount + scan.mediumCount + scan.lowCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FolderGit2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{repository.name}</h1>
              <p className="text-sm text-muted-foreground">{repository.fullName}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={repository.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver no GitHub
            </Button>
          </a>
          <Button
            onClick={() => createScanMutation.mutate()}
            disabled={createScanMutation.isPending}
          >
            {createScanMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Iniciar Scan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Scan className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Scans</p>
              <p className="text-2xl font-bold">{scans.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-red-500/10 p-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vulnerabilidades</p>
              <p className="text-2xl font-bold">{totalVulnerabilities}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-500/10 p-3">
              <GitBranch className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch Padrão</p>
              <p className="text-lg font-medium">{repository.defaultBranch}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-500/10 p-3">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Último Scan</p>
              <p className="text-sm font-medium">
                {repository.lastScannedAt
                  ? formatRelativeTime(repository.lastScannedAt)
                  : 'Nunca'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Repository Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </CardTitle>
            <CardDescription>
              Configure as opções de scan automático para este repositório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Scan Automático</p>
                <p className="text-sm text-muted-foreground">
                  Executar scans periódicos automaticamente
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={autoScanEnabled}
                  onChange={(e) => handleToggleAutoScan(e.target.checked)}
                  className="peer sr-only"
                  disabled={updateMutation.isPending}
                />
                <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-ring after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Scan no Push</p>
                <p className="text-sm text-muted-foreground">
                  Executar scan automaticamente ao receber push
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={scanOnPush}
                  onChange={(e) => handleToggleScanOnPush(e.target.checked)}
                  className="peer sr-only"
                  disabled={updateMutation.isPending}
                />
                <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-ring after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div>
                <p className="font-medium text-destructive">Remover Repositório</p>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Scans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Scans Recentes
              </CardTitle>
              <CardDescription>
                Histórico de scans deste repositório
              </CardDescription>
            </div>
            <Link href={`/scans?repositoryId=${repoId}`}>
              <Button variant="ghost" size="sm">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingScans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : scans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Scan className="mb-2 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum scan realizado</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => createScanMutation.mutate()}
                >
                  Iniciar primeiro scan
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {scans.slice(0, 5).map((scan) => (
                  <Link key={scan.id} href={`/scans/${scan.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            scan.status === 'COMPLETED'
                              ? 'bg-green-500'
                              : scan.status === 'FAILED'
                              ? 'bg-red-500'
                              : scan.status === 'RUNNING'
                              ? 'bg-yellow-500 animate-pulse'
                              : 'bg-gray-500'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium">
                            Branch: {scan.branch}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(scan.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {scan.criticalCount > 0 && (
                          <Badge variant="critical">{scan.criticalCount}</Badge>
                        )}
                        {scan.highCount > 0 && (
                          <Badge variant="high">{scan.highCount}</Badge>
                        )}
                        <Badge
                          variant={
                            scan.status === 'COMPLETED'
                              ? 'success'
                              : scan.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {scan.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Repository Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Repositório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Linguagem</p>
              <p className="font-medium">{repository.language || 'Não detectada'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visibilidade</p>
              <p className="font-medium">{repository.isPrivate ? 'Privado' : 'Público'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Adicionado em</p>
              <p className="font-medium">{formatDate(repository.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="font-medium">{formatDate(repository.updatedAt)}</p>
            </div>
          </div>
          {repository.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="mt-1">{repository.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
