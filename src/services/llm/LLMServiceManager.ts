import * as vscode from 'vscode';
import { ILLMService, ILLMServiceConfig, ILLMServiceFactory } from './interfaces/ILLMService';
import { OllamaService } from './ollamaService';
import { LocalAIService } from './LocalAIService';

/**
 * LLM service manager
 * Manages different LLM service providers and offers a unified interface
 */
export class LLMServiceManager {
    private static instance: LLMServiceManager;
    private services: Map<string, ILLMService> = new Map();
    private currentService: ILLMService | null = null;
    private serviceFactories: Map<string, ILLMServiceFactory> = new Map();

    private constructor() {
        this.initializeDefaultServices();
    }

    public static getInstance(): LLMServiceManager {
        if (!LLMServiceManager.instance) {
            LLMServiceManager.instance = new LLMServiceManager();
        }
        return LLMServiceManager.instance;
    }

    /**
     * Initialize default services
     */
    private initializeDefaultServices(): void {
        // Register Ollama service factory
        this.registerServiceFactory('ollama', {
            createService: (config: ILLMServiceConfig) => new OllamaService(config),
            getSupportedProviders: () => ['ollama']
        });

        // Register LocalAI service factory
        this.registerServiceFactory('localai', {
            createService: (config: ILLMServiceConfig) => new LocalAIService(config),
            getSupportedProviders: () => ['localai']
        });

        // Create default Ollama service
        const ollamaService = new OllamaService();
        this.services.set('ollama', ollamaService);
        this.currentService = ollamaService;

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.llmProvider')) {
                this.switchProvider();
            }
        });
    }

    /**
     * Register a service factory
     */
    public registerServiceFactory(providerName: string, factory: ILLMServiceFactory): void {
        this.serviceFactories.set(providerName, factory);
    }

    /**
     * Create a new service instance
     */
    public createService(providerName: string, config?: ILLMServiceConfig): ILLMService | null {
        const factory = this.serviceFactories.get(providerName);
        if (!factory) {
            console.warn(`No factory found for provider: ${providerName}`);
            return null;
        }

        try {
            const service = factory.createService(config || { providerName });
            this.services.set(providerName, service);
            return service;
        } catch (error) {
            console.error(`Failed to create service for provider ${providerName}:`, error);
            return null;
        }
    }

    /**
     * Switch service provider
     */
    public async switchProvider(): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const providerName = config.get('llmProvider', 'ollama');

        // If current service is already the target, no switch needed
        if (this.currentService?.providerName === providerName) {
            return;
        }

        // Check if the service already exists
        let service: ILLMService | null = this.services.get(providerName) || null;
        
        // If service doesn't exist, try creating it
        if (!service) {
            service = this.createService(providerName);
        }

        if (service) {
            // Check service availability
            const isAvailable = await service.isServiceAvailable();
            if (isAvailable) {
                this.currentService = service;
                console.log(`Switched to LLM provider: ${providerName}`);
                
                // Notify other components that the service has switched
                vscode.commands.executeCommand('aiAssistant.llmProviderChanged', providerName);
            } else {
                console.warn(`Provider ${providerName} is not available, keeping current provider`);
                vscode.window.showWarningMessage(
                    `LLM provider ${providerName} is not available. Please check your configuration.`
                );
            }
        } else {
            console.error(`Failed to switch to provider: ${providerName}`);
            vscode.window.showErrorMessage(
                `Failed to switch to LLM provider: ${providerName}`
            );
        }
    }

    /**
     * Get the current active service
     */
    public getCurrentService(): ILLMService | null {
        return this.currentService;
    }

    /**
     * Get the service for a specific provider
     */
    public getService(providerName: string): ILLMService | null {
        return this.services.get(providerName) || null;
    }

    /**
     * Get all available service providers
     */
    public getAvailableProviders(): string[] {
        return Array.from(this.serviceFactories.keys());
    }

    /**
     * Get the current provider name
     */
    public getCurrentProviderName(): string {
        return this.currentService?.providerName || 'ollama';
    }

    /**
     * Check whether the service is available
     */
    public async isServiceAvailable(): Promise<boolean> {
        const service = this.getCurrentService();
        return service ? await service.isServiceAvailable() : false;
    }

    /**
     * Get the list of available models
     */
    public async getModels(): Promise<string[]> {
        const service = this.getCurrentService();
        return service ? await service.getModels() : [];
    }

    /**
     * Get the preferred model (auto-select the best available)
     */
    public async getPreferredModel(): Promise<string> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        // Note: requires getPreferredModel() to be defined in the ILLMService interface
        if (typeof (service as any).getPreferredModel === 'function') {
            return await (service as any).getPreferredModel();
        }

        // If some services don't implement it, fall back to the first available model
        const models = await service.getModels();
        if (models.length === 0) {
            throw new Error('No models available');
        }
        return models[0];
    }


    /**
     * Streaming chat request
     */
    public async chatStream(
        model: string,
        prompt: string,
        session: any,
        onChunk: (chunk: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void
    ): Promise<void> {
        const service = this.getCurrentService();
        if (!service) {
            onError(new Error('No LLM service available'));
            return;
        }

        await service.chatStream(model, prompt, session, onChunk, onComplete, onError);
    }

    /**
     * Non-streaming chat request
     */
    public async chat(model: string, prompt: string, session: any): Promise<string> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.chat(model, prompt, session);
    }

    /**
     * Generate plain text
     */
    public async generate(model: string, prompt: string): Promise<string> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.generate(model, prompt);
    }

    /**
     * Pull a model
     */
    public async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.pullModel(modelName, onProgress);
    }

    /**
     * Delete a model
     */
    public async deleteModel(modelName: string): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.deleteModel(modelName);
    }

    /**
     * Get model information
     */
    public async getModelInfo(modelName: string): Promise<any> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.getModelInfo(modelName);
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.services.clear();
        this.currentService = null;
        this.serviceFactories.clear();
    }
}
