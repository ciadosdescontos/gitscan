# GitScan - Security Scanner for GitHub Repositories

<p align="center">
  <img src="logo_gitscan.png" alt="GitScan Logo" width="300">
</p>

<p align="center">
  <strong>Scanner automatizado de vulnerabilidades de seguranca com geracao de correcoes por IA</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Arquitetura</a> •
  <a href="#installation">Instalacao</a> •
  <a href="#usage">Uso</a> •
  <a href="#api">API</a> •
  <a href="#license">Licenca</a>
</p>

---

> **AVISO IMPORTANTE**: Este software e propriedade exclusiva da **Pressa Digital** (CNPJ: 63.971.377/0001-08). A comercializacao, venda ou distribuicao comercial por terceiros e expressamente proibida. Consulte a [LICENCA](#licenca-e-direitos-autorais) para mais detalhes.

---

## Visao Geral

GitScan e uma aplicacao full-stack que escaneia repositorios GitHub em busca de vulnerabilidades de seguranca e fornece correcoes geradas por IA. Integra multiplas ferramentas de seguranca profissionais (Semgrep, Bandit) com scanners personalizados baseados em regex para detectar uma ampla gama de problemas de seguranca, incluindo XSS, SQL Injection, Command Injection, credenciais expostas e dependencias vulneraveis.

## Features

### Escaneamento de Seguranca
- **Arquitetura Multi-Scanner**: Combina ferramentas profissionais (Semgrep, Bandit, Safety) com scanners regex customizados
- **50+ Tipos de Vulnerabilidades**: Detecta XSS, SQL Injection, Command Injection, Path Traversal, Segredos Expostos e mais
- **Baixa Taxa de Falsos Positivos**: Deduplicacao inteligente e filtragem contextual
- **Escaneamento de Dependencias**: Identifica pacotes vulneraveis em `package.json`, `requirements.txt`, etc.
- **Selecao Personalizada de Scanners**: Escolha quais scanners executar para cada scan

### Correcoes com IA
- **Multiplos Provedores de LLM**: Suporta OpenAI (GPT-4o, o1, o3-mini), Anthropic (Claude 4.5 Sonnet/Opus), e Google (Gemini 3 Pro/Flash)
- **Correcoes Automaticas de Codigo**: Gera substituicoes de codigo seguras para vulnerabilidades detectadas
- **Criacao de PR com Um Clique**: Cria automaticamente Pull Requests no GitHub com correcoes de seguranca
- **Selecao de Modelo por Provedor**: Escolha o modelo especifico de IA para cada provedor

### Dashboard e Gerenciamento
- **Progresso de Scan em Tempo Real**: Atualizacoes ao vivo durante o escaneamento
- **Dashboard de Vulnerabilidades**: Visao geral de todos os problemas de seguranca
- **Classificacao de Severidade**: CRITICAL, HIGH, MEDIUM, LOW, INFO
- **Historico de Correcoes**: Acompanhe todas as correcoes geradas e seus status
- **Badges de Status**: Indicadores visuais para vulnerabilidades corrigidas

### Interface Moderna
- **Design Brutalista Minimalista**: Interface moderna com bordas solidas e alto contraste
- **Tema Claro/Escuro**: Suporte completo a temas
- **Responsividade Total**: Funciona em desktop, tablet e mobile
- **Animacoes Sutis**: Transicoes suaves para melhor experiencia do usuario

## Arquitetura

```
+------------------------------------------------------------------+
|                         Frontend (Next.js 14)                     |
|                      http://localhost:8080                        |
|  • Design Brutalista Minimalista                                  |
|  • React 18 + TypeScript                                         |
|  • Tailwind CSS + Radix UI                                       |
+------------------------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                     Backend API (Express.js)                      |
|                      http://localhost:3002                        |
|  • Autenticacao (GitHub OAuth)                                   |
|  • Gerenciamento de Repositorios                                 |
|  • Orquestracao de Scans                                         |
|  • CRUD de Vulnerabilidades                                      |
|  • Criacao de Pull Requests                                      |
|  • API de Modelos LLM                                            |
+------------------------------------------------------------------+
                    |                           |
                    v                           v
+-------------------------------+  +-------------------------------+
|      Scanner Service          |  |        PostgreSQL 16          |
|   http://localhost:5000       |  |     (Armazenamento)           |
|  • Semgrep Scanner            |  +-------------------------------+
|  • Bandit Scanner             |
|  • Dependency Scanner         |  +-------------------------------+
|  • XSS Scanner                |  |          Redis 7              |
|  • Injection Scanner          |  |    (Filas e Cache)            |
|  • Secrets Scanner            |  +-------------------------------+
|  • Geracao de Fix com LLM     |
|  • Integracao Gemini 3        |
+-------------------------------+
```

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, React Query, Radix UI |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| Scanner | Python 3.11, Flask, Semgrep, Bandit, Safety, Celery |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| LLM SDKs | OpenAI >=1.60.0, Anthropic >=0.45.0, Google GenAI >=0.8.4 |
| Infraestrutura | Docker, Docker Compose |

## Modelos de IA Suportados

### OpenAI
| Modelo | Descricao |
|--------|-----------|
| GPT-4o | Mais capaz, multimodal (Recomendado) |
| GPT-4o Mini | Rapido e economico |
| o3 Mini | Raciocinio mais avancado (Mais Recente) |
| o1 | Raciocinio avancado |
| o1 Mini | Raciocinio rapido |
| GPT-4 Turbo | Alta performance |

### Anthropic
| Modelo | Descricao |
|--------|-----------|
| Claude 4.5 Sonnet | Ultimo modelo, mais inteligente (Mais Recente) |
| Claude 4.5 Opus | Maxima capacidade (Premium) |
| Claude 3.5 Sonnet | Equilibrio ideal (Recomendado) |
| Claude 3.5 Haiku | Ultra rapido (Economico) |
| Claude 3 Opus | Alta capacidade |

### Google Gemini
| Modelo | Descricao |
|--------|-----------|
| Gemini 3 Pro | Mais inteligente, raciocinio avancado e agentes (Mais Recente) |
| Gemini 3 Flash | Inteligencia Pro na velocidade Flash (Recomendado) |
| Gemini 2.5 Pro | Producao, raciocinio aprimorado |
| Gemini 2.5 Flash | Estavel para producao |
| Gemini 2.0 Flash | Multimodal (retirando Mar/2026) |
| Gemini 2.0 Flash Lite | Leve e rapido |

## Instalacao

### Pre-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recomendado)
- OU Node.js 20+, Python 3.11+, PostgreSQL 16, Redis 7
- Conta GitHub com Personal Access Token

### Inicio Rapido com Docker (Recomendado)

1. **Clone o repositorio**
   ```bash
   git clone https://github.com/pressadigital/gitscan.git
   cd gitscan
   ```

2. **Crie os arquivos de ambiente**

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

3. **Inicie todos os servicos**
   ```bash
   docker-compose up -d --build
   ```

4. **Acesse a aplicacao**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3002
   - Scanner Service: http://localhost:5000

### Instalacao Manual

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

## Uso

### 1. Autenticacao

GitScan usa GitHub Personal Access Tokens para autenticacao:

1. Va para [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Gere um novo token com permissoes `repo` e `read:user`
3. Use o token para fazer login em http://localhost:8080

### 2. Adicionando Repositorios

1. Apos o login, va para "Repositorios"
2. Clique em "Sincronizar Repositorios" para importar do GitHub
3. Selecione os repositorios que deseja escanear

### 3. Executando Scans

1. Clique em "Novo Scan" ou selecione um repositorio
2. Escolha a branch para escanear
3. Selecione os scanners que deseja utilizar
4. Clique em "Iniciar Scan"
5. Monitore o progresso em tempo real

### 4. Visualizando Vulnerabilidades

1. Apos a conclusao do scan, veja os resultados em "Vulnerabilidades"
2. Clique em qualquer vulnerabilidade para detalhes
3. Veja trechos de codigo, descricoes e sugestoes de remediacao

### 5. Gerando Correcoes com IA

1. Selecione uma vulnerabilidade
2. Clique em "Gerar Correcao com IA"
3. Escolha o provedor e modelo de LLM (requer chave de API em Configuracoes)
4. Revise a correcao gerada

### 6. Criando Pull Requests

1. Apos revisar uma correcao, clique em "Aplicar Fix no GitHub"
2. GitScan ira:
   - Criar uma nova branch
   - Fazer commit da correcao
   - Abrir um Pull Request
3. Revise e faca merge do PR no GitHub

## Referencia da API

### Autenticacao

```
POST /api/v1/auth/token
Body: { "token": "github_personal_access_token" }
```

### Repositorios

```
GET    /api/v1/repositories          # Listar repositorios
POST   /api/v1/repositories/sync     # Sincronizar do GitHub
DELETE /api/v1/repositories/:id      # Remover repositorio
```

### Scans

```
GET    /api/v1/scans                 # Listar scans
POST   /api/v1/scans                 # Iniciar novo scan
GET    /api/v1/scans/:id             # Obter detalhes do scan
GET    /api/v1/scans/stats           # Obter estatisticas
```

### Vulnerabilidades

```
GET    /api/v1/vulnerabilities       # Listar vulnerabilidades
GET    /api/v1/vulnerabilities/:id   # Obter detalhes
PATCH  /api/v1/vulnerabilities/:id   # Atualizar status
POST   /api/v1/vulnerabilities/:id/generate-fix  # Gerar correcao IA
POST   /api/v1/vulnerabilities/:id/apply-fix     # Criar PR com correcao
```

### Chaves de API

```
GET    /api/v1/api-keys              # Listar chaves configuradas
POST   /api/v1/api-keys              # Adicionar nova chave
DELETE /api/v1/api-keys/:provider    # Remover chave
```

### Modelos LLM

```
GET    /api/v1/llm/providers         # Listar provedores de LLM
GET    /api/v1/llm/models            # Listar todos os modelos
GET    /api/v1/llm/models/:provider  # Listar modelos de um provedor
```

## Scanners de Seguranca

### Semgrep Scanner
Ferramenta de analise estatica profissional suportando multiplas linguagens com conjuntos de regras extensivos.

### Bandit Scanner
Analisador de seguranca especifico para Python que encontra problemas comuns de seguranca.

### Dependency Scanner
Verifica manifestos de pacotes contra bancos de dados de vulnerabilidades (Safety DB, npm audit).

### Scanners Regex Customizados
- **XSS Scanner**: Detecta vulnerabilidades de Cross-Site Scripting
- **Injection Scanner**: SQL Injection, Command Injection, Path Traversal
- **Secrets Scanner**: Chaves de API, senhas, tokens no codigo

## Categorias de Vulnerabilidades

| Categoria | Descricao |
|-----------|-----------|
| XSS | Cross-Site Scripting |
| SQL_INJECTION | Ataques de SQL Injection |
| COMMAND_INJECTION | Injecao de Comandos OS |
| PATH_TRAVERSAL | Travessia de Diretorio |
| SSRF | Server-Side Request Forgery |
| XXE | XML External Entity |
| DESERIALIZATION | Deserializacao Insegura |
| AUTHENTICATION | Fraquezas de Autenticacao |
| AUTHORIZATION | Problemas de Autorizacao/Controle de Acesso |
| CRYPTOGRAPHY | Implementacoes Criptograficas Fracas |
| SECRETS_EXPOSURE | Credenciais e Chaves de API Expostas |
| DEPENDENCY | Pacotes com Vulnerabilidades Conhecidas |
| CONFIGURATION | Configuracao Incorreta de Seguranca |
| CODE_QUALITY | Problemas de Qualidade de Codigo com Impacto em Seguranca |
| CSRF | Cross-Site Request Forgery |
| SESSION | Problemas de Gerenciamento de Sessao |
| IDOR | Insecure Direct Object Reference |
| MASS_ASSIGNMENT | Vulnerabilidades de Mass Assignment |
| OPEN_REDIRECT | Vulnerabilidades de Redirecionamento Aberto |

## Variaveis de Ambiente

### Backend

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `DATABASE_URL` | String de conexao PostgreSQL | Obrigatorio |
| `REDIS_URL` | String de conexao Redis | Obrigatorio |
| `JWT_SECRET` | Segredo para tokens JWT | Obrigatorio |
| `SCANNER_SERVICE_URL` | URL do servico Scanner | `http://scanner:5000` |
| `FRONTEND_URL` | URL do Frontend para CORS | `http://localhost:8080` |

### Frontend

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `NEXT_PUBLIC_API_URL` | URL da API Backend | `http://localhost:3002/api/v1` |

## Comandos Docker

```bash
# Iniciar todos os servicos
docker-compose up -d

# Reconstruir e iniciar
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Parar todos os servicos
docker-compose down

# Resetar banco de dados
docker-compose down -v
docker-compose up -d
```

## Atualizacoes Recentes

### v1.3.0 (Janeiro 2026)
- **Gemini 3**: Suporte completo aos modelos Gemini 3 Pro e Gemini 3 Flash
- **SDK Atualizado**: Google Generative AI SDK >=0.8.4 para acesso aos modelos mais recentes
- **API de Modelos LLM**: Novos endpoints para listagem dinamica de modelos disponíveis
- **Selecao de Modelos**: Interface para selecionar modelo especifico de cada provedor

### v1.2.0 (Janeiro 2026)
- **Design Brutalista**: Nova interface minimalista com bordas solidas e alto contraste
- **Tema Moderno**: Cores primarias em amarelo/preto com tipografia bold
- **Componentes Atualizados**: Buttons, cards e badges com estilo brutalista
- **Responsividade**: Layout adaptativo para todos os tamanhos de tela

### v1.1.0 (Janeiro 2026)
- **Bug Fix**: Corrigido problema de descriptografia do token GitHub no Apply Fix
- **Novos Scanners**: Suporte para deteccao de CSRF, Session, IDOR, Mass Assignment e Open Redirect
- **Melhor Tratamento de Erros**: Mensagens de erro mais claras para falhas de autenticacao GitHub
- **Melhorias de UI**: Pagina de detalhes de vulnerabilidade aprimorada com feedback de aplicacao de fix
- **Selecao de Scanners**: Permite escolher quais scanners executar em cada scan
- **Badges de Status**: Indicadores visuais para vulnerabilidades corrigidas

### v1.0.0 (Lancamento Inicial)
- Arquitetura multi-scanner com Semgrep, Bandit e scanners regex customizados
- Geracao de correcoes com IA usando OpenAI, Anthropic e Google
- Criacao automatica de Pull Requests para correcoes de seguranca
- Monitoramento de progresso de scan em tempo real
- Integracao com GitHub OAuth

---

## Licenca e Direitos Autorais

### Propriedade

**Este software e propriedade exclusiva da Pressa Digital.**

- **Empresa**: Pressa Digital
- **CNPJ**: 63.971.377/0001-08

### Restricoes Comerciais

**A VENDA, COMERCIALIZACAO, LICENCIAMENTO E DISTRIBUICAO COMERCIAL DESTE SOFTWARE E DE UNICA E EXCLUSIVA RESPONSABILIDADE DA PRESSA DIGITAL.**

Qualquer pessoa fisica ou juridica que comercialize, venda, distribua comercialmente ou utilize este software para fins lucrativos sem autorizacao expressa e por escrito da Pressa Digital estara sujeita as sancoes previstas na legislacao brasileira vigente, incluindo:

- **Lei no 9.610/1998** (Lei de Direitos Autorais)
- **Lei no 9.609/1998** (Lei do Software)
- **Codigo Civil Brasileiro**
- **Codigo Penal Brasileiro**

### Uso Permitido

Este software e disponibilizado como **open source** apenas para:

- Fins educacionais e de aprendizado
- Uso pessoal nao comercial
- Contribuicoes para o projeto (sujeitas a aprovacao)
- Estudo da arquitetura e implementacao

### Licenca Comercial

Para obter uma licenca comercial, entre em contato com a Pressa Digital.

Consulte o arquivo [LICENSE](LICENSE) para os termos completos da licenca.

---

## Contribuicoes

Contribuicoes sao bem-vindas! Ao contribuir, voce concorda em ceder os direitos autorais da sua contribuicao a Pressa Digital.

1. Faca um Fork do repositorio
2. Crie uma branch de feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudancas (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## Reconhecimentos

- [Semgrep](https://semgrep.dev/) - Engine de analise estatica
- [Bandit](https://bandit.readthedocs.io/) - Linter de seguranca Python
- [Safety](https://pyup.io/safety/) - Verificador de vulnerabilidades de dependencias
- [OpenAI](https://openai.com/) - GPT-4 e modelos de raciocinio
- [Anthropic](https://anthropic.com/) - Claude e familia de modelos
- [Google](https://ai.google.dev/) - Gemini e modelos de IA generativa

---

<p align="center">
  <strong>GitScan</strong><br>
  Desenvolvido por <a href="#">Pressa Digital</a><br>
  CNPJ: 63.971.377/0001-08<br>
  Todos os direitos reservados - 2024-2026
</p>
