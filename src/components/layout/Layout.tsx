"use client";

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Loader2 } from 'lucide-react'; // Importando Loader2
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';

const ADMIN_EMAIL = "higor.torres8@gmail.com";

const Layout = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading: isSessionLoading } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSessionLoading && user) {
      const isAdminRoute = location.pathname.startsWith('/admin');
      if (isAdminRoute && user.email !== ADMIN_EMAIL) {
        showError("Você não tem permissão para acessar esta área.");
        navigate('/meus-produtos');
      }
    }
  }, [location.pathname, user, isSessionLoading, navigate]);

  const handleCloseMobileMenu = () => setIsMobileMenuOpen(false);

  // Renderiza um loader enquanto a sessão está carregando para evitar flashes de conteúdo não autorizado
  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {isMobile ? (
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar isMobile={true} onCloseMobileMenu={handleCloseMobileMenu} />
          </SheetContent>
        </Sheet>
      ) : (
        <aside className="w-64 flex-shrink-0">
          <Sidebar isMobile={false} />
        </aside>
      )}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;