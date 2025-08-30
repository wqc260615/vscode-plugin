import * as vscode from 'vscode';
import { LLMServiceManager } from '../LLMServiceManager';
import { LLMErrorHandler } from '../errorHandler';

export interface CompletionSuggestion {
    text: string;
    insertText: string;
    range: vscode.Range;
}

export class CodeCompletionProvider implements vscode.InlineCompletionItemProvider {
    private currentSuggestion: CompletionSuggestion | null = null;
    private completionTimeout: NodeJS.Timeout | null = null;
    private isGenerating: boolean = false;
    private llmServiceManager: LLMServiceManager;
    private errorHandler: LLMErrorHandler;

    // 添加状态变化回调
    public onCompletionStateChanged: ((hasCompletion: boolean) => void) | null = null;

    constructor(llmServiceManager: LLMServiceManager) {
        this.llmServiceManager = llmServiceManager;
        this.errorHandler = LLMErrorHandler.getInstance();
    }

    /**
     * 实现 InlineCompletionItemProvider 接口
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        
        // 检查是否启用了代码补全
        const config = vscode.workspace.getConfiguration('aiAssistant');
        if (!config.get('enableCodeCompletion', true)) {
            return null;
        }

        // 如果正在生成，返回空
        if (this.isGenerating) {
            return null;
        }

        try {
            this.isGenerating = true;

            // 获取代码上下文
            const codeContext = this.getCodeContext(document, position, 1500);
            if (!codeContext || codeContext.trim().length === 0) {
                return null;
            }

            // 从LLM服务获取补全
            const completion = await this.getCompletionFromLLM(codeContext);
            if (!completion || completion.trim().length === 0) {
                return null;
            }

            // 创建 InlineCompletionItem
            const item = new vscode.InlineCompletionItem(
                completion,
                new vscode.Range(position, position)
            );

            // 设置补全项的标签
            item.filterText = completion;

            return [item];
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'inlineCompletion',
                position: position.line + ':' + position.character 
            });
            
            // Don't show error UI for completion failures, just log them
            return null;
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * 检查是否为支持的编程语言
     */
    private isSupportedLanguage(languageId: string): boolean {
        const supportedLanguages = [
            'javascript',
            'typescript',
            'python',
            'java',
            'cpp',
            'c',
            'csharp',
            'php',
            'ruby',
            'go',
            'rust',
            'swift',
            'kotlin',
            'json',
            'html',
            'css',
            'scss',
            'less',
            'xml',
            'yaml',
            'sql'
        ];

        return supportedLanguages.includes(languageId);
    }

    /**
     * 清理补全文本，移除多余的空行和格式问题
     */
    private cleanCompletionText(text: string): string {
        // 首先trim整个文本
        let cleaned = text.trim();
        
        // 移除可能的markdown代码块标记
        cleaned = cleaned.replace(/^```[\w]*\n?/, '');
        cleaned = cleaned.replace(/\n?```$/, '');
        
        // 移除开头的多余空行和只包含空白字符的行
        cleaned = cleaned.replace(/^[\s\n]*\n/, '');
        
        // 移除结尾的多余空行
        cleaned = cleaned.replace(/\n+\s*$/, '');
        
        // 移除连续的空行，最多保留一个空行
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        // 如果文本开头有空白字符但不是缩进，移除它们
        const lines = cleaned.split('\n');
        if (lines.length > 0 && lines[0].match(/^\s+$/)) {
            lines.shift(); // 移除第一行如果它只包含空白
            cleaned = lines.join('\n');
        }
        
        // 确保不会返回空字符串
        return cleaned || '';
    }

    /**
     * 显示代码补全预览 (已弃用，现在使用 InlineCompletionProvider)
     */
    public showCompletion(editor: vscode.TextEditor, completion: string) {
        // 这个方法保留是为了向后兼容，实际补全现在通过 provideInlineCompletionItems 处理
    }

    /**
     * 清除当前的补全预览 (已弃用)
     */
    public clearCompletion(editor: vscode.TextEditor) {
        // 现在由 VS Code 的 InlineCompletionProvider 自动处理
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
    public async requestCompletion(editor: vscode.TextEditor, llmServiceManager: LLMServiceManager): Promise<void> {
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
            await this.performCompletion(editor, llmServiceManager);
        }, 500); // 500ms 防抖
    }

    /**
     * 执行实际的补全请求
     */
    private async performCompletion(editor: vscode.TextEditor, llmServiceManager: LLMServiceManager): Promise<void> {
        try {
            this.isGenerating = true;

            // 增加上下文字符数以获取更多信息
            const context = this.getCodeContext(editor.document, editor.selection.active, 1500);
            if (!context || context.trim().length === 0) {
                return;
            }

            const completion = await this.getCompletionFromLLM(context);
            if (completion && completion.trim().length > 0) {
                this.showCompletion(editor, completion);
            }
        } catch (error) {
            // Error handling silently
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * 获取代码上下文
     */
    private getCodeContext(document: vscode.TextDocument, position: vscode.Position, contextChars: number = 1500): string {
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
        
        return context;
    }

    /**
     * 从LLM获取补全建议
     */
    private async getCompletionFromLLM(context: string): Promise<string> {
        try {
            
            // 获取LLM服务
            const llmService = this.llmServiceManager.getCurrentService();
            if (!llmService) {
                return '';
            }
            
            // 获取首选模型
            const preferredModel = await llmService.getPreferredModel();
            if (!preferredModel) {
                return '';
            }

            const prompt = `You are an AI code completion assistant. Your task is to complete the code at the <BLANK> position.

IMPORTANT RULES:
1. Only provide the code that should replace <BLANK>
2. Do NOT include any leading empty lines or whitespace before the code
3. Do NOT include any trailing empty lines after the code
4. Do NOT wrap the response in markdown code blocks
5. Start immediately with the actual code content
6. Keep the completion concise and contextually appropriate

Code context:
${context}

Complete the code at <BLANK>:`;

            // 优先使用 generate 方法，如果失败则回退到 chat 方法
            try {
                const response = await llmService.generate(preferredModel, prompt);
                let completion = response.trim();
                
                // 清理响应，移除可能的代码块标记
                completion = completion.replace(/^```[\w]*\n?/, '');
                completion = completion.replace(/\n?```$/, '');
                
                // 清理并格式化补全文本
                completion = this.cleanCompletionText(completion);
                
                return completion;
            } catch (generateError) {
                // 回退到 chat API
                // 创建一个临时会话对象
                const tempSession = {
                    id: 'temp',
                    name: 'Temporary Session',
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const chatResponse = await llmService.chat(preferredModel, prompt, tempSession);
                let completion = chatResponse.trim();
                
                // 清理并格式化补全文本
                completion = this.cleanCompletionText(completion);
                
                return completion;
            }
        } catch (error) {
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
        this.currentSuggestion = null;

        // 通知状态变化
        if (this.onCompletionStateChanged) {
            this.onCompletionStateChanged(false);
        }
    }
}