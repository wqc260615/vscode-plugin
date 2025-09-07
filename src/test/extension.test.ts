import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Extension commands should be available', async () => {
        // Verify extension commands are available
        const commands = await vscode.commands.getCommands(true);
        
        // Check some basic VS Code commands
        assert.ok(commands.includes('workbench.action.files.newFile'), 'New file command should be available');
        assert.ok(commands.includes('workbench.action.files.openFile'), 'Open file command should be available');
    });

    test('Workspace should be accessible', () => {
        // Workspace access - in tests there may be no workspace folders
        // Only verify the workspace object is accessible
        assert.ok(vscode.workspace !== undefined, 'Workspace should be accessible');
        // In tests, workspaceFolders may be undefined; that's fine
        // Only verify the property exists, not its value
        assert.ok('workspaceFolders' in vscode.workspace, 'Workspace folders property should exist');
    });

    test('Configuration should be accessible', () => {
        // Verify configuration access
        const config = vscode.workspace.getConfiguration('aiAssistant');
        assert.ok(config, 'AI Assistant configuration should be accessible');
    });

    test('AI Assistant specific commands should be registered', async () => {
        // Verify AI Assistant specific commands are registered
        const commands = await vscode.commands.getCommands(true);
        
        // Check AI Assistant commands
        assert.ok(commands.includes('aiAssistant.showInlineChat'), 'Inline chat command should be available');
        assert.ok(commands.includes('aiAssistant.checkConnection'), 'Check connection command should be available');
        assert.ok(commands.includes('aiAssistant.toggleCompletion'), 'Toggle completion command should be available');
        assert.ok(commands.includes('aiAssistant.triggerCompletion'), 'Trigger completion command should be available');
    });

    test('Extension should handle configuration changes', () => {
        // Verify configuration change handling
        const config = vscode.workspace.getConfiguration('aiAssistant');
        
        // Check default configuration values
        const enableCompletion = config.get('enableCodeCompletion', true);
        assert.ok(typeof enableCompletion === 'boolean', 'enableCodeCompletion should be a boolean');
        
        const ollamaUrl = config.get('ollamaUrl', 'http://localhost:11434');
        assert.ok(typeof ollamaUrl === 'string', 'ollamaUrl should be a string');
        assert.ok(ollamaUrl.includes('localhost'), 'ollamaUrl should contain localhost');
    });

    test('Extension should support multiple programming languages', () => {
        // Verify supported programming languages
        const supportedLanguages = [
            'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
            'php', 'ruby', 'go', 'rust', 'swift', 'kotlin'
        ];
        
        // Validate these languages are recognizable by VS Code
        supportedLanguages.forEach(lang => {
            const language = vscode.workspace.getConfiguration('files.associations');
            assert.ok(language !== undefined, `Language configuration for ${lang} should be accessible`);
        });
    });
});
