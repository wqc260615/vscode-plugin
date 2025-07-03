import * as vscode from 'vscode';
import { ChatSession, ChatMessage } from './sessionManager';

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

export class OllamaService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = this.getOllamaUrl();
        
        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.ollamaUrl')) {
                this.baseUrl = this.getOllamaUrl();
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
            const response = await fetch(`${this.baseUrl}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { models?: OllamaModel[] };
            return data.models?.map((model: OllamaModel) => model.name) || [];
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            const defaultModel = vscode.workspace.getConfiguration('aiAssistant').get('defaultModel', 'llama2');
            return [defaultModel];
        }
    }

    /**
     * 检查Ollama服务是否可用
     */
    public async isServiceAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5秒超时
            });
            return response.ok;
        } catch (error) {
            console.error('Ollama service not available:', error);
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
        onError: (error: Error) => void
    ): Promise<void> {
        try {
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
                body: JSON.stringify(requestBody)
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
                                    onChunk(data.message.content);
                                }
                                if (data.done) {
                                    onComplete();
                                    return;
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse chunk:', line);
                            }
                        }
                    }
                }
                onComplete();
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            onError(error as Error);
        }
    }

    /**
     * 发送非流式聊天请求
     */
    public async chat(model: string, prompt: string, session: ChatSession): Promise<string> {
        try {
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
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { message?: { content?: string } };
            return data.message?.content || 'No response received';
        } catch (error) {
            throw new Error(`Failed to get response from Ollama: ${error}`);
        }
    }

    /**
     * 生成简单文本（不包含会话上下文）
     */
    public async generate(model: string, prompt: string): Promise<string> {
        try {
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
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { response?: string };
            return data.response || 'No response received';
        } catch (error) {
            throw new Error(`Failed to generate response: ${error}`);
        }
    }

    /**
     * 拉取模型
     */
    public async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: modelName,
                    stream: !!onProgress
                })
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
                        if (done) break;

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
        } catch (error) {
            console.error('Error pulling model:', error);
            return false;
        }
    }

    /**
     * 删除模型
     */
    public async deleteModel(modelName: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: modelName
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Error deleting model:', error);
            return false;
        }
    }

    /**
     * 获取模型信息
     */
    public async getModelInfo(modelName: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: modelName
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting model info:', error);
            return null;
        }
    }
}