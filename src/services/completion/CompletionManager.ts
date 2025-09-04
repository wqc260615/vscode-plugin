import * as vscode from 'vscode';
import { CodeCompletionProvider } from './CodeCompletionProvider';
import { LLMServiceManager } from '../LLMServiceManager';

export class CompletionManager {
    private completionProvider: CodeCompletionProvider;
    private llmServiceManager: LLMServiceManager;
    private disposables: vscode.Disposable[] = [];
    private documentChangeListeners: Map<string, vscode.Disposable> = new Map();
    private selectionChangeListeners: Map<string, vscode.Disposable> = new Map();

    constructor(llmServiceManager: LLMServiceManager) {
        this.llmServiceManager = llmServiceManager;
        this.completionProvider = new CodeCompletionProvider(llmServiceManager);

        // Listen for completion state changes
        this.completionProvider.onCompletionStateChanged = (hasCompletion: boolean) => {
            this.updateCompletionContext(hasCompletion);
        };
    }

    /**
     * Update context state
     */
    private updateCompletionContext(hasCompletion: boolean) {
        vscode.commands.executeCommand('setContext', 'aiAssistant.hasActiveCompletion', hasCompletion);
    }

    /**
     * Initialize code completion feature
     */
    public initialize(context: vscode.ExtensionContext) {
        // Register commands
        this.registerCommands(context);

        // Set up editor listeners
        this.setupEditorListeners();

        // Register keyboard shortcuts
        this.registerKeybindings(context);

        // Initialize context
        this.updateCompletionContext(false);
    }

    /**
     * Register related commands
     */
    private registerCommands(context: vscode.ExtensionContext) {
        // Manually trigger completion
        const triggerCommand = vscode.commands.registerCommand('aiAssistant.triggerCompletion', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // Trigger VS Code's built-in inline completion
                await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
            }
        });

        // Toggle completion feature
        const toggleCommand = vscode.commands.registerCommand('aiAssistant.toggleCompletion', () => {
            const config = vscode.workspace.getConfiguration('aiAssistant');
            const enabled = config.get('enableCodeCompletion', true);
            config.update('enableCodeCompletion', !enabled, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage(
                `AI Code Completion ${!enabled ? 'enabled' : 'disabled'}`
            );
        });

        this.disposables.push(triggerCommand, toggleCommand);
    }

    /**
     * Register keyboard shortcuts
     */
    private registerKeybindings(context: vscode.ExtensionContext) {
        // Tab to accept completion is handled by the acceptCompletion command in registerCommands
        // ESC to reject completion is handled by the rejectCompletion command in registerCommands
    }

    /**
     * Set up editor listeners
     */
    private setupEditorListeners() {
        // Listen for active editor changes
        const activeEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.setupEditorSpecificListeners(editor);
            } else {
                // When there is no active editor, clear completion state
                this.updateCompletionContext(false);
            }
        });

        // Set listeners for the current active editor
        if (vscode.window.activeTextEditor) {
            this.setupEditorSpecificListeners(vscode.window.activeTextEditor);
        }

        this.disposables.push(activeEditorChange);
    }

    /**
     * Set listeners for a specific editor
     */
    private setupEditorSpecificListeners(editor: vscode.TextEditor) {
        const document = editor.document;
        const documentUri = document.uri.toString();

        // If listeners already exist for this document, clean them up first
        this.cleanupEditorListeners(documentUri);

        // Check if the file type is supported
        if (!this.isSupportedLanguage(document.languageId)) {
            return;
        }

        // Check whether code completion is enabled
        const config = vscode.workspace.getConfiguration('aiAssistant');
        if (!config.get('enableCodeCompletion', true)) {
            return;
        }

        // Document change listener
        const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === document) {
                // VS Code automatically retriggers inline completion on document changes
                // We only need to log it
                console.log('Document changed, VS Code will handle inline completion automatically');
            }
        });

        // Cursor position change listener
        const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
            if (event.textEditor === editor) {
                // VS Code automatically hides inline completion when the cursor moves
                console.log('Selection changed, VS Code will handle inline completion automatically');
            }
        });

        this.documentChangeListeners.set(documentUri, documentChangeListener);
        this.selectionChangeListeners.set(documentUri, selectionChangeListener);
    }

    /**
     * Clean up listeners for a specific editor
     */
    private cleanupEditorListeners(documentUri: string) {
        const docListener = this.documentChangeListeners.get(documentUri);
        if (docListener) {
            docListener.dispose();
            this.documentChangeListeners.delete(documentUri);
        }

        const selListener = this.selectionChangeListeners.get(documentUri);
        if (selListener) {
            selListener.dispose();
            this.selectionChangeListeners.delete(documentUri);
        }
    }

    /**
     * Check if the programming language is supported
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
     * Get the completion provider instance
     */
    public getCompletionProvider(): CodeCompletionProvider {
        return this.completionProvider;
    }

    /**
     * Get completion statistics
     */
    public getCompletionStats() {
        return {
            hasActiveCompletion: this.completionProvider.hasActiveCompletion(),
            activeEditors: this.documentChangeListeners.size
        };
    }

    /**
     * Release all resources
     */
    public dispose() {
        // Clean up all listeners
        for (const [uri, disposable] of this.documentChangeListeners) {
            disposable.dispose();
        }
        this.documentChangeListeners.clear();

        for (const [uri, disposable] of this.selectionChangeListeners) {
            disposable.dispose();
        }
        this.selectionChangeListeners.clear();

        // Clean up other resources
        this.disposables.forEach(disposable => disposable.dispose());
        this.completionProvider.dispose();

        // Clean up context
        this.updateCompletionContext(false);
    }
}