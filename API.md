# API - Sistema de Titulación

**Base URL:** `http://localhost:3000`

---

# Content

## `POST /content/exercise`

Crea un nuevo ejercicio de clasificación con sus categorías e ítems.

**Request body:**

```ts
{
  title: string;
  categories: {
    name: string;
  }
  [];
  items: {
    textContent: string;
    correctCategoryIndex: number;
  }
  [];
}
```

`correctCategoryIndex` es el índice (0-based) dentro del array `categories` que corresponde a la categoría correcta del ítem.

**Response:** `ExerciseEntity`

```ts
{
  id: number;
  title: string;
  createdAt: Date;
  categories: {
    id: number;
    name: string;
    exerciseId: number;
  }
  [];
  items: {
    id: number;
    textContent: string;
    exerciseId: number;
    correctCategoryId: number;
  }
  [];
}
```

---

## `GET /content/exercises`

Obtiene todos los ejercicios con sus categorías e ítems.

**Response:** `ExerciseEntity[]`

---

## `GET /content/exercise/:id`

Obtiene un ejercicio por su ID.

**Response:** `ExerciseEntity`

---

## `PATCH /content/exercise/:id`

Actualiza parcial o totalmente un ejercicio.

**Request body:**

```ts
{
  title?: string;
  categories?: { name: string }[];
  items?: { textContent: string; correctCategoryIndex: number }[];
}
```

**Response:** `ExerciseEntity`

---

# Gamification

## `POST /gamification/session`

Crea una nueva sesión de juego y la establece como sesión activa.

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

Obtiene todas las sesiones activas, ordenadas por fecha de creación descendente.

**Response:** `GameSessionEntity[]`

---

## `POST /gamification/active-question`

Establece un ejercicio como el ejercicio activo de la sesión. Emite el evento `NEW_QUESTION_LOADED` vía WebSocket a la sala de la sesión con las categorías e ítems.

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
  status: 'question_active';
  questionId: number;
  timeLimitSeconds: number;
}
```

**WebSocket event `NEW_QUESTION_LOADED`:**

```ts
{
  exerciseId: number;
  title: string;
  timeLimitSeconds: number;
  categories: {
    id: number;
    name: string;
  }
  [];
  items: {
    id: number;
    textContent: string;
  }
  [];
}
```

---

## `POST /gamification/start-round-flow`

Configura una ronda completa (cola de IDs de ejercicios, tiempos) y avanza automáticamente al primer ejercicio. Al finalizar la ronda, emite `ROUND_FINAL_SUMMARY` vía WebSocket.

**Request body:**

```ts
{
  sessionId: number;
  questionIds: number[]; // IDs de ejercicios
  timePerQuestionSeconds: number;
  totalRoundTimeMinutes: number;
}
```

**Response:** Igual que `next-question`, según el estado de la cola:

- `{ status: "question_active", questionId, timeLimitSeconds }`
- `{ status: "round_ended", reason: "Global round time expired" }`
- `{ status: "round_completed", reason: "All exercises processed" }`

---

## `POST /gamification/next-question`

Avanza al siguiente ejercicio en la cola de la ronda. Si el ejercicio anterior tenía respuestas, las procesa antes de avanzar. Durante el procesamiento emite `ROUND_SUMMARY` vía WebSocket.

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

Cierra una sesión de juego. Si hay un ejercicio activo con respuestas sin procesar, las procesa antes de cerrar. Emite `ROUND_CLOSED` y `ROUND_FINAL_SUMMARY` vía WebSocket.

**Response:**

```ts
{
  status: 'session_closed';
  sessionId: number;
}
```

---

# WebSocket Events

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

### `SUBMIT_RESPONSE`

Envía las colocaciones de ítems en categorías. El servidor responde inmediatamente vía callback con el resultado de la clasificación (sin esperar a los demás estudiantes).

**Payload:**

```ts
{
  placements: Record<number, number>; // { itemId: categoryId, ... }
  timestamp: number; // client timestamp
}
```

**Ack callback (respuesta inmediata):**

```ts
{
  status: 'registered' | 'rejected';
  reason?: string;
  result?: {
    scoreObtained: number;   // 0–1000
    isCorrect: boolean;      // true solo si todos los ítems están correctos
    totalItems: number;
    correctCount: number;
  };
}
```

## Servidor → Cliente

### `NEW_QUESTION_LOADED`

Enviado cuando se activa un nuevo ejercicio.

```ts
{
  exerciseId: number;
  title: string;
  timeLimitSeconds: number;
  categories: {
    id: number;
    name: string;
  }
  [];
  items: {
    id: number;
    textContent: string;
  }
  [];
}
```

### `ROUND_SUMMARY`

Enviado a toda la sala después de procesar los resultados de cada pregunta. Contiene los resultados de **todos los estudiantes** para esa pregunta. En el panel del profesor actualiza la tabla de registros automáticamente.

```ts
{
  questionId: number;
  results: {
    sessionId: number;
    questionId: number;
    playerId: string;
    selectedAlternative: string; // JSON-stringified placements
    scoreObtained: number; // 0–1000
    isCorrect: boolean;
    positionInGame: number;
    clientTimestamp: number;
    arrivalTimestamp: number;
    responseTimeSeconds: number;
    totalTimeSeconds: number;
  }
  [];
}
```

### `ROUND_FINAL_SUMMARY`

Enviado a toda la sala cuando la ronda finaliza (cola de preguntas vacía, tiempo global expirado, o sesión cerrada). Los estudiantes ven automáticamente su **modal de puntaje final** sin necesidad de que el profesor cierre la sesión.

```ts
{
  reason: string; // "Ronda completada" | "Ronda finalizada por tiempo" | "Sesion cerrada"
  sessionId: number;
}
```

### `ROUND_CLOSED`

Enviado a cada estudiante individualmente cuando su pregunta se cierra (todos respondieron o se avanzó manualmente), y también a toda la sala cuando se cierra la sesión.

```ts
{
  status: 'cleared';
  sessionEnded: boolean;
  scoreObtained?: number;
  isCorrect?: boolean;
  position?: number;     // posición en esa pregunta (solo cuando sessionEnded: false)
}
```

### `STUDENT_JOINED`

Enviado cuando un estudiante se conecta.

```ts
{
  studentId: string;
  socketId: string;
}
```

### `STUDENT_ANSWERED`

Enviado cuando un estudiante envía sus colocaciones.

```ts
{
  studentId: string;
}
```

---

# Statistics

## `POST /statistics/trigger-end-round`

Fuerza el fin de la ronda actual y procesa los resultados del ejercicio activo. Calcula el puntaje como `(aciertos / totalItems) * 1000`.

**Response:** `RoundResult[]`

```ts
{
  sessionId: number;
  questionId: number; // ID del ejercicio
  playerId: string;
  selectedAlternative: string; // JSON-stringified placements: "{\"1\":3,\"2\":1}"
  scoreObtained: number; // 0–1000
  isCorrect: boolean; // true solo si todos los ítems están en la categoría correcta
  positionInGame: number;
  clientTimestamp: number;
  arrivalTimestamp: number;
  responseTimeSeconds: number;
  totalTimeSeconds: number;
}
[];
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
  selectedAlternative: string; // JSON-stringified placements
  scoreObtained: number;
  isCorrect: boolean;
  positionInGame: number;
  clientTimestamp: string;
  arrivalTimestamp: string;
  compensatedLagMs: number;
  createdAt: Date;
}
[];
```

---

## `GET /statistics/report/session/:sessionId`

Obtiene las métricas filtradas por sesión, ordenadas por questionId y positionInGame ascendentes.

**Response:** `LatencyLogEntity[]`
