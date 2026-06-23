import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ExternalController } from './external.controller';
import { ExternalAuthService } from './external-auth.service';
import { ExternalJwtStrategy } from './external-jwt.strategy';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: (() => {
        if (!process.env.EXTERNAL_JWT_SECRET)
          throw new Error('EXTERNAL_JWT_SECRET env var is required');
        return process.env.EXTERNAL_JWT_SECRET;
      })(),
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [ExternalController],
  providers: [ExternalAuthService, ExternalJwtStrategy],
})
export class ExternalModule {}
