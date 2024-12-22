import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const { password: _, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {

    const payload = {
      email: user.email,
      sub: user._id,
      username: user.username,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    };
  }

  async register(createUserDto: CreateUserDto) {
    const existingUser = await this.userService.findByUsername(
      createUserDto.username,
    );
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }

    const existingEmail = await this.userService.findByEmail(
      createUserDto.email,
    );
    if (existingEmail) {
      throw new UnauthorizedException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = await this.userService.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const { password, ...result } = newUser.toObject();
    return this.login(result);
  }
}
