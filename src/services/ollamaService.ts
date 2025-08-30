import * as vscode from 'vscode';
import { ChatSession, ChatMessage } from './sessionManager';
import { LLMErrorHandler, ErrorType, ResponseCache } from './errorHandler';
import { ILLMService, ILLMServiceConfig } from './interfaces/ILLMService';
import { PerformanceMonitor } from './performanceMonitor';

export interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
}

export interface OllamaResponse {
    response?: string;
    done: boolean;
    error?: string;
}

export class OllamaService implements ILLMService {
    public readonly providerName: string = 'ollama';
    private baseUrl: string;
    private errorHandler: LLMErrorHandler;
    private cache: ResponseCache;
    private performanceMonitor: PerformanceMonitor;
    private connectionChecked: boolean = false;

    constructor(config?: ILLMServiceConfig) {
        this.baseUrl = config?.baseUrl || this.getOllamaUrl();
        this.errorHandler = LLMErrorHandler.getInstance();
        this.cache = new ResponseCache();
        this.performanceMonitor = PerformanceMonitor.getInstance();

        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.ollamaUrl')) {
                this.baseUrl = this.getOllamaUrl();
                this.connectionChecked = false; // Reset connection check
            }
        });
    }

    private getOllamaUrl(): string {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        return config.get('ollamaUrl', 'http://localhost:11434');
    }

    /**
     * 获取可用的模型列表
     */
    public async getModels(): Promise<string[]> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const response = await fetch(`${this.baseUrl}/api/tags`, {
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { models?: OllamaModel[] };
                const models = data.models?.map((model: OllamaModel) => model.name) || [];
                
                if (models.length === 0) {
                    throw new Error('No models found. Please install at least one model using: ollama pull <model-name>');
                }
                
                return models;
            }, 'getModels');
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { operation: 'getModels' });
            await this.errorHandler.showErrorToUser(errorDetails, true);
            return [];
        }
    }

    /**
     * 获取首选模型（自动选择最佳可用模型）
     */
    public async getPreferredModel(): Promise<string> {
        try {
            const config = vscode.workspace.getConfiguration('aiAssistant');
            const defaultModel = config.get('defaultModel', '');
            
            const availableModels = await this.getModels();
            
            if (availableModels.length === 0) {
                throw new Error('No models available. Please install a model using: ollama pull <model-name>');
            }

            // If user specified default model and it exists, use it
            if (defaultModel && availableModels.includes(defaultModel)) {
                return defaultModel;
            }

            // Model preference order (best to least preferred)
            const preferredOrder = [
                'llama3.2', 'llama3.1', 'llama3', 'llama2',
                'codellama', 'codegemma',
                'gemma2', 'gemma3', 'gemma',
                'phi3', 'qwen2', 'mistral',
                'tinyllama' // Fallback for performance
            ];

            // Find first available model from preference list
            for (const preferredModel of preferredOrder) {
                const foundModel = availableModels.find(model => 
                    model.includes(preferredModel) || model.startsWith(preferredModel)
                );
                if (foundModel) {
                    console.log(`🤖 Using model: ${foundModel}`);
                    return foundModel;
                }
            }

            // If no preferred model found, use the first available model
            console.log(`🤖 Using fallback model: ${availableModels[0]}`);
            return availableModels[0];
        } catch (error) {
            console.error('Error getting preferred model:', error);
            return 'llama2'; // Fallback
        }
    }

    /**
     * 检查Ollama服务是否可用
     */
    public async isServiceAvailable(): Promise<boolean> {
        try {
            if (this.connectionChecked) {
                return true;
            }

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            const isAvailable = response.ok;
            if (isAvailable) {
                this.connectionChecked = true;
            }
            
            return isAvailable;
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { operation: 'serviceCheck' });
            
            // Only show error if this is not a background check
            if (!this.connectionChecked) {
                vscode.window.showWarningMessage(
                    'Ollama service is not available. Please ensure Ollama is running.',
                    'Help'
                ).then(result => {
                    if (result === 'Help') {
                        this.errorHandler.showErrorToUser(errorDetails, false);
                    }
                });
            }
            
            return false;
        }
    }

    /**
     * 发送聊天请求到Ollama（流式响应）
     */
    public async chatStream(
        model: string,
        prompt: string,
        session: ChatSession,
        onChunk: (chunk: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void,
        userActionStartTime?: number
    ): Promise<void> {
        const requestStartTime = performance.now();
        const userStartTime = userActionStartTime || requestStartTime;
        let completeResponse = '';
        let firstChunkReceived = false;
        let firstChunkTime: number | null = null;
        
        const wrappedOnChunk = (chunk: string) => {
            // Record the time when first chunk is received (end-to-end latency)
            if (!firstChunkReceived) {
                firstChunkReceived = true;
                firstChunkTime = performance.now();
                
                // Log end-to-end latency from user action to first response
                const endToEndLatency = firstChunkTime - userStartTime;
                console.log(`⚡ End-to-end latency: ${endToEndLatency.toFixed(2)}ms (from user action to first response)`);
                this.performanceMonitor.logEndToEndLatency(
                    'Chat Response Time',
                    prompt.length,
                    chunk.length,
                    userStartTime,
                    firstChunkTime
                );
            }
            
            completeResponse += chunk;
            onChunk(chunk);
        };

        const wrappedOnComplete = () => {
            const endTime = performance.now();
            // Log overall chat performance (full response completion)
            this.performanceMonitor.logChatPerformance(
                prompt,
                completeResponse,
                requestStartTime,
                endTime,
                model
            );
            onComplete();
        };

        const wrappedOnError = (error: Error) => {
            const endTime = performance.now();
            console.log(`❌ Chat error after ${(endTime - requestStartTime).toFixed(2)}ms: ${error.message}`);
            onError(error);
        };

        try {
            await this.errorHandler.withRetry(async () => {
                // 首先验证服务可用性
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('Ollama service is not available');
                }

                // 构建消息历史
                const messages = session.messages.map(msg => ({
                    role: msg.isUser ? 'user' : 'assistant',
                    content: msg.content
                }));

                // 添加当前用户消息
                messages.push({
                    role: 'user',
                    content: prompt
                });

                const requestBody = {
                    model: model,
                    messages: messages,
                    stream: true
                };

                const response = await fetch(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(60000) // 60 second timeout for streaming
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('Failed to get response reader');
                }

                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // 保留未完成的行

                        for (const line of lines) {
                            if (line.trim()) {
                                try {
                                    const data = JSON.parse(line);
                                    if (data.message?.content) {
                                        wrappedOnChunk(data.message.content);
                                    }
                                    if (data.done) {
                                        wrappedOnComplete();
                                        return;
                                    }
                                } catch (parseError) {
                                    console.warn('Failed to parse chunk:', line);
                                }
                            }
                        }
                    }
                    wrappedOnComplete();
                } finally {
                    reader.releaseLock();
                }
            }, `chatStream_${model}_${Date.now()}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'chatStream', 
                model, 
                promptLength: prompt.length 
            });
            
            // 通知用户错误
            this.errorHandler.showErrorToUser(errorDetails, true).then(action => {
                if (action === 'retry') {
                    // 用户选择重试
                    setTimeout(() => {
                        this.chatStream(model, prompt, session, onChunk, onComplete, onError, userStartTime);
                    }, 1000);
                }
            });
            
            wrappedOnError(error as Error);
        }
    }

    /**
     * 发送非流式聊天请求
     */
    public async chat(model: string, prompt: string, session: ChatSession): Promise<string> {
        try {
            return await this.errorHandler.withRetry(async () => {
                // 检查缓存
                const cacheKey = this.cache.generateKey(model, prompt + JSON.stringify(session.messages));
                const cachedResponse = this.cache.get(cacheKey);
                if (cachedResponse) {
                    vscode.window.showInformationMessage('Using cached response');
                    return cachedResponse;
                }

                // 验证服务可用性
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('Ollama service is not available');
                }

                const messages = session.messages.map(msg => ({
                    role: msg.isUser ? 'user' : 'assistant',
                    content: msg.content
                }));

                messages.push({
                    role: 'user',
                    content: prompt
                });

                const requestBody = {
                    model: model,
                    messages: messages,
                    stream: false
                };

                const response = await fetch(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { message?: { content?: string } };
                const responseContent = data.message?.content || 'No response received';
                
                // 缓存响应
                this.cache.set(cacheKey, responseContent);
                
                return responseContent;
            }, `chat_${model}_${Date.now()}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'chat', 
                model, 
                promptLength: prompt.length 
            });
            
            // 尝试从缓存获取备用响应
            const fallbackKey = this.cache.generateKey(model, prompt);
            const fallbackResponse = this.cache.get(fallbackKey);
            if (fallbackResponse) {
                vscode.window.showWarningMessage('Using cached fallback response due to connection issues');
                return fallbackResponse;
            }
            
            await this.errorHandler.showErrorToUser(errorDetails, true);
            throw new Error(`Failed to get response from Ollama: ${error}`);
        }
    }

    /**
    * 生成简单文本（不包含会话上下文）- 改进版本
    */
    public async generate(model: string, prompt: string): Promise<string> {
        const startTime = performance.now();
        
        try {
            const result = await this.errorHandler.withRetry(async () => {
                // 检查缓存
                const cacheKey = this.cache.generateKey(model, prompt);
                const cachedResponse = this.cache.get(cacheKey);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // 验证服务可用性
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('Ollama service is not available');
                }

                // 首先检查模型是否存在
                const availableModels = await this.getModels();
                if (!availableModels.includes(model)) {
                    throw new Error(`Model '${model}' not found. Available models: ${availableModels.join(', ')}`);
                }

                const requestBody = {
                    model: model,
                    prompt: prompt,
                    stream: false
                };

                const response = await fetch(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                });

                if (!response.ok) {
                    // 如果 generate API 不可用（404），尝试使用 chat API
                    if (response.status === 404) {
                        console.warn('Generate API not available, falling back to chat API');
                        return await this.generateWithChatAPI(model, prompt);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { response?: string };
                const responseContent = data.response || 'No response received';
                
                // 缓存响应
                this.cache.set(cacheKey, responseContent);
                
                return responseContent;
            }, `generate_${model}_${Date.now()}`);

            // Log performance for successful generation
            const endTime = performance.now();
            this.performanceMonitor.logEndToEndLatency(
                'Code Generation',
                prompt.length,
                result.length,
                startTime,
                endTime
            );
            
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.log(`❌ Generation error after ${(endTime - startTime).toFixed(2)}ms: ${error}`);
            
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'generate', 
                model, 
                promptLength: prompt.length 
            });

            // 如果是网络错误或404，尝试使用 chat API 作为备选
            if (error instanceof Error && (error.message.includes('404') || error.message.includes('fetch'))) {
                try {
                    console.log('Trying chat API as fallback...');
                    const fallbackResponse = await this.generateWithChatAPI(model, prompt);
                    
                    // 缓存备用响应
                    const cacheKey = this.cache.generateKey(model, prompt);
                    this.cache.set(cacheKey, fallbackResponse);
                    
                    return fallbackResponse;
                } catch (chatError) {
                    await this.errorHandler.showErrorToUser(errorDetails, true);
                    throw new Error(`Both generate and chat APIs failed. Original error: ${error.message}`);
                }
            }

            // 尝试从缓存获取备用响应
            const fallbackKey = this.cache.generateKey(model, prompt);
            const fallbackResponse = this.cache.get(fallbackKey);
            if (fallbackResponse) {
                vscode.window.showWarningMessage('Using cached response due to connection issues');
                return fallbackResponse;
            }

            await this.errorHandler.showErrorToUser(errorDetails, true);
            throw new Error(`Failed to generate response: ${error}`);
        }
    }

    /**
     * 使用 chat API 作为 generate 的备选方案
     */
    private async generateWithChatAPI(model: string, prompt: string): Promise<string> {
        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            stream: false
        };

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Chat API HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as { message?: { content?: string } };
        return data.message?.content || 'No response received';
    }

    /**
     * 拉取模型
     */
    public async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean> {
        try {
            return await this.errorHandler.withRetry(async () => {
                // 验证服务可用性
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('Ollama service is not available');
                }

                const response = await fetch(`${this.baseUrl}/api/pull`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: modelName,
                        stream: !!onProgress
                    }),
                    signal: AbortSignal.timeout(300000) // 5 minute timeout for model pulling
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                if (onProgress && response.body) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                break;
                            }

                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n').filter(line => line.trim());

                            for (const line of lines) {
                                try {
                                    const data = JSON.parse(line);
                                    onProgress(data);
                                } catch (parseError) {
                                    console.warn('Failed to parse progress chunk:', line);
                                }
                            }
                        }
                    } finally {
                        reader.releaseLock();
                    }
                }

                return true;
            }, `pullModel_${modelName}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'pullModel', 
                modelName 
            });
            
            await this.errorHandler.showErrorToUser(errorDetails, true);
            return false;
        }
    }

    /**
     * 删除模型
     */
    public async deleteModel(modelName: string): Promise<boolean> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const response = await fetch(`${this.baseUrl}/api/delete`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: modelName
                    }),
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                });

                return response.ok;
            }, `deleteModel_${modelName}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'deleteModel', 
                modelName 
            });
            
            await this.errorHandler.showErrorToUser(errorDetails, true);
            return false;
        }
    }

    /**
     * 获取模型信息
     */
    public async getModelInfo(modelName: string): Promise<any> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const response = await fetch(`${this.baseUrl}/api/show`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: modelName
                    }),
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            }, `getModelInfo_${modelName}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'getModelInfo', 
                modelName 
            });
            
            // For model info, don't show error to user unless explicitly requested
            return null;
        }
    }
}