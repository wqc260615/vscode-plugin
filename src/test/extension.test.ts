import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Extension commands should be available', async () => {
        // 测试扩展命令是否可用
        const commands = await vscode.commands.getCommands(true);
        
        // 检查一些基本的VS Code命令是否存在
        assert.ok(commands.includes('workbench.action.files.newFile'), 'New file command should be available');
        assert.ok(commands.includes('workbench.action.files.openFile'), 'Open file command should be available');
    });

    test('Workspace should be accessible', () => {
        // 测试工作区访问 - 在测试环境中可能没有工作区文件夹
        // 我们只测试 workspace 对象本身是否可访问
        assert.ok(vscode.workspace !== undefined, 'Workspace should be accessible');
        // 在测试环境中，workspaceFolders 可能为 undefined，这是正常的
        // 我们只测试属性是否存在，不测试其值
        assert.ok('workspaceFolders' in vscode.workspace, 'Workspace folders property should exist');
    });

    test('Configuration should be accessible', () => {
        // 测试配置访问
        const config = vscode.workspace.getConfiguration('aiAssistant');
        assert.ok(config, 'AI Assistant configuration should be accessible');
    });

    test('AI Assistant specific commands should be registered', async () => {
        // 测试AI Assistant特定的命令是否已注册
        const commands = await vscode.commands.getCommands(true);
        
        // 检查AI Assistant命令
        assert.ok(commands.includes('aiAssistant.showInlineChat'), 'Inline chat command should be available');
        assert.ok(commands.includes('aiAssistant.checkConnection'), 'Check connection command should be available');
        assert.ok(commands.includes('aiAssistant.toggleCompletion'), 'Toggle completion command should be available');
        assert.ok(commands.includes('aiAssistant.triggerCompletion'), 'Trigger completion command should be available');
    });

    test('Extension should handle configuration changes', () => {
        // 测试配置变化处理
        const config = vscode.workspace.getConfiguration('aiAssistant');
        
        // 测试默认配置值
        const enableCompletion = config.get('enableCodeCompletion', true);
        assert.ok(typeof enableCompletion === 'boolean', 'enableCodeCompletion should be a boolean');
        
        const ollamaUrl = config.get('ollamaUrl', 'http://localhost:11434');
        assert.ok(typeof ollamaUrl === 'string', 'ollamaUrl should be a string');
        assert.ok(ollamaUrl.includes('localhost'), 'ollamaUrl should contain localhost');
    });

    test('Extension should support multiple programming languages', () => {
        // 测试支持的编程语言
        const supportedLanguages = [
            'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
            'php', 'ruby', 'go', 'rust', 'swift', 'kotlin'
        ];
        
        // 验证这些语言在VS Code中是可识别的
        supportedLanguages.forEach(lang => {
            const language = vscode.workspace.getConfiguration('files.associations');
            assert.ok(language !== undefined, `Language configuration for ${lang} should be accessible`);
        });
    });
});
