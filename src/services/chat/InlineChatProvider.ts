import * as vscode from 'vscode';
import { LLMServiceManager } from '../llm/LLMServiceManager';
import { ProjectContextProcessor } from '../context/projectContextProcessor';
import { LLMErrorHandler } from '../core/error/errorHandler';

export class InlineChatProvider {
    private llmServiceManager: LLMServiceManager;
    private contextProcessor: ProjectContextProcessor;
    private currentDecorationType: vscode.TextEditorDecorationType | null = null;
    private previewDecorationType: vscode.TextEditorDecorationType | null = null;
    private currentEditor: vscode.TextEditor | null = null;
    private currentPosition: vscode.Position | null = null;
    private isGenerating: boolean = false;
    private errorHandler: LLMErrorHandler;

    constructor(llmServiceManager: LLMServiceManager, contextProcessor: ProjectContextProcessor) {
        this.llmServiceManager = llmServiceManager;
        this.contextProcessor = contextProcessor;
        this.errorHandler = LLMErrorHandler.getInstance();
        
        // Create decoration type to display generated code
        this.currentDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });

        // Create preview decoration type
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
     * Show inline chat input
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

        // Clear any existing decorations
        this.clearDecorations();

        // Get context
        const context = this.getContext(editor, this.currentPosition, 1000);

        // Create input widget
        await this.createInlineInput(context);
    }

    /**
     * Get code context
     */
    private getContext(editor: vscode.TextEditor, position: vscode.Position, maxChars: number): string {
        const document = editor.document;
        const totalLines = document.lineCount;
        
        // Get code around the current position
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(totalLines - 1, position.line + 10);
        
        let context = '';
        let currentChars = 0;
        
        // Add code before the current position
        for (let i = startLine; i <= position.line && currentChars < maxChars / 2; i++) {
            const lineText = document.lineAt(i).text;
            if (i === position.line) {
                // For the current line, add only the part before the cursor
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
        
        // Add code after the current position
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
     * Create the real inline input UI - show input at the cursor using decorations
     */
    private async createInlineInput(context: string) {
        try {
            const preferredModel = await this.llmServiceManager.getPreferredModel();
            
            if (!this.currentEditor || !this.currentPosition) {
                return;
            }

            // Create inline input decoration
            await this.showInlineInputWidget(context, preferredModel);
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { operation: 'createInlineInput' });
            vscode.window.showErrorMessage(errorDetails.userMessage);
        }
    }

    /**
     * Show the inline input widget at the cursor position
     */
    private async showInlineInputWidget(context: string, model: string) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // Create decoration type for inline input
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

        // Show inline input hint
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

        // Create input listener
        await this.createInputListener(context, model, inlineInputDecorationType);
    }

    /**
     * Create keyboard input listener to capture user input
     */
    private async createInputListener(context: string, model: string, decorationType: vscode.TextEditorDecorationType) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // Create inline WebView input box
        await this.createInlineWebView(context, model, decorationType);
    }

    /**
     * Create inline WebView input box
     */
    private async createInlineWebView(context: string, model: string, decorationType: vscode.TextEditorDecorationType) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        // Update decoration display
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

        // Show initial decoration
        updateDecoration('');

        // Create WebView panel
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

        // Set WebView content
        panel.webview.html = this.getInlineWebViewContent(model, context);

        // Listen for WebView messages
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
                    // After WebView is ready, focus the input box
                    panel.webview.postMessage({ command: 'focus' });
                    break;
            }
        });

        // Clean up when the panel is closed
        panel.onDidDispose(() => {
            this.currentEditor?.setDecorations(decorationType, []);
            decorationType.dispose();
            this.clearDecorations();
        });

        // Show the panel
        panel.reveal(vscode.ViewColumn.Beside, false);
    }

    /**
     * Get HTML content for inline WebView
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
     * Show input position decoration
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
     * Handle user input and generate code
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
            // Show loading state
            this.showLoadingDecoration();

            // Generate code
            const generatedCode = await this.llmServiceManager.generate(model, fullPrompt);
            
            // Clean the generated code
            const cleanCode = this.cleanGeneratedCode(generatedCode);
            
            if (cleanCode.trim()) {
                // Show preview first
                await this.showCodePreview(cleanCode);
                
                // Automatically insert code
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
     * Show code preview
     */
    private async showCodePreview(code: string) {
        if (!this.currentEditor || !this.currentPosition || !this.previewDecorationType) {
            return;
        }

        const lines = code.split('\n');
        const decorations: vscode.DecorationOptions[] = [];

        // Create decorations for each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const linePosition = new vscode.Position(this.currentPosition.line + i, 0);
            
            if (i === 0) {
                // First line displayed at cursor position
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
                // Subsequent lines displayed as full-line preview
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
     * Show loading decoration
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
     * Clean generated code
     */
    private cleanGeneratedCode(code: string): string {
        // Remove possible code block markers
        let cleaned = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
        
        // Remove extra leading and trailing blank lines
        cleaned = cleaned.trim();
        
        // If the code contains explanatory text, try extracting only the code
        const lines = cleaned.split('\n');
        let codeStartIndex = 0;
        let codeEndIndex = lines.length - 1;
        
        // Find the first actual code line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
                // Check if it looks like code
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
     * Insert code at the specified position
     */
    private async insertCodeAtPosition(code: string) {
        if (!this.currentEditor || !this.currentPosition) {
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.insert(this.currentEditor.document.uri, this.currentPosition, code);
        
        await vscode.workspace.applyEdit(edit);
        
        // Move the cursor to the end of the inserted content
        const lines = code.split('\n');
        const newPosition = new vscode.Position(
            this.currentPosition.line + lines.length - 1,
            lines.length === 1 ? this.currentPosition.character + code.length : lines[lines.length - 1].length
        );
        
        this.currentEditor.selection = new vscode.Selection(newPosition, newPosition);
        
        // Return focus to the editor
        vscode.window.showTextDocument(this.currentEditor.document);
    }

    /**
     * Clear decorations
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
     * Dispose the current chat UI
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
