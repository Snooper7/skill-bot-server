import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  const prismaService = app.get(PrismaService);
  await app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
