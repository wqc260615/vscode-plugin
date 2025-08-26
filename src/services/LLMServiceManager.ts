import * as vscode from 'vscode';
import { ILLMService, ILLMServiceConfig, ILLMServiceFactory } from './interfaces/ILLMService';
import { OllamaService } from './ollamaService';
import { LocalAIService } from './LocalAIService';

/**
 * LLM服务管理器
 * 负责管理不同的LLM服务提供商，提供统一的接口
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
     * 初始化默认服务
     */
    private initializeDefaultServices(): void {
        // 注册Ollama服务工厂
        this.registerServiceFactory('ollama', {
            createService: (config: ILLMServiceConfig) => new OllamaService(config),
            getSupportedProviders: () => ['ollama']
        });

        // 注册LocalAI服务工厂
        this.registerServiceFactory('localai', {
            createService: (config: ILLMServiceConfig) => new LocalAIService(config),
            getSupportedProviders: () => ['localai']
        });

        // 创建默认的Ollama服务
        const ollamaService = new OllamaService();
        this.services.set('ollama', ollamaService);
        this.currentService = ollamaService;

        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.llmProvider')) {
                this.switchProvider();
            }
        });
    }

    /**
     * 注册服务工厂
     */
    public registerServiceFactory(providerName: string, factory: ILLMServiceFactory): void {
        this.serviceFactories.set(providerName, factory);
    }

    /**
     * 创建新的服务实例
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
     * 切换服务提供商
     */
    public async switchProvider(): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const providerName = config.get('llmProvider', 'ollama');

        // 如果当前服务已经是目标提供商，无需切换
        if (this.currentService?.providerName === providerName) {
            return;
        }

        // 检查服务是否已存在
        let service: ILLMService | null = this.services.get(providerName) || null;
        
        // 如果服务不存在，尝试创建
        if (!service) {
            service = this.createService(providerName);
        }

        if (service) {
            // 检查服务可用性
            const isAvailable = await service.isServiceAvailable();
            if (isAvailable) {
                this.currentService = service;
                console.log(`Switched to LLM provider: ${providerName}`);
                
                // 通知其他组件服务已切换
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
     * 获取当前活跃的服务
     */
    public getCurrentService(): ILLMService | null {
        return this.currentService;
    }

    /**
     * 获取指定提供商的服务
     */
    public getService(providerName: string): ILLMService | null {
        return this.services.get(providerName) || null;
    }

    /**
     * 获取所有可用的服务提供商
     */
    public getAvailableProviders(): string[] {
        return Array.from(this.serviceFactories.keys());
    }

    /**
     * 获取当前提供商名称
     */
    public getCurrentProviderName(): string {
        return this.currentService?.providerName || 'ollama';
    }

    /**
     * 检查服务是否可用
     */
    public async isServiceAvailable(): Promise<boolean> {
        const service = this.getCurrentService();
        return service ? await service.isServiceAvailable() : false;
    }

    /**
     * 获取可用的模型列表
     */
    public async getModels(): Promise<string[]> {
        const service = this.getCurrentService();
        return service ? await service.getModels() : [];
    }

    /**
     * 流式聊天请求
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
     * 非流式聊天请求
     */
    public async chat(model: string, prompt: string, session: any): Promise<string> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.chat(model, prompt, session);
    }

    /**
     * 生成简单文本
     */
    public async generate(model: string, prompt: string): Promise<string> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.generate(model, prompt);
    }

    /**
     * 拉取模型
     */
    public async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.pullModel(modelName, onProgress);
    }

    /**
     * 删除模型
     */
    public async deleteModel(modelName: string): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.deleteModel(modelName);
    }

    /**
     * 获取模型信息
     */
    public async getModelInfo(modelName: string): Promise<any> {
        const service = this.getCurrentService();
        if (!service) {
            throw new Error('No LLM service available');
        }

        return await service.getModelInfo(modelName);
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        this.services.clear();
        this.currentService = null;
        this.serviceFactories.clear();
    }
}
