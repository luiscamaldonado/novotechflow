import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthCoreModule } from './auth-core.module';
import { UsersCoreModule } from '../users/users-core.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

// UsersCoreModule directo (no via AuthCoreModule): JwtStrategy inyecta
// UsersService y AuthCoreModule no lo re-exporta.
@Module({
  imports: [AuthCoreModule, UsersCoreModule, PassportModule],
  controllers: [AuthController],
  providers: [JwtStrategy],
  exports: [AuthCoreModule],
})
export class AuthModule {}
