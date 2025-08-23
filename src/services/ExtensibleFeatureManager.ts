import * as vscode from 'vscode';
import { IExtensibleFeature, IShortcutCommand, IContextMenuItem } from './interfaces/IExtensibleFeature';

export class ExtensibleFeatureManager {
    private static instance: ExtensibleFeatureManager;
    private shortcutCommands: Map<string, IShortcutCommand> = new Map();
    private contextMenuItems: Map<string, IContextMenuItem> = new Map();
    private disposables: vscode.Disposable[] = [];

    private constructor() {}

    public static getInstance(): ExtensibleFeatureManager {
        if (!ExtensibleFeatureManager.instance) {
            ExtensibleFeatureManager.instance = new ExtensibleFeatureManager();
        }
        return ExtensibleFeatureManager.instance;
    }

    /**
     * 注册快捷键命令
     */
    public registerShortcutCommand(command: IShortcutCommand): void {
        this.shortcutCommands.set(command.id, command);
        this.registerCommand(command);
    }

    /**
     * 注册上下文菜单项
     */
    public registerContextMenuItem(item: IContextMenuItem): void {
        this.contextMenuItems.set(item.id, item);
        this.registerContextMenu(item);
    }

    /**
     * 获取所有快捷键命令
     */
    public getShortcutCommands(): IShortcutCommand[] {
        return Array.from(this.shortcutCommands.values());
    }

    /**
     * 获取所有上下文菜单项
     */
    public getContextMenuItems(): IContextMenuItem[] {
        return Array.from(this.contextMenuItems.values());
    }

    /**
     * 启用/禁用功能
     */
    public toggleFeature(id: string, enabled: boolean): void {
        const shortcut = this.shortcutCommands.get(id);
        if (shortcut) {
            shortcut.enabled = enabled;
            this.updateShortcutRegistration(shortcut);
            return;
        }

        const contextItem = this.contextMenuItems.get(id);
        if (contextItem) {
            contextItem.enabled = enabled;
            this.updateContextMenuRegistration(contextItem);
        }
    }

    /**
     * 清理所有注册
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.shortcutCommands.clear();
        this.contextMenuItems.clear();
    }

    private registerCommand(command: IShortcutCommand): void {
        if (!command.enabled) return;

        const disposable = vscode.commands.registerCommand(
            `aiAssistant.extensible.${command.id}`,
            (...args: any[]) => command.execute(...args)
        );
        this.disposables.push(disposable);
    }

    private registerContextMenu(item: IContextMenuItem): void {
        if (!item.enabled) return;

        const disposable = vscode.commands.registerCommand(
            `aiAssistant.contextMenu.${item.id}`,
            (...args: any[]) => item.execute(...args)
        );
        this.disposables.push(disposable);
    }

    private updateShortcutRegistration(command: IShortcutCommand): void {
        // 重新注册快捷键
        this.disposables = this.disposables.filter(d => d.dispose);
        this.registerCommand(command);
    }

    private updateContextMenuRegistration(item: IContextMenuItem): void {
        // 重新注册上下文菜单
        this.disposables = this.disposables.filter(d => d.dispose);
        this.registerContextMenu(item);
    }
}

