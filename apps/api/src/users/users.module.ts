import { Module } from '@nestjs/common';
import { UsersCoreModule } from './users-core.module';
import { UsersController } from './users.controller';

@Module({
  imports: [UsersCoreModule],
  controllers: [UsersController],
  exports: [UsersCoreModule],
})
export class UsersModule {}
