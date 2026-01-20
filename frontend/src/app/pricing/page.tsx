'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Check, Zap, Building2, Rocket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { subscriptionApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  popular: boolean;
}

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<any>(null);

  useEffect(() => {
    loadPlans();
    loadStripeKey();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await subscriptionApi.getPlans();
      setPlans(response.data.data.plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
      // Fallback plans
      setPlans([
        {
          id: 'FREE',
          name: 'Gratuito',
          description: 'Perfeito para projetos pessoais',
          price: 0,
          currency: 'BRL',
          interval: 'month',
          features: [
            '3 repositorios',
            '10 scans por mes',
            '5 correcoes IA por mes',
            'Scanners basicos',
            'Suporte por email',
          ],
          popular: false,
        },
        {
          id: 'PRO',
          name: 'Pro',
          description: 'Para desenvolvedores e pequenas equipes',
          price: 49.00,
          currency: 'BRL',
          interval: 'month',
          features: [
            '20 repositorios',
            '100 scans por mes',
            '50 correcoes IA por mes',
            'Todos os scanners',
            'Scanners customizados',
            'Suporte prioritario',
            'Acesso a API',
          ],
          popular: true,
        },
        {
          id: 'ENTERPRISE',
          name: 'Enterprise',
          description: 'Para empresas e grandes equipes',
          price: 199.00,
          currency: 'BRL',
          interval: 'month',
          features: [
            'Repositorios ilimitados',
            'Scans ilimitados',
            'Correcoes IA ilimitadas',
            'Todos os scanners',
            'Scanners customizados',
            'Suporte 24/7 dedicado',
            'Acesso completo a API',
            'SLA garantido',
            'Onboarding personalizado',
          ],
          popular: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadStripeKey = async () => {
    try {
      const response = await subscriptionApi.getStripeKey();
      const key = response.data.data.publishableKey;
      if (key) {
        setStripePromise(loadStripe(key));
      }
    } catch (error) {
      console.error('Failed to load Stripe key:', error);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/pricing');
      return;
    }

    if (planId === 'FREE') {
      router.push('/dashboard');
      return;
    }

    setCheckoutLoading(planId);

    try {
      const response = await subscriptionApi.createCheckout(planId);
      const { url } = response.data.data;

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao criar checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'FREE':
        return <Rocket className="h-6 w-6" />;
      case 'PRO':
        return <Zap className="h-6 w-6" />;
      case 'ENTERPRISE':
        return <Building2 className="h-6 w-6" />;
      default:
        return <Rocket className="h-6 w-6" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    return user?.plan === planId;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-black bg-brutal-yellow">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="text-2xl font-black uppercase">
            GitScan
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="brutal">Dashboard</Button>
              </Link>
            ) : (
              <Link href="/auth/login">
                <Button variant="brutal">Entrar</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b-4 border-black bg-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-4 text-5xl font-black uppercase tracking-tight md:text-6xl">
            Planos e Precos
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Escolha o plano ideal para proteger seu codigo. Todos os planos incluem
            deteccao de vulnerabilidades com IA.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col border-4 border-black bg-white p-8 transition-transform hover:-translate-y-2 ${
                  plan.popular ? 'ring-4 ring-brutal-yellow ring-offset-4' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brutal-yellow text-black border-2 border-black px-4 py-1 text-sm font-bold uppercase">
                    Mais Popular
                  </Badge>
                )}

                {/* Plan Header */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-brutal-yellow">
                    {getPlanIcon(plan.id)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black">
                      {plan.price === 0 ? 'Gratis' : formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/mes</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  variant={plan.popular ? 'brutal' : 'outline'}
                  size="lg"
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={checkoutLoading !== null || isCurrentPlan(plan.id)}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isCurrentPlan(plan.id)
                    ? 'Plano Atual'
                    : plan.price === 0
                    ? 'Comecar Gratis'
                    : 'Assinar Agora'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t-4 border-black bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-4xl font-black uppercase">
            Perguntas Frequentes
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {[
              {
                q: 'Posso cancelar a qualquer momento?',
                a: 'Sim! Voce pode cancelar sua assinatura a qualquer momento. Seu acesso continua ate o fim do periodo pago.',
              },
              {
                q: 'Quais formas de pagamento sao aceitas?',
                a: 'Aceitamos cartoes de credito (Visa, Mastercard, American Express) e PIX atraves do Stripe.',
              },
              {
                q: 'Posso fazer upgrade ou downgrade do plano?',
                a: 'Sim! Voce pode alterar seu plano a qualquer momento. O valor sera ajustado proporcionalmente.',
              },
              {
                q: 'Existe periodo de teste?',
                a: 'O plano gratuito permite que voce teste a plataforma sem compromisso. Faca upgrade quando estiver pronto.',
              },
              {
                q: 'Os dados sao seguros?',
                a: 'Sim! Usamos criptografia de ponta e nao armazenamos seu codigo. Apenas analisamos temporariamente.',
              },
              {
                q: 'Posso usar em repositorios privados?',
                a: 'Sim! Todos os planos suportam repositorios publicos e privados do GitHub.',
              },
            ].map((faq, index) => (
              <div key={index} className="border-2 border-black bg-white p-6">
                <h3 className="mb-2 font-bold">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t-4 border-black bg-brutal-yellow py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-4xl font-black uppercase">
            Pronto para proteger seu codigo?
          </h2>
          <p className="mb-8 text-xl">
            Comece gratuitamente e faca upgrade quando precisar de mais recursos.
          </p>
          <Link href={isAuthenticated ? '/dashboard' : '/auth/login'}>
            <Button variant="brutal" size="lg">
              {isAuthenticated ? 'Ir para o Dashboard' : 'Comecar Agora'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-black py-8 text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold">GitScan - Pressa Digital</p>
          <p className="text-sm text-gray-400">CNPJ: 63.971.377/0001-08</p>
          <p className="mt-2 text-sm text-gray-400">
            Todos os direitos reservados 2024-2026
          </p>
        </div>
      </footer>
    </div>
  );
}
