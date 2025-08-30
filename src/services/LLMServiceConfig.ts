import * as vscode from 'vscode';

/**
 * LLM服务配置管理器
 * 负责管理不同LLM提供商的配置
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
     * 获取当前LLM提供商
     */
    public getCurrentProvider(): string {
        return this.config.get('llmProvider', 'ollama');
    }

    /**
     * 设置LLM提供商
     */
    public async setProvider(provider: string): Promise<void> {
        await this.config.update('llmProvider', provider, vscode.ConfigurationTarget.Global);
    }

    /**
     * 获取Ollama配置
     */
    public getOllamaConfig() {
        return {
            baseUrl: this.config.get('ollamaUrl', 'http://localhost:11434'),
            timeout: this.config.get('ollamaTimeout', 30000),
            maxRetries: this.config.get('ollamaMaxRetries', 3)
        };
    }

    /**
     * 获取LocalAI配置
     */
    public getLocalAIConfig() {
        return {
            baseUrl: this.config.get('localaiUrl', 'http://localhost:8080'),
            timeout: this.config.get('localaiTimeout', 30000),
            maxRetries: this.config.get('localaiMaxRetries', 3)
        };
    }

    /**
     * 获取默认模型
     */
    public getDefaultModel(): string {
        return this.config.get('defaultModel', '');
    }

    /**
     * 设置默认模型
     */
    public async setDefaultModel(model: string): Promise<void> {
        await this.config.update('defaultModel', model, vscode.ConfigurationTarget.Global);
    }

    /**
     * 获取所有可用的提供商
     */
    public getAvailableProviders(): string[] {
        return ['ollama', 'localai'];
    }

    /**
     * 获取提供商特定的配置
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
     * 验证提供商配置
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
     * 获取配置摘要
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
