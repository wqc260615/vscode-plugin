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

        // 监听补全状态变化
        this.completionProvider.onCompletionStateChanged = (hasCompletion: boolean) => {
            this.updateCompletionContext(hasCompletion);
        };
    }

    /**
     * 更新上下文状态
     */
    private updateCompletionContext(hasCompletion: boolean) {
        vscode.commands.executeCommand('setContext', 'aiAssistant.hasActiveCompletion', hasCompletion);
    }

    /**
     * 初始化代码补全功能
     */
    public initialize(context: vscode.ExtensionContext) {
        // 注册命令
        this.registerCommands(context);

        // 设置编辑器监听器
        this.setupEditorListeners();

        // 注册键盘快捷键
        this.registerKeybindings(context);

        // 初始化上下文
        this.updateCompletionContext(false);
    }

    /**
     * 注册相关命令
     */
    private registerCommands(context: vscode.ExtensionContext) {
        // 手动触发补全
        const triggerCommand = vscode.commands.registerCommand('aiAssistant.triggerCompletion', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // 触发 VS Code 的内置 inline completion
                await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
            }
        });

        // 切换补全功能开关
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
     * 注册键盘快捷键
     */
    private registerKeybindings(context: vscode.ExtensionContext) {
        // Tab键接受补全的逻辑已经在registerCommands中的acceptCompletion命令处理
        // ESC键拒绝补全的逻辑已经在registerCommands中的rejectCompletion命令处理
    }

    /**
     * 设置编辑器监听器
     */
    private setupEditorListeners() {
        // 监听活动编辑器变化
        const activeEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.setupEditorSpecificListeners(editor);
            } else {
                // 没有活动编辑器时，清除补全状态
                this.updateCompletionContext(false);
            }
        });

        // 为当前活动编辑器设置监听器
        if (vscode.window.activeTextEditor) {
            this.setupEditorSpecificListeners(vscode.window.activeTextEditor);
        }

        this.disposables.push(activeEditorChange);
    }

    /**
     * 为特定编辑器设置监听器
     */
    private setupEditorSpecificListeners(editor: vscode.TextEditor) {
        const document = editor.document;
        const documentUri = document.uri.toString();

        // 如果已经为此文档设置了监听器，先清理
        this.cleanupEditorListeners(documentUri);

        // 检查是否为支持的文件类型
        if (!this.isSupportedLanguage(document.languageId)) {
            return;
        }

        // 检查是否启用了代码补全
        const config = vscode.workspace.getConfiguration('aiAssistant');
        if (!config.get('enableCodeCompletion', true)) {
            return;
        }

        // 文档变化监听器
        const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === document) {
                // 文档变化时，VS Code 会自动重新触发 inline completion
                // 我们只需要记录日志
                console.log('Document changed, VS Code will handle inline completion automatically');
            }
        });

        // 光标位置变化监听器
        const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
            if (event.textEditor === editor) {
                // 光标移动时，VS Code 会自动隐藏 inline completion
                console.log('Selection changed, VS Code will handle inline completion automatically');
            }
        });

        this.documentChangeListeners.set(documentUri, documentChangeListener);
        this.selectionChangeListeners.set(documentUri, selectionChangeListener);
    }

    /**
     * 清理特定编辑器的监听器
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
     * 获取补全提供程序实例
     */
    public getCompletionProvider(): CodeCompletionProvider {
        return this.completionProvider;
    }

    /**
     * 获取补全统计信息
     */
    public getCompletionStats() {
        return {
            hasActiveCompletion: this.completionProvider.hasActiveCompletion(),
            activeEditors: this.documentChangeListeners.size
        };
    }

    /**
     * 释放所有资源
     */
    public dispose() {
        // 清理所有监听器
        for (const [uri, disposable] of this.documentChangeListeners) {
            disposable.dispose();
        }
        this.documentChangeListeners.clear();

        for (const [uri, disposable] of this.selectionChangeListeners) {
            disposable.dispose();
        }
        this.selectionChangeListeners.clear();

        // 清理其他资源
        this.disposables.forEach(disposable => disposable.dispose());
        this.completionProvider.dispose();

        // 清理上下文
        this.updateCompletionContext(false);
    }
}