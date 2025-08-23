export interface IExtensibleFeature {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    execute(...args: any[]): Promise<void> | void;
}

export interface IShortcutCommand extends IExtensibleFeature {
    keybinding: string;
    when?: string;
    category: string;
}

export interface IContextMenuItem extends IExtensibleFeature {
    title: string;
    icon?: string;
    when?: string;
    group?: string;
    order?: number;
}

