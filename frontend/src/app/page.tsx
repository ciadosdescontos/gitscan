'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Zap, GitBranch, Bot, Search, Lock, ArrowRight, Github, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Detecção de Vulnerabilidades',
    description: 'Identifique XSS, SQL Injection, secrets expostos e mais de 50 tipos de vulnerabilidades.',
    color: 'bg-brutal-red',
  },
  {
    icon: Bot,
    title: 'Correção com IA',
    description: 'Gere fixes automaticamente usando GPT-4, Claude 3 ou Gemini Pro.',
    color: 'bg-brutal-blue',
  },
  {
    icon: Zap,
    title: 'Scan Rápido',
    description: 'Análise completa do seu repositório em segundos, não em horas.',
    color: 'bg-brutal-yellow',
  },
  {
    icon: GitBranch,
    title: 'Integração GitHub',
    description: 'Conecte seus repositórios e crie PRs com correções automaticamente.',
    color: 'bg-foreground',
  },
  {
    icon: Search,
    title: 'Análise Profunda',
    description: 'Varredura completa de código, dependências e configurações.',
    color: 'bg-brutal-green',
  },
  {
    icon: Lock,
    title: 'Privacidade Total',
    description: 'Seu código nunca é armazenado. Análise em tempo real e descartada.',
    color: 'bg-foreground',
  },
];

const stats = [
  { value: '50+', label: 'Tipos de Vulnerabilidades' },
  { value: '3', label: 'Provedores de IA' },
  { value: '< 30s', label: 'Tempo Médio de Scan' },
  { value: '100%', label: 'Open Source' },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 border-4 border-foreground border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Brutalista */}
      <nav className="fixed top-0 z-50 w-full border-b-4 border-foreground bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="border-2 border-foreground p-1 bg-foreground">
              <Image
                src="/logo.png"
                alt="GitScan"
                width={100}
                height={28}
                priority
                className="invert"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com"
              target="_blank"
              className="brutal-link text-foreground p-2"
            >
              <Github className="h-6 w-6" />
            </Link>
            <Link
              href="/auth/login"
              className="border-2 border-foreground bg-foreground px-6 py-2 text-sm font-bold uppercase tracking-wider text-background transition-all duration-150 hover:bg-background hover:text-foreground shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Brutalista */}
      <section className="relative pt-16 border-b-4 border-foreground">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text */}
            <div className="brutal-fade-in">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 border-2 border-foreground bg-brutal-yellow px-4 py-2 mb-8 shadow-brutal">
                <span className="h-3 w-3 bg-foreground brutal-pulse"></span>
                <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                  GPT-4 • Claude 3 • Gemini
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-6">
                SEGURANÇA
                <br />
                DE CÓDIGO
                <br />
                <span className="bg-foreground text-background px-2 inline-block mt-2">
                  COM IA
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-foreground/80 mb-10 max-w-lg border-l-4 border-foreground pl-4">
                Escaneie seus repositórios GitHub em busca de vulnerabilidades e receba
                correções geradas por IA automaticamente.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auth/login"
                  className="group flex items-center justify-center gap-3 border-4 border-foreground bg-foreground px-8 py-4 text-lg font-bold uppercase tracking-wider text-background transition-all duration-150 hover:bg-brutal-yellow hover:text-foreground shadow-brutal-lg hover:shadow-none hover:translate-x-2 hover:translate-y-2"
                >
                  <Github className="h-6 w-6" />
                  Começar com GitHub
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                </Link>
                <Link
                  href="#features"
                  className="flex items-center justify-center border-4 border-foreground bg-background px-8 py-4 text-lg font-bold uppercase tracking-wider text-foreground transition-all duration-150 hover:bg-foreground hover:text-background"
                >
                  Saiba mais
                </Link>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Main box */}
                <div className="border-4 border-foreground bg-background p-8 shadow-brutal-lg">
                  <div className="space-y-4">
                    {/* Terminal header */}
                    <div className="flex items-center gap-2 border-b-2 border-foreground pb-4">
                      <div className="h-4 w-4 bg-brutal-red border-2 border-foreground"></div>
                      <div className="h-4 w-4 bg-brutal-yellow border-2 border-foreground"></div>
                      <div className="h-4 w-4 bg-brutal-green border-2 border-foreground"></div>
                      <span className="ml-4 font-mono text-sm font-bold">GITSCAN_TERMINAL</span>
                    </div>
                    {/* Terminal content */}
                    <div className="font-mono text-sm space-y-2">
                      <p><span className="text-brutal-green">$</span> gitscan scan --repo my-app</p>
                      <p className="text-muted-foreground">Scanning repository...</p>
                      <p className="text-muted-foreground">Running security checks...</p>
                      <p><span className="bg-brutal-red text-white px-1 font-bold">CRITICAL</span> SQL Injection in auth.js:42</p>
                      <p><span className="bg-brutal-yellow text-black px-1 font-bold">HIGH</span> XSS vulnerability in input.tsx:18</p>
                      <p><span className="bg-brutal-blue text-white px-1 font-bold">MEDIUM</span> Exposed API key in config.ts:5</p>
                      <p className="pt-2 border-t-2 border-foreground mt-4">
                        <span className="text-brutal-green">✓</span> 3 vulnerabilities found
                      </p>
                      <p><span className="text-brutal-green">$</span> gitscan fix --ai claude<span className="animate-pulse">_</span></p>
                    </div>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 h-full w-full border-4 border-foreground bg-brutal-yellow -z-10"></div>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap items-center justify-start gap-6 border-t-2 border-foreground pt-8">
            {[
              'Gratuito para repositórios públicos',
              'Sem cartão de crédito',
              'Setup em 30 segundos',
            ].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-brutal-green" strokeWidth={3} />
                <span className="font-bold uppercase text-sm tracking-wide">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section - Brutalista */}
      <section className="border-b-4 border-foreground bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x-2 divide-background">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center px-4 py-6">
                <div className="text-4xl sm:text-5xl font-black">{stat.value}</div>
                <div className="mt-2 text-sm font-bold uppercase tracking-wider text-background/70">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Brutalista */}
      <section id="features" className="py-20 sm:py-28 border-b-4 border-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              TUDO QUE VOCÊ
              <br />
              <span className="bg-foreground text-background px-2">PRECISA</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl border-l-4 border-foreground pl-4">
              Uma plataforma completa de segurança para desenvolvedores modernos.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group border-4 border-foreground bg-background p-6 transition-all duration-150 shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1 brutal-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex p-3 mb-4 ${feature.color} ${feature.color === 'bg-foreground' ? 'text-background' : feature.color === 'bg-brutal-yellow' ? 'text-foreground' : 'text-white'} border-2 border-foreground`}>
                  <feature.icon className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - Brutalista */}
      <section className="py-20 sm:py-28 bg-secondary border-b-4 border-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              COMO
              <span className="bg-foreground text-background px-2 ml-2">FUNCIONA</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Três passos simples para um código mais seguro.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Conecte o GitHub',
                description: 'Faça login com sua conta GitHub e autorize o acesso aos repositórios.',
              },
              {
                step: '02',
                title: 'Escaneie',
                description: 'Selecione um repositório e inicie a análise de segurança automatizada.',
              },
              {
                step: '03',
                title: 'Corrija com IA',
                description: 'Receba correções geradas por IA e crie PRs automaticamente.',
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connection line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 left-[calc(100%-1rem)] w-[calc(100%-2rem)] h-1 bg-foreground z-0" />
                )}

                <div className="relative z-10">
                  {/* Step number */}
                  <div className="inline-flex items-center justify-center h-24 w-24 border-4 border-foreground bg-foreground text-background text-4xl font-black mb-6 shadow-brutal">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-3">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Brutalista */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative border-4 border-foreground bg-foreground text-background p-12 sm:p-16">
            {/* Decorative corner */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-brutal-yellow border-l-4 border-b-4 border-foreground"></div>

            <div className="max-w-2xl">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">
                PRONTO PARA
                <br />
                PROTEGER SEU
                <br />
                <span className="bg-background text-foreground px-2">CÓDIGO?</span>
              </h2>

              <p className="text-xl text-background/80 mb-10 max-w-lg">
                Junte-se a milhares de desenvolvedores que já usam GitScan para manter seus repositórios seguros.
              </p>

              <Link
                href="/auth/login"
                className="inline-flex items-center gap-3 border-4 border-background bg-background px-8 py-4 text-lg font-bold uppercase tracking-wider text-foreground transition-all duration-150 hover:bg-brutal-yellow hover:border-brutal-yellow shadow-[4px_4px_0px_0px_hsl(var(--brutal-yellow))] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                <Github className="h-6 w-6" />
                Começar Agora — É Grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Brutalista */}
      <footer className="border-t-4 border-foreground py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="border-2 border-foreground p-1 bg-foreground">
                <Image
                  src="/logo.png"
                  alt="GitScan"
                  width={80}
                  height={22}
                  className="invert"
                />
              </div>
            </div>

            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              &copy; {new Date().getFullYear()} GitScan. Todos os direitos reservados.
            </p>

            <div className="flex items-center gap-6">
              <Link
                href="#"
                className="text-sm font-bold uppercase tracking-wider text-foreground brutal-link"
              >
                Termos
              </Link>
              <Link
                href="#"
                className="text-sm font-bold uppercase tracking-wider text-foreground brutal-link"
              >
                Privacidade
              </Link>
              <Link
                href="https://github.com"
                target="_blank"
                className="text-foreground hover:text-muted-foreground transition-colors"
              >
                <Github className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
