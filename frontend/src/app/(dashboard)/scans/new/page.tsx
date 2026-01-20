'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Scan,
  FolderGit2,
  GitBranch,
  Zap,
  Shield,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { repositoryApi, scanApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Repository, ScanType } from '@/types';
import * as Select from '@radix-ui/react-select';

const scanTypes: { value: ScanType; label: string; description: string; icon: any }[] = [
  {
    value: 'FULL',
    label: 'Scan Completo',
    description: 'Análise profunda de todas as vulnerabilidades',
    icon: Shield,
  },
  {
    value: 'QUICK',
    label: 'Scan Rápido',
    description: 'Análise das vulnerabilidades mais críticas',
    icon: Zap,
  },
  {
    value: 'CUSTOM',
    label: 'Personalizado',
    description: 'Escolha as regras específicas para análise',
    icon: Settings,
  },
];

export default function NewScanPage() {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [scanType, setScanType] = useState<ScanType>('FULL');

  // Fetch repositories
  const { data: repositories, isLoading: loadingRepos } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await repositoryApi.listRepos(1, 100);
      return response.data.data as Repository[];
    },
  });

  // Fetch branches for selected repo
  const { data: branches, isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', selectedRepo],
    queryFn: async () => {
      const response = await repositoryApi.getBranches(selectedRepo);
      return response.data.data as Array<{ name: string; protected: boolean }>;
    },
    enabled: !!selectedRepo,
  });

  // Get selected repository details
  const selectedRepository = repositories?.find((r) => r.id === selectedRepo);

  // Set default branch when repo changes
  const handleRepoChange = (repoId: string) => {
    setSelectedRepo(repoId);
    const repo = repositories?.find((r) => r.id === repoId);
    if (repo) {
      setSelectedBranch(repo.defaultBranch);
    }
  };

  // Create scan mutation
  const createScanMutation = useMutation({
    mutationFn: () =>
      scanApi.createScan({
        repositoryId: selectedRepo,
        branch: selectedBranch,
        scanType,
      }),
    onSuccess: (response) => {
      toast.success('Scan iniciado com sucesso!');
      router.push(`/scans/${response.data.data.id}`);
    },
    onError: () => {
      toast.error('Erro ao iniciar scan');
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Novo Scan</h1>
        <p className="text-muted-foreground">
          Configure e inicie uma nova análise de segurança
        </p>
      </div>

      {/* Repository Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            Selecione o Repositório
          </CardTitle>
          <CardDescription>
            Escolha qual repositório deseja analisar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRepos ? (
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          ) : repositories?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoChange(repo.id)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    selectedRepo === repo.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{repo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {repo.language || 'Desconhecido'}
                    </p>
                  </div>
                  {selectedRepo === repo.id && (
                    <Badge variant="default">Selecionado</Badge>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              Nenhum repositório adicionado. Adicione um repositório primeiro.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Branch Selection */}
      {selectedRepo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Selecione a Branch
            </CardTitle>
            <CardDescription>
              Escolha qual branch deseja analisar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBranches ? (
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            ) : branches?.length ? (
              <div className="flex flex-wrap gap-2">
                {branches.map((branch) => (
                  <button
                    key={branch.name}
                    onClick={() => setSelectedBranch(branch.name)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${
                      selectedBranch === branch.name
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <GitBranch className="h-4 w-4" />
                    {branch.name}
                    {branch.protected && (
                      <Badge variant="secondary" className="text-xs">
                        protegida
                      </Badge>
                    )}
                    {branch.name === selectedRepository?.defaultBranch && (
                      <Badge variant="outline" className="text-xs">
                        default
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhuma branch encontrada</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan Type Selection */}
      {selectedRepo && selectedBranch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Tipo de Scan
            </CardTitle>
            <CardDescription>
              Escolha o nível de profundidade da análise
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {scanTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setScanType(type.value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
                      scanType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-8 w-8 text-primary" />
                    <p className="font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary and Start */}
      {selectedRepo && selectedBranch && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repositório:</span>
                <span className="font-medium">{selectedRepository?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-medium">{selectedBranch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de Scan:</span>
                <span className="font-medium">
                  {scanTypes.find((t) => t.value === scanType)?.label}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => createScanMutation.mutate()}
              isLoading={createScanMutation.isPending}
              disabled={!selectedRepo || !selectedBranch}
            >
              <Scan className="mr-2 h-5 w-5" />
              Iniciar Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
