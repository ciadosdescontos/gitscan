import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'agora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d atrás`;
  return formatDate(date);
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'severity-critical',
    HIGH: 'severity-high',
    MEDIUM: 'severity-medium',
    LOW: 'severity-low',
    INFO: 'severity-info',
  };
  return colors[severity] || colors.INFO;
}

export function getSeverityBgColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-blue-500',
    INFO: 'bg-gray-500',
  };
  return colors[severity] || colors.INFO;
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    XSS: 'XSS',
    SQL_INJECTION: 'SQL Injection',
    COMMAND_INJECTION: 'Command Injection',
    PATH_TRAVERSAL: 'Path Traversal',
    SSRF: 'SSRF',
    XXE: 'XXE',
    DESERIALIZATION: 'Desserialização',
    AUTHENTICATION: 'Autenticação',
    AUTHORIZATION: 'Autorização',
    CRYPTOGRAPHY: 'Criptografia',
    SECRETS_EXPOSURE: 'Exposição de Secrets',
    DEPENDENCY: 'Dependência',
    CONFIGURATION: 'Configuração',
    CODE_QUALITY: 'Qualidade de Código',
    CSRF: 'CSRF',
    SESSION: 'Sessão',
    IDOR: 'IDOR',
    MASS_ASSIGNMENT: 'Mass Assignment',
    OPEN_REDIRECT: 'Open Redirect',
    OTHER: 'Outro',
  };
  return labels[category] || category;
}
