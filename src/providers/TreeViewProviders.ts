import * as vscode from 'vscode';
import { SessionManager, ChatSession } from '../services/session/sessionManager';
import { ProjectContextProcessor, ReferenceFile } from '../services/context/projectContextProcessor';

// Context file tree view provider
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
            // Return root-level items
            const items: ContextTreeItem[] = [
                new ContextTreeItem('Reference Files', 'reference-root', vscode.TreeItemCollapsibleState.Expanded),
                new ContextTreeItem('Project Files', 'project-root', vscode.TreeItemCollapsibleState.Collapsed)
            ];
            return Promise.resolve(items);
        } else {
            // Return child items
            if (element.contextValue === 'reference-root') {
                const referenceFiles = this.contextProcessor.getReferenceFiles();
                return Promise.resolve(referenceFiles.map(file => 
                    new ContextTreeItem(file.name, 'reference-file', vscode.TreeItemCollapsibleState.None, file.path)
                ));
            } else if (element.contextValue === 'project-root') {
                const sourceFiles = this.contextProcessor.getSourceFiles();
                return Promise.resolve(sourceFiles.slice(0, 20).map(file => // Limit display count
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

// AI Assistant command provider
export class AIAssistantCommands {
    constructor(
        private sessionManager: SessionManager,
        private contextProcessor: ProjectContextProcessor,
        private contextTreeProvider: ContextTreeProvider
    ) {}

    registerCommands(context: vscode.ExtensionContext) {
        // Context file related commands
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
                    if (success) {
                        successCount++;
                    }
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

        // Send selected code to AI Assistant
        const sendToAssistantCommand = vscode.commands.registerCommand('aiAssistant.sendToAssistant', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                
                if (selectedText) {
                    // We could trigger sending a message to the AI Assistant view here
                    vscode.window.showInformationMessage(`Selected ${selectedText.length} characters. Please use the AI Assistant panel to send your question.`);
                    // Optionally auto-focus the AI Assistant view
                    vscode.commands.executeCommand('aiAssistant.chatView.focus');
                } else {
                    vscode.window.showWarningMessage('Please select some code first');
                }
            }
        });

        // Register all commands
        context.subscriptions.push(
            addReferenceFileCommand,
            removeReferenceFileCommand,
            refreshProjectContextCommand,
            clearReferenceFilesCommand,
            sendToAssistantCommand
        );
    }
}