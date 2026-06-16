import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseEntity } from './entities/exercise.entity';
import { CategoryEntity } from './entities/category.entity';
import { ItemEntity } from './entities/item.entity';

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

  async createExercise(dto: any): Promise<ExerciseEntity> {
    const exercise = this.exerciseRepository.create({ title: dto.title });
    const saved = await this.exerciseRepository.save(exercise);

    const categories = dto.categories.map((cat: any) =>
      this.categoryRepository.create({ name: cat.name, exerciseId: saved.id }),
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

  async getAllExercises(): Promise<ExerciseEntity[]> {
    const exercises = await this.exerciseRepository.find({
      relations: { categories: true },
      order: { id: 'ASC' },
    });
    for (const ex of exercises) {
      (ex as any).items = await this.itemRepository.find({
        where: { exerciseId: ex.id },
      });
    }
    return exercises;
  }

  async updateExercise(id: number, dto: any): Promise<ExerciseEntity> {
    await this.getExerciseById(id);
    if (dto.title) {
      await this.exerciseRepository.update(id, { title: dto.title });
    }
    if (dto.categories) {
      await this.categoryRepository.delete({ exerciseId: id });
      const categories = dto.categories.map((cat: any) =>
        this.categoryRepository.create({ name: cat.name, exerciseId: id }),
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
}
