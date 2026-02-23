import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderWithItems {
  id: string;
  order_number: number;
  total: number;
  status: "pendiente" | "pagado" | "cancelado";
  customer_name?: string;
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_size_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  custom_label?: string;
  product?: {
    name: string;
    price?: number;
  };
  product_size?: {
    name: string;
    price: number;
  };
  customizations?: OrderCustomization[];
}

export interface OrderCustomization {
  id: string;
  order_item_id: string;
  ingredient_id: string;
  ingredient?: {
    name: string;
  };
}

export function useOrders(filters?: {
  status?: "pendiente" | "pagado" | "cancelado";
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["orders", filters],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          `
          *,
          order_items(
            *,
            product:products(name, price),
            product_size:product_sizes(name, price),
            order_item_customizations(
              *,
              ingredient:ingredients(name)
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        query = query.or(
          `order_number.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`
        );
      }

      if (filters?.dateFrom) {
        const fromDate = filters.dateFrom.toISOString().split("T")[0];
        query = query.gte("created_at", fromDate);
      }

      if (filters?.dateTo) {
        const toDate = filters.dateTo.toISOString().split("T")[0];
        query = query.lte("created_at", toDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as OrderWithItems[];
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (variables: {
      orderId: string;
      status: "pendiente" | "pagado" | "cancelado";
    }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: variables.status })
        .eq("id", variables.orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    isUpdating: updateOrderStatusMutation.isPending,
  };
}
