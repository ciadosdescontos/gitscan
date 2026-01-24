# GitScan - AI-Powered Security Scanner for GitHub Repositories

<p align="center">
  <img src="logo_gitscan.png" alt="GitScan Logo" width="300">
</p>

<p align="center">
  <strong>Automated security vulnerability scanner with AI-powered fix generation and automated pentesting</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#security-scanners">Scanners</a> •
  <a href="#shannon-pentest-system">Shannon Pentest</a> •
  <a href="#subscription-plans">Plans</a> •
  <a href="#api-reference">API</a> •
  <a href="#license">License</a>
</p>

---

> **IMPORTANT NOTICE**: This software is the exclusive property of **Pressa Digital** (CNPJ: 63.971.377/0001-08). Commercial sale, licensing, or distribution by third parties is expressly prohibited. See [LICENSE](#license-and-copyright) for details.

---

## Overview

GitScan is a full-stack application that scans GitHub repositories for security vulnerabilities and provides AI-generated fixes. It integrates multiple professional security tools (Semgrep, Bandit) with custom regex-based scanners to detect a wide range of security issues including XSS, SQL Injection, Command Injection, exposed credentials, and vulnerable dependencies.

**New in v2.0**: GitScan now includes **Shannon**, an AI-powered automated penetration testing system with 13 specialized agents orchestrated via Temporal workflows.

---

## Features

### Security Scanning (Static Analysis)

| Feature | Description |
|---------|-------------|
| **Multi-Scanner Architecture** | Combines 11 professional and custom scanners for comprehensive coverage |
| **50+ Vulnerability Types** | Detects XSS, SQL Injection, Command Injection, Path Traversal, Exposed Secrets, and more |
| **Low False Positive Rate** | Smart deduplication and contextual filtering between professional and regex findings |
| **Dependency Scanning** | Identifies vulnerable packages in `package.json`, `requirements.txt`, `Gemfile`, etc. |
| **Custom Scanner Selection** | Choose specific scanners for each scan (FULL, QUICK, or CUSTOM mode) |
| **Multi-Language Support** | JavaScript, TypeScript, Python, Java, Go, Ruby, PHP, C#, C/C++, Swift, Kotlin, Rust |
| **Real-time Progress** | SSE-based live updates during scan execution |

### AI-Powered Vulnerability Fixes

| Feature | Description |
|---------|-------------|
| **Multiple LLM Providers** | OpenAI, Anthropic, and Google Gemini integration |
| **20+ AI Models** | GPT-4o, o1, o3-mini, Claude 4.5, Gemini 3 Pro/Flash, and more |
| **Automatic Code Fixes** | Generates secure code replacements with explanations |
| **One-Click PR Creation** | Automatically creates GitHub Pull Requests with security fixes |
| **Model Selection** | Choose specific AI model per provider and per fix |
| **Fix History** | Track all generated fixes and their application status |

### Shannon: Automated Pentest System

| Feature | Description |
|---------|-------------|
| **13 Specialized AI Agents** | Pre-recon, Recon, 5 Vulnerability Detection, 5 Exploitation, Report |
| **Temporal Workflow Orchestration** | Crash-safe, resumable, and observable pentest pipelines |
| **Claude Agent SDK Integration** | Advanced AI analysis with tool use and multi-turn conversations |
| **Parallel Execution** | Vulnerability and exploitation agents run in parallel pipelines |
| **Real-time Monitoring** | SSE-based live updates and Temporal UI dashboard |
| **Comprehensive Audit Logs** | Complete logging of all agent activities, costs, and tokens |
| **YAML Configuration** | Flexible pentest configuration with security validation |
| **Git Checkpoints** | Automatic commit checkpoints for crash recovery |

### Subscription & Billing (SaaS)

| Plan | Repositories | Scans/Month | AI Fixes/Month | Features |
|------|--------------|-------------|----------------|----------|
| **FREE** | 3 | 10 | 5 | Basic scanning, community support |
| **PRO** | 20 | 100 | 50 | All scanners, priority support, pentest access |
| **ENTERPRISE** | Unlimited | Unlimited | Unlimited | Custom integrations, dedicated support, SSO |

- **Stripe Integration**: Secure payment processing with Stripe Checkout
- **Customer Portal**: Self-service subscription management
- **Usage Tracking**: Monthly usage limits with automatic reset
- **Webhook Support**: Real-time subscription status updates

### Dashboard & Management

| Feature | Description |
|---------|-------------|
| **Repository Management** | Sync, add, and configure GitHub repositories |
| **Vulnerability Dashboard** | Overview of all security issues with filtering |
| **Severity Classification** | CRITICAL, HIGH, MEDIUM, LOW, INFO levels |
| **Status Tracking** | OPEN, IN_PROGRESS, FIXED, WONT_FIX, FALSE_POSITIVE |
| **Scan History** | View all past scans with detailed results |
| **Settings Page** | Configure API keys, preferences, and subscription |

### Modern Interface

| Feature | Description |
|---------|-------------|
| **Brutalist Design** | Minimalist interface with solid borders and high contrast |
| **Light/Dark Theme** | Full theme support with system preference detection |
| **Fully Responsive** | Optimized for desktop, tablet, and mobile |
| **Real-time Updates** | Live progress indicators and status badges |

---

## Architecture

```
+------------------------------------------------------------------+
|                         Frontend (Next.js 14)                     |
|                      http://localhost:8080                        |
|  • React 18 + TypeScript                                         |
|  • Tailwind CSS + Radix UI                                       |
|  • Real-time SSE Progress                                        |
|  • Brutalist Design System                                       |
+------------------------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                     Backend API (Express.js)                      |
|                      http://localhost:3002                        |
|  • Authentication (GitHub OAuth + Token)                         |
|  • Repository & Scan Management                                  |
|  • Vulnerability CRUD + Fix Generation                           |
|  • Subscription & Billing (Stripe)                               |
|  • Pentest Pipeline Control                                       |
|  • LLM Models API                                                |
+------------------------------------------------------------------+
          |                    |                    |
          v                    v                    v
+------------------+  +------------------+  +------------------+
|  Scanner Service |  |  PostgreSQL 16   |  |     Redis 7     |
| http://localhost |  |   (Database)     |  |  (Queues/Cache) |
|     :5000        |  +------------------+  +------------------+
|                  |
| 11 Scanners:     |  +------------------+  +------------------+
| • Semgrep        |  | Temporal Server  |  | Temporal Worker |
| • Bandit         |  |  (Orchestration) |  | (13 AI Agents)  |
| • XSS Scanner    |  | http://localhost |  |                 |
| • Injection      |  |     :7233        |  | Claude Agent SDK|
| • Secrets        |  +------------------+  +------------------+
| • Dependency     |
| • CSRF           |  +------------------+
| • Session        |  |  Temporal UI     |
| • IDOR           |  | http://localhost |
| • Misconfig      |  |     :8088        |
| • LLM Fix Gen    |  +------------------+
+------------------+
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, React Query, Radix UI |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM, Zod Validation |
| Scanner | Python 3.11, Flask, Semgrep, Bandit, Safety, GitPython |
| Pentest Orchestration | Temporal.io 1.24, Claude Agent SDK |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Payments | Stripe (Checkout, Customer Portal, Webhooks) |
| LLM SDKs | OpenAI >=1.60.0, Anthropic >=0.45.0, Google GenAI >=0.8.4 |
| Infrastructure | Docker, Docker Compose |

---

## Security Scanners

GitScan includes 11 security scanners organized in two categories:

### Professional Tools (Directory-Level)

| Scanner | Technology | Description |
|---------|------------|-------------|
| **Semgrep Scanner** | Semgrep OSS | Multi-language static analysis with 2000+ rules for security, correctness, and performance |
| **Bandit Scanner** | Bandit | Python-specific security analyzer for common security issues (B101-B703) |
| **Dependency Scanner** | Safety DB + npm audit | Checks package manifests against vulnerability databases |

### Custom Regex Scanners (File-Level)

| Scanner | Detects |
|---------|---------|
| **XSS Scanner** | Reflected XSS, Stored XSS, DOM-based XSS, innerHTML injection, document.write |
| **Injection Scanner** | SQL Injection, Command Injection, Path Traversal, LDAP Injection, XPath Injection, SSRF |
| **Secrets Scanner** | API keys, passwords, tokens, private keys, AWS credentials, database URLs |
| **CSRF Scanner** | Missing CSRF tokens, unprotected state-changing endpoints |
| **Session Scanner** | Insecure session configuration, missing secure/httpOnly flags, weak session IDs |
| **IDOR Scanner** | Insecure direct object references, predictable resource IDs |
| **Misconfig Scanner** | Security misconfigurations, debug modes, weak crypto, insecure headers, open redirects |

### Vulnerability Categories

| Category | CWE | Description |
|----------|-----|-------------|
| `XSS` | CWE-79 | Cross-Site Scripting |
| `SQL_INJECTION` | CWE-89 | SQL Injection attacks |
| `COMMAND_INJECTION` | CWE-78 | OS Command Injection |
| `PATH_TRAVERSAL` | CWE-22 | Directory Traversal |
| `SSRF` | CWE-918 | Server-Side Request Forgery |
| `XXE` | CWE-611 | XML External Entity |
| `DESERIALIZATION` | CWE-502 | Insecure Deserialization |
| `AUTHENTICATION` | CWE-287 | Authentication Weaknesses |
| `AUTHORIZATION` | CWE-862 | Authorization Issues |
| `CRYPTOGRAPHY` | CWE-327 | Weak Cryptographic Implementations |
| `SECRETS_EXPOSURE` | CWE-798 | Hardcoded Credentials |
| `DEPENDENCY` | CWE-1104 | Vulnerable Dependencies |
| `CONFIGURATION` | CWE-16 | Security Misconfiguration |
| `CSRF` | CWE-352 | Cross-Site Request Forgery |
| `SESSION` | CWE-384 | Session Fixation |
| `IDOR` | CWE-639 | Insecure Direct Object Reference |
| `MASS_ASSIGNMENT` | CWE-915 | Mass Assignment |
| `OPEN_REDIRECT` | CWE-601 | Open Redirect |

### Supported File Extensions

```
JavaScript/TypeScript: .js, .jsx, .ts, .tsx
Python: .py
Java: .java
Go: .go
Ruby: .rb
PHP: .php
C#: .cs
C/C++: .c, .cpp, .h, .hpp
Swift: .swift
Kotlin: .kt, .kts
Rust: .rs
SQL: .sql
Web: .html, .htm, .xml
Config: .json, .yaml, .yml
```

---

## Supported AI Models

### OpenAI

| Model | ID | Context | Description |
|-------|-----|---------|-------------|
| **GPT-4o** | `gpt-4o` | 128K | Most capable multimodal model (Default) |
| GPT-4o Mini | `gpt-4o-mini` | 128K | Fast and economical |
| GPT-4 Turbo | `gpt-4-turbo` | 128K | Previous generation, still capable |
| o3 Mini | `o3-mini` | 200K | Latest advanced reasoning (New) |
| o1 | `o1` | 200K | Advanced reasoning model |
| o1 Mini | `o1-mini` | 128K | Fast reasoning, cost-effective |

### Anthropic

| Model | ID | Context | Description |
|-------|-----|---------|-------------|
| **Claude 4.5 Sonnet** | `claude-sonnet-4-5-20250514` | 200K | Latest and most intelligent (Default) |
| Claude 4.5 Opus | `claude-opus-4-5-20250514` | 200K | Maximum capability (Premium) |
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | 200K | Excellent balance |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` | 200K | Ultra fast (Economical) |
| Claude 3 Opus | `claude-3-opus-20240229` | 200K | High capability |

### Google Gemini

| Model | ID | Context | Description |
|-------|-----|---------|-------------|
| Gemini 3 Pro | `gemini-3-pro-preview` | 1M | Most intelligent with agentic capabilities |
| **Gemini 3 Flash** | `gemini-3-flash` | 1M | Pro intelligence at Flash speed (Default) |
| Gemini 2.5 Pro | `gemini-2.5-pro-preview-05-06` | 1M | Production-ready with enhanced reasoning |
| Gemini 2.5 Flash | `gemini-2.5-flash` | 1M | Stable for production |
| Gemini 2.0 Flash | `gemini-2.0-flash` | 1M | Fast multimodal (retiring Mar/2026) |
| Gemini 2.0 Flash Lite | `gemini-2.0-flash-lite` | 1M | Lightweight for simple tasks |

---

## Installation

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- OR Node.js 20+, Python 3.11+, PostgreSQL 16, Redis 7
- GitHub Account with Personal Access Token
- LLM API Keys (OpenAI, Anthropic, or Google)
- Anthropic API Key (required for Shannon pentest system)
- Stripe Account (optional, for SaaS billing)

### Quick Start with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/pressadigital/gitscan.git
   cd gitscan
   ```

2. **Create environment file** (`.env` in root directory)
   ```env
   # Database
   POSTGRES_USER=gitscan
   POSTGRES_PASSWORD=your_secure_password_here
   POSTGRES_DB=gitscan_db

   # Security
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

   # GitHub OAuth (optional)
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret

   # AI Providers
   ANTHROPIC_API_KEY=your-anthropic-api-key

   # Stripe (optional, for SaaS billing)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_ENTERPRISE=price_...
   ```

3. **Create temporal config directory**
   ```bash
   mkdir -p temporal-config
   echo "system.forceSearchAttributesCacheRefreshOnRead:" > temporal-config/development-sql.yaml
   echo "  - value: true" >> temporal-config/development-sql.yaml
   ```

4. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

5. **Wait for services to be healthy** (about 60 seconds)
   ```bash
   docker-compose ps
   ```

6. **Access the application**
   | Service | URL |
   |---------|-----|
   | Frontend | http://localhost:8080 |
   | Backend API | http://localhost:3002 |
   | Scanner Service | http://localhost:5000 |
   | Temporal UI | http://localhost:8088 |

### Manual Installation

#### Backend Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

#### Scanner Service Setup

```bash
cd scanner-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask run --host=0.0.0.0 --port=5000
```

#### Temporal Worker Setup

```bash
cd backend
npm run worker
```

---

## Usage

### 1. Authentication

GitScan supports two authentication methods:

**Personal Access Token (Recommended)**:
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Generate a new token with `repo` and `read:user` permissions
3. Use the token to login at http://localhost:8080

**GitHub OAuth** (requires configuration):
1. Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
2. Click "Login with GitHub" on the login page

### 2. Adding Repositories

1. After login, go to **Repositories**
2. Click **"Sync Repositories"** to import from GitHub
3. Select the repositories you want to scan
4. Configure auto-scan settings if needed

### 3. Running Security Scans

1. Click **"New Scan"** or select a repository
2. Choose the branch to scan
3. Select scan type:
   - **FULL**: All 11 scanners (recommended)
   - **QUICK**: Essential scanners only
   - **CUSTOM**: Select specific scanners
4. Click **"Start Scan"**
5. Monitor progress in real-time

### 4. Viewing Vulnerabilities

1. After scan completion, view results in **Vulnerabilities**
2. Filter by severity, status, or repository
3. Click any vulnerability for:
   - Code snippets with line numbers
   - Detailed descriptions
   - CWE references
   - Remediation suggestions

### 5. Generating AI Fixes

1. Select a vulnerability
2. Click **"Generate AI Fix"**
3. Choose:
   - LLM Provider (OpenAI, Anthropic, Google)
   - Specific Model
4. Wait for fix generation
5. Review the generated code and explanation

### 6. Creating Pull Requests

1. After reviewing a fix, click **"Apply Fix to GitHub"**
2. GitScan will automatically:
   - Create a new branch (`gitscan-fix/...`)
   - Commit the security fix
   - Open a Pull Request with detailed description
3. Review and merge the PR on GitHub

### 7. Managing API Keys

1. Go to **Settings**
2. Add API keys for each provider:
   - OpenAI API Key
   - Anthropic API Key
   - Google Gemini API Key
3. Set your default LLM provider

---

## Shannon Pentest System

Shannon is GitScan's automated penetration testing system that uses 13 specialized AI agents to perform comprehensive security assessments of web applications.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shannon Pentest Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1: Pre-Recon (Sequential)                                 │
│    └── pre-recon agent: Static analysis + Python scanners        │
│                           ↓                                       │
│  Phase 2: Recon (Sequential)                                      │
│    └── recon agent: Attack surface mapping, endpoint discovery   │
│                           ↓                                       │
│  Phase 3-4: Vulnerability + Exploitation (Parallel Pipelines)    │
│    ├── Injection Pipeline: injection-vuln → injection-exploit    │
│    ├── XSS Pipeline: xss-vuln → xss-exploit                      │
│    ├── Auth Pipeline: auth-vuln → auth-exploit                   │
│    ├── SSRF Pipeline: ssrf-vuln → ssrf-exploit                   │
│    └── AuthZ Pipeline: authz-vuln → authz-exploit                │
│                           ↓                                       │
│  Phase 5: Reporting (Sequential)                                  │
│    └── report agent: Executive summary with all findings         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Definitions

| Agent | Phase | Prerequisites | Description |
|-------|-------|---------------|-------------|
| `pre-recon` | Pre-Recon | None | Static code analysis, integrates Python scanner-service |
| `recon` | Recon | pre-recon | Attack surface mapping, endpoint discovery, auth flow analysis |
| `injection-vuln` | Vulnerability | recon | SQL Injection, Command Injection, LDAP/XPath Injection |
| `xss-vuln` | Vulnerability | recon | Reflected XSS, Stored XSS, DOM-based XSS |
| `auth-vuln` | Vulnerability | recon | Weak passwords, session issues, MFA bypass |
| `ssrf-vuln` | Vulnerability | recon | SSRF, blind SSRF, DNS rebinding |
| `authz-vuln` | Vulnerability | recon | IDOR, privilege escalation, broken access control |
| `injection-exploit` | Exploitation | injection-vuln | Proof-of-concept payloads for injection vulns |
| `xss-exploit` | Exploitation | xss-vuln | Proof-of-concept payloads for XSS vulns |
| `auth-exploit` | Exploitation | auth-vuln | Authentication bypass exploitation |
| `ssrf-exploit` | Exploitation | ssrf-vuln | SSRF exploitation with internal access |
| `authz-exploit` | Exploitation | authz-vuln | Authorization bypass exploitation |
| `report` | Reporting | All exploits | Comprehensive security assessment report |

### Deliverables

Each agent produces specific deliverables:

| Agent | Deliverables |
|-------|--------------|
| pre-recon | `code_analysis_deliverable.md` |
| recon | `recon_deliverable.md` |
| injection-vuln | `injection_analysis_deliverable.md`, `injection_exploitation_queue.json` |
| xss-vuln | `xss_analysis_deliverable.md`, `xss_exploitation_queue.json` |
| auth-vuln | `auth_analysis_deliverable.md`, `auth_exploitation_queue.json` |
| ssrf-vuln | `ssrf_analysis_deliverable.md`, `ssrf_exploitation_queue.json` |
| authz-vuln | `authz_analysis_deliverable.md`, `authz_exploitation_queue.json` |
| injection-exploit | `injection_evidence.md` |
| xss-exploit | `xss_evidence.md` |
| auth-exploit | `auth_evidence.md` |
| ssrf-exploit | `ssrf_evidence.md` |
| authz-exploit | `authz_evidence.md` |
| report | `comprehensive_security_assessment_report.md` |

### Starting a Pentest

1. Navigate to http://localhost:8080/pentest
2. Click **"New Pentest"**
3. Select a repository
4. Provide the **web application URL**
5. (Optional) Upload YAML configuration
6. Click **"Start Pentest"**
7. Monitor progress in real-time

### YAML Configuration

```yaml
# Target Configuration
target:
  url: https://example.com
  description: "E-commerce application"

# Authentication (optional)
authentication:
  login_type: form  # form, bearer, api_key, oauth2
  login_url: https://example.com/login
  credentials:
    username: ${TEST_USER}  # Environment variable reference
    password: ${TEST_PASS}
  login_flow:
    - "Type username in #email"
    - "Type password in #password"
    - "Click button[type=submit]"
  session_indicators:
    - cookie: session_id
    - header: Authorization

# Scope Rules
rules:
  focus:
    - type: path
      url_path: /api/**
    - type: parameter
      param: id
  avoid:
    - type: path
      url_path: /admin/**
    - type: path
      url_path: /delete/**
    - type: path
      url_path: /logout
  rate_limit: 10  # requests per second

# Agent Configuration (optional)
agents:
  skip: []  # agents to skip
  only: []  # only run these agents (empty = all)
  overrides:
    injection-vuln:
      model: claude-opus-4-5-20250929
    report:
      model: gpt-4o
```

### Configuration Security Validation

The YAML configuration is automatically validated for:

| Check | Severity | Description |
|-------|----------|-------------|
| Hardcoded Credentials | Warning | Plain text passwords or API keys |
| Dangerous Paths | Warning | Admin, delete, production paths in focus |
| Missing Avoid Rules | Info | No scope restrictions defined |
| High Rate Limit | Warning | Rate limit > 100 req/s |
| Production URLs | Warning | Production domains in target URL |

### Audit System

Shannon includes a comprehensive audit system:

```
audit-logs/{hostname}_{sessionId}/
├── session.json           # Session metadata
├── workflow.log           # Workflow-level events
├── prompts/               # All prompts sent to AI
├── agents/
│   └── {agent-name}/
│       ├── attempt-{n}.log        # Per-attempt logs
│       └── turn-by-turn/          # Detailed conversation logs
└── deliverables/          # All generated deliverables
```

### Temporal Dashboard

Access http://localhost:8088 to view:
- Running and completed workflows
- Individual agent execution history
- Error details and retry information
- Workflow state and progress queries
- Cancellation controls

---

## Subscription Plans

GitScan offers three subscription tiers:

### Plan Comparison

| Feature | FREE | PRO | ENTERPRISE |
|---------|------|-----|------------|
| Repositories | 3 | 20 | Unlimited |
| Scans per month | 10 | 100 | Unlimited |
| AI Fixes per month | 5 | 50 | Unlimited |
| Security Scanners | Basic | All 11 | All 11 + Custom |
| Shannon Pentest | - | Limited | Unlimited |
| Support | Community | Priority Email | Dedicated |
| SSO | - | - | Yes |
| Custom Integrations | - | - | Yes |

### Stripe Integration

- **Checkout**: Secure payment flow with Stripe Checkout
- **Customer Portal**: Self-service subscription management
- **Webhooks**: Real-time subscription status updates
- **Usage Tracking**: Automatic monthly limit enforcement

---

## API Reference

All API endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/github` | Initiate GitHub OAuth flow |
| `GET` | `/auth/github/callback` | GitHub OAuth callback |
| `POST` | `/auth/token` | Login with Personal Access Token |
| `GET` | `/auth/me` | Get current user info |
| `POST` | `/auth/logout` | Logout |
| `PATCH` | `/auth/preferences` | Update user preferences |

### Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/repositories` | List user's repositories |
| `GET` | `/repositories/:id` | Get repository details |
| `POST` | `/repositories/sync` | Sync repositories from GitHub |
| `POST` | `/repositories/:id/branches` | Get repository branches |
| `PATCH` | `/repositories/:id` | Update repository settings |
| `DELETE` | `/repositories/:id` | Remove repository |

### Scans

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/scans` | List user's scans |
| `GET` | `/scans/stats` | Get scan statistics |
| `POST` | `/scans` | Start new scan |
| `GET` | `/scans/:id` | Get scan details |
| `GET` | `/scans/:id/progress` | Get scan progress |
| `GET` | `/scans/:id/stream` | SSE stream for scan progress |
| `GET` | `/scans/:id/vulnerabilities` | Get scan vulnerabilities |
| `POST` | `/scans/:id/cancel` | Cancel running scan |

### Vulnerabilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/vulnerabilities` | List vulnerabilities (with filters) |
| `GET` | `/vulnerabilities/:id` | Get vulnerability details |
| `PATCH` | `/vulnerabilities/:id` | Update vulnerability status |
| `POST` | `/vulnerabilities/:id/generate-fix` | Generate AI fix |
| `POST` | `/vulnerabilities/:id/apply-fix` | Apply fix and create PR |
| `GET` | `/vulnerabilities/:id/fixes` | Get fix history |

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api-keys` | List configured API keys |
| `GET` | `/api-keys/settings` | Get API key settings |
| `POST` | `/api-keys` | Add new API key |
| `DELETE` | `/api-keys/:provider` | Remove API key |

### LLM Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/llm/providers` | List LLM providers |
| `GET` | `/llm/models` | List all available models |
| `GET` | `/llm/models/:provider` | List models for specific provider |

### Subscription

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/subscription/info` | Get subscription info and usage |
| `GET` | `/subscription/plans` | Get available plans |
| `GET` | `/subscription/stripe-key` | Get Stripe publishable key |
| `POST` | `/subscription/checkout` | Create Stripe checkout session |
| `POST` | `/subscription/portal` | Create Stripe customer portal session |
| `GET` | `/subscription/limits/:action` | Check limits for action |

### Pentest

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pentest/health` | Check pentest service health |
| `GET` | `/pentest` | List user's pentests |
| `POST` | `/pentest` | Start new pentest |
| `GET` | `/pentest/:id` | Get pentest details |
| `GET` | `/pentest/:id/progress` | Get pentest progress |
| `GET` | `/pentest/:id/stream` | SSE stream for pentest progress |
| `POST` | `/pentest/:id/cancel` | Cancel running pentest |
| `GET` | `/pentest/:id/report` | Get pentest report |
| `GET` | `/pentest/:id/deliverables` | List deliverable files |
| `GET` | `/pentest/:id/deliverables/:file` | Get specific deliverable |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | API health check with database status |

---

## Environment Variables

### Root `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `JWT_SECRET` | Yes | Secret for JWT tokens (min 32 chars) |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth client secret |
| `ANTHROPIC_API_KEY` | For Pentest | Anthropic API key for Shannon |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret |
| `STRIPE_PRICE_PRO` | No | Stripe price ID for Pro plan |
| `STRIPE_PRICE_ENTERPRISE` | No | Stripe price ID for Enterprise plan |

### Backend Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3002` | Backend API port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | - | Redis connection string |
| `FRONTEND_URL` | `http://localhost:8080` | Frontend URL for CORS |
| `SCANNER_SERVICE_URL` | `http://scanner:5000` | Scanner service URL |
| `TEMPORAL_ADDRESS` | `temporal:7233` | Temporal server address |

### Frontend Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3002/api/v1` | Backend API URL |

---

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Rebuild and start
docker-compose up -d --build

# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f temporal-worker
docker-compose logs -f scanner

# Stop all services
docker-compose down

# Reset database (delete all data)
docker-compose down -v
docker-compose up -d

# Check service status
docker-compose ps

# Execute command in container
docker-compose exec backend npx prisma db push
docker-compose exec backend npx prisma generate

# Restart specific service
docker-compose restart backend

# Scale temporal workers
docker-compose up -d --scale temporal-worker=3
```

---

## Database Schema

### Core Models

```prisma
model User {
  id                  String              @id @default(uuid())
  githubId            String              @unique
  username            String              @unique
  email               String?
  avatarUrl           String?
  defaultLlmProvider  LlmProvider         @default(OPENAI)
  stripeCustomerId    String?             @unique
  subscriptionStatus  SubscriptionStatus  @default(FREE)
  plan                PlanType            @default(FREE)
  scansUsedThisMonth  Int                 @default(0)
  repositories        Repository[]
  scans               Scan[]
  pentestRuns         PentestRun[]
  apiKeys             UserApiKey[]
}

model Repository {
  id              String        @id @default(uuid())
  name            String
  fullName        String
  cloneUrl        String
  defaultBranch   String
  autoScanEnabled Boolean       @default(false)
  scans           Scan[]
  pentestRuns     PentestRun[]
}

model Scan {
  id              String        @id @default(uuid())
  branch          String
  status          ScanStatus
  progress        Int           @default(0)
  criticalCount   Int           @default(0)
  highCount       Int           @default(0)
  mediumCount     Int           @default(0)
  lowCount        Int           @default(0)
  vulnerabilities Vulnerability[]
}

model Vulnerability {
  id              String        @id @default(uuid())
  title           String
  description     String
  severity        Severity
  category        VulnerabilityCategory
  filePath        String
  startLine       Int
  endLine         Int
  codeSnippet     String?
  cweId           String?
  status          VulnerabilityStatus  @default(OPEN)
  fixes           Fix[]
}

model PentestRun {
  id              String        @id @default(uuid())
  webUrl          String
  workflowId      String        @unique
  status          PentestStatus
  currentPhase    String?
  currentAgent    String?
  completedAgents String[]
  skippedAgents   String[]
  totalCostUsd    Float?
  agentRuns       AgentRun[]
  pentestReport   PentestReport?
}

model AgentRun {
  id              String        @id @default(uuid())
  agentName       String
  phase           String
  status          AgentStatus
  durationMs      Int?
  costUsd         Float?
  inputTokens     Int?
  outputTokens    Int?
}
```

---

## Troubleshooting

### Common Issues

#### Temporal Connection Refused
```
Error: Connection refused at localhost:7233
```
**Solution**: Ensure Temporal is running and healthy:
```bash
docker-compose logs temporal
docker-compose restart temporal
# Wait 60 seconds for Temporal to initialize
```

#### Backend Prisma Error
```
Error: PrismaClientInitializationError
```
**Solution**: Regenerate Prisma client:
```bash
docker-compose exec backend npx prisma generate
docker-compose restart backend
```

#### Database Tables Don't Exist
```
Error: The table `public.pentest_runs` does not exist
```
**Solution**: Push schema to database:
```bash
docker-compose exec backend npx prisma db push
docker-compose restart backend
```

#### Temporal Worker glibc Error
```
Error: Error loading shared library ld-linux-x86-64.so.2
```
**Solution**: The Temporal SDK requires glibc. Ensure Dockerfiles use `node:20-slim` instead of `node:20-alpine`.

#### Scanner Service Not Responding
```
Error: ECONNREFUSED scanner:5000
```
**Solution**: Check scanner service logs:
```bash
docker-compose logs scanner
docker-compose restart scanner
```

#### GitHub Token Expired
```
Error: 401 Unauthorized - Bad credentials
```
**Solution**: Generate a new GitHub Personal Access Token and re-login.

---

## Recent Updates

### v2.0.0 (January 2026)
- **Shannon Pentest System**: 13 AI agents for automated penetration testing
- **Temporal Integration**: Crash-safe workflow orchestration
- **Claude Agent SDK**: Advanced AI analysis with tool use
- **YAML Configuration**: Flexible pentest configuration with security validation
- **Real-time SSE**: Live progress updates for both scans and pentests
- **Comprehensive Audit**: Complete logging of all activities
- **Database Schema**: New models for PentestRun, AgentRun, PentestReport

### v1.3.0 (January 2026)
- **Gemini 3**: Full support for Gemini 3 Pro and Gemini 3 Flash models
- **Updated SDK**: Google Generative AI SDK >=0.8.4 for latest models
- **LLM Models API**: New endpoints for dynamic model listing
- **Model Selection**: Interface to select specific model per provider

### v1.2.0 (January 2026)
- **Brutalist Design**: New minimalist interface with solid borders and high contrast
- **Modern Theme**: Primary colors in yellow/black with bold typography
- **Updated Components**: Buttons, cards, and badges with brutalist style

### v1.1.0 (January 2026)
- **New Scanners**: CSRF, Session, IDOR, Misconfig scanners added
- **Scanner Selection**: Choose which scanners to run for each scan
- **Status Badges**: Visual indicators for fixed vulnerabilities
- **Bug Fixes**: GitHub token decryption in Apply Fix

### v1.0.0 (Initial Release)
- Multi-scanner architecture with Semgrep, Bandit, and custom scanners
- AI fix generation using OpenAI, Anthropic, and Google
- Automatic Pull Request creation
- Real-time scan progress monitoring
- GitHub authentication

---

## License and Copyright

### Ownership

**This software is the exclusive property of Pressa Digital.**

- **Company**: Pressa Digital
- **CNPJ**: 63.971.377/0001-08

### Commercial Restrictions

**THE SALE, COMMERCIALIZATION, LICENSING, AND COMMERCIAL DISTRIBUTION OF THIS SOFTWARE IS THE SOLE AND EXCLUSIVE RESPONSIBILITY OF PRESSA DIGITAL.**

Any individual or legal entity that commercializes, sells, commercially distributes, or uses this software for profit without express written authorization from Pressa Digital will be subject to sanctions under current Brazilian law, including:

- **Law No. 9.610/1998** (Copyright Law)
- **Law No. 9.609/1998** (Software Law)
- **Brazilian Civil Code**
- **Brazilian Criminal Code**

### Permitted Use

This software is made available as **open source** only for:

- Educational and learning purposes
- Non-commercial personal use
- Contributions to the project (subject to approval)
- Study of the architecture and implementation

### Commercial License

To obtain a commercial license, please contact Pressa Digital.

See the [LICENSE](LICENSE) file for complete license terms.

---

## Contributing

Contributions are welcome! By contributing, you agree to assign copyright of your contribution to Pressa Digital.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

---

## Acknowledgments

- [Semgrep](https://semgrep.dev/) - Static analysis engine
- [Bandit](https://bandit.readthedocs.io/) - Python security linter
- [Safety](https://pyup.io/safety/) - Dependency vulnerability checker
- [Temporal](https://temporal.io/) - Workflow orchestration platform
- [Stripe](https://stripe.com/) - Payment processing
- [OpenAI](https://openai.com/) - GPT-4 and reasoning models
- [Anthropic](https://anthropic.com/) - Claude model family
- [Google](https://ai.google.dev/) - Gemini generative AI models

---

<p align="center">
  <strong>GitScan</strong><br>
  Developed by <a href="#">Pressa Digital</a><br>
  CNPJ: 63.971.377/0001-08<br>
  All rights reserved - 2024-2026
</p>
