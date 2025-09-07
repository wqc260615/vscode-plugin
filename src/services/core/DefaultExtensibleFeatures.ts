import * as vscode from 'vscode';
import { IShortcutCommand, IContextMenuItem } from './interfaces/IExtensibleFeature';

/**
 * Default shortcut command implementation
 */
export class QuickCodeReviewCommand implements IShortcutCommand {
    public readonly id = 'quickCodeReview';
    public readonly name = 'Quick Code Review';
    public readonly description = 'Quick code review - analyze the current file’s code quality';
    public readonly keybinding = 'ctrl+shift+r';
    public readonly category = 'Code Quality';
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Please open a file first');
            return;
        }

        const document = editor.document;
        const fileName = document.fileName.split('/').pop();
        
        vscode.window.showInformationMessage(`Analyzing code quality of ${fileName}...`);
        
        // Here you can integrate an AI service for code analysis
        // For example: call the Ollama service to analyze code
        setTimeout(() => {
            vscode.window.showInformationMessage(`${fileName} code analysis completed!`);
        }, 2000);
    }
}

/**
 * Default context menu item implementation
 */
export class ExplainCodeContextMenu implements IContextMenuItem {
    public readonly id = 'explainCode';
    public readonly name = 'Explain Code';
    public readonly description = 'Explain the selected code';
    public readonly title = 'Explain Code';
    public readonly icon = '$(lightbulb)';
    public readonly when = 'editorHasSelection';
    public readonly group = 'ai@1';
    public readonly order = 1;
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text.trim()) {
            vscode.window.showInformationMessage('Please select the code to explain');
            return;
        }

        vscode.window.showInformationMessage('Using AI to explain the selected code...');
        
        // Here you can integrate an AI service to explain code
        // For example: call the Ollama service to explain code
        setTimeout(() => {
            vscode.window.showInformationMessage('Code explanation completed!');
        }, 2000);
    }
}

/**
 * File-type related context menu item
 */
export class OptimizeCodeContextMenu implements IContextMenuItem {
    public readonly id = 'optimizeCode';
    public readonly name = 'Optimize Code';
    public readonly description = 'Optimize the current file’s code';
    public readonly title = 'Optimize Code';
    public readonly icon = '$(zap)';
    public readonly when = 'resourceExtname == .js || resourceExtname == .ts || resourceExtname == .py';
    public readonly group = 'ai@2';
    public readonly order = 1;
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const fileName = document.fileName.split('/').pop();
        
        vscode.window.showInformationMessage(`Optimizing code in ${fileName}...`);
        
        // Here you can integrate an AI service to optimize code
        // For example: call the Ollama service to provide optimization suggestions
        setTimeout(() => {
            vscode.window.showInformationMessage(`Optimization suggestions for ${fileName} have been generated!`);
        }, 2000);
    }
}

/**
 * Get all default features
 */
export function getDefaultFeatures() {
    return {
        shortcuts: [
            new QuickCodeReviewCommand()
        ],
        contextMenus: [
            new ExplainCodeContextMenu(),
            new OptimizeCodeContextMenu()
        ]
    };
}

