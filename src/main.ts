import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

/**
 * Punto de entrada del servidor.
 * Inicializa la aplicación NestJS con soporte CORS y WebSocket (ws).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
