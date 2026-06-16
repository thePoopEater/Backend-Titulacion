import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ContentService } from './content.service';
import {
  CreateExerciseDto,
  UpdateExerciseDto,
} from './dto/create-question.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('exercise')
  async createExercise(@Body() dto: CreateExerciseDto) {
    return await this.contentService.createExercise(dto);
  }

  @Get('exercises')
  async getAllExercises() {
    return await this.contentService.getAllExercises();
  }

  @Get('exercise/:id')
  async getExerciseById(@Param('id', ParseIntPipe) id: number) {
    return await this.contentService.getExerciseById(id);
  }

  @Patch('exercise/:id')
  async updateExercise(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ) {
    return await this.contentService.updateExercise(id, dto);
  }
}
