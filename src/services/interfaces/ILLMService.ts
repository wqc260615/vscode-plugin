import { ChatSession } from '../sessionManager';

/**
 * LLM服务抽象接口
 * 所有LLM服务提供商都必须实现此接口
 */
export interface ILLMService {
    /**
     * 服务提供商名称
     */
    readonly providerName: string;

    /**
     * 检查服务是否可用
     */
    isServiceAvailable(): Promise<boolean>;

    /**
     * 获取可用的模型列表
     */
    getModels(): Promise<string[]>;

    getPreferredModel(): Promise<string | null>;

    /**
     * 流式聊天请求
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
     * 非流式聊天请求
     */
    chat(model: string, prompt: string, session: ChatSession): Promise<string>;

    /**
     * 生成简单文本（不包含会话上下文）
     */
    generate(model: string, prompt: string): Promise<string>;

    /**
     * 拉取模型
     */
    pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean>;

    /**
     * 删除模型
     */
    deleteModel(modelName: string): Promise<boolean>;

    /**
     * 获取模型信息
     */
    getModelInfo(modelName: string): Promise<any>;
}

/**
 * LLM服务配置接口
 */
export interface ILLMServiceConfig {
    providerName: string;
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
}

/**
 * LLM服务工厂接口
 */
export interface ILLMServiceFactory {
    createService(config: ILLMServiceConfig): ILLMService;
    getSupportedProviders(): string[];
}

