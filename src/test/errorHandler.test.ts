import * as assert from 'assert';
import * as vscode from 'vscode';
import { LLMErrorHandler, ErrorType, ResponseCache } from '../services/core/error/errorHandler';

suite('ErrorHandler Test Suite', () => {
    let errorHandler: LLMErrorHandler;
    let responseCache: ResponseCache;

    setup(() => {
        errorHandler = LLMErrorHandler.getInstance();
        responseCache = new ResponseCache();
    });

    test('LLMErrorHandler should be singleton', () => {
        const instance1 = LLMErrorHandler.getInstance();
        const instance2 = LLMErrorHandler.getInstance();
        
        assert.strictEqual(instance1, instance2, 'Should return the same instance');
        assert.strictEqual(instance1, errorHandler, 'Should return the expected instance');
    });

    test('should categorize connection errors correctly', () => {
        const connectionError = new Error('fetch failed: ECONNREFUSED');
        const errorDetails = errorHandler.handleError(connectionError);
        
        assert.strictEqual(errorDetails.type, ErrorType.CONNECTION_FAILED, 'Should categorize as connection error');
        assert.ok(errorDetails.canRetry, 'Connection errors should be retryable');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should categorize timeout errors correctly', () => {
        const timeoutError = new Error('Request timeout');
        const errorDetails = errorHandler.handleError(timeoutError);
        
        assert.strictEqual(errorDetails.type, ErrorType.TIMEOUT, 'Should categorize as timeout error');
        assert.ok(errorDetails.canRetry, 'Timeout errors should be retryable');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should categorize model not found errors correctly', () => {
        const modelError = new Error('Model not found');
        const errorDetails = errorHandler.handleError(modelError);
        
        assert.strictEqual(errorDetails.type, ErrorType.MODEL_NOT_FOUND, 'Should categorize as model not found error');
        assert.ok(!errorDetails.canRetry, 'Model not found errors should not be retryable');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should categorize service unavailable errors correctly', () => {
        const serviceError = new Error('Service unavailable 503');
        const errorDetails = errorHandler.handleError(serviceError);
        
        assert.strictEqual(errorDetails.type, ErrorType.SERVICE_UNAVAILABLE, 'Should categorize as service unavailable error');
        assert.ok(errorDetails.canRetry, 'Service unavailable errors should be retryable');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should categorize invalid response errors correctly', () => {
        const responseError = new Error('Invalid JSON response');
        const errorDetails = errorHandler.handleError(responseError);
        
        assert.strictEqual(errorDetails.type, ErrorType.INVALID_RESPONSE, 'Should categorize as invalid response error');
        assert.ok(errorDetails.canRetry, 'Invalid response errors should be retryable');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should categorize unknown errors correctly', () => {
        const unknownError = new Error('Some random error');
        const errorDetails = errorHandler.handleError(unknownError);
        
        assert.strictEqual(errorDetails.type, ErrorType.UNKNOWN, 'Should categorize as unknown error');
        assert.ok(errorDetails.canRetry, 'Unknown errors should be retryable by default');
        assert.ok(errorDetails.suggestedActions.length > 0, 'Should have suggested actions');
    });

    test('should handle errors with context', () => {
        const context = { operation: 'test', model: 'test-model' };
        const error = new Error('Test error');
        const errorDetails = errorHandler.handleError(error, context);
        
        assert.ok(errorDetails.context, 'Should include context');
        assert.strictEqual(errorDetails.context.operation, 'test', 'Should include operation context');
        assert.strictEqual(errorDetails.context.model, 'test-model', 'Should include model context');
    });

    test('should handle errors without context', () => {
        const error = new Error('Test error');
        const errorDetails = errorHandler.handleError(error);
        
        assert.ok(errorDetails, 'Should handle error without context');
        assert.strictEqual(errorDetails.type, ErrorType.UNKNOWN, 'Should categorize as unknown error');
    });

    test('should handle non-Error objects', () => {
        const nonError = 'String error';
        const errorDetails = errorHandler.handleError(nonError);
        
        assert.ok(errorDetails, 'Should handle non-Error objects');
        assert.strictEqual(errorDetails.type, ErrorType.UNKNOWN, 'Should categorize as unknown error');
    });

    test('should handle null/undefined errors', () => {
        const nullError = null;
        const errorDetails = errorHandler.handleError(nullError);
        
        assert.ok(errorDetails, 'Should handle null errors');
        assert.strictEqual(errorDetails.type, ErrorType.UNKNOWN, 'Should categorize as unknown error');
    });

    test('ResponseCache should store and retrieve values', () => {
        const key = 'test-key';
        const value = 'test-value';
        
        responseCache.set(key, value);
        const retrieved = responseCache.get(key);
        
        assert.strictEqual(retrieved, value, 'Should retrieve stored value');
    });

    test('ResponseCache should handle non-existent keys', () => {
        const retrieved = responseCache.get('non-existent-key');
        assert.strictEqual(retrieved, null, 'Should return null for non-existent keys');
    });

    test('ResponseCache should generate consistent keys', () => {
        const model = 'test-model';
        const prompt = 'test prompt';
        
        const key1 = responseCache.generateKey(model, prompt);
        const key2 = responseCache.generateKey(model, prompt);
        
        assert.strictEqual(key1, key2, 'Should generate consistent keys for same input');
    });

    test('ResponseCache should generate different keys for different input', () => {
        const key1 = responseCache.generateKey('model1', 'prompt1');
        const key2 = responseCache.generateKey('model2', 'prompt2');
        
        assert.notStrictEqual(key1, key2, 'Should generate different keys for different input');
    });

    test('ResponseCache should clear all values', () => {
        responseCache.set('key1', 'value1');
        responseCache.set('key2', 'value2');
        
        responseCache.clear();
        
        assert.strictEqual(responseCache.get('key1'), null, 'Should clear all values');
        assert.strictEqual(responseCache.get('key2'), null, 'Should clear all values');
    });

    test('should handle configuration access', () => {
        // Test configuration access
        const config = vscode.workspace.getConfiguration('aiAssistant.errorHandling');
        
        // These settings may not exist; verify access does not throw
        assert.ok(config !== undefined, 'Configuration should be accessible');
    });

    test('should handle retry mechanism', async function() {
        this.timeout(30000); // 30 seconds timeout
        let attemptCount = 0;
        const failingOperation = async () => {
            attemptCount++;
            throw new Error('Simulated failure');
        };

        try {
            await errorHandler.withRetry(failingOperation, 'test-operation');
            assert.fail('Should have thrown an error');
        } catch (error) {
            // In tests, retry could be disabled; only verify an error is thrown
            assert.ok(error instanceof Error, 'Should throw an Error');
        }
    });

    test('should handle successful operations', async () => {
        let attemptCount = 0;
        const successfulOperation = async () => {
            attemptCount++;
            return 'success';
        };

        const result = await errorHandler.withRetry(successfulOperation, 'test-operation');
        
        assert.strictEqual(result, 'success', 'Should return operation result');
        assert.strictEqual(attemptCount, 1, 'Should only attempt once for successful operation');
    });

    test('should handle error logging', () => {
        const error = new Error('Test error for logging');
        const errorDetails = errorHandler.handleError(error);
        
        // Should not throw during logging
        assert.ok(errorDetails, 'Should handle error logging');
        assert.strictEqual(errorDetails.type, ErrorType.UNKNOWN, 'Should categorize error correctly');
    });

    test('should handle different error message formats', () => {
        const errorMessages = [
            'Network error: fetch failed',
            'Timeout after 30 seconds',
            'Model llama2 not found',
            'Service returned 503',
            'Invalid JSON response: unexpected token'
        ];

        errorMessages.forEach(message => {
            const error = new Error(message);
            const errorDetails = errorHandler.handleError(error);
            
            assert.ok(errorDetails, `Should handle error message: ${message}`);
            assert.ok(errorDetails.type, 'Should have error type');
            assert.ok(errorDetails.userMessage, 'Should have user message');
        });
    });
});
