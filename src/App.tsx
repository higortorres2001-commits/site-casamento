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
import ProcessingPayment from "./pages/ProcessingPayment"; // Import the new ProcessingPayment page
import Logs from "./pages/admin/Logs"; // Import the new Logs page
import Layout from "./components/layout/Layout";
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
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/cupons" element={<Coupons />} />
              <Route path="/admin/logs" element={<Logs />} /> {/* New route for Logs */}
              <Route path="/checkout/:productId" element={<Checkout />} />
              <Route path="/meus-produtos" element={<MyProducts />} />
              <Route path="/produto/:productId" element={<ProductDetails />} />
              <Route path="/confirmacao" element={<Confirmation />} />
              <Route path="/processando-pagamento" element={<ProcessingPayment />} /> {/* New route */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;