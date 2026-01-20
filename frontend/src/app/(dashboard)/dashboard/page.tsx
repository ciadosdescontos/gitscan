'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  FolderGit2,
  Scan,
  TrendingUp,
} from 'lucide-react';
import { scanApi, repositoryApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { DashboardStats, Scan as ScanType } from '@/types';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await scanApi.getStats();
      return response.data.data as DashboardStats;
    },
  });

  const { data: repositories } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await repositoryApi.listRepos(1, 5);
      return response.data.data;
    },
  });

  const severityCards = [
    {
      title: 'Críticas',
      value: stats?.vulnerabilitySummary.critical || 0,
      icon: Shield,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Altas',
      value: stats?.vulnerabilitySummary.high || 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Médias',
      value: stats?.vulnerabilitySummary.medium || 0,
      icon: AlertCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Baixas',
      value: stats?.vulnerabilitySummary.low || 0,
      icon: Info,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral da segurança dos seus repositórios
          </p>
        </div>
        <Link href="/scans/new">
          <Button>
            <Scan className="mr-2 h-4 w-4" />
            Novo Scan
          </Button>
        </Link>
      </div>

      {/* Vulnerability Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {severityCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Scans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Scans Recentes</CardTitle>
            <Link href="/scans">
              <Button variant="ghost" size="sm">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : stats?.recentScans?.length ? (
              <div className="space-y-3">
                {stats.recentScans.slice(0, 5).map((scan: ScanType) => (
                  <Link key={scan.id} href={`/scans/${scan.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Scan className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {scan.repository?.name || 'Repositório'}
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
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Scan className="mb-2 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum scan realizado</p>
                <Link href="/scans/new" className="mt-2">
                  <Button variant="outline" size="sm">
                    Iniciar primeiro scan
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repositories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Repositórios</CardTitle>
            <Link href="/repositories">
              <Button variant="ghost" size="sm">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {repositories?.length ? (
              <div className="space-y-3">
                {repositories.slice(0, 5).map((repo: any) => (
                  <Link key={repo.id} href={`/repositories/${repo.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{repo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {repo.language || 'Desconhecido'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {repo._count?.scans > 0 && (
                          <Badge variant="secondary">
                            {repo._count.scans} scans
                          </Badge>
                        )}
                        {repo.autoScanEnabled && (
                          <Badge variant="outline">Auto</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderGit2 className="mb-2 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Nenhum repositório adicionado
                </p>
                <Link href="/repositories" className="mt-2">
                  <Button variant="outline" size="sm">
                    Adicionar repositório
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <Scan className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Scans</p>
              <p className="text-2xl font-bold">{stats?.totalScans || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <FolderGit2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Repositórios</p>
              <p className="text-2xl font-bold">{repositories?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Vulnerabilidades Totais
              </p>
              <p className="text-2xl font-bold">
                {(stats?.vulnerabilitySummary.critical || 0) +
                  (stats?.vulnerabilitySummary.high || 0) +
                  (stats?.vulnerabilitySummary.medium || 0) +
                  (stats?.vulnerabilitySummary.low || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
