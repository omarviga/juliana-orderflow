// vite.config.js
export default defineConfig(({ mode }) => ({
  // ... tu configuración existente
  build: {
    chunkSizeWarningLimit: 800, // Límite personalizado
    rollupOptions: {
      output: {
        // Dividir automáticamente chunks grandes
        manualChunks(id) {
          // Separar node_modules en chunks
          if (id.includes('node_modules')) {
            // Agrupar por librerías
            if (id.includes('react')) {
              return 'vendor_react';
            }
            if (id.includes('lodash') || id.includes('date-fns')) {
              return 'vendor_utils';
            }
            // El resto de node_modules
            return 'vendor';
          }
        },
        // Compactar nombres de chunks
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Reporte de tamaño (opcional)
    reportCompressedSize: true,
    // Sourcemaps en producción (opcional, desactivar para mejor rendimiento)
    sourcemap: mode === 'development',
  },
}));