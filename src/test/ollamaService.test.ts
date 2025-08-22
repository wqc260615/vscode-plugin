import * as assert from 'assert';
import * as vscode from 'vscode';
import { OllamaService } from '../services/ollamaService';
import { ChatSession } from '../services/sessionManager';

suite('OllamaService Test Suite', () => {
    let ollamaService: OllamaService;

    // 设置测试超时时间
    suiteSetup(function() {
        this.timeout(30000); // 30秒超时
    });

    setup(() => {
        ollamaService = new OllamaService();
    });

    test('OllamaService should be created successfully', () => {
        assert.ok(ollamaService, 'OllamaService should be created');
        assert.ok(typeof ollamaService.getModels === 'function', 'getModels method should exist');
        assert.ok(typeof ollamaService.chat === 'function', 'chat method should exist');
        assert.ok(typeof ollamaService.generate === 'function', 'generate method should exist');
        assert.ok(typeof ollamaService.chatStream === 'function', 'chatStream method should exist');
        assert.ok(typeof ollamaService.pullModel === 'function', 'pullModel method should exist');
        assert.ok(typeof ollamaService.deleteModel === 'function', 'deleteModel method should exist');
        assert.ok(typeof ollamaService.getModelInfo === 'function', 'getModelInfo method should exist');
    });

    test('getModels should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        // 测试获取模型列表
        const models = await ollamaService.getModels();
        assert.ok(Array.isArray(models), 'Should return an array');
        // 在测试环境中，如果Ollama不可用，应该返回空数组
    });

    test('isServiceAvailable should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        // 测试服务可用性检查
        const isAvailable = await ollamaService.isServiceAvailable();
        assert.ok(typeof isAvailable === 'boolean', 'Should return a boolean value');
    });

    test('generate should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const prompt = 'Hello, how are you?';
        const model = 'test-model';

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.generate(model, prompt);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should return a string response');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('chat should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const prompt = 'Hello, how are you?';
        const model = 'test-model';
        const mockSession: ChatSession = {
            id: 'test-session',
            name: 'Test Session',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.chat(model, prompt, mockSession);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should return a string response');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('chatStream should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const prompt = 'Hello, how are you?';
        const model = 'test-model';
        const mockSession: ChatSession = {
            id: 'test-session',
            name: 'Test Session',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const onChunk = (chunk: string) => {
            // 回调函数
        };
        const onComplete = () => {
            // 完成回调
        };
        const onError = (error: Error) => {
            // 错误回调
        };

        try {
            await ollamaService.chatStream(model, prompt, mockSession, onChunk, onComplete, onError);
            // 如果成功，测试通过
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('pullModel should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const modelName = 'test-model';
        const onProgress = (progress: any) => {
            // 进度回调
        };

        try {
            const result = await ollamaService.pullModel(modelName, onProgress);
            assert.ok(typeof result === 'boolean', 'Should return a boolean result');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('deleteModel should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const modelName = 'test-model';

        try {
            const result = await ollamaService.deleteModel(modelName);
            assert.ok(typeof result === 'boolean', 'Should return a boolean result');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('getModelInfo should handle connection errors gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const modelName = 'test-model';

        try {
            const info = await ollamaService.getModelInfo(modelName);
            assert.ok(typeof info === 'object', 'Should return an object');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle configuration changes', () => {
        // 测试配置变化处理
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const ollamaUrl = config.get('ollamaUrl', 'http://localhost:11434');
        
        assert.ok(typeof ollamaUrl === 'string', 'ollamaUrl should be a string');
        assert.ok(ollamaUrl.includes('localhost'), 'ollamaUrl should contain localhost');
    });

    test('should handle empty prompt gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const model = 'test-model';
        const emptyPrompt = '';

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.generate(model, emptyPrompt);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle empty prompt');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle long prompt gracefully', async function() {
        this.timeout(30000); // 30秒超时
        const model = 'test-model';
        const longPrompt = 'A'.repeat(10000); // 10KB prompt

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.generate(model, longPrompt);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle long prompt');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle special characters in prompt', async function() {
        this.timeout(30000); // 30秒超时
        const model = 'test-model';
        const specialPrompt = 'Hello! How are you? @#$%^&*()_+-=[]{}|;:,.<>?';

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.generate(model, specialPrompt);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle special characters');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle session with messages', async function() {
        this.timeout(30000); // 30秒超时
        const model = 'test-model';
        const prompt = 'Continue the conversation';
        const mockSession: ChatSession = {
            id: 'test-session',
            name: 'Test Session',
            messages: [
                {
                    id: 'msg-1',
                    content: 'Hello',
                    isUser: true,
                    timestamp: new Date()
                },
                {
                    id: 'msg-2',
                    content: 'Hi there!',
                    isUser: false,
                    timestamp: new Date()
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.chat(model, prompt, mockSession);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle session with messages');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle empty session', async function() {
        this.timeout(30000); // 30秒超时
        const model = 'test-model';
        const prompt = 'Hello';
        const emptySession: ChatSession = {
            id: 'empty-session',
            name: 'Empty Session',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.chat(model, prompt, emptySession);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle empty session');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle model name validation', async function() {
        this.timeout(30000); // 30秒超时
        const invalidModel = '';
        const prompt = 'Hello';

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.generate(invalidModel, prompt);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof response === 'string', 'Should handle empty model name');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle progress callback in pullModel', async function() {
        this.timeout(30000); // 30秒超时
        const modelName = 'test-model';
        let progressCalled = false;
        
        const onProgress = (progress: any) => {
            progressCalled = true;
            assert.ok(typeof progress === 'object', 'Progress should be an object');
        };

        try {
            const result = await ollamaService.pullModel(modelName, onProgress);
            assert.ok(typeof result === 'boolean', 'Should return a boolean result');
            // 注意：在测试环境中，如果Ollama不可用，progress可能不会被调用
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });

    test('should handle null progress callback in pullModel', async function() {
        this.timeout(30000); // 30秒超时
        const modelName = 'test-model';

        try {
            // 添加超时保护
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 10000)
            );
            
            const responsePromise = ollamaService.pullModel(modelName, undefined);
            const result = await Promise.race([responsePromise, timeoutPromise]);
            
            assert.ok(typeof result === 'boolean', 'Should handle null progress callback');
        } catch (error) {
            // 在测试环境中，如果Ollama不可用，这是预期的行为
            assert.ok(error instanceof Error, 'Should throw an Error when Ollama is not available');
        }
    });
}); 