import { Module, forwardRef } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationGateway } from './gamification.gateway';
import { ContentModule } from '../content/content.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSessionEntity } from './entities/game-session.entity';
import { SessionQuestionEntity } from './entities/session-question.entity';
import { GamificationController } from './gamification.controller';
import { GamificationHttpController } from './gamification-http.controller';
import { LatencyLogEntity } from 'src/statistics/entities/latency-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSessionEntity, SessionQuestionEntity,LatencyLogEntity]),
    ContentModule,
    forwardRef(() => StatisticsModule),
  ],
  providers: [GamificationService, GamificationGateway],
  exports: [GamificationService],
  controllers: [GamificationController, GamificationHttpController],
})
export class GamificationModule {}
