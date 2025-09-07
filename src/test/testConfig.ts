import * as vscode from 'vscode';

/**
 * Test configuration and utility functions
 */
export class TestConfig {
    /**
     * Create a mock extension context
     */
    static createMockContext(): any {
        return {
            subscriptions: [],
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            extensionUri: vscode.Uri.file(__dirname),
            asAbsolutePath: (relativePath: string) => relativePath,
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            extensionPath: '',
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
            },
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            extensionRuntime: 'node' as any,
            extension: {
                id: 'test-extension',
                extensionUri: vscode.Uri.file(__dirname),
                extensionPath: __dirname,
                isActive: false,
                packageJSON: {},
                exports: undefined,
                activate: () => Promise.resolve(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            languageModelAccessInformation: {
                endpoint: 'test-endpoint',
                authHeader: 'test-auth'
            }
        };
    }

    /**
     * Create a mock chat session
     */
    static createMockSession(name: string = 'Test Session'): any {
        return {
            id: 'test-session-' + Date.now(),
            name: name,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Create a mock chat message
     */
    static createMockMessage(content: string, isUser: boolean = true): any {
        return {
            id: 'msg-' + Date.now(),
            content: content,
            isUser: isUser,
            timestamp: new Date()
        };
    }

    /**
     * Wait for specified milliseconds
     */
    static async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create a mock configuration accessor
     */
    static createMockConfig(values: Record<string, any> = {}): any {
        return {
            get: (key: string, defaultValue?: any) => {
                return values[key] !== undefined ? values[key] : defaultValue;
            }
        };
    }

    /**
     * Cleanup test environment
     */
    static async cleanup(): Promise<void> {
        // Wait for all async operations to complete
        await this.wait(100);
    }
}
