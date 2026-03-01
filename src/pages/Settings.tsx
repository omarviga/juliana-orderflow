import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";
import { useCategories, useProducts } from "@/hooks/useMenuData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bluetooth, Store, Clock, RotateCcw, Check, Trash2, Plus, QrCode, Upload, ExternalLink, Link as LinkIcon, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

const MENU_FILE_STORAGE_KEY = "menu_file_url";
const MENU_FILE_NAME_KEY = "menu_file_name";
const MENU_BUCKET = import.meta.env.VITE_SUPABASE_MENU_BUCKET || "menus";
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf"];

const normalizeProductKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function SettingsPage() {
  const { settings, updateSettings, resetToDefaults } = useSystemSettings();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();
  const queryClient = useQueryClient();
  const {
    preferences,
    savePreferences,
  } = useBluetootPrinter();

  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [menuFileUrl, setMenuFileUrl] = useState<string>(() => localStorage.getItem(MENU_FILE_STORAGE_KEY) || "");
  const [menuFileName, setMenuFileName] = useState<string>(() => localStorage.getItem(MENU_FILE_NAME_KEY) || "");
  const [selectedMenuFile, setSelectedMenuFile] = useState<File | null>(null);
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState<string>("");
  const [priceDraftByProductId, setPriceDraftByProductId] = useState<Record<string, string>>({});
  const [isSavingMenu, setIsSavingMenu] = useState(false);

  const uniqueProducts = useMemo(() => {
    const uniqueByCategoryAndName = new Map<string, (typeof products)[number]>();

    for (const product of products) {
      const key = `${product.category_id}:${normalizeProductKey(product.name)}`;
      const existing = uniqueByCategoryAndName.get(key);

      if (!existing) {
        uniqueByCategoryAndName.set(key, product);
        continue;
      }

      const existingDate = Date.parse(existing.created_at || "");
      const productDate = Date.parse(product.created_at || "");
      if (!Number.isNaN(productDate) && (Number.isNaN(existingDate) || productDate < existingDate)) {
        uniqueByCategoryAndName.set(key, product);
      }
    }

    return Array.from(uniqueByCategoryAndName.values());
  }, [products]);

  const dessertsCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.name
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") === "postres"
      ) || null,
    [categories]
  );

  useEffect(() => {
    if (!newProductCategoryId && categories.length > 0) {
      setNewProductCategoryId(categories[0].id);
    }
  }, [categories, newProductCategoryId]);

  useEffect(() => {
    const drafts: Record<string, string> = {};
    for (const product of products) {
      if (typeof product.price === "number") {
        drafts[product.id] = product.price.toFixed(2);
      }
    }
    setPriceDraftByProductId(drafts);
  }, [products]);

  const handleSaveBusinessInfo = async () => {
    setIsSaving(true);
    try {
      updateSettings({
        businessName: localSettings.businessName,
        businessPhone: localSettings.businessPhone,
        businessAddress: localSettings.businessAddress,
        businessCity: localSettings.businessCity,
        businessEmail: localSettings.businessEmail,
      });
      toast.success("Información guardada correctamente");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      updateSettings({
        openTime: localSettings.openTime,
        closeTime: localSettings.closeTime,
      });
      toast.success("Horarios guardados correctamente");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        "¿Estás seguro? Esto restaurará toda la configuración a los valores por defecto."
      )
    ) {
      resetToDefaults();
      setLocalSettings(settings);
      toast.success("Configuración restaurada");
    }
  };

  const isValidMenuFile = (file: File) => {
    const byMime = ALLOWED_MIME_TYPES.includes(file.type);
    const lowerName = file.name.toLowerCase();
    const byExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    return byMime || byExtension;
  };

  const handleMenuFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedMenuFile(null);
      return;
    }

    if (!isValidMenuFile(file)) {
      toast.error("Formato inválido. Solo se permite PNG, JPG o PDF.");
      event.target.value = "";
      setSelectedMenuFile(null);
      return;
    }

    setSelectedMenuFile(file);
  };

  const handleUploadMenu = async () => {
    if (!selectedMenuFile) {
      toast.error("Selecciona un archivo primero.");
      return;
    }

    setIsUploadingMenu(true);
    try {
      const timestamp = Date.now();
      const safeFileName = selectedMenuFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `restaurant-menu/${timestamp}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(MENU_BUCKET)
        .upload(path, selectedMenuFile, {
          upsert: true,
          contentType: selectedMenuFile.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from(MENU_BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      setMenuFileUrl(publicUrl);
      setMenuFileName(selectedMenuFile.name);
      localStorage.setItem(MENU_FILE_STORAGE_KEY, publicUrl);
      localStorage.setItem(MENU_FILE_NAME_KEY, selectedMenuFile.name);
      setSelectedMenuFile(null);

      toast.success("Menú cargado correctamente. QR generado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir el archivo.";
      toast.error(`Error al subir menú: ${message}`);
    } finally {
      setIsUploadingMenu(false);
    }
  };

  const handleCopyMenuLink = async () => {
    if (!menuFileUrl) return;
    try {
      await navigator.clipboard.writeText(menuFileUrl);
      toast.success("Liga copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la liga");
    }
  };

  const handleClearMenu = () => {
    setMenuFileUrl("");
    setMenuFileName("");
    setSelectedMenuFile(null);
    localStorage.removeItem(MENU_FILE_STORAGE_KEY);
    localStorage.removeItem(MENU_FILE_NAME_KEY);
    toast.success("Referencia de menú eliminada");
  };

  const handleCreateDessertsCategory = async () => {
    setIsSavingMenu(true);
    try {
      const nextOrder = categories.reduce((max, cat) => Math.max(max, cat.display_order), 0) + 1;
      const { error } = await supabase
        .from("categories")
        .insert({ name: "Postres", display_order: nextOrder });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría Postres creada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la categoría";
      toast.error(message);
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleCreateProduct = async () => {
    const trimmedName = newProductName.trim();
    const parsedPrice = Number(newProductPrice);
    if (!trimmedName) {
      toast.error("Ingresa el nombre del producto");
      return;
    }
    if (!newProductCategoryId) {
      toast.error("Selecciona una categoría");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Ingresa un precio válido");
      return;
    }

    const duplicateExists = products.some(
      (product) =>
        product.category_id === newProductCategoryId &&
        normalizeProductKey(product.name) === normalizeProductKey(trimmedName)
    );
    if (duplicateExists) {
      toast.error("Ese producto ya existe en la categoría seleccionada");
      return;
    }

    setIsSavingMenu(true);
    try {
      const nextOrder =
        products
          .filter((product) => product.category_id === newProductCategoryId)
          .reduce((max, product) => Math.max(max, product.display_order), 0) + 1;

      const { error } = await supabase.from("products").insert({
        category_id: newProductCategoryId,
        name: trimmedName,
        price: parsedPrice,
        is_customizable: false,
        display_order: nextOrder,
      });
      if (error) throw error;

      setNewProductName("");
      setNewProductPrice("");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto agregado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo agregar el producto";
      toast.error(message);
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleUpdateProductPrice = async (productId: string) => {
    const draftPrice = priceDraftByProductId[productId];
    const parsedPrice = Number(draftPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Precio inválido");
      return;
    }

    setIsSavingMenu(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ price: parsedPrice })
        .eq("id", productId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Precio actualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el precio";
      toast.error(message);
    } finally {
      setIsSavingMenu(false);
    }
  };

  const qrUrl = menuFileUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(menuFileUrl)}`
    : "";

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ajustes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura tu sistema, negocio e impresoras
          </p>
        </div>

        <Tabs defaultValue="business" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="business" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Negocio</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horarios</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <span className="h-4 w-4">⚙️</span>
              <span className="hidden sm:inline">Prefs</span>
            </TabsTrigger>
            <TabsTrigger value="menu-qr" className="gap-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Menú QR</span>
            </TabsTrigger>
            <TabsTrigger value="menu-admin" className="gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Menú POS</span>
            </TabsTrigger>
            <TabsTrigger value="printers" className="gap-2">
              <Bluetooth className="h-4 w-4" />
              <span className="hidden sm:inline">Impresoras</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB: Business Info */}
          <TabsContent value="business" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Negocio</CardTitle>
                <CardDescription>
                  Datos generales que aparecerán en tickets y recibos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business-name">Nombre del Negocio</Label>
                    <Input
                      id="business-name"
                      value={localSettings.businessName}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          businessName: e.target.value,
                        })
                      }
                      placeholder="Ej: JULIANA — BARRA COTIDIANA"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-phone">Teléfono</Label>
                    <Input
                      id="business-phone"
                      value={localSettings.businessPhone}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          businessPhone: e.target.value,
                        })
                      }
                      placeholder="Ej: 417 206 0111"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="business-address">Dirección</Label>
                    <Input
                      id="business-address"
                      value={localSettings.businessAddress}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          businessAddress: e.target.value,
                        })
                      }
                      placeholder="Ej: Av. Miguel Hidalgo #276"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-city">Ciudad</Label>
                    <Input
                      id="business-city"
                      value={localSettings.businessCity}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          businessCity: e.target.value,
                        })
                      }
                      placeholder="Ej: San Luis Potosí"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-email">Email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={localSettings.businessEmail}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          businessEmail: e.target.value,
                        })
                      }
                      placeholder="Ej: info@juliana.com"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveBusinessInfo}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Schedule */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Horarios de Atención</CardTitle>
                <CardDescription>
                  Define la hora de apertura y cierre
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="open-time">Hora de Apertura</Label>
                    <Input
                      id="open-time"
                      type="time"
                      value={localSettings.openTime}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          openTime: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="close-time">Hora de Cierre</Label>
                    <Input
                      id="close-time"
                      type="time"
                      value={localSettings.closeTime}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          closeTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Guardar Horarios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Preferences */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias Generales</CardTitle>
                <CardDescription>
                  Configura moneda, impuestos y otros valores por defecto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tax-rate">Tasa de Impuesto (%)</Label>
                    <Input
                      id="tax-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={localSettings.taxRate}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          taxRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Ej: 16"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme">Tema</Label>
                    <Select
                      value={localSettings.theme}
                      onValueChange={(value) =>
                        setLocalSettings({
                          ...localSettings,
                          theme: value as "light" | "dark" | "auto",
                        })
                      }
                    >
                      <SelectTrigger id="theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automático</SelectItem>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Oscuro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Idioma</Label>
                    <Select
                      value={localSettings.language}
                      onValueChange={(value) =>
                        setLocalSettings({
                          ...localSettings,
                          language: value as "es" | "en",
                        })
                      }
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      updateSettings({
                        currency: localSettings.currency,
                        taxRate: localSettings.taxRate,
                        theme: localSettings.theme,
                        language: localSettings.language,
                      });
                      toast.success("Preferencias guardadas");
                    }}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Guardar Preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Menu Admin */}
          <TabsContent value="menu-admin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Administrar Menú POS</CardTitle>
                <CardDescription>
                  Agrega productos, actualiza precios y crea la categoría Postres.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-product-name">Nombre</Label>
                    <Input
                      id="new-product-name"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Ej: Cheesecake"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-product-price">Precio</Label>
                    <Input
                      id="new-product-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      placeholder="Ej: 65"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-product-category">Categoría</Label>
                    <Select value={newProductCategoryId} onValueChange={setNewProductCategoryId}>
                      <SelectTrigger id="new-product-category" className="w-56">
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateProduct} disabled={isSavingMenu} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </Button>
                </div>

                {!dessertsCategory && (
                  <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted-foreground">
                      La categoría Postres aún no existe.
                    </p>
                    <Button variant="outline" onClick={handleCreateDessertsCategory} disabled={isSavingMenu}>
                      Crear categoría Postres
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Productos y precios</h3>
                  <div className="space-y-2">
                    {uniqueProducts.map((product) => (
                      <div key={product.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1fr_220px_120px]">
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {categories.find((c) => c.id === product.category_id)?.name || "Sin categoría"}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceDraftByProductId[product.id] ?? ""}
                          onChange={(e) =>
                            setPriceDraftByProductId((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleUpdateProductPrice(product.id)}
                          disabled={isSavingMenu}
                        >
                          Guardar precio
                        </Button>
                      </div>
                    ))}
                    {uniqueProducts.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No hay productos disponibles.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Menu QR */}
          <TabsContent value="menu-qr" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Menú Digital con QR</CardTitle>
                <CardDescription>
                  Sube un archivo PNG, JPG o PDF para generar una liga y su código QR.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="menu-file">Archivo del menú</Label>
                  <Input
                    id="menu-file"
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    onChange={handleMenuFileChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos permitidos: PNG, JPG, PDF.
                  </p>
                </div>

                {selectedMenuFile && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    Archivo seleccionado: <span className="font-medium">{selectedMenuFile.name}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUploadMenu} disabled={!selectedMenuFile || isUploadingMenu} className="gap-2">
                    <Upload className="h-4 w-4" />
                    {isUploadingMenu ? "Subiendo..." : "Subir y Generar QR"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleCopyMenuLink}
                    disabled={!menuFileUrl}
                    className="gap-2"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Copiar liga
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => menuFileUrl && window.open(menuFileUrl, "_blank", "noopener,noreferrer")}
                    disabled={!menuFileUrl}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir archivo
                  </Button>

                  <Button variant="destructive" onClick={handleClearMenu} disabled={!menuFileUrl}>
                    Limpiar
                  </Button>
                </div>

                {menuFileUrl && (
                  <div className="grid grid-cols-1 gap-6 rounded-lg border p-4 md:grid-cols-[300px_1fr]">
                    <div className="flex justify-center">
                      <img
                        src={qrUrl}
                        alt="Código QR del menú"
                        className="h-[280px] w-[280px] rounded-md border bg-white p-2"
                      />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Archivo activo</p>
                        <p className="text-sm text-muted-foreground">{menuFileName || "Menú sin nombre"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Liga para visualizar o descargar</p>
                        <a
                          href={menuFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-sm text-primary underline-offset-2 hover:underline"
                        >
                          {menuFileUrl}
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Escanea el QR para abrir el menú desde cualquier celular.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Printers */}
          <TabsContent value="printers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bluetooth className="h-5 w-5" />
                  Impresora Cliente (80mm)
                </CardTitle>
                <CardDescription>
                  Configuración fija del sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                  <p className="mb-2 text-sm font-medium text-green-900 dark:text-green-400">
                    ✓ Fija
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">GLPrinter_80mm</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bluetooth className="h-5 w-5" />
                  Impresora Cocina
                </CardTitle>
                <CardDescription>
                  Usa la misma impresora fija del sistema (80mm)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                  <p className="mb-2 text-sm font-medium text-green-900 dark:text-green-400">
                    ✓ Fija
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">GLPrinter_80mm</p>
                </div>
              </CardContent>
            </Card>

            {/* Print Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Opciones de Impresión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-print" className="font-medium">
                      Impresión Automática
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Imprime automáticamente al confirmar pedido
                    </p>
                  </div>
                  <Switch
                    id="auto-print"
                    checked={preferences.autoPrint}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        ...preferences,
                        autoPrint: checked,
                      })
                    }
                  />
                </div>

                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium text-foreground">Modo impresión</p>
                  <p className="text-xs text-muted-foreground">
                    ESC/POS por Bluetooth únicamente. Fallback web/navegador deshabilitado.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="open-drawer-80" className="font-medium">
                      Abrir Cajon en 80mm
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Envía pulso de apertura al cajon al imprimir ticket/corte
                    </p>
                  </div>
                  <Switch
                    id="open-drawer-80"
                    checked={preferences.openDrawerOn80mm}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        ...preferences,
                        openDrawerOn80mm: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="full-cut-80" className="font-medium">
                      Corte Completo en 80mm
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Usa corte completo en lugar de parcial para ticket/corte
                    </p>
                  </div>
                  <Switch
                    id="full-cut-80"
                    checked={preferences.fullCutOn80mm}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        ...preferences,
                        fullCutOn80mm: checked,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reset Button */}
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-900/10">
          <CardHeader>
            <CardTitle className="text-yellow-900 dark:text-yellow-400">
              Zona de Peligro
            </CardTitle>
            <CardDescription className="text-yellow-800 dark:text-yellow-300">
              Acciones que no se pueden deshacer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleResetDefaults}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar Valores por Defecto
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
