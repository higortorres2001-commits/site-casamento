"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Home, LogOut, Tag, BookOpen, ScrollText, Users, RefreshCw, Search, UserCheck, Bug, Users as UsersIcon } from 'lucide-react';
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao fazer logout: " + error.message);
    } else {
      showSuccess("Logout realizado com sucesso!");
    }
    if (onCloseMobileMenu) onCloseMobileMenu();
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
            <Link to="/admin/logs" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <ScrollText className="h-4 w-4" />
              Logs
            </Link>
            <Link to="/admin/sync-payment" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <RefreshCw className="h-4 w-4" />
              Sincronizar Pagamento
            </Link>
            <Link to="/admin/sync-specific-payment" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <Search className="h-4 w-4" />
              Buscar Pagamento
            </Link>
            <Link to="/admin/fix-missing-auth" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <UserCheck className="h-4 w-4" />
              Corrigir Auth
            </Link>
            <Link to="/admin/auth-debug" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <Bug className="h-4 w-4" />
              Debug Auth
            </Link>
            <Link to="/admin/duplicate-users" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-primary hover:bg-sidebar-accent" onClick={onCloseMobileMenu}>
              <UsersIcon className="h-4 w-4" />
              Usuários Duplicados
            </Link>
          </>
        )}
      </nav>
      <div className="mt-auto">
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:text-destructive" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;