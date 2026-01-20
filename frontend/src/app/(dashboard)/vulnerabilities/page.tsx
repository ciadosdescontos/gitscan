'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileCode,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { vulnerabilityApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Vulnerability } from '@/types';
import * as Select from '@radix-ui/react-select';

const severityConfig = {
  CRITICAL: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'destructive' as const,
  },
  HIGH: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    badge: 'warning' as const,
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'secondary' as const,
  },
  LOW: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'outline' as const,
  },
  INFO: {
    icon: Info,
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    badge: 'outline' as const,
  },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
  OPEN: { label: 'Aberto', variant: 'destructive' },
  IN_PROGRESS: { label: 'Em Progresso', variant: 'warning' },
  FIXED: { label: 'Corrigido', variant: 'success' },
  WONT_FIX: { label: 'Não Corrigir', variant: 'secondary' },
  FALSE_POSITIVE: { label: 'Falso Positivo', variant: 'outline' },
};

export default function VulnerabilitiesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vulnerabilities', page, severityFilter, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (severityFilter && severityFilter !== 'ALL') params.severity = severityFilter;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      const response = await vulnerabilityApi.listVulnerabilities(params);
      return response.data.data as {
        vulnerabilities: Vulnerability[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    },
  });

  const vulnerabilities = data?.vulnerabilities || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  // Filter by search term locally
  const filteredVulnerabilities = vulnerabilities.filter(
    (vuln) =>
      vuln.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vuln.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vuln.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count by severity
  const severityCounts = {
    CRITICAL: vulnerabilities.filter((v) => v.severity === 'CRITICAL').length,
    HIGH: vulnerabilities.filter((v) => v.severity === 'HIGH').length,
    MEDIUM: vulnerabilities.filter((v) => v.severity === 'MEDIUM').length,
    LOW: vulnerabilities.filter((v) => v.severity === 'LOW').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vulnerabilidades</h1>
          <p className="text-muted-foreground">
            Gerencie e corrija vulnerabilidades encontradas nos seus repositórios
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(severityCounts).map(([severity, count]) => {
          const config = severityConfig[severity as keyof typeof severityConfig];
          const Icon = config.icon;
          return (
            <Card
              key={severity}
              className={`cursor-pointer transition-all hover:shadow-md ${
                severityFilter === severity ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSeverityFilter(severityFilter === severity ? 'ALL' : severity)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{severity}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <div className={`rounded-full p-3 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por título, arquivo ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Severity Filter */}
            <Select.Root value={severityFilter} onValueChange={setSeverityFilter}>
              <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm min-w-[150px]">
                <Filter className="h-4 w-4" />
                <Select.Value placeholder="Severidade" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="rounded-md border bg-card p-1 shadow-lg z-50">
                  <Select.Viewport>
                    <Select.Item
                      value="ALL"
                      className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Select.ItemText>Todas</Select.ItemText>
                    </Select.Item>
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                      <Select.Item
                        key={sev}
                        value={sev}
                        className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent"
                      >
                        <Select.ItemText>{sev}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Status Filter */}
            <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
              <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm min-w-[150px]">
                <Filter className="h-4 w-4" />
                <Select.Value placeholder="Status" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="rounded-md border bg-card p-1 shadow-lg z-50">
                  <Select.Viewport>
                    <Select.Item
                      value="ALL"
                      className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Select.ItemText>Todos</Select.ItemText>
                    </Select.Item>
                    {Object.entries(statusConfig).map(([status, config]) => (
                      <Select.Item
                        key={status}
                        value={status}
                        className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent"
                      >
                        <Select.ItemText>{config.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </CardContent>
      </Card>

      {/* Vulnerabilities List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Lista de Vulnerabilidades
          </CardTitle>
          <CardDescription>
            {pagination.total} vulnerabilidades encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredVulnerabilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nenhuma vulnerabilidade encontrada</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm || (severityFilter && severityFilter !== 'ALL') || (statusFilter && statusFilter !== 'ALL')
                  ? 'Tente ajustar os filtros de busca'
                  : 'Execute um scan para detectar vulnerabilidades nos seus repositórios'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVulnerabilities.map((vuln) => {
                const config = severityConfig[vuln.severity as keyof typeof severityConfig] || severityConfig.INFO;
                const Icon = config.icon;
                const status = statusConfig[vuln.status] || statusConfig.OPEN;
                const hasFixe = vuln.fixes && vuln.fixes.length > 0;

                return (
                  <div
                    key={vuln.id}
                    onClick={() => router.push(`/vulnerabilities/${vuln.id}`)}
                    className={`flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${config.border}`}
                  >
                    {/* Severity Icon */}
                    <div className={`rounded-full p-2 ${config.bg}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{vuln.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <FileCode className="h-4 w-4" />
                            <span className="truncate">
                              {vuln.filePath}:{vuln.startLine}
                            </span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={config.badge}>{vuln.severity}</Badge>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {hasFixe && (
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Fix
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {vuln.description}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {vuln.category}
                          </Badge>
                        </span>
                        {vuln.cweId && (
                          <span>{vuln.cweId}</span>
                        )}
                        <span>{vuln.scan?.repository?.name}</span>
                        <span>{formatDate(vuln.createdAt)}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                {pagination.total} vulnerabilidades
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
