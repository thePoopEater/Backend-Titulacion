# Backend - Sistema de Titulación VR Kahoot

Backend del proyecto de titulación: plataforma educativa interactiva tipo **Kahoot** con realidad virtual, enfocada en ejercicios de clasificación por categorías. Los estudiantes colocan ítems en categorías correctas compitiendo en tiempo real.

## Stack tecnológico

- **Framework:** NestJS v11
- **Base de datos:** PostgreSQL (TypeORM)
- **WebSocket:** `ws` (nativo) + `@nestjs/platform-ws`
- **Autenticación:** JWT (Access + Refresh tokens) con Passport
- **Lenguaje:** TypeScript

## Estructura del proyecto

```
src/
├── main.ts                    # Punto de entrada
├── app.module.ts              # Módulo raíz
├── app.controller.ts          # Health check
├── auth/                      # Módulo de autenticación
│   ├── auth.module.ts
│   ├── auth.controller.ts     # POST /auth/login, /register, /refresh, GET /me
│   ├── auth.service.ts        # Lógica de login, registro, refresh
│   ├── entities/              # UserEntity, RefreshTokenEntity
│   ├── dto/                   # LoginRequest, RegisterRequest, LoginResponse
│   ├── guards/                # JwtAuthGuard, JwtRefreshGuard
│   ├── strategies/            # JwtStrategy, JwtRefreshStrategy
│   ├── decorators/            # CurrentUser decorator
│   └── interfaces/            # JwtPayload interface
├── content/                   # Gestión de contenido educativo
│   ├── content.module.ts
│   ├── content.controller.ts  # CRUD de ejercicios
│   ├── content.service.ts     # Lógica de ejercicios, categorías e ítems
│   ├── entities/              # ExerciseEntity, CategoryEntity, ItemEntity
│   └── dto/                   # CreateExerciseDto, UpdateExerciseDto
├── gamification/              # Lógica de juego en tiempo real
│   ├── gamification.module.ts
│   ├── gamification.controller.ts      # Endpoints REST de sesiones/rondas
│   ├── gamification-http.controller.ts # Endpoint HTTP benchmark
│   ├── gamification.service.ts         # Lógica de juego (sesiones, rondas, puntajes)
│   ├── gamification.gateway.ts         # WebSocket gateway
│   ├── entities/              # GameSessionEntity, SessionQuestionEntity
│   └── dto/                   # CreateSessionDto, SetCurrentQuestionDto, etc.
├── statistics/                # Métricas y reportes
│   ├── statistics.module.ts
│   ├── statistics.controller.ts   # GET /statistics/report, POST trigger-end-round
│   ├── statistics.service.ts      # Consultas de métricas
│   └── entities/              # LatencyLogEntity
```

## Configuración de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| PORT | 3000 | Puerto del servidor |
| DB_HOST | localhost | Host de PostgreSQL |
| DB_PORT | 5432 | Puerto de PostgreSQL |
| DB_USERNAME | vr_user | Usuario de BD |
| DB_PASSWORD | vr_secure_password | Contraseña de BD |
| DB_NAME | vr_kahoot_db | Nombre de BD |
| JWT_SECRET | titulacion-secret-key | Secreto JWT access |
| JWT_REFRESH_SECRET | titulacion-refresh-secret-key | Secreto JWT refresh |

## Instalación y ejecución

```bash
# Instalar dependencias
npm install

# Desarrollo (con watch)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

**Requisito:** Tener PostgreSQL corriendo (ver `docker-compose.yml` para entorno Docker).

## Pruebas

```bash
# Tests unitarios
npm run test

# Tests end-to-end
npm run test:e2e

# Cobertura
npm run test:cov
```

## Documentación de API

Ver [`API.md`](./API.md) para la documentación completa de endpoints REST y eventos WebSocket.

## Simulación de jugadores

```bash
node simulate-players.js
```
