import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { LoginRequestDTO } from './dto/login-request.dto';
import { RegisterRequestDTO } from './dto/register-request.dto';
import { AuthService } from './auth.service';
import { type Response } from 'express';

@Controller('auth')
export class AuthController {
        
    constructor(
        private readonly authService : AuthService
    ){}

    @Post('login')
    async loginUser(@Body() loginRequestDTO : LoginRequestDTO,@Res() res : Response){
        if ( await this.authService.loginUser(loginRequestDTO) ){
           return res.status(HttpStatus.OK).json({
            statusCode: HttpStatus.OK,
            message: "Usuario logeado correctamente",
            });
        }
    }

    @Post('register')
    async registerUser(@Body() registerRequestDTO : RegisterRequestDTO,@Res() res: Response){
        const idUsuarioCreado = await this.authService.createUser(registerRequestDTO);
        return res.status(HttpStatus.CREATED).json({
            statusCode: HttpStatus.CREATED,
            message: "Usuario creado correctamente",
            data : {id : idUsuarioCreado}
        })
    }


}
