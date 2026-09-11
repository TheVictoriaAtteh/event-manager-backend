import { ConfigService } from '@nestjs/config';
export declare class UploadsService {
    private readonly config;
    private readonly storageClient;
    private readonly supabaseUrl;
    constructor(config: ConfigService);
    uploadImage(file: Express.Multer.File): Promise<{
        url: string;
    }>;
}
