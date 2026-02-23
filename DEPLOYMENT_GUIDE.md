# 🚀 Guía de Despliegue 100% Gratuito

## 🎯 Stack Gratuito Recomendado:

- **Frontend (Vercel)** - $0/mes ♾️
- **Backend (Supabase Edge Functions)** - $0/mes ♾️
- **Base de Datos (Supabase PostgreSQL)** - $0/mes (hasta 500MB) ♾️

---

## 📋 Paso 1: Requisitos

✅ Cuenta en **GitHub** (tienes)
✅ Repositorio en GitHub (tienes: portofinosistemas-creator/juliana-orderflow)
✅ Proyecto Supabase (tienes: vexsdilhoejvvaxysmvu)
✅ Cuenta en **Vercel** (gratis en vercel.com)

---

## 🚀 Paso 2: Desplegar Edge Functions en Supabase

Las Edge Functions ya están creadas en:
- `supabase/functions/print-ticket/index.ts`
- `supabase/functions/print-kitchen/index.ts`

### Para desplegar:

#### Opción A: Desde CLI (Recomendado)

```bash
# 1. Instala Supabase CLI
npm install -g @supabase/cli

# 2. Loguéate con tu cuenta Supabase
supabase login

# 3. Sube las Edge Functions
supabase functions deploy print-ticket
supabase functions deploy print-kitchen

# 4. Verifica que funcionan
curl https://<project-id>.supabase.supabase.co/functions/v1/print-ticket
```

#### Opción B: Desde el Panel de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto `vexsdilhoejvvaxysmvu`
3. Ve a **Edge Functions** (o **Functions**)
4. Copia el contenido de `supabase/functions/print-ticket/index.ts`
5. Crea una función nueva llamada `print-ticket`
6. Pega el código y guarda
7. Repite para `print-kitchen`

---

## 🌐 Paso 3: Desplegar Frontend en Vercel

### 3.1 Conecta tu repo a Vercel

1. Abre https://vercel.com/new
2. Haz clic en **"Import Project"**
3. Selecciona **"GitHub"**
4. Busca y selecciona **`portofinosistemas-creator/juliana-orderflow`**
5. Haz clic en **"Import"**

### 3.2 Configura Variables de Entorno

En el formulario de importación, añade:

```
VITE_SUPABASE_URL = https://vexsdilhoejvvaxysmvu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (tu clave pública)
```

**Para obtener tus claves:**
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings → API**
4. Copia:
   - `ANON_KEY` → Usar como `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `URL` → Usar como `VITE_SUPABASE_URL`

### 3.3 Despliega

1. Haz clic en **"Deploy"**
2. Espera a que termine (2-5 minutos)
3. ¡Listo! Tu app está en vivo 🎉

**URL será similar a:**
```
https://juliana-orderflow.vercel.app
```

---

## ✅ Verificación Post-Despliegue

### 1. Verifica que Supabase está conectado
```bash
curl -H "Authorization: Bearer <ANON_KEY>" \
  https://vexsdilhoejvvaxysmvu.supabase.co/functions/v1/print-ticket \
  -d '{"items":[],"total":0}'
```

Deberías recibir un JSON con arrays vacíos.

### 2. Prueba desde el navegador

1. Abre tu app en Vercel: `https://juliana-orderflow.vercel.app`
2. Haz un pedido
3. Haz clic en "Confirmar Pago"
4. Si tienes Bluetooth Print App instalada, intentará imprimir
5. Si no, verás un toast diciendo que instales la app

---

## 🔄 Deployment Automático

### Con Vercel + GitHub

Cada vez que hagas `git push` a `main`:

1. Vercel detecta el cambio automáticamente
2. Inicia un nuevo build
3. Si todo OK, despliega automáticamente
4. Si falla, recibe notificación

Esto es **completamente gratuito**.

---

## 📊 Monitoreo de Costos

| Servicio | Límite Gratuito | Tu Uso Estimado |
|----------|----------------|-----------------|
| **Vercel** | ∞ builds, ∞ requests | Bajo |
| **Supabase DB** | 500MB storage | ~100MB (estructura + datos) |
| **Supabase Edge Functions** | 125,000 invocaciones/mes | ~1,000-5,000 por mes |
| **Supabase Auth** | Ilimitado | N/A (sin auth) |

✅ **Total Mensual: $0**

---

## 🐛 Troubleshooting

### "Error conectando a Supabase"

**Causa:** Variables de entorno incorrectas

**Solución:**
1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Settings → Environment Variables
3. Verifica que:
   - `VITE_SUPABASE_URL` = `https://vexsdilhoejvvaxysmvu.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = tu ANON_KEY

### "Edge Function not found"

**Causa:** No desplegaste las funciones

**Solución:**
```bash
supabase functions deploy print-ticket
supabase functions deploy print-kitchen
```

### "CORS error"

**Causa:** Las Edge Functions no tienen CORS habilitado

**Solución:** Las Edge Functions ya tienen CORS en el código, pero verifica:

```bash
curl -i https://vexsdilhoejvvaxysmvu.supabase.co/functions/v1/print-ticket -X OPTIONS
```

Deberías ver headers `Access-Control-Allow-Origin: *`

---

## 📈 Cómo Escalar (Cuando crezcas)

Si pasas los límites gratuitos:

1. **Vercel Pro** - $20/mes (para sitios corporativos)
2. **Supabase Pro** - $25/mes (por proyecto, más storage y funciones)
3. **Database** - Compra plan superior para más storage

Pero para una pequeña barra de comidas, **gratuito es suficiente**.

---

## 🔗 URLs Útiles

- **Tu App:** https://juliana-orderflow.vercel.app
- **Supabase Dashboard:** https://supabase.com/dashboard/project/vexsdilhoejvvaxysmvu
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/portofinosistemas-creator/juliana-orderflow

---

## ✅ Checklist Final

- [ ] Tengo cuenta en Vercel
- [ ] Tengo proyecto Supabase activo
- [ ] Desplegué Edge Functions (`supabase functions deploy`)
- [ ] Configuré variables de entorno en Vercel
- [ ] Desplegué el frontend en Vercel
- [ ] Testé que funciona desde el navegador
- [ ] Instalé Bluetooth Print App en mi tablet
- [ ] ¡Impriendo! 🖨️

---

## 💬 ¿Necesitas Ayuda?

Si algo no funciona:

1. Verifica logs en Vercel: https://vercel.com/dashboard → Deployments
2. Verifica logs en Supabase: Dashboard → Edge Functions
3. Abre DevTools (F12) en tu navegador
4. Busca errores en la consola

**¡Todo debe funcionar sin pagar un centavo!** ✨
