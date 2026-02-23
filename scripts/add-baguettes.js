import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  try {
    // First, get the display_order of Sándwiches category
    const { data: sandwichesCategory, error: fetchError } = await supabase
      .from("categories")
      .select("display_order")
      .eq("name", "Sándwiches")
      .single();

    if (fetchError) {
      console.error("Error fetching Sándwiches category:", fetchError);
      process.exit(1);
    }

    const baguetteOrder = sandwichesCategory.display_order + 1;

    // Insert Baguettes category
    const { data: baguettesCategory, error: insertCatError } = await supabase
      .from("categories")
      .insert({ name: "Baguettes", display_order: baguetteOrder })
      .select()
      .single();

    if (insertCatError) {
      console.error("Error inserting Baguettes category:", insertCatError);
      process.exit(1);
    }

    console.log("✓ Baguettes category created:", baguettesCategory.id);

    // Insert products
    const products = [
      { name: "Baguette Pavo y Panela", price: 85.0, display_order: 1 },
      { name: "Baguette Serrano y Queso", price: 110.0, display_order: 2 },
      { name: "Baguette Healthy", price: 75.0, display_order: 3 },
      { name: "Baguette Roast Beef", price: 110.0, display_order: 4 },
      { name: "Baguette Garlic Grill Cheese", price: 75.0, display_order: 5 },
    ];

    const productsToInsert = products.map((p) => ({
      category_id: baguettesCategory.id,
      name: p.name,
      price: p.price,
      is_customizable: false,
      display_order: p.display_order,
    }));

    const { data: insertedProducts, error: insertProdError } = await supabase
      .from("products")
      .insert(productsToInsert)
      .select();

    if (insertProdError) {
      console.error("Error inserting products:", insertProdError);
      process.exit(1);
    }

    console.log("✓ Products created:", insertedProducts.length);
    insertedProducts.forEach((p) => {
      console.log(`  - ${p.name} ($${p.price})`);
    });

    console.log("\n✓ Migration completed successfully!");
  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

runMigration();
