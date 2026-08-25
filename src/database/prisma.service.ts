import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Provides the Prisma Client to the whole application via dependency
 * injection. Exported globally by {@link PrismaModule}.
 *
 * Prisma 7: the client is built with the PrismaPg driver adapter; the
 * connection string comes exclusively from the DATABASE_URL environment
 * variable. Connections are opened lazily on the first query, so the API
 * can boot before PostgreSQL becomes reachable (useful in containerized
 * deployments). `$disconnect` is called on application shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured. Set it in the backend environment.',
      );
    }

    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma connection closed');
  }
}
