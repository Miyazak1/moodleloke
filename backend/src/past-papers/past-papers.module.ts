import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PastPapersController } from './past-papers.controller';
import { PastPapersService } from './past-papers.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PastPapersController],
  providers: [PastPapersService],
  exports: [PastPapersService]
})
export class PastPapersModule {}
