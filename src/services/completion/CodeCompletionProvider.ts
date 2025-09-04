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

    // Add state change callback
    public onCompletionStateChanged: ((hasCompletion: boolean) => void) | null = null;

    constructor(llmServiceManager: LLMServiceManager) {
        this.llmServiceManager = llmServiceManager;
        this.errorHandler = LLMErrorHandler.getInstance();
    }

    /**
     * Implement InlineCompletionItemProvider interface
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        
        // Check whether code completion is enabled
        const config = vscode.workspace.getConfiguration('aiAssistant');
        if (!config.get('enableCodeCompletion', true)) {
            return null;
        }

        // If generating, return null
        if (this.isGenerating) {
            return null;
        }

        try {
            this.isGenerating = true;

            // Get code context
            const codeContext = this.getCodeContext(document, position, 1500);
            if (!codeContext || codeContext.trim().length === 0) {
                return null;
            }

            // Get completion from LLM service
            const completion = await this.getCompletionFromLLM(codeContext);
            if (!completion || completion.trim().length === 0) {
                return null;
            }

            // Create InlineCompletionItem
            const item = new vscode.InlineCompletionItem(
                completion,
                new vscode.Range(position, position)
            );

            // Set label for the completion item
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
     * Check if the language is supported
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
     * Clean completion text, remove extra blank lines and formatting issues
     */
    private cleanCompletionText(text: string): string {
        // First, trim the entire text
        let cleaned = text.trim();
        
        // Remove possible markdown code block markers
        cleaned = cleaned.replace(/^```[\w]*\n?/, '');
        cleaned = cleaned.replace(/\n?```$/, '');
        
        // Remove leading extra blank lines and lines with only whitespace
        cleaned = cleaned.replace(/^[\s\n]*\n/, '');
        
        // Remove trailing extra blank lines
        cleaned = cleaned.replace(/\n+\s*$/, '');
        
        // Remove consecutive blank lines, keep at most one
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        // If leading whitespace exists but is not indentation, remove it
        const lines = cleaned.split('\n');
        if (lines.length > 0 && lines[0].match(/^\s+$/)) {
            lines.shift(); // Remove the first line if it only contains whitespace
            cleaned = lines.join('\n');
        }
        
        // Ensure not returning an empty string
        return cleaned || '';
    }

    /**
     * Show code completion preview (deprecated, now using InlineCompletionProvider)
     */
    public showCompletion(editor: vscode.TextEditor, completion: string) {
        // Kept for backward compatibility; actual completion handled by provideInlineCompletionItems
    }

    /**
     * Clear current completion preview (deprecated)
     */
    public clearCompletion(editor: vscode.TextEditor) {
        // Now handled automatically by VS Code's InlineCompletionProvider
    }

    /**
     * Accept the current completion suggestion
     */
    public async acceptCompletion(editor: vscode.TextEditor): Promise<boolean> {
        if (!this.currentSuggestion) {
            return false;
        }

        const suggestion = this.currentSuggestion;
        this.clearCompletion(editor);

        try {
            // Insert completion text
            await editor.edit(editBuilder => {
                editBuilder.insert(suggestion.range.start, suggestion.insertText);
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if there is an active completion
     */
    public hasActiveCompletion(): boolean {
        return this.currentSuggestion !== null;
    }

    /**
     * Request code completion
     */
    public async requestCompletion(editor: vscode.TextEditor, llmServiceManager: LLMServiceManager): Promise<void> {
        // If generating, skip
        if (this.isGenerating) {
            return;
        }

        // Clear previous timer
        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);


        }

        // Set debounce delay
        this.completionTimeout = setTimeout(async () => {
            await this.performCompletion(editor, llmServiceManager);
        }, 500); // 500ms debounce
    }

    /**
     * Perform the actual completion request
     */
    private async performCompletion(editor: vscode.TextEditor, llmServiceManager: LLMServiceManager): Promise<void> {
        try {
            this.isGenerating = true;

            // Increase context characters to get more information
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
     * Get code context
     */
    private getCodeContext(document: vscode.TextDocument, position: vscode.Position, contextChars: number = 1500): string {
        // Calculate allocation ratio of surrounding text (60% before, 40% after)
        const beforeChars = Math.floor(contextChars * 0.6);
        const afterChars = contextChars - beforeChars;

        // Get text before the cursor
        const startPosition = new vscode.Position(0, 0);
        const beforeRange = new vscode.Range(startPosition, position);
        let beforeText = document.getText(beforeRange);

        // If the preceding text is too long, keep only the tail
        if (beforeText.length > beforeChars) {
            beforeText = beforeText.substring(beforeText.length - beforeChars);
            
            // Ensure not cutting in the middle of a word; find first complete line
            const firstNewlineIndex = beforeText.indexOf('\n');
            if (firstNewlineIndex > 0) {
                beforeText = beforeText.substring(firstNewlineIndex + 1);
            }
        }

        // Get text after the cursor
        const endPosition = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        const afterRange = new vscode.Range(position, endPosition);
        let afterText = document.getText(afterRange);

        // If the trailing text is too long, keep only the head
        if (afterText.length > afterChars) {
            afterText = afterText.substring(0, afterChars);
            
            // Ensure not cutting in the middle of a word; find last complete line
            const lastNewlineIndex = afterText.lastIndexOf('\n');
            if (lastNewlineIndex > 0 && lastNewlineIndex < afterText.length - 1) {
                afterText = afterText.substring(0, lastNewlineIndex + 1);
            }
        }

        // Build full context with <BLANK> inserted at cursor position
        const context = beforeText + '<BLANK>' + afterText;
        
        return context;
    }

    /**
     * Get completion suggestion from LLM
     */
    private async getCompletionFromLLM(context: string): Promise<string> {
        try {
            
            // Get LLM service
            const llmService = this.llmServiceManager.getCurrentService();
            if (!llmService) {
                return '';
            }
            
            // Get preferred model
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

            // Prefer using generate; fallback to chat on failure
            try {
                const response = await llmService.generate(preferredModel, prompt);
                let completion = response.trim();
                
                // Clean the response, removing possible code block markers
                completion = completion.replace(/^```[\w]*\n?/, '');
                completion = completion.replace(/\n?```$/, '');
                
                // Clean and format completion text
                completion = this.cleanCompletionText(completion);
                
                return completion;
            } catch (generateError) {
                // Fallback to chat API
                // Create a temporary session object
                const tempSession = {
                    id: 'temp',
                    name: 'Temporary Session',
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const chatResponse = await llmService.chat(preferredModel, prompt, tempSession);
                let completion = chatResponse.trim();
                
                // Clean and format completion text
                completion = this.cleanCompletionText(completion);
                
                return completion;
            }
        } catch (error) {
            return '';
        }
    }

    /**
     * Handle document change event
     */
    public onDocumentChange(editor: vscode.TextEditor, change: vscode.TextDocumentChangeEvent) {
        // Clear current completion preview when document changes
        if (change.contentChanges.length > 0) {
            this.clearCompletion(editor);
        }
    }

    /**
     * Handle cursor position change
     */
    public onCursorChange(editor: vscode.TextEditor) {
        // Clear completion preview when cursor moves
        this.clearCompletion(editor);
    }

    /**
     * Release resources
     */
    public dispose() {
        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
        }
        this.currentSuggestion = null;

        // Notify state change
        if (this.onCompletionStateChanged) {
            this.onCompletionStateChanged(false);
        }
    }
}