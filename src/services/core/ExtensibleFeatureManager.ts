import * as vscode from 'vscode';
import { IExtensibleFeature, IShortcutCommand, IContextMenuItem } from './interfaces/IExtensibleFeature';

export class ExtensibleFeatureManager {
    private static instance: ExtensibleFeatureManager;
    private shortcutCommands: Map<string, IShortcutCommand> = new Map();
    private contextMenuItems: Map<string, IContextMenuItem> = new Map();
    private disposables: vscode.Disposable[] = [];
    private commandDisposables: Map<string, vscode.Disposable> = new Map();
    private contextMenuDisposables: Map<string, vscode.Disposable> = new Map();

    private constructor() {}

    public static getInstance(): ExtensibleFeatureManager {
        if (!ExtensibleFeatureManager.instance) {
            ExtensibleFeatureManager.instance = new ExtensibleFeatureManager();
        }
        return ExtensibleFeatureManager.instance;
    }

    /**
     * Register shortcut command
     */
    public registerShortcutCommand(command: IShortcutCommand): void {
        this.shortcutCommands.set(command.id, command);
        this.updateShortcutRegistration(command);
    }

    /**
     * Register context menu item
     */
    public registerContextMenuItem(item: IContextMenuItem): void {
        this.contextMenuItems.set(item.id, item);
        this.updateContextMenuRegistration(item);
    }

    /**
     * Get all shortcut commands
     */
    public getShortcutCommands(): IShortcutCommand[] {
        return Array.from(this.shortcutCommands.values());
    }

    /**
     * Get all context menu items
     */
    public getContextMenuItems(): IContextMenuItem[] {
        return Array.from(this.contextMenuItems.values());
    }

    /**
     * Enable/disable feature
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
     * Clean up all registrations
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.commandDisposables.forEach(d => d.dispose());
        this.commandDisposables.clear();
        this.contextMenuDisposables.forEach(d => d.dispose());
        this.contextMenuDisposables.clear();
        this.shortcutCommands.clear();
        this.contextMenuItems.clear();
    }

    private registerCommand(command: IShortcutCommand): void {
        if (!command.enabled) {
            return;
        }
        // Dispose prior registration for this id if exists to avoid duplicate command error
        const existing = this.commandDisposables.get(command.id);
        if (existing) {
            existing.dispose();
            this.commandDisposables.delete(command.id);
        }

        const disposable = vscode.commands.registerCommand(
            `aiAssistant.extensible.${command.id}`,
            (...args: any[]) => command.execute(...args)
        );
        this.disposables.push(disposable);
        this.commandDisposables.set(command.id, disposable);
    }

    private registerContextMenu(item: IContextMenuItem): void {
        if (!item.enabled) {
            return;
        }
        // Dispose prior registration for this id if exists to avoid duplicate command error
        const existing = this.contextMenuDisposables.get(item.id);
        if (existing) {
            existing.dispose();
            this.contextMenuDisposables.delete(item.id);
        }

        const disposable = vscode.commands.registerCommand(
            `aiAssistant.contextMenu.${item.id}`,
            (...args: any[]) => item.execute(...args)
        );
        this.disposables.push(disposable);
        this.contextMenuDisposables.set(item.id, disposable);
    }

    private updateShortcutRegistration(command: IShortcutCommand): void {
        // Re-register shortcut: if disabled, dispose; if enabled, (re)register
        const existing = this.commandDisposables.get(command.id);
        if (existing) {
            existing.dispose();
            this.commandDisposables.delete(command.id);
        }
        if (command.enabled) {
            this.registerCommand(command);
        }
    }

    private updateContextMenuRegistration(item: IContextMenuItem): void {
        // Re-register context menu: if disabled, dispose; if enabled, (re)register
        const existing = this.contextMenuDisposables.get(item.id);
        if (existing) {
            existing.dispose();
            this.contextMenuDisposables.delete(item.id);
        }
        if (item.enabled) {
            this.registerContextMenu(item);
        }
    }
}

