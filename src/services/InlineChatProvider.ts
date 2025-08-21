import * as vscode from 'vscode';
import { OllamaService } from './ollamaService';
import { ProjectContextProcessor } from './projectContextProcessor';
import { LLMErrorHandler } from './errorHandler';

export class InlineChatProvider {
    private ollamaService: OllamaService;
    private contextProcessor: ProjectContextProcessor;
    private currentDecorationType: vscode.TextEditorDecorationType | null = null;
    private previewDecorationType: vscode.TextEditorDecorationType | null = null;
    private currentEditor: vscode.TextEditor | null = null;
    private currentPosition: vscode.Position | null = null;
    private isGenerating: boolean = false;
    private errorHandler: LLMErrorHandler;

    constructor(ollamaService: OllamaService, contextProcessor: ProjectContextProcessor) {
        this.ollamaService = ollamaService;
        this.contextProcessor = contextProcessor;
        this.errorHandler = LLMErrorHandler.getInstance();
        
        // 创建装饰类型用于显示生成的代码
        this.currentDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });

        // 创建预览装饰类型
        this.previewDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.wordHighlightBorder'),
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });
    }

    /**
     * 显示inline chat输入框
     */
    public async showInlineChat() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        if (this.isGenerating) {
            vscode.window.showInformationMessage('AI is currently generating code. Please wait...');
            return;
        }

        this.currentEditor = editor;
        this.currentPosition = editor.selection.active;

        // 清除任何现有的装饰
        this.clearDecorations();

        // 获取上下文
        const context = this.getContext(editor, this.currentPosition, 1000);

        // 创建输入框
        await this.createInlineInput(context);
    }

    /**
     * 获取代码上下文
     */
    private getContext(editor: vscode.TextEditor, position: vscode.Position, maxChars: number): string {
        const document = editor.document;
        const totalLines = document.lineCount;
        
        // 获取当前位置前后的代码
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(totalLines - 1, position.line + 10);
        
        let context = '';
        let currentChars = 0;
        
        // 添加当前位置前的代码
        for (let i = startLine; i <= position.line && currentChars < maxChars / 2; i++) {
            const lineText = document.lineAt(i).text;
            if (i === position.line) {
                // 当前行只添加光标之前的部分
                const beforeCursor = lineText.substring(0, position.character);
                context += beforeCursor + '<CURSOR>';
                const afterCursor = lineText.substring(position.character);
                if (afterCursor.trim()) {
                    context += afterCursor;
                }
                context += '\n';
            } else {
                context += lineText + '\n';
            }
            currentChars += lineText.length + 1;
        }
        
        // 添加当前位置后的代码
        for (let i = position.line + 1; i <= endLine && currentChars < maxChars; i++) {
            const lineText = document.lineAt(i).text;
            if (currentChars + lineText.length <= maxChars) {
                context += lineText + '\n';
                currentChars += lineText.length + 1;
            } else {
                break;
            }
        }
        
        return context;
    }

    /**
     * 创建真正的内联输入界面 - 使用装饰器在光标位置显示输入框
     */
    private async createInlineInput(context: string) {
        const models = await this.ollamaService.getModels();
        
        // 如果没有可用模型，显示错误信息
        if (!models || models.length === 0) {
            vscode.window.showErrorMessage('No Ollama models available. Please ensure Ollama is running and models are installed.');
            return;
        }

        // 优先使用配置中的默认模型，如果不存在则使用第一个可用模型
        const configModel = vscode.workspace.getConfiguration('aiAssistant').get('defaultModel', '');
        const defaultModel = models.includes(configModel) ? configModel : models[0];

        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // 创建内联输入装饰
        await this.showInlineInputWidget(context, defaultModel);
    }

    /**
     * 在光标位置显示内联输入小部件
     */
    private async showInlineInputWidget(context: string, model: string) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // 创建用于内联输入的装饰类型
        const inlineInputDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: '',
                margin: '0 0 0 10px',
                textDecoration: 'none'
            },
            backgroundColor: new vscode.ThemeColor('input.background'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('input.border')
        });

        // 显示内联输入提示
        const inputRange = new vscode.Range(this.currentPosition, this.currentPosition);
        const decoration: vscode.DecorationOptions = {
            range: inputRange,
            renderOptions: {
                after: {
                    contentText: '💬 Type your request... (Press Enter to generate, Esc to cancel)',
                    color: new vscode.ThemeColor('input.foreground'),
                    backgroundColor: new vscode.ThemeColor('input.background'),
                    border: '1px solid',
                    borderColor: new vscode.ThemeColor('input.border'),
                    fontStyle: 'normal',
                    margin: '0 0 0 10px',
                    textDecoration: 'none'
                }
            }
        };

        this.currentEditor.setDecorations(inlineInputDecorationType, [decoration]);

        // 创建输入监听器
        await this.createInputListener(context, model, inlineInputDecorationType);
    }

    /**
     * 创建键盘输入监听器来捕获用户输入
     */
    private async createInputListener(context: string, model: string, decorationType: vscode.TextEditorDecorationType) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // 创建内联WebView输入框
        await this.createInlineWebView(context, model, decorationType);
    }

    /**
     * 创建内联WebView输入框
     */
    private async createInlineWebView(context: string, model: string, decorationType: vscode.TextEditorDecorationType) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // 更新装饰显示
        const updateDecoration = (text: string, isGenerating: boolean = false) => {
            if (!this.currentEditor || !this.currentPosition) {
                return;
            }

            let displayText = '';
            if (isGenerating) {
                displayText = '⏳ Generating code...';
            } else if (text) {
                displayText = `💬 "${text}" (WebView input active)`;
            } else {
                displayText = '💬 WebView input active - Type in the panel';
            }

            const decoration: vscode.DecorationOptions = {
                range: new vscode.Range(this.currentPosition, this.currentPosition),
                renderOptions: {
                    after: {
                        contentText: displayText,
                        color: new vscode.ThemeColor(isGenerating ? 'editorGhostText.foreground' : 'input.foreground'),
                        backgroundColor: new vscode.ThemeColor('input.background'),
                        border: '1px solid',
                        borderColor: new vscode.ThemeColor(isGenerating ? 'progressBar.background' : 'input.border'),
                        fontStyle: isGenerating ? 'italic' : 'normal',
                        margin: '0 0 0 10px'
                    }
                }
            };

            this.currentEditor.setDecorations(decorationType, [decoration]);
        };

        // 显示初始装饰
        updateDecoration('');

        // 创建WebView面板
        const panel = vscode.window.createWebviewPanel(
            'inlineChat',
            `AI Inline Chat - Line ${this.currentPosition.line + 1}`,
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: false
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // 设置WebView内容
        panel.webview.html = this.getInlineWebViewContent(model, context);

        // 监听WebView消息
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'input':
                    updateDecoration(message.text);
                    break;
                case 'generate':
                    if (message.text?.trim()) {
                        panel.dispose();
                        updateDecoration('', true);
                        await this.handleUserInput(message.text.trim(), model, context);
                        this.currentEditor?.setDecorations(decorationType, []);
                        decorationType.dispose();
                    }
                    break;
                case 'cancel':
                    panel.dispose();
                    this.currentEditor?.setDecorations(decorationType, []);
                    decorationType.dispose();
                    this.clearDecorations();
                    break;
                case 'ready':
                    // WebView准备好后，将焦点设置到输入框
                    panel.webview.postMessage({ command: 'focus' });
                    break;
            }
        });

        // 面板关闭时清理
        panel.onDidDispose(() => {
            this.currentEditor?.setDecorations(decorationType, []);
            decorationType.dispose();
            this.clearDecorations();
        });

        // 显示面板
        panel.reveal(vscode.ViewColumn.Beside, false);
    }

    /**
     * 获取内联WebView的HTML内容
     */
    private getInlineWebViewContent(model: string, context: string): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Inline Chat</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                }
                .container {
                    padding: 18px 24px 16px 24px;
                    max-width: 540px;
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    align-items: center;
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                .header .icon {
                    margin-right: 8px;
                    font-size: 18px;
                }
                .info {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 10px;
                }
                textarea {
                    width: 100%;
                    min-height: 80px;
                    max-height: 200px;
                    resize: vertical;
                    font-family: inherit;
                    font-size: 14px;
                    padding: 10px;
                    border: 1.5px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 5px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                textarea:focus {
                    border-color: var(--vscode-focusBorder);
                }
                .actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 12px;
                }
                .btn {
                    padding: 7px 18px;
                    border-radius: 4px;
                    border: none;
                    font-size: 13px;
                    font-family: inherit;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-primary {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .btn-primary:hover:not(:disabled) {
                    background: var(--vscode-button-hoverBackground);
                }
                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .shortcuts {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                    text-align: right;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <span class="icon">💬</span>
                    AI Inline Chat
                </div>
                <div class="info">
                    <div>Model: <b>${model}</b></div>
                    <div>Context: <b>${context.split('\\n').length} lines</b></div>
                </div>
                <textarea id="userInput" placeholder="Describe what you want to generate..."></textarea>
                <div class="actions">
                    <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn btn-primary" id="generateBtn" disabled>Generate</button>
                </div>
                <div class="shortcuts">
                    Ctrl+Enter: Generate &nbsp;|&nbsp; Esc: Cancel
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const input = document.getElementById('userInput');
                const generateBtn = document.getElementById('generateBtn');
                const cancelBtn = document.getElementById('cancelBtn');

                input.focus();

                input.addEventListener('input', () => {
                    const text = input.value.trim();
                    generateBtn.disabled = !text;
                    vscode.postMessage({ command: 'input', text });
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        if (!generateBtn.disabled) generate();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancel();
                    }
                });

                generateBtn.addEventListener('click', generate);
                cancelBtn.addEventListener('click', cancel);

                function generate() {
                    const text = input.value.trim();
                    if (text) {
                        generateBtn.disabled = true;
                        generateBtn.textContent = 'Generating...';
                        input.disabled = true;
                        vscode.postMessage({ command: 'generate', text });
                    }
                }
                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>
        `;
    }

    /**
     * 显示输入位置装饰
     */
    private showInputDecoration() {
        if (!this.currentEditor || !this.currentPosition || !this.currentDecorationType) {
            return;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(this.currentPosition, this.currentPosition),
            renderOptions: {
                after: {
                    contentText: ' 💬 Inline chat active...',
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic'
                }
            }
        };

        this.currentEditor.setDecorations(this.currentDecorationType, [decoration]);
    }

    /**
     * 处理用户输入并生成代码
     */
    private async handleUserInput(userInput: string, model: string, context: string) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        this.isGenerating = true;

        const fullPrompt = `You are an AI code assistant. Based on the user's request and the code context, generate the appropriate code to insert at the cursor position.

User Request: ${userInput}

Code Context:
${context}

Generate code that should be inserted at the <CURSOR> position. Return only the code without any explanations, markdown formatting, or code blocks. The code should be properly formatted and indented to match the surrounding context.`;

        try {
            // 显示加载状态
            this.showLoadingDecoration();

            // 生成代码
            const generatedCode = await this.ollamaService.generate(model, fullPrompt);
            
            // 清理生成的代码
            const cleanCode = this.cleanGeneratedCode(generatedCode);
            
            if (cleanCode.trim()) {
                // 先显示预览
                await this.showCodePreview(cleanCode);
                
                // 自动插入代码
                setTimeout(async () => {
                    await this.insertCodeAtPosition(cleanCode);
                    vscode.window.showInformationMessage(`AI generated ${cleanCode.split('\n').length} lines of code`);
                }, 1000);
            } else {
                vscode.window.showWarningMessage('No code was generated. Please try a different request.');
            }

        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { 
                operation: 'inlineChat',
                userInput,
                model 
            });
            
            await this.errorHandler.showErrorToUser(errorDetails, true);
        } finally {
            this.isGenerating = false;
            setTimeout(() => this.clearDecorations(), 2000);
        }
    }

    /**
     * 显示代码预览
     */
    private async showCodePreview(code: string) {
        if (!this.currentEditor || !this.currentPosition || !this.previewDecorationType) {
            return;
        }

        const lines = code.split('\n');
        const decorations: vscode.DecorationOptions[] = [];

        // 为每一行创建装饰
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const linePosition = new vscode.Position(this.currentPosition.line + i, 0);
            
            if (i === 0) {
                // 第一行显示在光标位置
                decorations.push({
                    range: new vscode.Range(this.currentPosition, this.currentPosition),
                    renderOptions: {
                        after: {
                            contentText: ` ${line}`,
                            color: new vscode.ThemeColor('editorGhostText.foreground'),
                            fontStyle: 'italic'
                        }
                    }
                });
            } else {
                // 后续行显示为完整行预览
                const targetPosition = new vscode.Position(this.currentPosition.line + i, this.currentPosition.character);
                decorations.push({
                    range: new vscode.Range(targetPosition, targetPosition),
                    renderOptions: {
                        after: {
                            contentText: line,
                            color: new vscode.ThemeColor('editorGhostText.foreground'),
                            fontStyle: 'italic'
                        }
                    }
                });
            }
        }

        this.currentEditor.setDecorations(this.previewDecorationType, decorations);
    }

    /**
     * 显示加载装饰
     */
    private showLoadingDecoration() {
        if (!this.currentEditor || !this.currentPosition || !this.currentDecorationType) {
            return;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(this.currentPosition, this.currentPosition),
            renderOptions: {
                after: {
                    contentText: ' ⏳ Generating code...',
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic'
                }
            }
        };

        this.currentEditor.setDecorations(this.currentDecorationType, [decoration]);
    }

    /**
     * 清理生成的代码
     */
    private cleanGeneratedCode(code: string): string {
        // 移除可能的代码块标记
        let cleaned = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
        
        // 移除多余的空行开头和结尾
        cleaned = cleaned.trim();
        
        // 如果代码包含解释性文本，尝试提取纯代码部分
        const lines = cleaned.split('\n');
        let codeStartIndex = 0;
        let codeEndIndex = lines.length - 1;
        
        // 查找第一行实际代码
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
                // 检查是否看起来像代码
                if (line.includes('{') || line.includes(';') || line.includes('=') || 
                    line.includes('def ') || line.includes('function ') || line.includes('class ')) {
                    codeStartIndex = i;
                    break;
                }
            }
        }
        
        return lines.slice(codeStartIndex, codeEndIndex + 1).join('\n');
    }

    /**
     * 在指定位置插入代码
     */
    private async insertCodeAtPosition(code: string) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.insert(this.currentEditor.document.uri, this.currentPosition, code);
        
        await vscode.workspace.applyEdit(edit);
        
        // 移动光标到插入内容的末尾
        const lines = code.split('\n');
        const newPosition = new vscode.Position(
            this.currentPosition.line + lines.length - 1,
            lines.length === 1 ? this.currentPosition.character + code.length : lines[lines.length - 1].length
        );
        
        this.currentEditor.selection = new vscode.Selection(newPosition, newPosition);
        
        // 将焦点返回到编辑器
        vscode.window.showTextDocument(this.currentEditor.document);
    }

    /**
     * 清除装饰
     */
    private clearDecorations() {
        if (this.currentEditor) {
            if (this.currentDecorationType) {
                this.currentEditor.setDecorations(this.currentDecorationType, []);
            }
            if (this.previewDecorationType) {
                this.currentEditor.setDecorations(this.previewDecorationType, []);
            }
        }
    }

    /**
     * 销毁当前的聊天界面
     */
    public dispose() {
        this.clearDecorations();
        
        if (this.currentDecorationType) {
            this.currentDecorationType.dispose();
            this.currentDecorationType = null;
        }
        
        if (this.previewDecorationType) {
            this.previewDecorationType.dispose();
            this.previewDecorationType = null;
        }
        
        this.currentEditor = null;
        this.currentPosition = null;
        this.isGenerating = false;
    }
}
