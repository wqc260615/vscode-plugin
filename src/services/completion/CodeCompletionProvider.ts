import * as vscode from 'vscode';
import { OllamaService } from '../ollamaService';

export interface CompletionSuggestion {
    text: string;
    insertText: string;
    range: vscode.Range;
}

export class CodeCompletionProvider {
    private currentSuggestion: CompletionSuggestion | null = null;
    private suggestionDecorationType: vscode.TextEditorDecorationType;
    private completionTimeout: NodeJS.Timeout | null = null;
    private isGenerating: boolean = false;

    // 添加状态变化回调
    public onCompletionStateChanged: ((hasCompletion: boolean) => void) | null = null;

    constructor() {
        // 创建装饰类型，用于显示灰色预览文本
        this.suggestionDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });
    }

    /**
     * 显示代码补全预览
     */
    public showCompletion(editor: vscode.TextEditor, completion: string) {
        this.clearCompletion(editor);

        if (!completion || completion.trim().length === 0) {
            return;
        }

        const position = editor.selection.active;
        const range = new vscode.Range(position, position);

        // 处理多行补全
        const lines = completion.split('\n');
        let displayText = lines[0];

        // 如果有多行，显示第一行并添加省略号
        if (lines.length > 1) {
            displayText += ' ...';
        }

        this.currentSuggestion = {
            text: completion,
            insertText: completion,
            range: range
        };

        // 设置装饰
        const decoration: vscode.DecorationOptions = {
            range: range,
            renderOptions: {
                after: {
                    contentText: displayText,
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic'
                }
            }
        };

        editor.setDecorations(this.suggestionDecorationType, [decoration]);

        // 通知状态变化
        if (this.onCompletionStateChanged) {
            this.onCompletionStateChanged(true);
        }
    }

    /**
     * 清除当前的补全预览
     */
    public clearCompletion(editor: vscode.TextEditor) {
        if (this.currentSuggestion) {
            editor.setDecorations(this.suggestionDecorationType, []);
            this.currentSuggestion = null;

            // 通知状态变化
            if (this.onCompletionStateChanged) {
                this.onCompletionStateChanged(false);
            }
        }
    }

    /**
     * 接受当前的补全建议
     */
    public async acceptCompletion(editor: vscode.TextEditor): Promise<boolean> {
        if (!this.currentSuggestion) {
            return false;
        }

        const suggestion = this.currentSuggestion;
        this.clearCompletion(editor);

        try {
            // 插入补全文本
            await editor.edit(editBuilder => {
                editBuilder.insert(suggestion.range.start, suggestion.insertText);
            });
            return true;
        } catch (error) {
            console.error('Error accepting completion:', error);
            return false;
        }
    }

    /**
     * 检查是否有活动的补全
     */
    public hasActiveCompletion(): boolean {
        return this.currentSuggestion !== null;
    }

    /**
     * 请求代码补全
     */
    public async requestCompletion(editor: vscode.TextEditor, ollamaService: any): Promise<void> {
        // 如果正在生成，跳过
        if (this.isGenerating) {
            return;
        }

        // 清除之前的定时器
        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
        }

        // 设置防抖延迟
        this.completionTimeout = setTimeout(async () => {
            await this.performCompletion(editor, ollamaService);
        }, 500); // 500ms 防抖
    }

    /**
     * 执行实际的补全请求
     */
    private async performCompletion(editor: vscode.TextEditor, ollamaService: any): Promise<void> {
        try {
            this.isGenerating = true;

            const context = this.getCodeContext(editor);
            if (!context || context.trim().length === 0) {
                return;
            }

            const completion = await this.getCompletionFromOllama(context, ollamaService);
            if (completion && completion.trim().length > 0) {
                this.showCompletion(editor, completion);
            }
        } catch (error) {
            console.error('Code completion error:', error);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * 获取代码上下文
     */
    private getCodeContext(editor: vscode.TextEditor, contextChars: number = 500): string {
        const document = editor.document;
        const position = editor.selection.active;

        // 获取当前位置前的文本作为上下文
        const startPosition = new vscode.Position(
            Math.max(0, position.line - 10),
            0
        );

        const contextRange = new vscode.Range(startPosition, position);
        let context = document.getText(contextRange);

        // 限制上下文长度
        if (context.length > contextChars) {
            context = context.substring(context.length - contextChars);
        }

        // 在光标位置添加占位符
        context += '<BLANK>';

        return context;
    }

    /**
     * 从Ollama获取补全建议
     */
    private async getCompletionFromOllama(context: string, ollamaService: any): Promise<string> {
        try {
            // 检查Ollama服务是否可用
            const isAvailable = await ollamaService.isServiceAvailable();
            if (!isAvailable) {
                return '';
            }

            // 获取可用模型列表
            const models = await ollamaService.getModels();
            if (!models || models.length === 0) {
                console.error('No models available in Ollama');
                return '';
            }

            // 获取配置中的模型，如果不存在则使用第一个可用模型
            const config = vscode.workspace.getConfiguration('aiAssistant');
            let defaultModel = config.get('defaultModel', 'llama2');

            // 检查配置的模型是否在可用模型列表中
            if (!models.includes(defaultModel)) {
                console.warn(`Model ${defaultModel} not found, using ${models[0]} instead`);
                defaultModel = models[0];
            }

            const prompt = `You are a AI agent aiming to provide code completion function, 
            your task is to complete the following code block where something is missing, 
            below is the code block to be completed.${context}
            Fill in the blank to complete the code block. 
            Your response should include only the code to replace <BLANK>, without surrounding backticks.
            ,include the response code block in \`\`\` tags.
            `;

            // 优先使用 generate 方法，如果失败则回退到 chat 方法
            try {
                const response = await ollamaService.generate(defaultModel, prompt);
                console.log('Generate API response:', response);
                let completion = response.trim();
                completion = completion.replace(/^```[\w]*\n?/, '');
                completion = completion.replace(/\n?```$/, '');
                return completion;
            } catch (generateError) {
                console.warn('Generate API failed, trying chat API:', generateError);

                // 回退到 chat API
                // 创建一个临时会话对象
                const tempSession = {
                    messages: []
                };

                const chatResponse = await ollamaService.chat(defaultModel, prompt, tempSession);
                let completion = chatResponse.trim();
                completion = completion.replace(/^```[\w]*\n?/, '');
                completion = completion.replace(/\n?```$/, '');
                return completion;
            }
        } catch (error) {
            console.error('Error getting completion from Ollama:', error);
            return '';
        }
    }

    /**
     * 处理文档变化事件
     */
    public onDocumentChange(editor: vscode.TextEditor, change: vscode.TextDocumentChangeEvent) {
        // 如果文档有变化，清除当前的补全预览
        if (change.contentChanges.length > 0) {
            this.clearCompletion(editor);
        }
    }

    /**
     * 处理光标位置变化
     */
    public onCursorChange(editor: vscode.TextEditor) {
        // 光标移动时清除补全预览
        this.clearCompletion(editor);
    }

    /**
     * 释放资源
     */
    public dispose() {
        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
        }
        this.suggestionDecorationType.dispose();
        this.currentSuggestion = null;

        // 通知状态变化
        if (this.onCompletionStateChanged) {
            this.onCompletionStateChanged(false);
        }
    }
}