import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseEntity } from './entities/exercise.entity';
import { CategoryEntity } from './entities/category.entity';
import { ItemEntity } from './entities/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExerciseEntity, CategoryEntity, ItemEntity]),
  ],
  providers: [ContentService],
  controllers: [ContentController],
  exports: [ContentService],
})
export class ContentModule {}
