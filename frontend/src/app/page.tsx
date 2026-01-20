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
  },
  {
    icon: Bot,
    title: 'Correção com IA',
    description: 'Gere fixes automaticamente usando GPT-4, Claude 3 ou Gemini Pro.',
  },
  {
    icon: Zap,
    title: 'Scan Rápido',
    description: 'Análise completa do seu repositório em segundos, não em horas.',
  },
  {
    icon: GitBranch,
    title: 'Integração GitHub',
    description: 'Conecte seus repositórios e crie PRs com correções automaticamente.',
  },
  {
    icon: Search,
    title: 'Análise Profunda',
    description: 'Varredura completa de código, dependências e configurações.',
  },
  {
    icon: Lock,
    title: 'Privacidade Total',
    description: 'Seu código nunca é armazenado. Análise em tempo real e descartada.',
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="GitScan"
              width={120}
              height={35}
              priority
            />
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" />
            </Link>
            <Link
              href="/auth/login"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl" aria-hidden="true">
            <div
              className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-primary/20 to-secondary/20 opacity-30"
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
            />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground">
                  <Image
                    src="/logo.png"
                    alt="GitScan"
                    width={80}
                    height={80}
                    className="invert"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <div className="absolute -inset-4 -z-10 animate-pulse rounded-full bg-primary/20 blur-xl" />
              </div>
            </div>

            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 text-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              Powered by GPT-4, Claude 3 & Gemini
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Segurança de código
              <span className="block bg-gradient-to-r from-primary via-blue-500 to-purple-600 bg-clip-text text-transparent">
                com inteligência artificial
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              Escaneie seus repositórios GitHub em busca de vulnerabilidades e receba
              correções geradas por IA automaticamente. Proteja seu código antes que seja tarde.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/login"
                className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-4 text-lg font-semibold text-background shadow-lg transition-all hover:bg-foreground/90 hover:shadow-xl hover:scale-105"
              >
                <Github className="h-5 w-5" />
                Começar com GitHub
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#features"
                className="rounded-xl border-2 border-border px-8 py-4 text-lg font-semibold transition-colors hover:bg-muted"
              >
                Saiba mais
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Gratuito para repositórios públicos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Setup em 30 segundos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que você precisa para proteger seu código
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Uma plataforma completa de segurança para desenvolvedores modernos.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Como funciona
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Três passos simples para um código mais seguro.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-3">
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
              <div key={item.step} className="relative text-center">
                {index < 2 && (
                  <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-gradient-to-r from-primary/50 to-transparent md:block" />
                )}
                <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-16 text-center text-background shadow-2xl sm:px-16 sm:py-24">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-purple-600/20" />

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-background">
              <Image
                src="/logo.png"
                alt="GitScan"
                width={60}
                height={60}
                style={{ objectFit: 'contain' }}
              />
            </div>

            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Pronto para proteger seu código?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-background/80">
              Junte-se a milhares de desenvolvedores que já usam GitScan para manter seus repositórios seguros.
            </p>

            <div className="mt-10">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-xl bg-background px-8 py-4 text-lg font-semibold text-foreground shadow-lg transition-all hover:bg-background/90 hover:scale-105"
              >
                <Github className="h-5 w-5" />
                Começar Agora - É Grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="GitScan"
                width={100}
                height={28}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} GitScan. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Termos
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacidade
              </Link>
              <Link href="https://github.com" target="_blank" className="text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
