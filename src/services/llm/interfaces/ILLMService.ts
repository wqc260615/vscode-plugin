import { ChatSession } from '../../session/sessionManager';

/**
 * Abstract interface for LLM services
 * All LLM service providers must implement this interface
 */
export interface ILLMService {
    /**
     * Service provider name
     */
    readonly providerName: string;

    /**
     * Check whether the service is available
     */
    isServiceAvailable(): Promise<boolean>;

    /**
     * Get the list of available models
     */
    getModels(): Promise<string[]>;

    getPreferredModel(): Promise<string | null>;

    /**
     * Streaming chat request
     */
    chatStream(
        model: string,
        prompt: string,
        session: ChatSession,
        onChunk: (chunk: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void
    ): Promise<void>;

    /**
     * Non-streaming chat request
     */
    chat(model: string, prompt: string, session: ChatSession): Promise<string>;

    /**
     * Generate plain text (without session context)
     */
    generate(model: string, prompt: string): Promise<string>;

    /**
     * Pull a model
     */
    pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean>;

    /**
     * Delete a model
     */
    deleteModel(modelName: string): Promise<boolean>;

    /**
     * Get model information
     */
    getModelInfo(modelName: string): Promise<any>;
}

/**
 * LLM service configuration interface
 */
export interface ILLMServiceConfig {
    providerName: string;
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
}

/**
 * LLM service factory interface
 */
export interface ILLMServiceFactory {
    createService(config: ILLMServiceConfig): ILLMService;
    getSupportedProviders(): string[];
}

