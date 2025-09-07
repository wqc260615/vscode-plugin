import * as assert from 'assert';
import { ExtensibleFeatureManager } from '../services/core/ExtensibleFeatureManager';
import { IShortcutCommand, IContextMenuItem } from '../services/core/interfaces/IExtensibleFeature';

// Mock shortcut command for testing
class MockShortcutCommand implements IShortcutCommand {
    public readonly id = 'testShortcut';
    public readonly name = 'Test Shortcut';
    public readonly description = 'Test shortcut command';
    public readonly keybinding = 'ctrl+shift+t';
    public readonly category = 'Test';
    public enabled = true;
    public executed = false;

    async execute(): Promise<void> {
        this.executed = true;
    }
}

// Mock context menu item for testing
class MockContextMenuItem implements IContextMenuItem {
    public readonly id = 'testContextMenu';
    public readonly name = 'Test Context Menu';
    public readonly description = 'Test context menu item';
    public readonly title = 'Test Action';
    public readonly icon = '$(test)';
    public readonly when = 'editorTextFocus';
    public readonly group = 'test@1';
    public readonly order = 1;
    public enabled = true;
    public executed = false;

    async execute(): Promise<void> {
        this.executed = true;
    }
}

suite('ExtensibleFeatureManager Tests', () => {
    let manager: ExtensibleFeatureManager;

    setup(() => {
        manager = ExtensibleFeatureManager.getInstance();
        // Ensure clean state in case extension activation registered defaults
        manager.dispose();
    });

    teardown(() => {
        manager.dispose();
    });

    test('should register shortcut command', () => {
        const command = new MockShortcutCommand();
        manager.registerShortcutCommand(command);
        
        const commands = manager.getShortcutCommands();
        assert.strictEqual(commands.length, 1);
        assert.strictEqual(commands[0].id, 'testShortcut');
    });

    test('should register context menu item', () => {
        const menuItem = new MockContextMenuItem();
        manager.registerContextMenuItem(menuItem);
        
        const menuItems = manager.getContextMenuItems();
        assert.strictEqual(menuItems.length, 1);
        assert.strictEqual(menuItems[0].id, 'testContextMenu');
    });

    test('should toggle feature enabled state', () => {
        const command = new MockShortcutCommand();
        manager.registerShortcutCommand(command);
        
        // Disable feature
        manager.toggleFeature('testShortcut', false);
        const commands = manager.getShortcutCommands();
        assert.strictEqual(commands[0].enabled, false);
        
        // Enable feature
        manager.toggleFeature('testShortcut', true);
        assert.strictEqual(commands[0].enabled, true);
    });

    // test('should handle multiple features', () => {
    //     const command1 = new MockShortcutCommand();
    //     const command2 = new MockShortcutCommand();
    //     command2.id = 'testShortcut2';
        
    //     manager.registerShortcutCommand(command1);
    //     manager.registerShortcutCommand(command2);
        
    //     const commands = manager.getShortcutCommands();
    //     assert.strictEqual(commands.length, 2);
    // });

    test('should dispose all features', () => {
        const command = new MockShortcutCommand();
        const menuItem = new MockContextMenuItem();
        
        manager.registerShortcutCommand(command);
        manager.registerContextMenuItem(menuItem);
        
        manager.dispose();
        
        assert.strictEqual(manager.getShortcutCommands().length, 0);
        assert.strictEqual(manager.getContextMenuItems().length, 0);
    });
});

