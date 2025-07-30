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

        this.currentSuggestion = {
            text: completion,
            insertText: completion,
            range: range
        };

        // 创建多行预览装饰
        this.createMultiLinePreview(editor, completion, position);
    }

    /**
     * 创建多行预览装饰
     */
    private createMultiLinePreview(editor: vscode.TextEditor, completion: string, startPosition: vscode.Position) {
        const lines = completion.split('\n');
        const decorations: vscode.DecorationOptions[] = [];

        lines.forEach((line, index) => {
            const linePosition = new vscode.Position(startPosition.line + index, 
                index === 0 ? startPosition.character : 0);
            const range = new vscode.Range(linePosition, linePosition);

            // 对于第一行，显示在光标位置后
            // 对于后续行，显示在行的开始位置
            const decoration: vscode.DecorationOptions = {
                range: range,
                renderOptions: {
                    after: {
                        contentText: line,
                        color: new vscode.ThemeColor('editorGhostText.foreground'),
                        fontStyle: 'italic'
                    }
                }
            };

            decorations.push(decoration);
        });

        editor.setDecorations(this.suggestionDecorationType, decorations);

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

            // 增加上下文字符数以获取更多信息
            const context = this.getCodeContext(editor, 1500);
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
    private getCodeContext(editor: vscode.TextEditor, contextChars: number = 1500): string {
        const document = editor.document;
        const position = editor.selection.active;
        
        // 计算前后文本的分配比例 (60% 前文，40% 后文)
        const beforeChars = Math.floor(contextChars * 0.6);
        const afterChars = contextChars - beforeChars;

        // 获取光标前的文本
        const startPosition = new vscode.Position(0, 0);
        const beforeRange = new vscode.Range(startPosition, position);
        let beforeText = document.getText(beforeRange);

        // 如果前文太长，截取最后部分
        if (beforeText.length > beforeChars) {
            beforeText = beforeText.substring(beforeText.length - beforeChars);
            
            // 确保不会在单词中间截断，找到第一个完整的行
            const firstNewlineIndex = beforeText.indexOf('\n');
            if (firstNewlineIndex > 0) {
                beforeText = beforeText.substring(firstNewlineIndex + 1);
            }
        }

        // 获取光标后的文本
        const endPosition = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        const afterRange = new vscode.Range(position, endPosition);
        let afterText = document.getText(afterRange);

        // 如果后文太长，截取前面部分
        if (afterText.length > afterChars) {
            afterText = afterText.substring(0, afterChars);
            
            // 确保不会在单词中间截断，找到最后一个完整的行
            const lastNewlineIndex = afterText.lastIndexOf('\n');
            if (lastNewlineIndex > 0 && lastNewlineIndex < afterText.length - 1) {
                afterText = afterText.substring(0, lastNewlineIndex + 1);
            }
        }

        // 构建完整的上下文，在光标位置插入 <BLANK>
        const context = beforeText + '<BLANK>' + afterText;

        console.log(`Context length: ${context.length} (before: ${beforeText.length}, after: ${afterText.length})`);
        
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
            console.log("context:"+context);
            // 获取可用模型列表
            const models = await ollamaService.getModels();
            if (!models || models.length === 0) {
                console.error('No models available in Ollama');
                return '';
            }

            // 获取配置中的模型，如果不存在则使用第一个可用模型
            const config = vscode.workspace.getConfiguration('aiAssistant');
            let defaultModel = config.get('defaultModel', '');

            // 如果没有配置默认模型或配置的模型不在可用列表中，使用第一个可用模型
            if (!defaultModel || !models.includes(defaultModel)) {
                if (defaultModel) {
                    console.warn(`Model ${defaultModel} not found, using ${models[0]} instead`);
                }
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