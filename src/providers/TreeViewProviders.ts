import * as vscode from 'vscode';
import { SessionManager, ChatSession } from '../services/sessionManager';
import { ProjectContextProcessor, ReferenceFile } from '../services/projectContextProcessor';

// 会话树视图提供者
export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionTreeItem | undefined | null | void> = new vscode.EventEmitter<SessionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SessionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private sessionManager: SessionManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SessionTreeItem): Thenable<SessionTreeItem[]> {
        if (!element) {
            // 返回所有会话
            const sessions = this.sessionManager.getAllSessions();
            return Promise.resolve(sessions.map(session => new SessionTreeItem(
                session.name,
                session.id,
                session.messages.length,
                this.sessionManager.getActiveSession()?.id === session.id
            )));
        }
        return Promise.resolve([]);
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly sessionId: string,
        public readonly messageCount: number,
        public readonly isActive: boolean
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${this.label} (${messageCount} messages)`;
        this.description = messageCount > 0 ? `${messageCount} msgs` : 'empty';
        this.contextValue = 'session';
        
        if (isActive) {
            this.iconPath = new vscode.ThemeIcon('comment-discussion', new vscode.ThemeColor('charts.green'));
        } else {
            this.iconPath = new vscode.ThemeIcon('comment-discussion');
        }

        // 添加命令，点击时选择会话
        this.command = {
            command: 'aiAssistant.selectSession',
            title: 'Select Session',
            arguments: [sessionId]
        };
    }
}

// 上下文文件树视图提供者
export class ContextTreeProvider implements vscode.TreeDataProvider<ContextTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextTreeItem | undefined | null | void> = new vscode.EventEmitter<ContextTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private contextProcessor: ProjectContextProcessor) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContextTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContextTreeItem): Thenable<ContextTreeItem[]> {
        if (!element) {
            // 返回根级别项目
            const items: ContextTreeItem[] = [
                new ContextTreeItem('Reference Files', 'reference-root', vscode.TreeItemCollapsibleState.Expanded),
                new ContextTreeItem('Project Files', 'project-root', vscode.TreeItemCollapsibleState.Collapsed)
            ];
            return Promise.resolve(items);
        } else {
            // 返回子项目
            if (element.contextValue === 'reference-root') {
                const referenceFiles = this.contextProcessor.getReferenceFiles();
                return Promise.resolve(referenceFiles.map(file => 
                    new ContextTreeItem(file.name, 'reference-file', vscode.TreeItemCollapsibleState.None, file.path)
                ));
            } else if (element.contextValue === 'project-root') {
                const sourceFiles = this.contextProcessor.getSourceFiles();
                return Promise.resolve(sourceFiles.slice(0, 20).map(file => // 限制显示数量
                    new ContextTreeItem(file.name, 'project-file', vscode.TreeItemCollapsibleState.None, file.path)
                ));
            }
        }
        return Promise.resolve([]);
    }
}

export class ContextTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly filePath?: string
    ) {
        super(label, collapsibleState);

        if (contextValue === 'reference-root') {
            this.iconPath = new vscode.ThemeIcon('references');
            this.tooltip = 'Manually added reference files';
        } else if (contextValue === 'project-root') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
            this.tooltip = 'Project source files';
        } else if (contextValue === 'reference-file') {
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.tooltip = `Reference file: ${filePath}`;
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(filePath!)]
            };
        } else if (contextValue === 'project-file') {
            this.iconPath = new vscode.ThemeIcon('file-code');
            this.tooltip = `Project file: ${filePath}`;
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(filePath!)]
            };
        }
    }
}

// AI助手命令提供者
export class AIAssistantCommands {
    constructor(
        private sessionManager: SessionManager,
        private contextProcessor: ProjectContextProcessor,
        private sessionsTreeProvider: SessionsTreeProvider,
        private contextTreeProvider: ContextTreeProvider
    ) {}

    registerCommands(context: vscode.ExtensionContext) {
        // 会话相关命令
        const selectSessionCommand = vscode.commands.registerCommand('aiAssistant.selectSession', (sessionId: string) => {
            this.sessionManager.setActiveSession(sessionId);
            this.sessionsTreeProvider.refresh();
            vscode.window.showInformationMessage(`Selected session: ${this.sessionManager.getSession(sessionId)?.name}`);
        });

        const newSessionCommand = vscode.commands.registerCommand('aiAssistant.newSession', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter session name',
                value: 'New Session'
            });
            if (name) {
                this.sessionManager.createNewSession(name);
                this.sessionsTreeProvider.refresh();
            }
        });

        const deleteSessionCommand = vscode.commands.registerCommand('aiAssistant.deleteSession', async (item: SessionTreeItem) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete session "${item.label}"?`,
                'Delete', 'Cancel'
            );
            if (result === 'Delete') {
                this.sessionManager.removeSession(item.sessionId);
                this.sessionsTreeProvider.refresh();
            }
        });

        const renameSessionCommand = vscode.commands.registerCommand('aiAssistant.renameSession', async (item: SessionTreeItem) => {
            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new session name',
                value: item.label
            });
            if (newName && newName.trim()) {
                this.sessionManager.renameSession(item.sessionId, newName.trim());
                this.sessionsTreeProvider.refresh();
            }
        });

        const clearSessionCommand = vscode.commands.registerCommand('aiAssistant.clearSession', async (item: SessionTreeItem) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to clear all messages in session "${item.label}"?`,
                'Clear', 'Cancel'
            );
            if (result === 'Clear') {
                this.sessionManager.clearSession(item.sessionId);
                this.sessionsTreeProvider.refresh();
            }
        });

        // 上下文文件相关命令
        const addReferenceFileCommand = vscode.commands.registerCommand('aiAssistant.addReferenceFile', async () => {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                openLabel: 'Add Reference Files'
            });

            if (fileUri && fileUri.length > 0) {
                let successCount = 0;
                for (const uri of fileUri) {
                    const success = await this.contextProcessor.addReferenceFile(uri.fsPath);
                    if (success) successCount++;
                }
                this.contextTreeProvider.refresh();
                vscode.window.showInformationMessage(`Added ${successCount} reference file(s)`);
            }
        });

        const removeReferenceFileCommand = vscode.commands.registerCommand('aiAssistant.removeReferenceFile', (item: ContextTreeItem) => {
            if (item.filePath) {
                this.contextProcessor.removeReferenceFile(item.filePath);
                this.contextTreeProvider.refresh();
                vscode.window.showInformationMessage(`Removed reference file: ${item.label}`);
            }
        });

        const refreshProjectContextCommand = vscode.commands.registerCommand('aiAssistant.refreshProjectContext', async () => {
            await this.contextProcessor.initProjectContext();
            this.contextTreeProvider.refresh();
            vscode.window.showInformationMessage('Project context refreshed');
        });

        const clearReferenceFilesCommand = vscode.commands.registerCommand('aiAssistant.clearReferenceFiles', async () => {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to remove all reference files?',
                'Clear', 'Cancel'
            );
            if (result === 'Clear') {
                this.contextProcessor.clearReferenceFiles();
                this.contextTreeProvider.refresh();
                vscode.window.showInformationMessage('All reference files cleared');
            }
        });

        // 发送选中代码到AI助手
        const sendToAssistantCommand = vscode.commands.registerCommand('aiAssistant.sendToAssistant', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                
                if (selectedText) {
                    // 在这里我们可以触发AI助手视图的消息发送
                    vscode.window.showInformationMessage(`Selected ${selectedText.length} characters. Please use the AI Assistant panel to send your question.`);
                    // 可以考虑自动打开AI助手视图
                    vscode.commands.executeCommand('aiAssistant.chatView.focus');
                } else {
                    vscode.window.showWarningMessage('Please select some code first');
                }
            }
        });

        // 注册所有命令
        context.subscriptions.push(
            selectSessionCommand,
            newSessionCommand,
            deleteSessionCommand,
            renameSessionCommand,
            clearSessionCommand,
            addReferenceFileCommand,
            removeReferenceFileCommand,
            refreshProjectContextCommand,
            clearReferenceFilesCommand,
            sendToAssistantCommand
        );
    }
}