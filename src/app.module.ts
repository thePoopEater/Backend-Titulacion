import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContentModule } from './content/content.module';
import { GamificationModule } from './gamification/gamification.module';
import { StatisticsModule } from './statistics/statistics.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT!, 10) || 5432,
      username: process.env.DB_USERNAME || 'vr_user',
      password: process.env.DB_PASSWORD || 'vr_secure_password',
      database: process.env.DB_NAME || 'vr_kahoot_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    ContentModule,
    GamificationModule,
    StatisticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
