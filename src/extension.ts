import * as vscode from 'vscode';
import { AIChatViewProvider } from './panels/AIChatViewProvider';
import { ContextTreeProvider, AIAssistantCommands } from './providers/TreeViewProviders';
import { SessionManager } from './services/session/sessionManager';
import { ProjectContextProcessor } from './services/context/projectContextProcessor';
import { LLMServiceManager } from './services/llm/LLMServiceManager';
import { CompletionManager } from './services/completion/CompletionManager';
import { InlineChatProvider } from './services/chat/InlineChatProvider';
import { StatusBarManager } from './services/status/statusBarManager';
import { ExtensibleFeatureManager } from './services/core/ExtensibleFeatureManager';
import { getDefaultFeatures } from './services/core/DefaultExtensibleFeatures';
import { LLMProviderCommands } from './services/llm/LLMProviderCommands';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Assistant extension is now active!');

    // Initialize services
    const sessionManager = new SessionManager(context);
    const contextProcessor = new ProjectContextProcessor();
    const llmServiceManager = LLMServiceManager.getInstance();

    // Initialize project context
    contextProcessor.initProjectContext();

    // Initialize code completion feature
    const completionManager = new CompletionManager(llmServiceManager);
    completionManager.initialize(context);

    // Register Inline Completion Provider
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

    // Initialize inline chat feature
    const inlineChatProvider = new InlineChatProvider(llmServiceManager, contextProcessor);

    // Initialize status bar manager
    const statusBarManager = new StatusBarManager(llmServiceManager);

    // Initialize extensible feature manager
    const extensibleFeatureManager = ExtensibleFeatureManager.getInstance();
    const defaultFeatures = getDefaultFeatures();
    
    // Register default features
    defaultFeatures.shortcuts.forEach(shortcut => {
        extensibleFeatureManager.registerShortcutCommand(shortcut);
    });
    
    defaultFeatures.contextMenus.forEach(contextMenu => {
        extensibleFeatureManager.registerContextMenuItem(contextMenu);
    });

    // Register LLM provider management commands
    const llmProviderCommands = new LLMProviderCommands();
    llmProviderCommands.registerCommands(context);

    // Create tree view provider
    const contextTreeProvider = new ContextTreeProvider(contextProcessor);

    // Register main chat view provider
    const chatViewProvider = new AIChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(AIChatViewProvider.viewType, chatViewProvider)
    );

    // Register tree view
    const contextTreeView = vscode.window.createTreeView('aiAssistant.contextView', {
        treeDataProvider: contextTreeProvider,
        showCollapseAll: true
    });

    // Register commands
    const commandsManager = new AIAssistantCommands(
        sessionManager,
        contextProcessor,
        contextTreeProvider
    );
    commandsManager.registerCommands(context);

    // Register inline chat command
    const inlineChatCommand = vscode.commands.registerCommand('aiAssistant.showInlineChat', () => {
        inlineChatProvider.showInlineChat();
    });
    context.subscriptions.push(inlineChatCommand);

    // Register status bar click command
    const checkConnectionCommand = vscode.commands.registerCommand('aiAssistant.checkConnection', () => {
        statusBarManager.handleStatusBarClick();
    });
    context.subscriptions.push(checkConnectionCommand);

    // Register workspace change listener
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await contextProcessor.initProjectContext();
        contextTreeProvider.refresh();
    });

    // Register file save listener to auto-update project context
    const fileSaveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
        // If a source code file was saved, refresh the project context
        const ext = document.fileName.split('.').pop()?.toLowerCase();
        if (ext && ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(ext)) {
            await contextProcessor.initProjectContext();
            contextTreeProvider.refresh();
        }
    });

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(robot) AI Assistant";
    statusBarItem.command = 'aiAssistant.chatView.focus';
    statusBarItem.tooltip = "Open AI Assistant";
    statusBarItem.show();

    // Create code completion status bar item
    const completionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    completionStatusBar.text = "$(lightbulb) AI Completion";
    completionStatusBar.command = 'aiAssistant.toggleCompletion';
    completionStatusBar.tooltip = "Toggle AI Code Completion";
    completionStatusBar.show();

    // Update completion status bar
    const updateCompletionStatus = () => {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const enabled = config.get('enableCodeCompletion', true);
        completionStatusBar.text = enabled ? "$(lightbulb) AI Completion" : "$(lightbulb-off) AI Completion";
        completionStatusBar.tooltip = enabled ? "AI Code Completion (Enabled)" : "AI Code Completion (Disabled)";
    };

    updateCompletionStatus();

    // Listen for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('aiAssistant.enableCodeCompletion')) {
            updateCompletionStatus();
        }
    });

    // Add all subscriptions
    context.subscriptions.push(
        contextTreeView,
        workspaceWatcher,
        fileSaveWatcher,
        statusBarItem,
        completionStatusBar,
        configWatcher,
        statusBarManager,  // Ensure proper cleanup of the status bar manager when the extension is deactivated
        completionManager,  // Ensure proper cleanup when the extension is deactivated
        extensibleFeatureManager  // Ensure proper cleanup of the extensible feature manager when the extension is deactivated
    );

    // Show activation message
    vscode.window.showInformationMessage('AI Assistant is ready! Click the robot icon in the activity bar to get started.');
}

export function deactivate() {
    console.log('AI Assistant extension deactivated');
}