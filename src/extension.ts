import * as vscode from 'vscode';
import { AIChatViewProvider } from './panels/AIChatViewProvider';
import { ContextTreeProvider, AIAssistantCommands } from './providers/TreeViewProviders';
import { SessionManager } from './services/sessionManager';
import { ProjectContextProcessor } from './services/projectContextProcessor';
import { OllamaService } from './services/ollamaService';
import { CompletionManager } from './services/completion/CompletionManager';
import { InlineChatProvider } from './services/InlineChatProvider';
import { StatusBarManager } from './services/statusBarManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Assistant extension is now active!');

    // 初始化服务
    const sessionManager = new SessionManager(context);
    const contextProcessor = new ProjectContextProcessor();
    const ollamaService = new OllamaService();

    // 初始化项目上下文
    contextProcessor.initProjectContext();

    // 初始化代码补全功能
    const completionManager = new CompletionManager(ollamaService);
    completionManager.initialize(context);

    // 注册 Inline Completion Provider
    const inlineCompletionProvider = completionManager.getCompletionProvider();
    const inlineCompletionDisposable = vscode.languages.registerInlineCompletionItemProvider(
        [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'python' },
            { scheme: 'file', language: 'java' },
            { scheme: 'file', language: 'cpp' },
            { scheme: 'file', language: 'c' },
            { scheme: 'file', language: 'csharp' },
            { scheme: 'file', language: 'php' },
            { scheme: 'file', language: 'ruby' },
            { scheme: 'file', language: 'go' },
            { scheme: 'file', language: 'rust' },
            { scheme: 'file', language: 'swift' },
            { scheme: 'file', language: 'kotlin' }
        ],
        inlineCompletionProvider
    );
    context.subscriptions.push(inlineCompletionDisposable);

    // 初始化inline chat功能
    const inlineChatProvider = new InlineChatProvider(ollamaService, contextProcessor);

    // 初始化状态栏管理器
    const statusBarManager = new StatusBarManager(ollamaService);

    // 创建树视图提供者
    const contextTreeProvider = new ContextTreeProvider(contextProcessor);

    // 注册主聊天视图提供者
    const chatViewProvider = new AIChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(AIChatViewProvider.viewType, chatViewProvider)
    );

    // 注册树视图
    const contextTreeView = vscode.window.createTreeView('aiAssistant.contextView', {
        treeDataProvider: contextTreeProvider,
        showCollapseAll: true
    });

    // 注册命令
    const commandsManager = new AIAssistantCommands(
        sessionManager,
        contextProcessor,
        contextTreeProvider
    );
    commandsManager.registerCommands(context);

    // 注册inline chat命令
    const inlineChatCommand = vscode.commands.registerCommand('aiAssistant.showInlineChat', () => {
        inlineChatProvider.showInlineChat();
    });
    context.subscriptions.push(inlineChatCommand);

    // 注册状态栏点击命令
    const checkConnectionCommand = vscode.commands.registerCommand('aiAssistant.checkConnection', () => {
        statusBarManager.handleStatusBarClick();
    });
    context.subscriptions.push(checkConnectionCommand);

    // 注册工作区变化监听器
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await contextProcessor.initProjectContext();
        contextTreeProvider.refresh();
    });

    // 注册文件保存监听器，自动更新项目上下文
    const fileSaveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
        // 如果保存的是源代码文件，刷新项目上下文
        const ext = document.fileName.split('.').pop()?.toLowerCase();
        if (ext && ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(ext)) {
            await contextProcessor.initProjectContext();
            contextTreeProvider.refresh();
        }
    });

    // 创建状态栏项目
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(robot) AI Assistant";
    statusBarItem.command = 'aiAssistant.chatView.focus';
    statusBarItem.tooltip = "Open AI Assistant";
    statusBarItem.show();

    // 创建代码补全状态栏项目
    const completionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    completionStatusBar.text = "$(lightbulb) AI Completion";
    completionStatusBar.command = 'aiAssistant.toggleCompletion';
    completionStatusBar.tooltip = "Toggle AI Code Completion";
    completionStatusBar.show();

    // 更新补全状态栏
    const updateCompletionStatus = () => {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const enabled = config.get('enableCodeCompletion', true);
        completionStatusBar.text = enabled ? "$(lightbulb) AI Completion" : "$(lightbulb-off) AI Completion";
        completionStatusBar.tooltip = enabled ? "AI Code Completion (Enabled)" : "AI Code Completion (Disabled)";
    };

    updateCompletionStatus();

    // 监听配置变化
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('aiAssistant.enableCodeCompletion')) {
            updateCompletionStatus();
        }
    });

    // 添加所有订阅
    context.subscriptions.push(
        contextTreeView,
        workspaceWatcher,
        fileSaveWatcher,
        statusBarItem,
        completionStatusBar,
        configWatcher,
        statusBarManager,  // 确保在扩展停用时正确清理状态栏管理器
        completionManager  // 确保在扩展停用时正确清理
    );

    // 显示激活消息
    vscode.window.showInformationMessage('AI Assistant is ready! Click the robot icon in the activity bar to get started.');
}

export function deactivate() {
    console.log('AI Assistant extension deactivated');
}