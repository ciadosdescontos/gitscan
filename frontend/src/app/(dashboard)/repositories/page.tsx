'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderGit2,
  Plus,
  Search,
  ExternalLink,
  Settings,
  Trash2,
  Lock,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { repositoryApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { Repository, GitHubRepository } from '@/types';
import * as Dialog from '@radix-ui/react-dialog';

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch user's repositories in GitScan
  const { data: repositories, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await repositoryApi.listRepos(1, 100);
      return response.data.data as Repository[];
    },
  });

  // Fetch GitHub repositories
  const { data: githubRepos, isLoading: loadingGithub } = useQuery({
    queryKey: ['github-repositories'],
    queryFn: async () => {
      const response = await repositoryApi.listGitHubRepos(1, 100);
      return response.data.data as GitHubRepository[];
    },
    enabled: isAddModalOpen,
  });

  // Add repository mutation
  const addRepoMutation = useMutation({
    mutationFn: (githubRepoId: string) =>
      repositoryApi.addRepo({ githubRepoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      toast.success('Repositório adicionado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao adicionar repositório');
    },
  });

  // Delete repository mutation
  const deleteRepoMutation = useMutation({
    mutationFn: (id: string) => repositoryApi.deleteRepo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      toast.success('Repositório removido com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover repositório');
    },
  });

  const filteredRepos = repositories?.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addedRepoIds = new Set(repositories?.map((r) => r.githubRepoId) || []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Repositórios</h1>
          <p className="text-muted-foreground">
            Gerencie os repositórios para análise de segurança
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Repositório
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar repositórios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Repository List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredRepos?.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRepos.map((repo) => (
            <Card key={repo.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{repo.name}</CardTitle>
                  </div>
                  {repo.isPrivate ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                  {repo.description || 'Sem descrição'}
                </p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {repo.language && (
                    <Badge variant="secondary">{repo.language}</Badge>
                  )}
                  {repo.autoScanEnabled && (
                    <Badge variant="outline">Auto-scan</Badge>
                  )}
                  {repo._count?.scans && repo._count.scans > 0 && (
                    <Badge variant="secondary">
                      {repo._count.scans} scans
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {repo.lastScannedAt
                      ? `Último scan: ${formatRelativeTime(repo.lastScannedAt)}`
                      : 'Nunca scaneado'}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link href={`/repositories/${repo.id}`}>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRepoMutation.mutate(repo.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderGit2 className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-xl font-semibold">
              Nenhum repositório adicionado
            </h3>
            <p className="mb-4 text-muted-foreground">
              Adicione repositórios do GitHub para iniciar a análise de segurança
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Repositório
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Repository Modal */}
      <Dialog.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lg">
            <Dialog.Title className="mb-4 text-xl font-semibold">
              Adicionar Repositório
            </Dialog.Title>
            <Dialog.Description className="mb-4 text-sm text-muted-foreground">
              Selecione um repositório do GitHub para adicionar ao GitScan
            </Dialog.Description>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {loadingGithub ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : githubRepos?.length ? (
                githubRepos.map((repo) => {
                  const isAdded = addedRepoIds.has(String(repo.id));
                  return (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{repo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {repo.language || 'Desconhecido'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isAdded ? 'secondary' : 'default'}
                        disabled={isAdded || addRepoMutation.isPending}
                        onClick={() => addRepoMutation.mutate(String(repo.id))}
                      >
                        {isAdded ? 'Adicionado' : 'Adicionar'}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum repositório encontrado
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
