'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scan,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';
import { scanApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { Scan as ScanType, ScanStatus } from '@/types';

const statusConfig: Record<ScanStatus, { label: string; icon: any; variant: any }> = {
  PENDING: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  QUEUED: { label: 'Na fila', icon: Clock, variant: 'secondary' },
  RUNNING: { label: 'Executando', icon: PlayCircle, variant: 'default' },
  COMPLETED: { label: 'Concluído', icon: CheckCircle, variant: 'success' },
  FAILED: { label: 'Falhou', icon: XCircle, variant: 'destructive' },
  CANCELLED: { label: 'Cancelado', icon: AlertCircle, variant: 'secondary' },
};

export default function ScansPage() {
  const [statusFilter, setStatusFilter] = useState<ScanStatus | 'ALL'>('ALL');

  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', statusFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const response = await scanApi.listScans(params);
      return response.data;
    },
  });

  const scans = scansData?.data as ScanType[] || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scans</h1>
          <p className="text-muted-foreground">
            Histórico de análises de segurança
          </p>
        </div>
        <Link href="/scans/new">
          <Button>
            <Scan className="mr-2 h-4 w-4" />
            Novo Scan
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'ALL' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('ALL')}
        >
          Todos
        </Button>
        <Button
          variant={statusFilter === 'RUNNING' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('RUNNING')}
        >
          <PlayCircle className="mr-1 h-3 w-3" />
          Executando
        </Button>
        <Button
          variant={statusFilter === 'COMPLETED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('COMPLETED')}
        >
          <CheckCircle className="mr-1 h-3 w-3" />
          Concluídos
        </Button>
        <Button
          variant={statusFilter === 'FAILED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('FAILED')}
        >
          <XCircle className="mr-1 h-3 w-3" />
          Falhas
        </Button>
      </div>

      {/* Scans List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : scans.length ? (
        <div className="space-y-4">
          {scans.map((scan) => {
            const status = statusConfig[scan.status];
            const StatusIcon = status.icon;
            const totalVulns =
              scan.criticalCount +
              scan.highCount +
              scan.mediumCount +
              scan.lowCount;

            return (
              <Link key={scan.id} href={`/scans/${scan.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-primary/10 p-3">
                        <Scan className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {scan.repository?.name || 'Repositório'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Branch: {scan.branch} • {scan.scanType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(scan.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Vulnerability Counts */}
                      {scan.status === 'COMPLETED' && (
                        <div className="flex gap-2">
                          {scan.criticalCount > 0 && (
                            <Badge variant="critical">
                              {scan.criticalCount} críticas
                            </Badge>
                          )}
                          {scan.highCount > 0 && (
                            <Badge variant="high">{scan.highCount} altas</Badge>
                          )}
                          {scan.mediumCount > 0 && (
                            <Badge variant="medium">
                              {scan.mediumCount} médias
                            </Badge>
                          )}
                          {scan.lowCount > 0 && (
                            <Badge variant="low">{scan.lowCount} baixas</Badge>
                          )}
                          {totalVulns === 0 && (
                            <Badge variant="success">Nenhuma vulnerabilidade</Badge>
                          )}
                        </div>
                      )}

                      {/* Progress */}
                      {scan.status === 'RUNNING' && (
                        <div className="w-32">
                          <div className="flex justify-between text-xs">
                            <span>{scan.progress}%</span>
                            <span>
                              {scan.filesScanned}/{scan.totalFiles}
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${scan.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status Badge */}
                      <Badge variant={status.variant}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scan className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-xl font-semibold">Nenhum scan encontrado</h3>
            <p className="mb-4 text-muted-foreground">
              Inicie um novo scan para analisar seus repositórios
            </p>
            <Link href="/scans/new">
              <Button>
                <Scan className="mr-2 h-4 w-4" />
                Novo Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
