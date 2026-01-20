# GitScan - Security Scanner for GitHub Repositories

<p align="center">
  <img src="logo_gitscan.png" alt="GitScan Logo" width="300">
</p>

<p align="center">
  <strong>Automated security vulnerability scanner with AI-powered fix generation</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#api">API</a>
</p>

---

## Overview

GitScan is a full-stack application that scans GitHub repositories for security vulnerabilities and provides AI-generated fixes. It integrates multiple professional security tools (Semgrep, Bandit) with custom regex-based scanners to detect a wide range of security issues including XSS, SQL Injection, command injection, exposed secrets, and vulnerable dependencies.

## Features

### Security Scanning
- **Multi-Scanner Architecture**: Combines professional tools (Semgrep, Bandit, Safety) with custom regex scanners
- **50+ Vulnerability Types**: Detects XSS, SQL Injection, Command Injection, Path Traversal, Exposed Secrets, and more
- **Low False Positive Rate**: Intelligent deduplication and context-aware filtering
- **Dependency Scanning**: Identifies vulnerable packages in `package.json`, `requirements.txt`, etc.

### AI-Powered Fixes
- **Multiple LLM Providers**: Supports OpenAI (GPT-4), Anthropic (Claude), and Google (Gemini)
- **Automatic Code Fixes**: Generates secure code replacements for detected vulnerabilities
- **One-Click PR Creation**: Automatically creates GitHub Pull Requests with security fixes

### Dashboard & Management
- **Real-time Scan Progress**: Live updates during repository scanning
- **Vulnerability Dashboard**: Overview of all security issues across repositories
- **Severity Classification**: CRITICAL, HIGH, MEDIUM, LOW, INFO levels
- **Fix History**: Track all generated fixes and their status

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                      http://localhost:8080                       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API (Express.js)                     │
│                      http://localhost:3002                       │
│  • Authentication (GitHub OAuth)                                 │
│  • Repository Management                                         │
│  • Scan Orchestration                                           │
│  • Vulnerability CRUD                                           │
│  • GitHub PR Creation                                           │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│      Scanner Service         │  │        PostgreSQL            │
│   http://localhost:5000      │  │     (Data Storage)           │
│  • Semgrep Scanner           │  └──────────────────────────────┘
│  • Bandit Scanner            │
│  • Dependency Scanner        │  ┌──────────────────────────────┐
│  • XSS Scanner               │  │          Redis               │
│  • Injection Scanner         │  │    (Queue & Cache)           │
│  • Secrets Scanner           │  └──────────────────────────────┘
│  • LLM Fix Generation        │
└──────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, React Query |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Scanner | Python 3.11, Flask, Semgrep, Bandit, Safety |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Infrastructure | Docker, Docker Compose |

## Installation

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- OR Node.js 20+, Python 3.11+, PostgreSQL 16, Redis 7
- GitHub Account with Personal Access Token

### Quick Start with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/NoelCunha/gitscan.git
   cd gitscan
   ```

2. **Create environment files**

   Backend (`backend/.env`):
   ```env
   DATABASE_URL="postgresql://gitscan:gitscan123@postgres:5432/gitscan?schema=public"
   REDIS_URL="redis://redis:6379"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   GITHUB_CLIENT_ID=""
   GITHUB_CLIENT_SECRET=""
   SCANNER_SERVICE_URL="http://scanner:5000"
   FRONTEND_URL="http://localhost:8080"
   NODE_ENV="development"
   ```

   Frontend (`frontend/.env.local`):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3002/api/v1
   ```

3. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3002
   - Scanner Service: http://localhost:5000

### Manual Installation

#### Backend Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
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

## Usage

### 1. Authentication

GitScan uses GitHub Personal Access Tokens for authentication:

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Generate a new token with `repo` and `read:user` permissions
3. Use the token to login at http://localhost:8080

### 2. Adding Repositories

1. After login, go to "Repositories"
2. Click "Sync Repositories" to import from GitHub
3. Select repositories you want to scan

### 3. Running Scans

1. Click "New Scan" or select a repository
2. Choose the branch to scan
3. Click "Start Scan"
4. Monitor progress in real-time

### 4. Viewing Vulnerabilities

1. After scan completion, view results in "Vulnerabilities"
2. Click on any vulnerability for details
3. View code snippets, descriptions, and remediation suggestions

### 5. Generating AI Fixes

1. Select a vulnerability
2. Click "Generate Fix with AI"
3. Choose LLM provider (requires API key in Settings)
4. Review the generated fix

### 6. Creating Pull Requests

1. After reviewing a fix, click "Apply Fix to GitHub"
2. GitScan will:
   - Create a new branch
   - Commit the fix
   - Open a Pull Request
3. Review and merge the PR on GitHub

## API Reference

### Authentication

```
POST /api/v1/auth/token
Body: { "token": "github_personal_access_token" }
```

### Repositories

```
GET    /api/v1/repositories          # List repositories
POST   /api/v1/repositories/sync     # Sync from GitHub
DELETE /api/v1/repositories/:id      # Remove repository
```

### Scans

```
GET    /api/v1/scans                 # List scans
POST   /api/v1/scans                 # Start new scan
GET    /api/v1/scans/:id             # Get scan details
GET    /api/v1/scans/stats           # Get scan statistics
```

### Vulnerabilities

```
GET    /api/v1/vulnerabilities       # List vulnerabilities
GET    /api/v1/vulnerabilities/:id   # Get vulnerability details
PATCH  /api/v1/vulnerabilities/:id   # Update status
POST   /api/v1/vulnerabilities/:id/generate-fix  # Generate AI fix
POST   /api/v1/vulnerabilities/:id/apply-fix     # Create PR with fix
```

### API Keys

```
GET    /api/v1/api-keys              # List configured API keys
POST   /api/v1/api-keys              # Add new API key
DELETE /api/v1/api-keys/:provider    # Remove API key
```

## Security Scanners

### Semgrep Scanner
Professional static analysis tool supporting multiple languages with extensive rule sets.

### Bandit Scanner
Python-specific security analyzer that finds common security issues.

### Dependency Scanner
Checks package manifests against vulnerability databases (Safety DB, npm audit).

### Custom Regex Scanners
- **XSS Scanner**: Detects Cross-Site Scripting vulnerabilities
- **Injection Scanner**: SQL Injection, Command Injection, Path Traversal
- **Secrets Scanner**: API keys, passwords, tokens in code

## Vulnerability Categories

| Category | Description |
|----------|-------------|
| XSS | Cross-Site Scripting |
| SQL_INJECTION | SQL Injection attacks |
| COMMAND_INJECTION | OS Command Injection |
| PATH_TRAVERSAL | Directory Traversal |
| SECRETS_EXPOSURE | Exposed credentials |
| INSECURE_DESERIALIZATION | Unsafe deserialization |
| VULNERABLE_DEPENDENCY | Known vulnerable packages |
| SECURITY_MISCONFIGURATION | Configuration issues |

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `SCANNER_SERVICE_URL` | Scanner service URL | `http://scanner:5000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:8080` |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3002/api/v1` |

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Rebuild and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Semgrep](https://semgrep.dev/) - Static analysis engine
- [Bandit](https://bandit.readthedocs.io/) - Python security linter
- [Safety](https://pyup.io/safety/) - Dependency vulnerability checker

---

<p align="center">
  Made with ❤️ for secure code
</p>
