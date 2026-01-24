'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderGit2,
  Scan,
  Settings,
  Bug,
  Zap,
  Shield,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Repositórios', href: '/repositories', icon: FolderGit2 },
  { name: 'Scans', href: '/scans', icon: Scan },
  { name: 'Pentest', href: '/pentest', icon: Shield },
  { name: 'Vulnerabilidades', href: '/vulnerabilities', icon: Bug },
];

const secondaryNavigation = [
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r-4 border-foreground bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b-4 border-foreground px-4 bg-foreground">
        <Image
          src="/logo.png"
          alt="GitScan Logo"
          width={140}
          height={40}
          className="invert"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150 border-2',
                isActive
                  ? 'bg-foreground text-background border-foreground shadow-brutal'
                  : 'text-foreground border-transparent hover:border-foreground hover:bg-secondary'
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.5} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="border-t-4 border-foreground px-3 py-4">
        {secondaryNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150 border-2',
                isActive
                  ? 'bg-foreground text-background border-foreground shadow-brutal'
                  : 'text-foreground border-transparent hover:border-foreground hover:bg-secondary'
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.5} />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Quick Scan */}
      <div className="border-t-4 border-foreground p-4">
        <Link
          href="/scans/new"
          className="flex w-full items-center justify-center gap-2 border-4 border-foreground bg-brutal-yellow px-4 py-3 text-sm font-bold uppercase tracking-wider text-foreground shadow-brutal transition-all duration-150 hover:shadow-none hover:translate-x-1 hover:translate-y-1"
        >
          <Zap className="h-5 w-5" strokeWidth={2.5} />
          Novo Scan
        </Link>
      </div>
    </div>
  );
}
