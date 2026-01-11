"use client";

import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Settings, LogOut, Home, Gift, Users, Menu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess } from '@/utils/toast';
import Brand from '@/components/Brand';

const PublicLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Início', icon: Home },
    { path: '/presentes', label: 'Presentes', icon: Gift },
    { path: '/convidados', label: 'Convidados', icon: Users },
    { path: '/minha-lista', label: 'Configurações', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showSuccess('Você saiu da conta!');
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 h-24">
        <div className="max-w-6xl mx-auto px-4 h-full relative flex items-center justify-between">
          {/* Left Section (Mobile Menu / Desktop Logo) */}
          <div className="flex items-center gap-4 z-20">
            {/* Mobile Menu Button - Left */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-gray-600 -ml-2"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu className="w-6 h-6" />
            </Button>

            {/* Desktop Logo - Left */}
            <div
              className="hidden md:block cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <Brand className="h-[5em]" />
            </div>
          </div>

          {/* Center Section (Mobile Logo / Desktop Nav) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            {/* Mobile Logo - Absolute Center */}
            <div
              className="md:hidden cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <Brand className="h-[5em]" />
            </div>

            {/* Desktop Navigation - Absolute Center */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={`text-sm font-medium transition-colors ${isActive(item.path)
                    ? 'text-pink-600 bg-pink-50'
                    : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
                    }`}
                >
                  <item.icon className="w-4 h-4 mr-1.5" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Right Section: User Menu */}
          <div className="flex items-center gap-2 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-600">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/meu-perfil')}>
                  <User className="w-4 h-4 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/minha-lista')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate(item.path);
                    setMenuOpen(false);
                  }}
                  className={`justify-start ${isActive(item.path)
                    ? 'text-pink-600 bg-pink-50'
                    : 'text-gray-600'
                    }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <Brand size="sm" />
          <p className="text-xs text-gray-400">
            © 2025 DuetLove. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;