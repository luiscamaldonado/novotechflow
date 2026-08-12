import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthCoreModule } from '../auth/auth-core.module';
import { UsersCoreModule } from '../users/users-core.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExternalController } from './external.controller';
import { ExternalAuthService } from './external-auth.service';
import { ExternalJwtStrategy } from './external-jwt.strategy';
import { ExternalProposalsService } from './external-proposals.service';

@Module({
  imports: [
    AuthCoreModule,
    UsersCoreModule,
    PrismaModule,
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
  providers: [
    ExternalAuthService,
    ExternalJwtStrategy,
    ExternalProposalsService,
  ],
})
export class ExternalModule {}
