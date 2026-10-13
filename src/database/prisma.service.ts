
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

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

    super({
      adapter: new PrismaPg({ connectionString }),
      log: [{ emit: 'event', level: 'query' }],
    });

    (this.$on as unknown as (
  event: 'query',
  callback: (event: Prisma.QueryEvent) => void,
) => void)('query', (event) => {
  this.logger.debug(
    `Database query duration: ${event.duration.toFixed(2)} ms`,
  );

  this.logger.debug(
    `SQL: ${event.query}`,
  );
});
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma connection closed');
  }
}
