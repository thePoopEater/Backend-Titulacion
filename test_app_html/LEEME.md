# Test App HTML — Consola de Ejercicios de Clasificación

Dos archivos HTML para probar el flujo de ejercicios de clasificación (drag & drop) con el backend NestJS.

## Requisitos

- Backend NestJS corriendo en `http://localhost:3000`
- Navegador web moderno
- Conexión a Internet (carga Tailwind CSS y Socket.IO desde CDN)

---

## Archivos

### `gestion_contenido.html` — Consola del Profesor

Panel central para orquestar rondas de ejercicios de clasificación.

**Pasos de uso:**

1. **Abrir** el archivo en el navegador
2. **Crear ejercicios** (sección 1):
   - Ingresar Título del ejercicio
   - Agregar categorías (conceptos) usando "Agregar Categoría"
   - Agregar ítems (descripciones) y seleccionar la categoría correcta para cada uno
   - Click en "Guardar Ejercicio"
3. **Crear una sesión** (sección 2):
   - Ingresar nombre de sesión y click "Abrir"
   - Automáticamente se conecta al WebSocket de la sala creada
4. **Iniciar ronda** (sección 2):
   - Ingresar IDs de ejercicios separadas por coma (ej: `1,2,3`)
   - Configurar tiempo por ejercicio y tiempo total de ronda
   - Click "INICIAR SECUENCIA DE RONDA EVALUATIVA"
5. **Avanzar entre ejercicios:**
   - Click "Siguiente" — guarda respuestas actuales y muestra el siguiente
6. **Cerrar sesión:**
   - Click "Cerrar Sesión" — guarda respuestas pendientes, cierra la sala y notifica a estudiantes

**Sección 3 (Módulo Analítico):**

- Click "Extraer Logs de Postgres" para ver todas las respuestas registradas
- Muestra: estudiante, sesión, rendimiento, puntaje y latencia

---

### `estudiante.html` — Cliente del Estudiante

Interfaz drag & drop para que los estudiantes clasifiquen conceptos.

**Pasos de uso:**

1. **Abrir** el archivo en el navegador (pueden ser múltiples pestañas/ventanas)
2. **Configurar identificador** (ej: "Estudiante_1", "Estudiante_2", etc.)
3. Click "Buscar Salas" para buscar salas activas
4. Seleccionar una sala del listado
5. Click "Vincular a Sala"
6. **Esperar** a que el profesor inicie la ronda
7. **Responder** arrastrando cada ítem (texto) desde la zona central a la categoría correspondiente
8. **Ver feedback** visual de las colocaciones
9. Al cerrar el profesor la sesión, ver el **modal de resumen** con puntaje total

---

## Flujo típico de prueba

| Paso | Acción                                                            |
| ---- | ----------------------------------------------------------------- |
| 1    | Abrir `gestion_contenido.html`                                    |
| 2    | Crear 2-3 ejercicios con categorías e ítems                       |
| 3    | Abrir 2-3 pestañas con `estudiante.html` (cambiar ID en cada una) |
| 4    | En cada estudiante, seleccionar la sala y vincular                |
| 5    | En profesor, crear sesión e iniciar ronda                         |
| 6    | Estudiantes arrastran ítems a las categorías                      |
| 7    | Profesor click "Siguiente"                                        |
| 8    | Repetir 6-7 hasta terminar                                        |
| 9    | Profesor click "Cerrar Sesión"                                    |
| 10   | Revisar tabla analítica en sección 3                              |

---

## Notas técnicas

- Los HTML usan Tailwind CSS via CDN (`cdn.tailwindcss.com`)
- WebSocket via Socket.IO (`cdn.socket.io/4.7.2/socket.io.min.js`)
- Backend debe estar en `http://localhost:3000` (configurable en `BACKEND_URL`)
- Sin framework frontend — JavaScript vanilla
- El sistema de clasificación usa HTML5 Drag and Drop API
