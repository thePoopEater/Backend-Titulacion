import { forwardRef, Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LatencyLogEntity } from './entities/latency-log.entity';
import { GamificationModule } from 'src/gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LatencyLogEntity]),
    forwardRef(() => GamificationModule),
  ],
  providers: [StatisticsService],
  controllers: [StatisticsController],
  exports: [StatisticsService],
})
export class StatisticsModule {}
