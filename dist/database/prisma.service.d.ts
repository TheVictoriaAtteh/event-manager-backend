import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
export declare class PrismaService extends PrismaClient implements OnModuleDestroy {
    private readonly logger;
    constructor(config: ConfigService);
    onModuleDestroy(): Promise<void>;
}
