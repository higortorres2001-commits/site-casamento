"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Tag } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import CouponForm from "@/components/CouponForm";
import { Coupon } from "@/types";

const Coupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) {
      showError("Erro ao carregar cupons: " + error.message);
      console.error("Error fetching coupons:", error);
    } else {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  const handleCreateCoupon = () => {
    setEditingCoupon(undefined);
    setIsModalOpen(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (formData: Omit<Coupon, "id" | "created_at">) => {
    setIsSubmitting(true);
    if (editingCoupon) {
      // Update existing coupon
      const { error } = await supabase
        .from("coupons")
        .update(formData)
        .eq("id", editingCoupon.id);
      if (error) {
        showError("Erro ao atualizar cupom: " + error.message);
        console.error("Error updating coupon:", error);
      } else {
        showSuccess("Cupom atualizado com sucesso!");
        fetchCoupons();
        setIsModalOpen(false);
      }
    } else {
      // Create new coupon
      const { error } = await supabase.from("coupons").insert(formData);
      if (error) {
        showError("Erro ao criar cupom: " + error.message);
        console.error("Error creating coupon:", error);
      } else {
        showSuccess("Cupom criado com sucesso!");
        fetchCoupons();
        setIsModalOpen(false);
      }
    }
    setIsSubmitting(false);
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este cupom?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      showError("Erro ao excluir cupom: " + error.message);
      console.error("Error deleting coupon:", error);
    } else {
      showSuccess("Cupom excluído com sucesso!");
      fetchCoupons();
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    const newActiveStatus = !coupon.active;
    const { error } = await supabase
      .from("coupons")
      .update({ active: newActiveStatus })
      .eq("id", coupon.id);
    if (error) {
      showError("Erro ao alterar status do cupom: " + error.message);
      console.error("Error toggling coupon status:", error);
    } else {
      showSuccess(`Cupom ${newActiveStatus ? "ativado" : "desativado"} com sucesso!`);
      fetchCoupons();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Cupons</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleCreateCoupon}
            >
              <Tag className="mr-2 h-4 w-4" /> Adicionar Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}</DialogTitle>
            </DialogHeader>
            <CouponForm
              initialData={editingCoupon}
              onSubmit={handleSaveCoupon}
              onCancel={() => setIsModalOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Carregando cupons...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo de Desconto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-medium">{coupon.code}</TableCell>
                  <TableCell>{coupon.discount_type === "percentage" ? "Percentual" : "Fixo"}</TableCell>
                  <TableCell>{coupon.value.toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={coupon.active}
                      onCheckedChange={() => handleToggleActive(coupon)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCoupon(coupon)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Coupons;