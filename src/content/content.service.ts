import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseEntity } from './entities/exercise.entity';
import { CategoryEntity } from './entities/category.entity';
import { ItemEntity } from './entities/item.entity';

/**
 * Servicio de contenido educativo.
 * Gestiona el CRUD de ejercicios de clasificación con sus categorías e ítems.
 */
@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ExerciseEntity)
    private readonly exerciseRepository: Repository<ExerciseEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
  ) {}

  /**
   * Crea un ejercicio con categorías e ítems.
   * Los ítems referencian a la categoría correcta mediante correctCategoryIndex
   * (índice 0-based del array de categorías).
   */
  async createExercise(dto: any): Promise<ExerciseEntity> {
    const exercise = this.exerciseRepository.create({
      title: dto.title,
      asignatura: dto.asignatura || null,
      descripcion: dto.descripcion || null,
      isActive: true,
    });
    const saved = await this.exerciseRepository.save(exercise);

    const categories = dto.categories.map((cat: any) =>
      this.categoryRepository.create({
        name: cat.name,
        descripcion: cat.descripcion || null,
        exerciseId: saved.id,
      }),
    );
    const savedCategories = await this.categoryRepository.save(categories);

    const items = dto.items.map((item: any) =>
      this.itemRepository.create({
        textContent: item.textContent,
        exerciseId: saved.id,
        correctCategoryId: savedCategories[item.correctCategoryIndex].id,
      }),
    );
    await this.itemRepository.save(items);

    return this.getExerciseById(saved.id);
  }

  /** Obtiene un ejercicio por ID incluyendo categorías e ítems. */
  async getExerciseById(id: number): Promise<ExerciseEntity> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id },
      relations: { categories: true },
    });
    if (!exercise) {
      throw new NotFoundException(`Ejercicio ID ${id} no encontrado.`);
    }
    (exercise as any).items = await this.itemRepository.find({
      where: { exerciseId: id },
    });
    return exercise;
  }

  /** Obtiene todos los ejercicios activos ordenados por ID ascendente. */
  async getAllExercises(): Promise<ExerciseEntity[]> {
    const exercises = await this.exerciseRepository.find({
      relations: { categories: true },
      order: { id: 'ASC' },
      where: { isActive: true },
    });
    for (const ex of exercises) {
      (ex as any).items = await this.itemRepository.find({
        where: { exerciseId: ex.id },
      });
    }
    return exercises;
  }

  /**
   * Actualiza un ejercicio parcial o totalmente.
   * Si se envían categorías o ítems, se reemplazan completamente
   * (borra los existentes y crea nuevos).
   */
  async updateExercise(id: number, dto: any): Promise<ExerciseEntity> {
    await this.getExerciseById(id);
    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.asignatura !== undefined) updateData.asignatura = dto.asignatura;
    if (dto.descripcion !== undefined) updateData.descripcion = dto.descripcion;
    if (Object.keys(updateData).length > 0) {
      await this.exerciseRepository.update(id, updateData);
    }
    if (dto.categories) {
      await this.categoryRepository.delete({ exerciseId: id });
      const categories = dto.categories.map((cat: any) =>
        this.categoryRepository.create({
          name: cat.name,
          descripcion: cat.descripcion || null,
          exerciseId: id,
        }),
      );
      await this.categoryRepository.save(categories);
    }
    if (dto.items) {
      await this.itemRepository.delete({ exerciseId: id });
      const exercise = await this.getExerciseById(id);
      const categories = (exercise as any).categories || [];
      const items = dto.items.map((item: any) =>
        this.itemRepository.create({
          textContent: item.textContent,
          exerciseId: id,
          correctCategoryId: categories[item.correctCategoryIndex]?.id || 0,
        }),
      );
      await this.itemRepository.save(items);
    }
    return this.getExerciseById(id);
  }

  /**
   * Desactiva un ejercicio (soft delete).
   * El ejercicio permanece en BD pero no se lista en las consultas por defecto.
   */
  async deleteExercise(id: number): Promise<void> {
    const exercise = await this.exerciseRepository.findOne({ where: { id } });
    if (!exercise) {
      throw new NotFoundException(`Ejercicio ID ${id} no encontrado.`);
    }

    await this.exerciseRepository.update(id, { isActive: false });
  }
}
