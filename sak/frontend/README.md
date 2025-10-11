# 🎨 Frontend - Sistema de Facturas

Frontend de Next.js para el Sistema de Gestión de Facturas.

## 🚀 Inicio Rápido

### **1. Instalar Dependencias**
```bash
npm install
```

### **2. Configurar Variables de Entorno**

**Opción A: Usar Scripts (Recomendado)**
```powershell
# Para trabajar contra backend en GCP
.\switch-to-gcp.ps1

# O para trabajar contra backend local
.\switch-to-local.ps1
```

**Opción B: Manual**
```bash
# Crear .env.local desde el template
cp .env.example .env.local

# Editar .env.local con tu configuración preferida
```

### **3. Iniciar Servidor de Desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🔄 Cambiar entre Backend Local y GCP

Ver documentación completa: **[SWITCH_BACKEND.md](SWITCH_BACKEND.md)**

**Uso rápido:**
```powershell
# Backend Local
.\switch-to-local.ps1
npm run dev

# Backend GCP
.\switch-to-gcp.ps1
npm run dev
```

---

## 📁 Estructura de Variables de Entorno

```
.env.local       ← Tu configuración local (git ignora)
.env.production  ← Documentación (Vercel usa Dashboard)
.env.example     ← Template para el equipo
```

---

## 🛠️ Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run start    # Servidor de producción
npm run lint     # Linter
```

---

## 🌐 URLs

- **Desarrollo:** http://localhost:3000
- **Producción:** https://wcl-seven.vercel.app
- **Backend GCP:** https://sak-backend-94464199991.us-central1.run.app

---

## 📚 Documentación

- **[SWITCH_BACKEND.md](SWITCH_BACKEND.md)** - Cómo cambiar entre backends

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
