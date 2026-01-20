'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Github, Eye, EyeOff, Loader2, Key, ArrowLeft, Shield, Zap, Bot } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const { setToken, setUser } = useAuthStore();
  const [token, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      toast.error('Por favor, insira seu Personal Access Token');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Falha na autenticação');
      }

      if (data.success && data.data) {
        setToken(data.data.token);
        setUser(data.data.user);
        toast.success('Login realizado com sucesso!');
        router.push('/dashboard');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Token inválido. Verifique e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background p-12 flex-col justify-between relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brutal-yellow"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brutal-red"></div>

        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-background/70 hover:text-background transition-colors mb-12 brutal-link">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-bold uppercase tracking-wider text-sm">Voltar</span>
          </Link>

          <div className="border-4 border-background p-2 inline-block bg-background mb-8">
            <Image
              src="/logo.png"
              alt="GitScan Logo"
              width={160}
              height={45}
              priority
            />
          </div>

          <h1 className="text-5xl font-black tracking-tight leading-none mb-6">
            PROTEJA
            <br />
            SEU CÓDIGO
            <br />
            <span className="bg-background text-foreground px-2 inline-block mt-2">AGORA</span>
          </h1>

          <p className="text-xl text-background/70 max-w-md">
            Scanner de segurança automatizado com correções geradas por inteligência artificial.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          {[
            { icon: Shield, text: '50+ tipos de vulnerabilidades' },
            { icon: Bot, text: 'Correção automática com IA' },
            { icon: Zap, text: 'Scan em menos de 30 segundos' },
          ].map((feature) => (
            <div key={feature.text} className="flex items-center gap-3">
              <div className="p-2 bg-background text-foreground">
                <feature.icon className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <span className="font-bold uppercase tracking-wide text-sm">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile back button */}
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors mb-8 brutal-link">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-bold uppercase tracking-wider text-sm">Voltar</span>
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden border-4 border-foreground p-2 inline-block bg-foreground mb-8">
            <Image
              src="/logo.png"
              alt="GitScan Logo"
              width={140}
              height={40}
              priority
              className="invert"
            />
          </div>

          <div className="border-4 border-foreground bg-background p-8 shadow-brutal-lg">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">
              ENTRAR
            </h2>
            <p className="text-muted-foreground mb-8">
              Use seu Personal Access Token do GitHub
            </p>

            <form onSubmit={handleTokenLogin} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-bold uppercase tracking-wider">
                  GitHub Token
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full border-4 border-foreground bg-background py-4 pl-12 pr-12 text-base font-mono focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground border-l-4 border-foreground pl-3 mt-3">
                  Crie um token em{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline hover:no-underline"
                  >
                    github.com/settings/tokens
                  </a>
                  <br />
                  <span className="text-xs">
                    Permissões necessárias:{' '}
                    <code className="bg-foreground text-background px-1 font-bold">repo</code>{' '}
                    <code className="bg-foreground text-background px-1 font-bold">read:user</code>
                  </span>
                </p>
              </div>

              <button
                type="submit"
                className="w-full border-4 border-foreground bg-foreground text-background py-4 text-lg font-bold uppercase tracking-wider transition-all duration-150 hover:bg-brutal-yellow hover:text-foreground shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-brutal flex items-center justify-center gap-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <Github className="h-6 w-6" />
                    Entrar com Token
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6 border-t-2 border-foreground pt-6">
              Ao continuar, você concorda com nossos{' '}
              <a href="#" className="font-bold underline hover:no-underline">Termos de Serviço</a>
              {' '}e{' '}
              <a href="#" className="font-bold underline hover:no-underline">Política de Privacidade</a>
            </p>
          </div>

          {/* Mobile features */}
          <div className="lg:hidden mt-8 grid grid-cols-2 gap-4">
            {[
              { label: 'XSS', color: 'bg-brutal-red' },
              { label: 'SQL Injection', color: 'bg-brutal-yellow' },
              { label: 'Secrets', color: 'bg-brutal-blue' },
              { label: 'Auto-Fix IA', color: 'bg-brutal-green' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`h-4 w-4 ${item.color} border-2 border-foreground`}></div>
                <span className="text-sm font-bold uppercase tracking-wide">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
