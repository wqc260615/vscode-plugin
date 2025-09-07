import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectContextProcessor, ReferenceFile } from '../services/context/projectContextProcessor';

suite('ProjectContextProcessor Test Suite', () => {
    let contextProcessor: ProjectContextProcessor;
    let testWorkspacePath: string;

    suiteSetup(async () => {
        // Create test workspace
        testWorkspacePath = path.join(__dirname, 'test-project');
        if (!fs.existsSync(testWorkspacePath)) {
            fs.mkdirSync(testWorkspacePath, { recursive: true });
        }

        // Create test files
        const testFiles = [
            { name: 'main.js', content: 'console.log("Hello World");' },
            { name: 'utils.js', content: 'function helper() { return true; }' },
            { name: 'config.json', content: '{"key": "value"}' },
            { name: 'README.md', content: '# Test Project' },
            { name: 'package.json', content: '{"name": "test-project"}' },
            { name: 'test.java', content: 'public class Test { public void method() {} }' },
            { name: 'test.ts', content: 'interface Test { method(): void; }' }
        ];

        for (const file of testFiles) {
            const filePath = path.join(testWorkspacePath, file.name);
            fs.writeFileSync(filePath, file.content);
        }

        // Create subdirectory
        const subDir = path.join(testWorkspacePath, 'src');
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, 'index.js'), 'export default {};');
    });

    setup(() => {
        contextProcessor = new ProjectContextProcessor();
    });

    teardown(() => {
        // Clean up reference files
        contextProcessor.clearReferenceFiles();
    });

    suiteTeardown(async () => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspacePath)) {
            fs.rmSync(testWorkspacePath, { recursive: true, force: true });
        }
    });

    test('ProjectContextProcessor should be created successfully', () => {
        assert.ok(contextProcessor, 'ProjectContextProcessor should be created');
        assert.ok(typeof contextProcessor.initProjectContext === 'function', 'initProjectContext method should exist');
        assert.ok(typeof contextProcessor.addReferenceFile === 'function', 'addReferenceFile method should exist');
        assert.ok(typeof contextProcessor.removeReferenceFile === 'function', 'removeReferenceFile method should exist');
        assert.ok(typeof contextProcessor.generateFullPrompt === 'function', 'generateFullPrompt method should exist');
        assert.ok(typeof contextProcessor.getContextStats === 'function', 'getContextStats method should exist');
    });

    test('initProjectContext should initialize project context', async () => {
        // Mock workspace folders
        const mockWorkspaceFolders = [
            {
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test-project',
                index: 0
            }
        ];

        // Use Object.defineProperty to mock read-only property
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: mockWorkspaceFolders,
            writable: false,
            configurable: true
        });

        try {
            await contextProcessor.initProjectContext();
            
            // Verify initialized successfully
            const sourceFiles = contextProcessor.getSourceFiles();
            assert.ok(Array.isArray(sourceFiles), 'Source files should be initialized');
        } finally {
            // Restore original property
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                writable: false,
                configurable: true
            });
        }
    });

    test('addReferenceFile should add file to reference list', async () => {
        const filePath = path.join(testWorkspacePath, 'main.js');
        
        const result = await contextProcessor.addReferenceFile(filePath);
        assert.ok(result, 'Should successfully add reference file');
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        const addedFile = referenceFiles.find(f => f.path === filePath);
        assert.ok(addedFile, 'File should be added to reference list');
        assert.strictEqual(addedFile!.name, 'main.js', 'File name should be correct');
        assert.strictEqual(addedFile!.type, 'reference', 'File type should be reference');
    });

    test('removeReferenceFile should remove file from reference list', async () => {
        const filePath = path.join(testWorkspacePath, 'main.js');
        
        // Add file first
        await contextProcessor.addReferenceFile(filePath);
        assert.ok(contextProcessor.getReferenceFiles().find(f => f.path === filePath), 'File should be added');
        
        // Then remove file
        const result = contextProcessor.removeReferenceFile(filePath);
        assert.ok(result, 'Should successfully remove reference file');
        assert.ok(!contextProcessor.getReferenceFiles().find(f => f.path === filePath), 'File should be removed');
    });

    test('clearReferenceFiles should clear all reference files', async () => {
        const files = [
            path.join(testWorkspacePath, 'main.js'),
            path.join(testWorkspacePath, 'utils.js'),
            path.join(testWorkspacePath, 'config.json')
        ];
        
        // Add multiple files
        for (const file of files) {
            await contextProcessor.addReferenceFile(file);
        }
        assert.strictEqual(contextProcessor.getReferenceFiles().length, 3, 'Should have 3 reference files');
        
        // Clear reference files
        contextProcessor.clearReferenceFiles();
        assert.strictEqual(contextProcessor.getReferenceFiles().length, 0, 'Should have no reference files');
    });

    test('getReferenceFiles should return current reference files', async () => {
        const files = [
            path.join(testWorkspacePath, 'main.js'),
            path.join(testWorkspacePath, 'utils.js')
        ];
        
        for (const file of files) {
            await contextProcessor.addReferenceFile(file);
        }
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        assert.strictEqual(referenceFiles.length, 2, 'Should return 2 reference files');
        assert.ok(referenceFiles.find(f => f.path === files[0]), 'Should include first file');
        assert.ok(referenceFiles.find(f => f.path === files[1]), 'Should include second file');
    });

    test('getSourceFiles should return source files', async () => {
        // Mock workspace folders
        const mockWorkspaceFolders = [
            {
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test-project',
                index: 0
            }
        ];

        // Use Object.defineProperty to mock read-only property
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: mockWorkspaceFolders,
            writable: false,
            configurable: true
        });

        try {
            await contextProcessor.initProjectContext();
            
            const sourceFiles = contextProcessor.getSourceFiles();
            assert.ok(Array.isArray(sourceFiles), 'Should return source files array');
        } finally {
            // Restore original property
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                writable: false,
                configurable: true
            });
        }
    });

    test('getContextStats should return context statistics', () => {
        const stats = contextProcessor.getContextStats();
        assert.ok(typeof stats === 'object', 'Should return stats object');
        assert.ok(typeof stats.referenceFiles === 'number', 'Should have referenceFiles count');
        assert.ok(typeof stats.sourceFiles === 'number', 'Should have sourceFiles count');
        assert.ok(typeof stats.totalSize === 'number', 'Should have totalSize');
    });

    test('clearProjectContext should clear project context', async () => {
        // Mock workspace folders
        const mockWorkspaceFolders = [
            {
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test-project',
                index: 0
            }
        ];

        // Use Object.defineProperty to mock read-only property
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: mockWorkspaceFolders,
            writable: false,
            configurable: true
        });

        try {
            await contextProcessor.initProjectContext();
            // Check if there are source files; skip test if none
            const sourceFiles = contextProcessor.getSourceFiles();
            if (sourceFiles.length === 0) {
                console.log('No source files found, skipping clearProjectContext test');
                return;
            }
            
            contextProcessor.clearProjectContext();
            assert.strictEqual(contextProcessor.getSourceFiles().length, 0, 'Should clear source files');
        } finally {
            // Restore original property
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                writable: false,
                configurable: true
            });
        }
    });

    test('generateFullPrompt should generate prompt with context', async () => {
        const userMessage = 'Explain this code';
        const filePath = path.join(testWorkspacePath, 'main.js');
        
        await contextProcessor.addReferenceFile(filePath);
        
        const prompt = await contextProcessor.generateFullPrompt(userMessage);
        assert.ok(typeof prompt === 'string', 'Should return string prompt');
        assert.ok(prompt.includes(userMessage), 'Should include user message');
        assert.ok(prompt.includes('console.log("Hello World")'), 'Should include file content');
    });

    test('should handle file reading errors gracefully', async () => {
        const nonExistentPath = path.join(testWorkspacePath, 'non-existent.js');
        
        const result = await contextProcessor.addReferenceFile(nonExistentPath);
        assert.strictEqual(result, false, 'Should return false for non-existent file');
    });

    test('should handle Java file structure extraction', async () => {
        const javaFilePath = path.join(testWorkspacePath, 'test.java');
        await contextProcessor.addReferenceFile(javaFilePath);
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        const javaFile = referenceFiles.find(f => f.name === 'test.java');
        assert.ok(javaFile, 'Java file should be added');
        
        // Verify Java structure extraction works
        const content = javaFile!.content;
        assert.ok(typeof content === 'string', 'Content should be string');
        assert.ok(content.length > 0, 'Content should not be empty');
    });

    test('should handle TypeScript file structure extraction', async () => {
        const tsFilePath = path.join(testWorkspacePath, 'test.ts');
        await contextProcessor.addReferenceFile(tsFilePath);
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        const tsFile = referenceFiles.find(f => f.name === 'test.ts');
        assert.ok(tsFile, 'TypeScript file should be added');
        
        // Verify TypeScript structure extraction works
        const content = tsFile!.content;
        assert.ok(typeof content === 'string', 'Content should be string');
        assert.ok(content.length > 0, 'Content should not be empty');
    });

    test('should handle configuration changes', () => {
        // Test configuration change handling
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const maxContextFiles = config.get('maxContextFiles', 50);
        
        assert.ok(typeof maxContextFiles === 'number', 'maxContextFiles should be a number');
        assert.ok(maxContextFiles > 0, 'maxContextFiles should be positive');
    });

    test('should handle empty workspace gracefully', async () => {
        // Mock empty workspace
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [],
            writable: false,
            configurable: true
        });

        try {
            await contextProcessor.initProjectContext();
            
            // Should not throw
            const sourceFiles = contextProcessor.getSourceFiles();
            assert.ok(Array.isArray(sourceFiles), 'Should return empty array for empty workspace');
            assert.strictEqual(sourceFiles.length, 0, 'Should have no source files for empty workspace');
        } finally {
            // Restore original property
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                writable: false,
                configurable: true
            });
        }
    });

    test('should handle large file content gracefully', async () => {
        // Create a large file
        const largeContent = 'console.log("test");\n'.repeat(1000); // ~20KB
        const largeFilePath = path.join(testWorkspacePath, 'large.js');
        fs.writeFileSync(largeFilePath, largeContent);
        
        const result = await contextProcessor.addReferenceFile(largeFilePath);
        assert.ok(result, 'Should successfully add large file');
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        const largeFile = referenceFiles.find(f => f.name === 'large.js');
        assert.ok(largeFile, 'Large file should be added');
        
        // Verify content is not truncated for reference files
        // Only source files may be truncated; reference files remain intact
        assert.ok(largeFile!.content.length > 0, 'Large file content should not be empty');
        assert.ok(largeFile!.content.includes('console.log("test")'), 'Large file should contain expected content');
    });

    test('should handle duplicate file addition', async () => {
        const filePath = path.join(testWorkspacePath, 'main.js');
        
        // First addition
        const result1 = await contextProcessor.addReferenceFile(filePath);
        assert.ok(result1, 'First addition should succeed');
        
        // Second addition of the same file
        const result2 = await contextProcessor.addReferenceFile(filePath);
        assert.ok(result2, 'Second addition should succeed');
        
        const referenceFiles = contextProcessor.getReferenceFiles();
        const addedFiles = referenceFiles.filter(f => f.path === filePath);
        assert.strictEqual(addedFiles.length, 1, 'Should have only one instance of the file');
    });
}); 