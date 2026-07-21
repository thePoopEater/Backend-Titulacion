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
   - La tabla de resultados se actualiza automáticamente
6. **Cerrar sesión:**
   - Click "Cerrar Sesión" — guarda respuestas pendientes, cierra la sala y notifica a estudiantes

**Sección 3 (Módulo Analítico):**

- Click "Consultar Registros" para ver todas las respuestas registradas (se actualiza automáticamente al procesar cada pregunta)
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
8. **Ver feedback** visual inmediato al enviar (correcta/incorrecta + puntaje), sin esperar a los demás estudiantes
9. Al terminar todas las preguntas de la ronda, ver automáticamente el **modal de resumen** con puntaje total y desglose (sin necesidad de que el profesor cierre la sesión)

---

## Flujo típico de prueba

| Paso | Acción                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1    | Abrir `gestion_contenido.html`                                         |
| 2    | Crear 2-3 ejercicios con categorías e ítems                            |
| 3    | Abrir 2-3 pestañas con `estudiante.html` (cambiar ID en cada una)      |
| 4    | En cada estudiante, seleccionar la sala y vincular                     |
| 5    | En profesor, crear sesión e iniciar ronda                              |
| 6    | Estudiantes arrastran ítems a las categorías y envían                  |
| 7    | Cada estudiante ve su resultado inmediatamente al enviar               |
| 8    | Profesor click "Siguiente" o espera auto-avance cuando todos responden |
| 9    | Repetir 6-8 hasta terminar todas las preguntas                         |
| 10   | Estudiantes ven automáticamente su modal de puntaje final              |
| 11   | Revisar tabla analítica en sección 3                                   |

---

## Notas técnicas

- Los HTML usan Tailwind CSS via CDN (`cdn.tailwindcss.com`)
- WebSocket via Socket.IO (`cdn.socket.io/4.7.2/socket.io.min.js`)
- Backend debe estar en `http://localhost:3000` (configurable en `BACKEND_URL`)
- Sin framework frontend — JavaScript vanilla
- El sistema de clasificación usa HTML5 Drag and Drop API
