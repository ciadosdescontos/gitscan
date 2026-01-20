'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken, fetchUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Falha na autenticação. Por favor, tente novamente.');
      return;
    }

    if (token) {
      setToken(token);
      fetchUser().then(() => {
        router.push('/dashboard');
      }).catch(() => {
        setError('Falha ao carregar dados do usuário.');
      });
    } else {
      setError('Token não encontrado. Por favor, tente novamente.');
    }
  }, [searchParams, setToken, fetchUser, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-xl font-semibold">Erro de Autenticação</h2>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/auth/login')}>
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <h2 className="mb-2 text-xl font-semibold">Autenticando...</h2>
          <p className="text-muted-foreground">
            Aguarde enquanto configuramos sua conta
          </p>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] bg-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
