import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Products from "./pages/admin/Products";
import Coupons from "./pages/admin/Coupons";
import Customers from "./pages/admin/Customers"; // NEW: admin customers page
import Checkout from "./pages/Checkout";
import MyProducts from "./pages/MyProducts";
import ProductDetails from "./pages/ProductDetails";
import Confirmation from "./pages/Confirmation";
import ProcessingPayment from "./pages/ProcessingPayment";
import Logs from "./pages/admin/Logs";
import UpdatePassword from "./pages/UpdatePassword";
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";
import { SessionContextProvider } from "./components/SessionContextProvider";
import WhatsAppButton from "./components/WhatsAppButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/checkout/:productId" element={<Checkout />} />
            <Route path="/primeira-senha" element={<UpdatePassword />} />

            <Route element={<AdminLayout />}>
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/cupons" element={<Coupons />} />
              <Route path="/admin/customers" element={<Customers />} /> {/* NEW: Customers admin route */} 
              <Route path="/admin/logs" element={<Logs />} />
            </Route>

            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/meus-produtos" element={<MyProducts />} />
              <Route path="/produto/:productId" element={<ProductDetails />} />
              <Route path="/confirmacao" element={<Confirmation />} />
              <Route path="/processando-pagamento" element={<ProcessingPayment />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <WhatsAppButton />
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;