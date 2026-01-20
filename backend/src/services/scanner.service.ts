import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const SCANNER_URL = process.env.SCANNER_SERVICE_URL || 'http://scanner:5000';

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

interface ScanVulnerability {
  title: string;
  description: string;
  severity: string;
  category: string;
  file_path: string;
  start_line: number;
  end_line: number;
  code_snippet?: string;
  cwe_id?: string;
  cve_id?: string;
  suggested_fix?: string;
  fix_confidence?: number;
  auto_fix_available?: boolean;
}

interface ScanResult {
  scan_id: string;
  status: string;
  total_files: number;
  files_scanned: number;
  vulnerabilities: ScanVulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  error_message?: string;
}

// Store for active scan progress (in production, use Redis)
const scanProgressStore = new Map<string, ScanProgress>();
const scanLogsStore = new Map<string, string[]>();

export function getScanProgress(scanId: string): ScanProgress | null {
  return scanProgressStore.get(scanId) || null;
}

export function getScanLogs(scanId: string): string[] {
  return scanLogsStore.get(scanId) || [];
}

function addScanLog(scanId: string, message: string) {
  const logs = scanLogsStore.get(scanId) || [];
  const timestamp = new Date().toISOString();
  logs.push(`[${timestamp}] ${message}`);
  scanLogsStore.set(scanId, logs);

  // Update progress with logs
  const progress = scanProgressStore.get(scanId);
  if (progress) {
    progress.logs = logs;
    scanProgressStore.set(scanId, progress);
  }
}

function updateScanProgress(
  scanId: string,
  updates: Partial<ScanProgress>
) {
  const current = scanProgressStore.get(scanId) || {
    scanId,
    status: 'PENDING',
    step: 'Iniciando...',
    progress: 0,
    totalFiles: 0,
    filesScanned: 0,
    logs: [],
  };

  const updated = { ...current, ...updates };
  scanProgressStore.set(scanId, updated);
  return updated;
}

export async function startScan(
  scanId: string,
  repositoryFullName: string,
  branch: string,
  accessToken: string,
  cloneUrl: string,
  scanType: string = 'FULL',
  scanners?: string[]
): Promise<void> {
  const scannerClient = axios.create({
    baseURL: SCANNER_URL,
    timeout: 600000, // 10 minutes
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Initialize progress
  updateScanProgress(scanId, {
    status: 'PENDING',
    step: 'Preparando scan...',
    progress: 0,
    logs: [],
  });
  addScanLog(scanId, 'Scan iniciado');

  try {
    // Step 1: Update status to CLONING
    addScanLog(scanId, `Clonando repositório ${repositoryFullName}...`);
    updateScanProgress(scanId, {
      status: 'CLONING',
      step: 'Clonando repositório...',
      progress: 10,
    });

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Step 2: Call scanner service
    addScanLog(scanId, `Enviando para análise de segurança...`);
    updateScanProgress(scanId, {
      status: 'SCANNING',
      step: 'Analisando código...',
      progress: 20,
    });

    const response = await scannerClient.post<ScanResult>('/api/scanner/scan', {
      scan_id: scanId,
      repository: {
        clone_url: cloneUrl,
        branch: branch,
        access_token: accessToken,
      },
      options: {
        scan_type: scanType,
        ...(scanners && scanners.length > 0 && { scanners }),
      },
    });

    const result = response.data;

    addScanLog(scanId, `Scan concluído: ${result.total_files} arquivos analisados`);
    addScanLog(scanId, `Vulnerabilidades encontradas: ${result.summary.total}`);

    if (result.summary.critical > 0) {
      addScanLog(scanId, `  - Críticas: ${result.summary.critical}`);
    }
    if (result.summary.high > 0) {
      addScanLog(scanId, `  - Altas: ${result.summary.high}`);
    }
    if (result.summary.medium > 0) {
      addScanLog(scanId, `  - Médias: ${result.summary.medium}`);
    }
    if (result.summary.low > 0) {
      addScanLog(scanId, `  - Baixas: ${result.summary.low}`);
    }

    updateScanProgress(scanId, {
      status: 'ANALYZING',
      step: 'Salvando resultados...',
      progress: 80,
      totalFiles: result.total_files,
      filesScanned: result.files_scanned,
    });

    // Step 3: Save vulnerabilities to database
    if (result.vulnerabilities && result.vulnerabilities.length > 0) {
      addScanLog(scanId, 'Salvando vulnerabilidades no banco de dados...');

      const vulnerabilitiesToCreate = result.vulnerabilities.map((vuln) => ({
        scanId,
        title: vuln.title,
        description: vuln.description,
        severity: vuln.severity as any,
        category: vuln.category as any,
        filePath: vuln.file_path,
        startLine: vuln.start_line,
        endLine: vuln.end_line,
        codeSnippet: vuln.code_snippet,
        cweId: vuln.cwe_id,
        cveId: vuln.cve_id,
        suggestedFix: vuln.suggested_fix,
        fixConfidence: vuln.fix_confidence,
        autoFixAvailable: vuln.auto_fix_available || false,
      }));

      await prisma.vulnerability.createMany({
        data: vulnerabilitiesToCreate,
      });
    }

    // Step 4: Update scan status to COMPLETED
    addScanLog(scanId, 'Scan finalizado com sucesso!');
    updateScanProgress(scanId, {
      status: 'COMPLETED',
      step: 'Concluído',
      progress: 100,
    });

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalFiles: result.total_files,
        filesScanned: result.files_scanned,
        criticalCount: result.summary.critical,
        highCount: result.summary.high,
        mediumCount: result.summary.medium,
        lowCount: result.summary.low,
        infoCount: result.summary.info,
      },
    });

    logger.info('Scan completed successfully', {
      scanId,
      vulnerabilities: result.summary.total
    });

  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';

    addScanLog(scanId, `ERRO: ${errorMessage}`);
    updateScanProgress(scanId, {
      status: 'FAILED',
      step: 'Falhou',
      progress: 0,
    });

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: errorMessage,
      },
    });

    logger.error('Scan failed', { scanId, error: errorMessage });
    throw error;
  }
}

// SSE Stream for real-time updates
export function createScanProgressStream(scanId: string) {
  return (req: any, res: any) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const sendProgress = () => {
      const progress = getScanProgress(scanId);
      if (progress) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    };

    // Send initial progress
    sendProgress();

    // Poll for updates every 500ms
    const intervalId = setInterval(() => {
      const progress = getScanProgress(scanId);
      if (progress) {
        sendProgress();

        // Stop polling when scan is done
        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
          clearInterval(intervalId);
          res.end();
        }
      }
    }, 500);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
    });
  };
}
