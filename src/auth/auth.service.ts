import { Injectable } from '@nestjs/common';
import { RegisterRequestDTO } from './dto/register-request.dto';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { InsertResult } from 'typeorm/browser';
import { LoginRequestDTO } from './dto/login-request.dto';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository : Repository<UserEntity>
    ){}

    async createUser(registerRequestDTO : RegisterRequestDTO) : Promise<number>{
        const result : InsertResult = await this.userRepository.
        insert({
            nombre: registerRequestDTO.nombre,
            email: registerRequestDTO.email,
            password: registerRequestDTO.password
        })
        const idUser = result.identifiers[0].id
        return idUser;
    }

    async loginUser(loginRequestDTO : LoginRequestDTO) : Promise<boolean> {
        const result : boolean = await this.userRepository.exists({
            where: {
                email: loginRequestDTO.email,
                password: loginRequestDTO.password
            }
        })
        return result;
    }
}
