/**
 * PDF Generation Service
 *
 * Generates PDF reports from pentest results using Puppeteer
 */

import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { logger } from '../utils/logger';
import { GITSCAN_LOGO_BASE64 } from '../assets/logo-base64';

interface PentestReportData {
  id: string;
  repositoryName: string;
  webUrl: string;
  branch: string;
  createdAt: Date;
  completedAt: Date | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  exploitsAttempted: number;
  exploitsSuccessful: number;
  content: string;
  totalCostUsd?: number;
  totalDurationMs?: number;
}

/**
 * Generate PDF from pentest report data
 */
export async function generatePentestPdf(data: PentestReportData): Promise<Buffer> {
  logger.info('Generating PDF report', { pentestId: data.id });

  // Use embedded logo
  const logoBase64 = GITSCAN_LOGO_BASE64;

  // Clean up markdown content - remove Claude function calls if present
  let cleanContent = data.content;

  // Remove any <function_calls> blocks
  cleanContent = cleanContent.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '');
  cleanContent = cleanContent.replace(/<invoke[\s\S]*?<\/invoke>/g, '');
  cleanContent = cleanContent.replace(/<parameter[\s\S]*?<\/parameter>/g, '');

  // Find the actual report start
  const reportStartIndex = cleanContent.indexOf('# Comprehensive Security Assessment Report');
  if (reportStartIndex > 0) {
    cleanContent = cleanContent.substring(reportStartIndex);
  }

  // Convert markdown to HTML
  const contentHtml = await marked.parse(cleanContent);

  // Generate HTML document
  const html = generateHtmlTemplate({
    ...data,
    logoBase64,
    contentHtml,
  });

  // Launch puppeteer and generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 9px; color: #666; width: 100%; text-align: center; margin-top: 10px;">
          GitScan Security Assessment Report - ${data.repositoryName}
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 9px; color: #666; width: 100%; display: flex; justify-content: space-between; padding: 0 20px;">
          <span>Confidential</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span>${new Date().toLocaleDateString()}</span>
        </div>
      `,
    });

    logger.info('PDF generated successfully', { pentestId: data.id, size: pdfBuffer.length });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate styled HTML template for the PDF
 */
function generateHtmlTemplate(data: PentestReportData & { logoBase64: string; contentHtml: string }): string {
  const totalVulnerabilities =
    data.criticalCount + data.highCount + data.mediumCount + data.lowCount + data.infoCount;

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitScan Security Report - ${data.repositoryName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      background: white;
    }

    .cover-page {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      padding: 40px;
    }

    .logo {
      width: 150px;
      height: auto;
      margin-bottom: 40px;
    }

    .cover-title {
      font-size: 36pt;
      font-weight: bold;
      margin-bottom: 10px;
      letter-spacing: 2px;
    }

    .cover-subtitle {
      font-size: 18pt;
      opacity: 0.9;
      margin-bottom: 60px;
    }

    .cover-repo {
      font-size: 16pt;
      background: rgba(255,255,255,0.1);
      padding: 15px 30px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .cover-meta {
      font-size: 11pt;
      opacity: 0.8;
    }

    .summary-page {
      page-break-after: always;
      padding: 20px 0;
    }

    .summary-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .summary-header h2 {
      font-size: 24pt;
      color: #1a1a2e;
      margin-bottom: 5px;
    }

    .summary-header p {
      color: #666;
    }

    .vuln-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      margin-bottom: 40px;
    }

    .vuln-card {
      text-align: center;
      padding: 20px 10px;
      border-radius: 12px;
      border: 2px solid;
    }

    .vuln-card.critical {
      background: #fef2f2;
      border-color: #ef4444;
      color: #dc2626;
    }

    .vuln-card.high {
      background: #fff7ed;
      border-color: #f97316;
      color: #ea580c;
    }

    .vuln-card.medium {
      background: #fefce8;
      border-color: #eab308;
      color: #ca8a04;
    }

    .vuln-card.low {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #2563eb;
    }

    .vuln-card.info {
      background: #f0fdf4;
      border-color: #22c55e;
      color: #16a34a;
    }

    .vuln-card .count {
      font-size: 36pt;
      font-weight: bold;
      line-height: 1;
    }

    .vuln-card .label {
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 5px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .stat-box .value {
      font-size: 24pt;
      font-weight: bold;
      color: #1a1a2e;
    }

    .stat-box .label {
      color: #64748b;
      font-size: 10pt;
    }

    .risk-level {
      text-align: center;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 40px;
    }

    .risk-level.critical {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: white;
    }

    .risk-level.high {
      background: linear-gradient(135deg, #ea580c, #c2410c);
      color: white;
    }

    .risk-level.medium {
      background: linear-gradient(135deg, #ca8a04, #a16207);
      color: white;
    }

    .risk-level.low {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
    }

    .risk-level h3 {
      font-size: 14pt;
      margin-bottom: 5px;
      opacity: 0.9;
    }

    .risk-level .level {
      font-size: 28pt;
      font-weight: bold;
    }

    .content {
      padding: 20px 0;
    }

    .content h1 {
      font-size: 22pt;
      color: #1a1a2e;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
      margin: 30px 0 20px 0;
    }

    .content h2 {
      font-size: 16pt;
      color: #1e40af;
      margin: 25px 0 15px 0;
    }

    .content h3 {
      font-size: 13pt;
      color: #1e3a8a;
      margin: 20px 0 10px 0;
    }

    .content h4 {
      font-size: 11pt;
      color: #1e40af;
      margin: 15px 0 10px 0;
    }

    .content p {
      margin-bottom: 12px;
    }

    .content ul, .content ol {
      margin: 10px 0 15px 25px;
    }

    .content li {
      margin-bottom: 5px;
    }

    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
    }

    .content th, .content td {
      border: 1px solid #e2e8f0;
      padding: 10px;
      text-align: left;
    }

    .content th {
      background: #f1f5f9;
      font-weight: 600;
    }

    .content tr:nth-child(even) {
      background: #f8fafc;
    }

    .content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 9pt;
    }

    .content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 9pt;
      margin: 15px 0;
    }

    .content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    .content blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 15px;
      margin: 15px 0;
      color: #475569;
      font-style: italic;
    }

    .content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 25px 0;
    }

    .content strong {
      color: #0f172a;
    }

    @media print {
      .cover-page {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .vuln-card, .risk-level, .stat-box {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    ${data.logoBase64 ? `<img src="${data.logoBase64}" alt="GitScan Logo" class="logo">` : ''}
    <h1 class="cover-title">GITSCAN</h1>
    <p class="cover-subtitle">Security Assessment Report</p>

    <div class="cover-repo">
      <strong>${data.repositoryName}</strong>
    </div>

    <p class="cover-meta">
      Target: ${data.webUrl}<br>
      Branch: ${data.branch}<br>
      Date: ${new Date(data.createdAt).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
  </div>

  <!-- Summary Page -->
  <div class="summary-page">
    <div class="summary-header">
      <h2>Executive Summary</h2>
      <p>Vulnerability Assessment Overview</p>
    </div>

    <!-- Risk Level -->
    <div class="risk-level ${data.criticalCount > 0 ? 'critical' : data.highCount > 0 ? 'high' : data.mediumCount > 0 ? 'medium' : 'low'}">
      <h3>Overall Risk Level</h3>
      <div class="level">${data.criticalCount > 0 ? 'CRITICAL' : data.highCount > 0 ? 'HIGH' : data.mediumCount > 0 ? 'MEDIUM' : 'LOW'}</div>
    </div>

    <!-- Vulnerability Counts -->
    <div class="vuln-grid">
      <div class="vuln-card critical">
        <div class="count">${data.criticalCount}</div>
        <div class="label">Critical</div>
      </div>
      <div class="vuln-card high">
        <div class="count">${data.highCount}</div>
        <div class="label">High</div>
      </div>
      <div class="vuln-card medium">
        <div class="count">${data.mediumCount}</div>
        <div class="label">Medium</div>
      </div>
      <div class="vuln-card low">
        <div class="count">${data.lowCount}</div>
        <div class="label">Low</div>
      </div>
      <div class="vuln-card info">
        <div class="count">${data.infoCount}</div>
        <div class="label">Info</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-box">
        <div class="value">${totalVulnerabilities}</div>
        <div class="label">Total Vulnerabilities</div>
      </div>
      <div class="stat-box">
        <div class="value">${data.exploitsAttempted}</div>
        <div class="label">Exploits Attempted</div>
      </div>
      <div class="stat-box">
        <div class="value">${data.exploitsSuccessful}</div>
        <div class="label">Exploits Successful</div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-box">
        <div class="value">${data.totalDurationMs ? formatDuration(data.totalDurationMs) : 'N/A'}</div>
        <div class="label">Scan Duration</div>
      </div>
      <div class="stat-box">
        <div class="value">${data.totalCostUsd ? `$${data.totalCostUsd.toFixed(2)}` : 'N/A'}</div>
        <div class="label">Analysis Cost</div>
      </div>
      <div class="stat-box">
        <div class="value">13</div>
        <div class="label">AI Agents Used</div>
      </div>
    </div>
  </div>

  <!-- Full Report Content -->
  <div class="content">
    ${data.contentHtml}
  </div>
</body>
</html>
  `;
}

export default {
  generatePentestPdf,
};
