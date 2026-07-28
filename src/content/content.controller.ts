import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ContentService } from './content.service';
import {
  CreateExerciseDto,
  UpdateExerciseDto,
} from './dto/create-question.dto';

/** Controlador REST para gestión de contenido educativo (ejercicios de clasificación). */
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /** Crea un nuevo ejercicio con categorías e ítems. */
  @Post('exercise')
  async createExercise(@Body() dto: CreateExerciseDto) {
    return await this.contentService.createExercise(dto);
  }

  /** Obtiene todos los ejercicios activos. */
  @Get('exercises')
  async getAllExercises() {
    return await this.contentService.getAllExercises();
  }

  /** Obtiene un ejercicio por ID. */
  @Get('exercise/:id')
  async getExerciseById(@Param('id', ParseIntPipe) id: number) {
    return await this.contentService.getExerciseById(id);
  }

  /** Actualiza un ejercicio (parcial o totalmente). */
  @Patch('exercise/:id')
  async updateExercise(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ) {
    return await this.contentService.updateExercise(id, dto);
  }

  /** Desactiva un ejercicio (soft delete). */
  @Delete('exercise/:id')
  async deleteExercise(@Param('id', ParseIntPipe) id: number) {
    return await this.contentService.deleteExercise(id);
  }
}
