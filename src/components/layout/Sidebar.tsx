"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Home, LogOut, Tag, BookOpen, ScrollText, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface SidebarProps {
  isMobile: boolean;
  onCloseMobileMenu?: () => void;
}

const ADMIN_EMAIL = "higor.torres8@gmail.com";

const Sidebar = ({ isMobile, onCloseMobileMenu }: SidebarProps) => {
  const { user } = useSession();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    try {
      console.log('Iniciando processo de logout...');
      
      // Verificar se há uma sessão ativa antes de tentar fazer logout
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('Nenhuma sessão ativa encontrada, redirecionando para login');
        showSuccess("Você já está deslogado.");
        if (onCloseMobileMenu) onCloseMobileMenu();
        // Forçar redirecionamento para a página de login
        window.location.href = '/login';
        return;
      }

      console.log('Sessão encontrada, fazendo signOut...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Erro específico do Supabase ao fazer logout:', error);
        
        // Tratamento específico para diferentes tipos de erro
        if (error.message.includes('Auth session missing')) {
          // Se a sessão está faltando, consideramos que o logout foi bem-sucedido
          console.log('Sessão ausente detectada, tratando como logout bem-sucedido');
          showSuccess("Logout realizado com sucesso!");
          if (onCloseMobileMenu) onCloseMobileMenu();
          window.location.href = '/login';
        } else {
          // Outros tipos de erro
          showError("Erro ao fazer logout: " + error.message);
          console.error('Erro de logout detalhado:', {
            name: error.name,
            message: error.message,
            status: error.status
          });
        }
      } else {
        console.log('Logout realizado com sucesso');
        showSuccess("Logout realizado com sucesso!");
        if (onCloseMobileMenu) onCloseMobileMenu();
        // Forçar redirecionamento para garantir que a sessão seja limpa
        window.location.href = '/login';
      }
    } catch (err: any) {
      console.error('Erro inesperado durante o logout:', err);
      showError("Erro inesperado ao fazer logout. Por favor, tente novamente.");
      
      // Mesmo em caso de erro, tentar redirecionar para o login
      if (onCloseMobileMenu) onCloseMobileMenu();
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-sidebar-primary-foreground">
          {isAdmin ? "Admin" : "Minha Conta"}
        </h2>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onCloseMobileMenu}>
            <Home className="h-5 w-5" />
          </Button>
        )}
      </div>
      <nav className="flex-1 space-y-2">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
          <Home className="h-4 w-4" />
          Início
        </Link>
        <Link to="/meus-produtos" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
          <BookOpen className="h-4 w-4" />
          Meus Produtos
        </Link>
        {isAdmin && (
          <>
            <Link to="/admin/products" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <Package className="h-4 w-4" />
              Produtos
            </Link>
            <Link to="/admin/cupons" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <Tag className="h-4 w-4" />
              Cupons
            </Link>
            <Link to="/admin/customers" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <Users className="h-4 w-4" />
              Clientes
            </Link>
            <Link to="/admin/sales" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <ShoppingCart className="h-4 w-4" />
              Vendas
            </Link>
            <Link to="/admin/logs" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <ScrollText className="h-4 w-4" />
              Logs
            </Link>
          </>
        )}
      </nav>
      <div className="mt-auto">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground hover:text-destructive" 
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;