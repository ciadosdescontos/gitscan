'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LogOut,
  User,
  Settings,
  Moon,
  Sun,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect, useState } from 'react';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b-4 border-foreground bg-card px-6">
      {/* Title / Breadcrumb area */}
      <div className="flex-1">
        <h1 className="text-lg font-black uppercase tracking-wider">GitScan</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background transition-all duration-150 hover:bg-foreground hover:text-background"
        >
          {isDark ? (
            <Sun className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <Moon className="h-5 w-5" strokeWidth={2.5} />
          )}
        </button>

        {/* Notifications */}
        <button className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background transition-all duration-150 hover:bg-foreground hover:text-background">
          <Bell className="h-5 w-5" strokeWidth={2.5} />
        </button>

        {/* User Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-3 border-2 border-foreground bg-background px-3 py-1.5 transition-all duration-150 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2">
              {user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.username}
                  width={32}
                  height={32}
                  className="border-2 border-foreground"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center bg-foreground text-background">
                  <User className="h-5 w-5" />
                </div>
              )}
              <span className="text-sm font-bold uppercase tracking-wider hidden sm:block">
                {user?.username}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[220px] border-4 border-foreground bg-card p-2 shadow-brutal-lg"
              align="end"
              sideOffset={8}
            >
              <div className="px-3 py-3 border-b-2 border-foreground mb-2">
                <p className="text-sm font-black uppercase tracking-wider">{user?.username}</p>
                <p className="text-xs text-muted-foreground font-mono">{user?.email}</p>
              </div>

              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:bg-foreground hover:text-background focus:outline-none focus:bg-foreground focus:text-background"
                onClick={() => router.push('/settings')}
              >
                <Settings className="h-4 w-4" strokeWidth={2.5} />
                Configurações
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-2 h-0.5 bg-foreground" />

              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-wider text-brutal-red transition-all duration-150 hover:bg-brutal-red hover:text-white focus:outline-none focus:bg-brutal-red focus:text-white"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" strokeWidth={2.5} />
                Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
