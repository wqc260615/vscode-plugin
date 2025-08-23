import * as vscode from 'vscode';
import { IShortcutCommand, IContextMenuItem } from './interfaces/IExtensibleFeature';

/**
 * 默认快捷键命令实现
 */
export class QuickCodeReviewCommand implements IShortcutCommand {
    public readonly id = 'quickCodeReview';
    public readonly name = 'Quick Code Review';
    public readonly description = '快速代码审查 - 分析当前文件的代码质量';
    public readonly keybinding = 'ctrl+shift+r';
    public readonly category = 'Code Quality';
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('请先打开一个文件');
            return;
        }

        const document = editor.document;
        const fileName = document.fileName.split('/').pop();
        
        vscode.window.showInformationMessage(`正在分析 ${fileName} 的代码质量...`);
        
        // 这里可以集成AI服务进行代码分析
        // 例如：调用Ollama服务分析代码
        setTimeout(() => {
            vscode.window.showInformationMessage(`${fileName} 代码分析完成！`);
        }, 2000);
    }
}

/**
 * 默认上下文菜单项实现
 */
export class ExplainCodeContextMenu implements IContextMenuItem {
    public readonly id = 'explainCode';
    public readonly name = 'Explain Code';
    public readonly description = '解释选中的代码';
    public readonly title = '解释代码';
    public readonly icon = '$(lightbulb)';
    public readonly when = 'editorHasSelection';
    public readonly group = 'ai@1';
    public readonly order = 1;
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text.trim()) {
            vscode.window.showInformationMessage('请先选择要解释的代码');
            return;
        }

        vscode.window.showInformationMessage('正在使用AI解释选中的代码...');
        
        // 这里可以集成AI服务解释代码
        // 例如：调用Ollama服务解释代码
        setTimeout(() => {
            vscode.window.showInformationMessage('代码解释完成！');
        }, 2000);
    }
}

/**
 * 文件类型相关的上下文菜单项
 */
export class OptimizeCodeContextMenu implements IContextMenuItem {
    public readonly id = 'optimizeCode';
    public readonly name = 'Optimize Code';
    public readonly description = '优化当前文件的代码';
    public readonly title = '优化代码';
    public readonly icon = '$(zap)';
    public readonly when = 'resourceExtname == .js || resourceExtname == .ts || resourceExtname == .py';
    public readonly group = 'ai@2';
    public readonly order = 1;
    public enabled = true;

    async execute(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const fileName = document.fileName.split('/').pop();
        
        vscode.window.showInformationMessage(`正在优化 ${fileName} 的代码...`);
        
        // 这里可以集成AI服务优化代码
        // 例如：调用Ollama服务提供优化建议
        setTimeout(() => {
            vscode.window.showInformationMessage(`${fileName} 代码优化建议已生成！`);
        }, 2000);
    }
}

/**
 * 获取所有默认功能
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

