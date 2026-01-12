import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { SessionContextProvider } from "./components/SessionContextProvider";
import WhatsAppButton from "./components/WhatsAppButton";
import { usePixelInitialization } from "./hooks/use-pixel-initialization";
import { Loader2 } from "lucide-react";

// Lazy loaded pages - each becomes its own chunk
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Gifts = lazy(() => import("./pages/Gifts"));
const WeddingListSettings = lazy(() => import("./pages/WeddingListSettings"));
const GuestManagement = lazy(() => import("./pages/GuestManagement"));
const PublicGiftList = lazy(() => import("./pages/PublicGiftList"));
const GiftCheckout = lazy(() => import("./pages/GiftCheckout"));
const MagicRsvp = lazy(() => import("./pages/MagicRsvp"));
const Products = lazy(() => import("./pages/admin/Products"));
const Coupons = lazy(() => import("./pages/admin/Coupons"));
const Customers = lazy(() => import("./pages/admin/Customers"));
const Sales = lazy(() => import("./pages/admin/Sales"));
const FailedSales = lazy(() => import("./pages/admin/FailedSales"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyProducts = lazy(() => import("./pages/MyProducts"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Confirmation = lazy(() => import("./pages/Confirmation"));
const ProcessingPayment = lazy(() => import("./pages/ProcessingPayment"));
const Logs = lazy(() => import("./pages/admin/Logs"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const ProductTags = lazy(() => import("./pages/admin/ProductTags"));

// Layouts are loaded eagerly since they're used by multiple routes
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";

const queryClient = new QueryClient();

// Loading spinner for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      <p className="text-sm text-gray-500">Carregando...</p>
    </div>
  </div>
);

const AppContent = () => {
  // Initialize Pixel with user data
  usePixelInitialization();

  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="/admin/failed-sales" element={<FailedSales />} />
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
    </Suspense>
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