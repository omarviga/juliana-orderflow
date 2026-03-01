import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          price,
          is_customizable,
          description,
          display_order,
          category_id,
          created_at,
          categories:category_id (
            id,
            name,
            display_order
          )
        `)
        .order("display_order", { referencedTable: "categories", ascending: true })
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductsByCategory(categoryId: string | null) {
  return useQuery({
    queryKey: ["products", "by-category", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryId!)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductsWithPrice() {
  return useQuery({
    queryKey: ["products", "with-price"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .not("price", "is", null)
        .order("price", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ["products", "search", query],
    enabled: query.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories:category_id (
            name
          )
        `)
        .ilike("name", `%${query}%`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomizableProducts() {
  return useQuery({
    queryKey: ["products", "customizable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          categories:category_id (
            name
          )
        `)
        .eq("is_customizable", true);
      if (error) throw error;
      return data;
    },
  });
}

export function useProductSizes() {
  return useQuery({
    queryKey: ["product_sizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_sizes")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useIngredients() {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}
