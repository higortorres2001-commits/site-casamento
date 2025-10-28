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
import Checkout from "./pages/Checkout";
import MyProducts from "./pages/MyProducts";
import ProductDetails from "./pages/ProductDetails";
import Confirmation from "./pages/Confirmation";
import ProcessingPayment from "./pages/ProcessingPayment";
import Logs from "./pages/admin/Logs";
import UpdatePassword from "./pages/UpdatePassword";
import AdminLayout from "./components/layout/AdminLayout"; // Import AdminLayout
import PublicLayout from "./components/layout/PublicLayout"; // Import PublicLayout
import { SessionContextProvider } from "./components/SessionContextProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            {/* Rotas autônomas que gerenciam seu próprio layout de página inteira */}
            <Route path="/login" element={<Login />} />
            <Route path="/checkout/:productId" element={<Checkout />} />
            <Route path="/primeira-senha" element={<UpdatePassword />} />

            {/* Rotas de administração usando AdminLayout (com sidebar e verificação de admin) */}
            <Route element={<AdminLayout />}>
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/cupons" element={<Coupons />} />
              <Route path="/admin/logs" element={<Logs />} />
            </Route>

            {/* Rotas de cliente usando PublicLayout (wrapper vazio) */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/meus-produtos" element={<MyProducts />} />
              <Route path="/produto/:productId" element={<ProductDetails />} />
              <Route path="/confirmacao" element={<Confirmation />} />
              <Route path="/processando-pagamento" element={<ProcessingPayment />} />
            </Route>
            
            {/* Rota catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;