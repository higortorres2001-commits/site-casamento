import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Gifts from "./pages/Gifts";
import WeddingListSettings from "./pages/WeddingListSettings";
import GuestManagement from "./pages/GuestManagement";
import PublicGiftList from "./pages/PublicGiftList";
import GiftCheckout from "./pages/GiftCheckout";
import MagicRsvp from "./pages/MagicRsvp";
import Products from "./pages/admin/Products";
import Coupons from "./pages/admin/Coupons";
import Customers from "./pages/admin/Customers";
import Sales from "./pages/admin/Sales";
import FailedSales from "./pages/admin/FailedSales"; // Nova importação
import Checkout from "./pages/Checkout";
import MyProducts from "./pages/MyProducts";
import ProductDetails from "./pages/ProductDetails";
import Confirmation from "./pages/Confirmation";
import ProcessingPayment from "./pages/ProcessingPayment";
import Logs from "./pages/admin/Logs";
import UpdatePassword from "./pages/UpdatePassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";
import { SessionContextProvider } from "./components/SessionContextProvider";
import WhatsAppButton from "./components/WhatsAppButton";
import ProductTags from "./pages/admin/ProductTags";
import { usePixelInitialization } from "./hooks/use-pixel-initialization";

const queryClient = new QueryClient();

const AppContent = () => {
  // Inicializar o Pixel com dados do usuário
  usePixelInitialization();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Navigate to="/onboarding" replace />} />
      <Route path="/checkout/:productId" element={<Checkout />} />
      <Route path="/primeira-senha" element={<UpdatePassword />} />
      <Route path="/update-password" element={<ResetPassword />} />
      <Route path="/lista/:slug" element={<PublicGiftList />} />
      <Route path="/lista/:slug/rsvp/:envelopeSlug" element={<MagicRsvp />} />
      <Route path="/presente/:giftId" element={<GiftCheckout />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route element={<AdminLayout />}>
        <Route path="/admin/products" element={<Products />} />
        <Route path="/admin/cupons" element={<Coupons />} />
        <Route path="/admin/customers" element={<Customers />} />
        <Route path="/admin/sales" element={<Sales />} />
        <Route path="/admin/failed-sales" element={<FailedSales />} /> {/* Nova rota */}
        <Route path="/admin/logs" element={<Logs />} />
        <Route path="/admin/product-tags" element={<ProductTags />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/presentes" element={<Gifts />} />
        <Route path="/minha-lista" element={<WeddingListSettings />} />
        <Route path="/convidados" element={<GuestManagement />} />
        <Route path="/meus-produtos" element={<MyProducts />} />
        <Route path="/meu-perfil" element={<Profile />} />
        <Route path="/produto/:productId" element={<ProductDetails />} />
        <Route path="/confirmacao" element={<Confirmation />} />
        <Route path="/processando-pagamento" element={<ProcessingPayment />} />
      </Route>

      {/* Home route redirects to login */}
      <Route path="/" element={<Login />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <AppContent />
            <WhatsAppButton />
          </SessionContextProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;