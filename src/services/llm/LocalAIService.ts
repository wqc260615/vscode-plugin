import * as vscode from 'vscode';
import { ChatSession, ChatMessage } from '../session/sessionManager';
import { LLMErrorHandler } from '../core/error/errorHandler';
import { ILLMService, ILLMServiceConfig } from './interfaces/ILLMService';

/**
 * LocalAI service implementation
 * Example: how to implement a new LLM service provider
 */
export class LocalAIService implements ILLMService {
    public readonly providerName: string = 'localai';
    private baseUrl: string;
    private errorHandler: LLMErrorHandler;
    private connectionChecked: boolean = false;

    constructor(config?: ILLMServiceConfig) {
        this.baseUrl = config?.baseUrl || this.getLocalAIUrl();
        this.errorHandler = LLMErrorHandler.getInstance();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.localaiUrl')) {
                this.baseUrl = this.getLocalAIUrl();
                this.connectionChecked = false;
            }
        });
    }

    private getLocalAIUrl(): string {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        return config.get('localaiUrl', 'http://localhost:8080');
    }

    public async isServiceAvailable(): Promise<boolean> {
        try {
            if (this.connectionChecked) {
                return true;
            }

            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            const isAvailable = response.ok;
            if (isAvailable) {
                this.connectionChecked = true;
            }
            
            return isAvailable;
        } catch (error) {
            console.warn('LocalAI service check failed:', error);
            return false;
        }
    }

    public async getModels(): Promise<string[]> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const response = await fetch(`${this.baseUrl}/v1/models`, {
                    signal: AbortSignal.timeout(10000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { data?: Array<{ id: string }> };
                const models = data.data?.map(model => model.id) || [];
                
                if (models.length === 0) {
                    throw new Error('No models found in LocalAI');
                }
                
                return models;
            }, 'getModels');
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { operation: 'getModels' });
            await this.errorHandler.showErrorToUser(errorDetails, true);
            return [];
        }
    }

    public async chatStream(
        model: string,
        prompt: string,
        session: ChatSession,
        onChunk: (chunk: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void
    ): Promise<void> {
        try {
            await this.errorHandler.withRetry(async () => {
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('LocalAI service is not available');
                }

                const messages = session.messages.map((msg: ChatMessage) => ({
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
                    stream: true
                };

                const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(60000)
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
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() && line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') {
                                    onComplete();
                                    return;
                                }
                                
                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.choices?.[0]?.delta?.content) {
                                        onChunk(parsed.choices[0].delta.content);
                                    }
                                } catch (parseError) {
                                    console.warn('Failed to parse chunk:', data);
                                }
                            }
                        }
                    }
                    onComplete();
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
            
            onError(error as Error);
        }
    }

    public async chat(model: string, prompt: string, session: ChatSession): Promise<string> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('LocalAI service is not available');
                }

                const messages = session.messages.map((msg: ChatMessage) => ({
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

                const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(30000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
                return data.choices?.[0]?.message?.content || 'No response received';
            }, `chat_${model}_${Date.now()}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'chat', 
                model, 
                promptLength: prompt.length 
            });
            
            await this.errorHandler.showErrorToUser(errorDetails, true);
            throw new Error(`Failed to get response from LocalAI: ${error}`);
        }
    }

    public async generate(model: string, prompt: string): Promise<string> {
        try {
            return await this.errorHandler.withRetry(async () => {
                const isAvailable = await this.isServiceAvailable();
                if (!isAvailable) {
                    throw new Error('LocalAI service is not available');
                }

                const availableModels = await this.getModels();
                if (!availableModels.includes(model)) {
                    throw new Error(`Model '${model}' not found. Available models: ${availableModels.join(', ')}`);
                }

                const requestBody = {
                    model: model,
                    prompt: prompt,
                    max_tokens: 1000
                };

                const response = await fetch(`${this.baseUrl}/v1/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(30000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { choices?: Array<{ text?: string }> };
                return data.choices?.[0]?.text || 'No response received';
            }, `generate_${model}_${Date.now()}`);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'generate', 
                model, 
                promptLength: prompt.length 
            });

            await this.errorHandler.showErrorToUser(errorDetails, true);
            throw new Error(`Failed to generate response: ${error}`);
        }
    }

    public async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean> {
        // LocalAI typically doesn't need to pull models; they should already exist locally
        console.log(`LocalAI: Model ${modelName} should already be available locally`);
        return true;
    }

    public async deleteModel(modelName: string): Promise<boolean> {
        // LocalAI usually does not support model deletion
        console.log(`LocalAI: Model deletion not supported for ${modelName}`);
        return false;
    }

    public async getModelInfo(modelName: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models/${modelName}`, {
                method: 'GET',
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn(`Failed to get model info for ${modelName}:`, error);
            return null;
        }
    }

        public async getPreferredModel(): Promise<string | null> {
        try {
            const models = await this.getModels();
            if (!models || models.length === 0) {
                return null;
            }
            // LocalAI can choose a default model as needed
            // Here we simply return the first one
            return models[0];
        } catch (err) {
            console.warn('Failed to get preferred model from LocalAI:', err);
            return null;
        }
    }

}

