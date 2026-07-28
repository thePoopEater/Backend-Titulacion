# API - Sistema de Titulación VR Kahoot

**Base URL:** `http://localhost:3000`

---

# Auth

## `POST /auth/register`

Registra un nuevo usuario (profesor).

**Request body:**
```ts
{
  nombre: string;
  email: string;
  password: string;
}
```

**Response:** `201 Created`
```ts
{
  statusCode: 201,
  message: "Usuario creado correctamente",
  data: { id: number }
}
```

---

## `POST /auth/login`

Inicia sesión y obtiene tokens JWT.

**Request body:**
```ts
{
  email: string;
  password: string;
}
```

**Response:** `200 OK`
```ts
{
  statusCode: 200,
  message: "Usuario logueado correctamente",
  data: {
    accessToken: string;   // expires in 1h
    refreshToken: string;  // expires in 7 days
  }
}
```

---

## `POST /auth/refresh`

Renueva el access token usando un refresh token válido.

**Headers:** `Authorization: Bearer <refreshToken>` (usa JwtRefreshGuard)

**Request body:**
```ts
{
  refreshToken: string;
}
```

**Response:** `200 OK`
```ts
{
  statusCode: 200,
  message: "Tokens renovados correctamente",
  data: {
    accessToken: string;
    refreshToken: string;
  }
}
```

---

## `GET /auth/me`

Obtiene el perfil del usuario autenticado.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `200 OK`
```ts
{
  statusCode: 200,
  data: {
    id: number;
    nombre: string;
    email: string;
  }
}
```

---

# Content (Gestión de Ejercicios)

## `POST /content/exercise`

Crea un nuevo ejercicio de clasificación con sus categorías e ítems.

**Request body:**
```ts
{
  title: string;                    // Título del ejercicio
  asignatura?: string;              // Materia (opcional)
  descripcion?: string;             // Descripción (opcional)
  categories: {                     // Categorías donde clasificar
    name: string;
    descripcion?: string;
  }[];
  items: {                          // Ítems a clasificar
    textContent: string;            // Texto del ítem
    correctCategoryIndex: number;   // Índice 0-based de la categoría correcta
  }[];
}
```

**Response:** `ExerciseEntity`

---

## `GET /content/exercises`

Obtiene todos los ejercicios activos con sus categorías e ítems.

**Response:** `ExerciseEntity[]`

---

## `GET /content/exercise/:id`

Obtiene un ejercicio por su ID.

**Response:** `ExerciseEntity`

---

## `PATCH /content/exercise/:id`

Actualiza parcial o totalmente un ejercicio. Reemplaza categorías e ítems si se envían.

**Request body:**
```ts
{
  title?: string;
  asignatura?: string;
  descripcion?: string;
  categories?: { name: string; descripcion?: string }[];
  items?: { textContent: string; correctCategoryIndex: number }[];
}
```

**Response:** `ExerciseEntity`

---

## `DELETE /content/exercise/:id`

Desactiva un ejercicio (soft delete: `isActive = false`).

**Response:** `204 No Content`

---

### ExerciseEntity

```ts
{
  id: number;
  title: string;
  asignatura: string | null;
  descripcion: string | null;
  isActive: boolean;
  createdAt: Date;
  categories: {
    id: number;
    name: string;
    descripcion: string | null;
    exerciseId: number;
  }[];
  items: {
    id: number;
    textContent: string;
    exerciseId: number;
    correctCategoryId: number;
  }[];
}
```

---

# Gamification (Juego)

## `POST /gamification/session`

Crea una nueva sesión de juego y la establece como activa.

**Request body:**
```ts
{
  name: string;
}
```

**Response:** `GameSessionEntity`
```ts
{
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
}
```

---

## `GET /gamification/active-sessions`

Obtiene todas las sesiones activas, ordenadas por fecha descendente.

**Response:** `GameSessionEntity[]`

---

## `GET /gamification/sessions`

Obtiene **todas** las sesiones (activas e inactivas).

**Response:** `GameSessionEntity[]`

---

## `GET /gamification/session/:id`

Obtiene una sesión con sus ejercicios asociados (parsea `questionOrder`).

**Response:**
```ts
{
  id: number;
  name: string;
  isActive: boolean;
  questionOrder: string | null;  // JSON string de IDs
  createdAt: Date;
  exercises: ExerciseEntity[];   // Ejercicios de la ronda
}
```

---

## `POST /gamification/active-question`

Establece un ejercicio como activo en la sesión. Emite `NEW_QUESTION_LOADED` vía WebSocket.

**Request body:**
```ts
{
  sessionId: number;
  questionId: number; // ID del ejercicio
}
```

**Response:**
```ts
{
  status: "question_active";
  questionId: number;
  timeLimitSeconds: number;
}
```

---

## `POST /gamification/start-round-flow`

Configura una ronda completa: cola de ejercicios, tiempos por pregunta y tiempo total. Avanza automáticamente al primer ejercicio.

**Request body:**
```ts
{
  sessionId: number;
  questionIds: number[];            // IDs de ejercicios en orden
  timePerQuestionSeconds: number;  // Tiempo límite por ejercicio
  totalRoundTimeMinutes: number;   // Tiempo total de la ronda
}
```

**Response:** Mismo que `next-question`:
- `{ status: "question_active", questionId, timeLimitSeconds }`
- `{ status: "round_ended", reason: "Global round time expired" }`
- `{ status: "round_completed", reason: "All exercises processed" }`

---

## `POST /gamification/next-question`

Avanza al siguiente ejercicio en la cola. Si el anterior tenía respuestas, las procesa y emite `ROUND_SUMMARY` vía WebSocket.

**Response:**
```ts
{
  status: "question_active" | "round_ended" | "round_completed";
  questionId?: number;
  timeLimitSeconds?: number;
  reason?: string;
}
```

---

## `POST /gamification/close-session/:id`

Cierra una sesión. Procesa respuestas pendientes si las hay. Emite `ROUND_CLOSED` y `ROUND_FINAL_SUMMARY` vía WebSocket.

**Response:**
```ts
{
  status: "session_closed";
  sessionId: number;
}
```

---

## `POST /game-http-benchmark/submit`

Endpoint HTTP alternativo para enviar respuestas (benchmarking).

**Request body:**
```ts
{
  socketId: string;
  placements: Record<number, number>; // { itemId: categoryId }
  clientTimestamp: number;
}
```

**Response:** Mismo que `SUBMIT_RESPONSE` por WebSocket:
```ts
{
  status: "registered" | "rejected";
  reason?: string;
  result?: {
    scoreObtained: number;
    isCorrect: boolean;
    totalItems: number;
    correctCount: number;
  };
}
```

---

# WebSocket Events

**Conexión:** `ws://localhost:3000`

Formato de mensajes: `{ event: string, data: any }`

## Cliente → Servidor

### `LOGIN_PLAYER`

Registra un estudiante en una sesión.

**Payload:**
```ts
{
  studentId: string;
  sessionId: number;
}
```

**Response (ack automático):** `{ status: "logged_in", studentId, sessionId }`
Además emite `STUDENT_JOINED` a la sala.

Si hay un ejercicio activo, envía automáticamente `NEW_QUESTION_LOADED` al cliente.

---

### `SUBMIT_RESPONSE`

Envía las colocaciones de ítems en categorías. El servidor responde inmediatamente vía callback con el resultado individual.

**Payload:**
```ts
{
  placements: Record<number, number>; // { itemId: categoryId, ... }
  timestamp: number;                  // Timestamp del cliente (ms)
}
```

**Ack callback (respuesta inmediata):**
```ts
{
  status: "registered" | "rejected";
  reason?: string;
  result?: {
    scoreObtained: number;         // 0–1000
    isCorrect: boolean;           // true solo si todos los ítems están correctos
    totalItems: number;
    correctCount: number;
    selectedAlternative: string;  // JSON del resultado
    itemResults: {
      itemId: number;
      textContent: string;
      correctCategoryId: number;
      correctCategoryName: string;
      placedCategoryId: number | null;
      placedCategoryName: string | null;
      isCorrect: boolean;
    }[];
  };
}
```

Cuando todos los estudiantes responden, avanza automáticamente a la siguiente pregunta.

---

### `TRACKING_DATA`

Envía datos de posición del estudiante en el entorno VR. El servidor hace relay (broadcast) a los demás clientes de la misma sesión.

**Payload:**
```ts
{
  playerId: string;
  sessionId: number;
  x: number;
  y: number;
  z: number;
}
```

**Broadcast a sala (evento `REMOTE_PLAYER_UPDATE`):**
```ts
{
  playerId: string;
  x: number;
  y: number;
  z: number;
}
```

---

## Servidor → Cliente

### `NEW_QUESTION_LOADED`

Enviado cuando se activa un nuevo ejercicio.

```ts
{
  exerciseId: number;
  title: string;
  timeLimitSeconds: number;
  categories: { id: number; name: string }[];
  items: { id: number; textContent: string }[];
}
```

---

### `ROUND_SUMMARY`

Enviado a toda la sala después de procesar los resultados de cada pregunta. Contiene los resultados de **todos los estudiantes** para esa pregunta.

```ts
{
  questionId: number;
  results: {
    sessionId: number;
    questionId: number;
    playerId: string;
    selectedAlternative: string;  // JSON con resultados por ítem
    scoreObtained: number;        // 0–1000
    isCorrect: boolean;
    positionInGame: number;
    clientTimestamp: number;
    arrivalTimestamp: number;
    responseTimeSeconds: number;
    totalTimeSeconds: number;
    itemResults: {
      itemId: number;
      textContent: string;
      correctCategoryId: number;
      correctCategoryName: string;
      placedCategoryId: number | null;
      placedCategoryName: string | null;
      isCorrect: boolean;
    }[];
  }[];
}
```

---

### `ROUND_FINAL_SUMMARY`

Enviado a **cada estudiante individualmente** cuando la ronda finaliza (cola vacía, tiempo expirado o sesión cerrada).

```ts
{
  reason: string;    // "Ronda completada" | "Ronda finalizada por tiempo" | "Sesion cerrada"
  sessionId: number;
  playerId: string;
  totalScore: number;
  totalTime: number;
  totalQuestions: number;
  results: {
    questionId: number;
    selectedAlternative: string;
    scoreObtained: number;
    isCorrect: boolean;
    positionInGame: number;
    compensatedLagMs: number;
    totalTimeSeconds: number;
  }[];
}
```

---

### `ROUND_CLOSED`

Enviado a cada estudiante cuando su pregunta se cierra, o a toda la sala cuando la sesión se cierra.

**Por pregunta (a cada estudiante):**
```ts
{
  status: "cleared";
  sessionEnded: false;
  scoreObtained: number;
  isCorrect: boolean;
  position: number;
  itemResults: { ... }[];
}
```

**Por cierre de sesión (a toda la sala):**
```ts
{
  status: "cleared";
  sessionEnded: true;
}
```

---

### `ROUND_ADVANCED`

Emitido cuando el sistema avanza automáticamente al siguiente ejercicio porque todos respondieron.

```ts
{ status: "question_active", questionId: number, timeLimitSeconds: number }
```

---

### `STUDENT_JOINED`

Enviado a toda la sala cuando un estudiante se conecta.

```ts
{
  studentId: string;
  socketId: string;
}
```

---

### `STUDENT_ANSWERED`

Enviado a toda la sala cuando un estudiante envía sus colocaciones.

```ts
{
  studentId: string;
}
```

---

### `REMOTE_PLAYER_UPDATE`

Broadcast de tracking VR en tiempo real (≈60 FPS). Se envía a los demás clientes de la misma sesión.

```ts
{
  playerId: string;
  x: number;
  y: number;
  z: number;
}
```

---

# Statistics (Métricas y Reportes)

## `POST /statistics/trigger-end-round`

Fuerza el fin de la ronda actual y procesa los resultados del ejercicio activo. Calcula puntaje como `(aciertos / totalItems) * 1000`. Emite `ROUND_SUMMARY` vía WebSocket.

**Response:** `RoundResult[]`

```ts
{
  sessionId: number;
  questionId: number;
  playerId: string;
  selectedAlternative: string;  // JSON-stringified itemResults
  scoreObtained: number;        // 0–1000
  isCorrect: boolean;
  positionInGame: number;
  clientTimestamp: number;
  arrivalTimestamp: number;
  responseTimeSeconds: number;
  totalTimeSeconds: number;
}[]
```

---

## `GET /statistics/report`

Obtiene todos los registros de métricas (latencia, puntajes), ordenados por fecha descendente.

**Response:** `LatencyLogEntity[]`

```ts
{
  id: number;
  sessionId: number;
  questionId: number;
  playerId: string;
  selectedAlternative: string;  // JSON-stringified placements o itemResults
  scoreObtained: number;
  isCorrect: boolean;
  positionInGame: number;
  clientTimestamp: string;      // bigint como string
  arrivalTimestamp: string;     // bigint como string
  compensatedLagMs: number;
  totalTimeSeconds: number;
  createdAt: Date;
}[]
```

---

## `GET /statistics/report/session/:sessionId`

Obtiene las métricas filtradas por sesión, ordenadas por `questionId` y `positionInGame` ascendentes.

**Response:** `LatencyLogEntity[]`

---

# Flujo Típico del Juego

1. **Registro de profesor:** `POST /auth/register`
2. **Login:** `POST /auth/login` → obtiene `accessToken` + `refreshToken`
3. **Crear ejercicio:** `POST /content/exercise` (con categorías e ítems)
4. **Crear sesión:** `POST /gamification/session`
5. **Iniciar ronda:** `POST /gamification/start-round-flow` (cola de ejercicios, tiempos)
6. **Estudiantes se conectan:** WebSocket → `LOGIN_PLAYER`
7. **Estudiantes responden:** `SUBMIT_RESPONSE` vía WebSocket (o `POST /game-http-benchmark/submit`)
8. **Avance automático:** Cuando todos responden o se llama `POST /gamification/next-question`
9. **Cierre:** `POST /gamification/close-session/:id`
10. **Reportes:** `GET /statistics/report` o `GET /statistics/report/session/:sessionId`
