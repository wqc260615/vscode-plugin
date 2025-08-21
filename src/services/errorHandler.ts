import * as vscode from 'vscode';

export enum ErrorType {
    CONNECTION_FAILED = 'connection_failed',
    TIMEOUT = 'timeout',
    MODEL_NOT_FOUND = 'model_not_found',
    MODEL_LOADING_FAILED = 'model_loading_failed',
    INVALID_RESPONSE = 'invalid_response',
    SERVICE_UNAVAILABLE = 'service_unavailable',
    AUTHENTICATION_FAILED = 'authentication_failed',
    RATE_LIMITED = 'rate_limited',
    UNKNOWN = 'unknown'
}

export interface ErrorDetails {
    type: ErrorType;
    message: string;
    originalError?: Error;
    context?: any;
    userMessage: string;
    suggestedActions: string[];
    canRetry: boolean;
}

export class LLMErrorHandler {
    private static instance: LLMErrorHandler;
    private retryAttempts = new Map<string, number>();
    private maxRetries = 3;
    private retryDelay = 1000; // 1 second

    public static getInstance(): LLMErrorHandler {
        if (!LLMErrorHandler.instance) {
            LLMErrorHandler.instance = new LLMErrorHandler();
        }
        return LLMErrorHandler.instance;
    }

    /**
     * 获取错误处理配置
     */
    private getErrorConfig() {
        const config = vscode.workspace.getConfiguration('aiAssistant.errorHandling');
        return {
            showDetailedErrors: config.get('showDetailedErrors', true),
            enableRetry: config.get('enableRetry', true),
            maxRetries: config.get('maxRetries', 3),
            cacheResponses: config.get('cacheResponses', true),
            showConnectionWarnings: config.get('showConnectionWarnings', true)
        };
    }

    /**
     * 处理和分类错误
     */
    public handleError(error: any, context?: any): ErrorDetails {
        const errorDetails = this.categorizeError(error, context);
        this.logError(errorDetails);
        return errorDetails;
    }

    /**
     * 分类错误类型
     */
    private categorizeError(error: any, context?: any): ErrorDetails {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        // 连接失败
        if (this.isConnectionError(error)) {
            return {
                type: ErrorType.CONNECTION_FAILED,
                message: errorMessage,
                originalError: error,
                context,
                userMessage: 'Unable to connect to Ollama service',
                suggestedActions: [
                    'Check if Ollama is running (try: ollama serve)',
                    'Verify the Ollama URL in settings',
                    'Check your network connection',
                    'Ensure Ollama is installed and properly configured'
                ],
                canRetry: true
            };
        }

        // 超时错误
        if (this.isTimeoutError(error)) {
            return {
                type: ErrorType.TIMEOUT,
                message: errorMessage,
                originalError: error,
                context,
                userMessage: 'Request timed out',
                suggestedActions: [
                    'Try again with a simpler request',
                    'Check if Ollama service is responsive',
                    'Consider using a smaller model if available'
                ],
                canRetry: true
            };
        }

        // 模型未找到
        if (this.isModelNotFoundError(error)) {
            return {
                type: ErrorType.MODEL_NOT_FOUND,
                message: errorMessage,
                originalError: error,
                context,
                userMessage: 'The specified AI model is not available',
                suggestedActions: [
                    'Download the model using: ollama pull <model-name>',
                    'Check available models with: ollama list',
                    'Select a different model from the dropdown',
                    'Verify the model name is correct'
                ],
                canRetry: false
            };
        }

        // 服务不可用
        if (this.isServiceUnavailableError(error)) {
            return {
                type: ErrorType.SERVICE_UNAVAILABLE,
                message: errorMessage,
                originalError: error,
                context,
                userMessage: 'Ollama service is not available',
                suggestedActions: [
                    'Start Ollama service: ollama serve',
                    'Check if Ollama is installed',
                    'Verify system requirements are met',
                    'Try restarting Ollama service'
                ],
                canRetry: true
            };
        }

        // 无效响应
        if (this.isInvalidResponseError(error)) {
            return {
                type: ErrorType.INVALID_RESPONSE,
                message: errorMessage,
                originalError: error,
                context,
                userMessage: 'Received invalid response from AI service',
                suggestedActions: [
                    'Try rephrasing your request',
                    'Check if the model is properly loaded',
                    'Try with a different model'
                ],
                canRetry: true
            };
        }

        // 默认未知错误
        return {
            type: ErrorType.UNKNOWN,
            message: errorMessage,
            originalError: error,
            context,
            userMessage: 'An unexpected error occurred',
            suggestedActions: [
                'Try again in a moment',
                'Check the VS Code output panel for details',
                'Restart the extension if the problem persists'
            ],
            canRetry: true
        };
    }

    /**
     * 显示用户友好的错误消息
     */
    public async showErrorToUser(errorDetails: ErrorDetails, allowRetry: boolean = true): Promise<'retry' | 'dismiss' | 'help'> {
        const config = this.getErrorConfig();
        
        if (!config.showDetailedErrors) {
            // 简化错误显示
            vscode.window.showErrorMessage('AI service encountered an error. Please try again.');
            return 'dismiss';
        }

        const actions: string[] = [];
        
        if (allowRetry && errorDetails.canRetry && config.enableRetry) {
            actions.push('Retry');
        }
        actions.push('Help', 'Dismiss');

        const result = await vscode.window.showErrorMessage(
            errorDetails.userMessage,
            ...actions
        );

        if (result === 'Help') {
            this.showErrorHelp(errorDetails);
            return 'help';
        }

        return result === 'Retry' ? 'retry' : 'dismiss';
    }

    /**
     * 显示详细的错误帮助
     */
    private async showErrorHelp(errorDetails: ErrorDetails) {
        const panel = vscode.window.createWebviewPanel(
            'errorHelp',
            'AI Assistant - Error Help',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getErrorHelpHtml(errorDetails);
    }

    /**
     * 生成错误帮助页面HTML
     */
    private getErrorHelpHtml(errorDetails: ErrorDetails): string {
        const actions = errorDetails.suggestedActions
            .map(action => `<li>${action}</li>`)
            .join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Error Help</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                }
                .error-type { 
                    color: var(--vscode-errorForeground); 
                    font-weight: bold; 
                    margin-bottom: 10px;
                }
                .actions { 
                    margin-top: 15px; 
                }
                .actions h3 { 
                    color: var(--vscode-textLink-foreground); 
                }
                .actions ul { 
                    padding-left: 20px; 
                }
                .actions li { 
                    margin-bottom: 8px; 
                    line-height: 1.4;
                }
                .technical-details {
                    margin-top: 20px;
                    padding: 10px;
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    font-family: monospace;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <h2>🛠️ AI Assistant Error Help</h2>
            <div class="error-type">Error Type: ${errorDetails.type.replace('_', ' ').toUpperCase()}</div>
            <p><strong>Description:</strong> ${errorDetails.userMessage}</p>
            
            <div class="actions">
                <h3>Suggested Solutions:</h3>
                <ul>${actions}</ul>
            </div>

            <div class="technical-details">
                <strong>Technical Details:</strong><br>
                ${errorDetails.message}
            </div>
        </body>
        </html>`;
    }

    /**
     * 实现重试机制
     */
    public async withRetry<T>(
        operation: () => Promise<T>,
        operationId: string,
        context?: any
    ): Promise<T> {
        const config = this.getErrorConfig();
        const maxRetries = config.enableRetry ? config.maxRetries : 0;
        const currentAttempts = this.retryAttempts.get(operationId) || 0;
        
        try {
            const result = await operation();
            // 成功时重置重试计数
            this.retryAttempts.delete(operationId);
            return result;
        } catch (error) {
            const errorDetails = this.handleError(error, context);
            
            if (currentAttempts < maxRetries && errorDetails.canRetry && config.enableRetry) {
                // 增加重试计数
                this.retryAttempts.set(operationId, currentAttempts + 1);
                
                // 指数退避延迟
                const delay = this.retryDelay * Math.pow(2, currentAttempts);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // 显示重试通知
                if (config.showDetailedErrors) {
                    vscode.window.showInformationMessage(
                        `Retrying operation... (${currentAttempts + 1}/${maxRetries})`
                    );
                }
                
                return this.withRetry(operation, operationId, context);
            } else {
                // 重试次数用完，清除计数并抛出错误
                this.retryAttempts.delete(operationId);
                throw error;
            }
        }
    }

    /**
     * 记录错误到输出通道
     */
    private logError(errorDetails: ErrorDetails) {
        const outputChannel = vscode.window.createOutputChannel('AI Assistant Errors');
        const timestamp = new Date().toISOString();
        
        outputChannel.appendLine(`[${timestamp}] Error Type: ${errorDetails.type}`);
        outputChannel.appendLine(`Message: ${errorDetails.message}`);
        if (errorDetails.context) {
            outputChannel.appendLine(`Context: ${JSON.stringify(errorDetails.context, null, 2)}`);
        }
        if (errorDetails.originalError?.stack) {
            outputChannel.appendLine(`Stack Trace: ${errorDetails.originalError.stack}`);
        }
        outputChannel.appendLine('---');
    }

    // 错误类型检测方法
    private isConnectionError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return message.includes('fetch') || 
               message.includes('network') || 
               message.includes('connection') ||
               message.includes('econnrefused') ||
               message.includes('enotfound');
    }

    private isTimeoutError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return message.includes('timeout') || 
               message.includes('aborted') ||
               error?.name === 'AbortError';
    }

    private isModelNotFoundError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return message.includes('model') && message.includes('not found') ||
               message.includes('model') && message.includes('does not exist') ||
               message.includes('unknown model');
    }

    private isServiceUnavailableError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return message.includes('service unavailable') ||
               message.includes('502') ||
               message.includes('503') ||
               message.includes('504');
    }

    private isInvalidResponseError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return message.includes('invalid response') ||
               message.includes('parse') ||
               message.includes('json') ||
               message.includes('unexpected token');
    }
}

/**
 * 缓存管理器 - 用于实现fallback策略
 */
export class ResponseCache {
    private cache = new Map<string, { response: string; timestamp: number }>();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes

    public set(key: string, response: string): void {
        this.cache.set(key, {
            response,
            timestamp: Date.now()
        });
    }

    public get(key: string): string | null {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return cached.response;
    }

    public clear(): void {
        this.cache.clear();
    }

    public generateKey(model: string, prompt: string): string {
        // 简单的哈希键生成
        const combined = model + prompt;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString();
    }
}
