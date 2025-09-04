import * as vscode from 'vscode';

/**
 * LLM service configuration manager
 * Responsible for managing configurations of different LLM providers
 */
export class LLMServiceConfig {
    private static instance: LLMServiceConfig;
    private config: vscode.WorkspaceConfiguration;

    private constructor() {
        this.config = vscode.workspace.getConfiguration('aiAssistant');
    }

    public static getInstance(): LLMServiceConfig {
        if (!LLMServiceConfig.instance) {
            LLMServiceConfig.instance = new LLMServiceConfig();
        }
        return LLMServiceConfig.instance;
    }

    /**
     * Get current LLM provider
     */
    public getCurrentProvider(): string {
        return this.config.get('llmProvider', 'ollama');
    }

    /**
     * Set LLM provider
     */
    public async setProvider(provider: string): Promise<void> {
        await this.config.update('llmProvider', provider, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get Ollama configuration
     */
    public getOllamaConfig() {
        return {
            baseUrl: this.config.get('ollamaUrl', 'http://localhost:11434'),
            timeout: this.config.get('ollamaTimeout', 30000),
            maxRetries: this.config.get('ollamaMaxRetries', 3)
        };
    }

    /**
     * Get LocalAI configuration
     */
    public getLocalAIConfig() {
        return {
            baseUrl: this.config.get('localaiUrl', 'http://localhost:8080'),
            timeout: this.config.get('localaiTimeout', 30000),
            maxRetries: this.config.get('localaiMaxRetries', 3)
        };
    }

    /**
     * Get default model
     */
    public getDefaultModel(): string {
        return this.config.get('defaultModel', '');
    }

    /**
     * Set default model
     */
    public async setDefaultModel(model: string): Promise<void> {
        await this.config.update('defaultModel', model, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get all available providers
     */
    public getAvailableProviders(): string[] {
        return ['ollama', 'localai'];
    }

    /**
     * Get provider-specific configuration
     */
    public getProviderConfig(provider: string): { baseUrl: string; timeout: number; maxRetries: number } {
        switch (provider) {
            case 'ollama':
                return this.getOllamaConfig();
            case 'localai':
                return this.getLocalAIConfig();
            default:
                return {
                    baseUrl: '',
                    timeout: 30000,
                    maxRetries: 3
                };
        }
    }

    /**
     * Validate provider configuration
     */
    public validateProviderConfig(provider: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const config = this.getProviderConfig(provider);

        if (!config.baseUrl) {
            errors.push('Base URL is required');
        }

        if (config.timeout && config.timeout < 1000) {
            errors.push('Timeout must be at least 1000ms');
        }

        if (config.maxRetries && config.maxRetries < 0) {
            errors.push('Max retries must be non-negative');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get configuration summary
     */
    public getConfigSummary(): string {
        const provider = this.getCurrentProvider();
        const config = this.getProviderConfig(provider);
        const defaultModel = this.getDefaultModel();

        return `Provider: ${provider}
Base URL: ${config.baseUrl}
Timeout: ${config.timeout}ms
Max Retries: ${config.maxRetries}
Default Model: ${defaultModel || 'Not set'}`;
    }
}
