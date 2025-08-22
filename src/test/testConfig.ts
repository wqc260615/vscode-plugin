import * as vscode from 'vscode';

/**
 * 测试配置和工具函数
 */
export class TestConfig {
    /**
     * 创建模拟的扩展上下文
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
     * 创建模拟的聊天会话
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
     * 创建模拟的聊天消息
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
     * 等待指定的时间
     */
    static async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 模拟配置获取
     */
    static createMockConfig(values: Record<string, any> = {}): any {
        return {
            get: (key: string, defaultValue?: any) => {
                return values[key] !== undefined ? values[key] : defaultValue;
            }
        };
    }

    /**
     * 清理测试环境
     */
    static async cleanup(): Promise<void> {
        // 等待所有异步操作完成
        await this.wait(100);
    }
}
