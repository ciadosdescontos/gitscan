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
  Check,
  AlertTriangle,
  Database,
  Terminal,
  Globe,
  Lock,
  Key,
  FileWarning,
  Bug,
  RefreshCw,
  Link,
  Users,
  FileCode,
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

// Scanner categories for custom scan
const scannerCategories = [
  { id: 'XSS', label: 'XSS', description: 'Cross-Site Scripting', icon: Globe, severity: 'high' },
  { id: 'SQL_INJECTION', label: 'SQL Injection', description: 'Injeção de SQL', icon: Database, severity: 'critical' },
  { id: 'COMMAND_INJECTION', label: 'Command Injection', description: 'Injeção de comandos', icon: Terminal, severity: 'critical' },
  { id: 'SECRETS_EXPOSURE', label: 'Secrets', description: 'Exposição de segredos e senhas', icon: Key, severity: 'critical' },
  { id: 'PATH_TRAVERSAL', label: 'Path Traversal', description: 'Travessia de diretórios', icon: FileWarning, severity: 'high' },
  { id: 'SSRF', label: 'SSRF', description: 'Server-Side Request Forgery', icon: Globe, severity: 'high' },
  { id: 'AUTHENTICATION', label: 'Autenticação', description: 'Falhas de autenticação', icon: Lock, severity: 'high' },
  { id: 'AUTHORIZATION', label: 'Autorização', description: 'Falhas de autorização', icon: Users, severity: 'high' },
  { id: 'CRYPTOGRAPHY', label: 'Criptografia', description: 'Uso inseguro de criptografia', icon: Lock, severity: 'medium' },
  { id: 'CSRF', label: 'CSRF', description: 'Cross-Site Request Forgery', icon: RefreshCw, severity: 'medium' },
  { id: 'SESSION', label: 'Sessão', description: 'Gerenciamento de sessão inseguro', icon: Key, severity: 'medium' },
  { id: 'IDOR', label: 'IDOR', description: 'Referência direta insegura a objetos', icon: Link, severity: 'high' },
  { id: 'OPEN_REDIRECT', label: 'Open Redirect', description: 'Redirecionamento aberto', icon: Link, severity: 'medium' },
  { id: 'DEPENDENCY', label: 'Dependências', description: 'Vulnerabilidades em dependências', icon: Bug, severity: 'varies' },
  { id: 'CONFIGURATION', label: 'Configuração', description: 'Configurações inseguras', icon: Settings, severity: 'medium' },
  { id: 'CODE_QUALITY', label: 'Qualidade de Código', description: 'Problemas de qualidade e segurança', icon: FileCode, severity: 'low' },
];

export default function NewScanPage() {
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [scanType, setScanType] = useState<ScanType>('FULL');
  const [selectedScanners, setSelectedScanners] = useState<string[]>(
    scannerCategories.map((s) => s.id) // All selected by default
  );

  const toggleScanner = (scannerId: string) => {
    setSelectedScanners((prev) =>
      prev.includes(scannerId)
        ? prev.filter((id) => id !== scannerId)
        : [...prev, scannerId]
    );
  };

  const selectAllScanners = () => {
    setSelectedScanners(scannerCategories.map((s) => s.id));
  };

  const deselectAllScanners = () => {
    setSelectedScanners([]);
  };

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
        ...(scanType === 'CUSTOM' && { scanners: selectedScanners }),
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

      {/* Custom Scanner Selection */}
      {selectedRepo && selectedBranch && scanType === 'CUSTOM' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Selecione os Scanners
            </CardTitle>
            <CardDescription className="flex items-center justify-between">
              <span>Escolha quais categorias de vulnerabilidades deseja analisar</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllScanners}
                  className="text-xs"
                >
                  Selecionar Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllScanners}
                  className="text-xs"
                >
                  Limpar
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {scannerCategories.map((scanner) => {
                const Icon = scanner.icon;
                const isSelected = selectedScanners.includes(scanner.id);
                return (
                  <button
                    key={scanner.id}
                    onClick={() => toggleScanner(scanner.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:bg-muted/50'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{scanner.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scanner.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedScanners.length === 0 && (
              <p className="mt-4 text-center text-sm text-amber-600 flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Selecione pelo menos um scanner para continuar
              </p>
            )}
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
              {scanType === 'CUSTOM' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scanners:</span>
                  <span className="font-medium">
                    {selectedScanners.length} de {scannerCategories.length} selecionados
                  </span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => createScanMutation.mutate()}
              isLoading={createScanMutation.isPending}
              disabled={!selectedRepo || !selectedBranch || (scanType === 'CUSTOM' && selectedScanners.length === 0)}
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
