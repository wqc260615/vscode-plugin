import * as vscode from 'vscode';
import { SessionManager, ChatSession } from '../services/sessionManager';
import { OllamaService } from '../services/ollamaService';
import { ProjectContextProcessor } from '../services/projectContextProcessor';
import * as path from 'path';
import * as fs from 'fs';

export class AIChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiAssistant.chatView';
    private _view?: vscode.WebviewView;
    private sessionManager: SessionManager;
    private ollamaService: OllamaService;
    private contextProcessor: ProjectContextProcessor;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this.sessionManager = new SessionManager(context);
        this.ollamaService = new OllamaService();
        this.contextProcessor = new ProjectContextProcessor();
        
        // 初始化项目上下文
        this.contextProcessor.initProjectContext();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 监听来自webview的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this._handleMessage(data);
        });

        // 加载初始数据
        this._loadInitialData();
    }

    private async _handleMessage(message: any) {
        switch (message.type) {
            case 'sendMessage':
                await this._handleSendMessage(message.data);
                break;
            case 'getModels':
                await this._loadModels();
                break;
            case 'createSession':
                await this._createSession(message.data.name);
                break;
            case 'deleteSession':
                await this._deleteSession(message.data.sessionId);
                break;
            case 'selectSession':
                await this._selectSession(message.data.sessionId);
                break;
            case 'renameSession':
                await this._renameSession(message.data.sessionId, message.data.name);
                break;
            case 'addReference':
                await this._addReferenceFile();
                break;
            case 'clearMessages':
                await this._clearMessages(message.data.sessionId);
                break;
            case 'ready':
                await this._loadInitialData();
                break;
        }
    }

    private async _loadInitialData() {
        if (!this._view) return;

        // 加载会话列表
        const sessions = this.sessionManager.getAllSessions();
        const activeSession = this.sessionManager.getActiveSession();
        
        this._view.webview.postMessage({
            type: 'sessionsLoaded',
            data: { 
                sessions: sessions.map(s => ({
                    id: s.id,
                    name: s.name,
                    messageCount: s.messages.length
                })),
                activeSessionId: activeSession?.id
            }
        });

        // 加载当前会话的消息
        if (activeSession) {
            this._view.webview.postMessage({
                type: 'messagesLoaded',
                data: { messages: activeSession.messages }
            });
        }

        // 加载模型列表
        await this._loadModels();
    }

    private async _loadModels() {
        if (!this._view) return;

        try {
            const models = await this.ollamaService.getModels();
            this._view.webview.postMessage({
                type: 'modelsLoaded',
                data: { models }
            });
        } catch (error) {
            this._view.webview.postMessage({
                type: 'error',
                data: { message: 'Failed to load models: ' + error }
            });
        }
    }

    private async _handleSendMessage(data: any) {
        if (!this._view) return;

        const { message, model } = data;
        const activeSession = this.sessionManager.getActiveSession();
        
        if (!activeSession) {
            vscode.window.showErrorMessage('No active session. Please create a new session first.');
            return;
        }

        try {
            // 添加用户消息到会话
            this.sessionManager.addMessage(activeSession.id, message, true);
            
            // 更新UI显示用户消息
            this._view.webview.postMessage({
                type: 'messageAdded',
                data: { 
                    message: { 
                        id: Date.now().toString(),
                        content: message, 
                        isUser: true, 
                        timestamp: new Date() 
                    } 
                }
            });

            // 构建完整提示词
            const fullPrompt = await this.contextProcessor.generateFullPrompt(message);
            
            // 显示AI正在思考
            this._view.webview.postMessage({
                type: 'aiThinking',
                data: { thinking: true }
            });

            let responseContent = '';
            
            // 调用Ollama API（流式响应）
            await this.ollamaService.chatStream(
                model,
                fullPrompt,
                activeSession,
                (chunk: string) => {
                    // 处理流式响应
                    responseContent += chunk;
                    this._view?.webview.postMessage({
                        type: 'aiResponse',
                        data: { content: responseContent, isComplete: false }
                    });
                },
                () => {
                    // 响应完成
                    this.sessionManager.addMessage(activeSession.id, responseContent, false);
                    this._view?.webview.postMessage({
                        type: 'aiResponse',
                        data: { content: responseContent, isComplete: true }
                    });
                    this._view?.webview.postMessage({
                        type: 'aiThinking',
                        data: { thinking: false }
                    });
                },
                (error: Error) => {
                    // 处理错误
                    this._view?.webview.postMessage({
                        type: 'error',
                        data: { message: 'Error: ' + error.message }
                    });
                    this._view?.webview.postMessage({
                        type: 'aiThinking',
                        data: { thinking: false }
                    });
                }
            );

        } catch (error) {
            this._view.webview.postMessage({
                type: 'error',
                data: { message: 'Failed to send message: ' + error }
            });
        }
    }

    private async _createSession(name: string) {
        if (!this._view) return;

        const session = this.sessionManager.createNewSession(name);
        this._view.webview.postMessage({
            type: 'sessionCreated',
            data: { 
                session: {
                    id: session.id,
                    name: session.name,
                    messageCount: 0
                }
            }
        });

        // 清空消息显示
        this._view.webview.postMessage({
            type: 'messagesLoaded',
            data: { messages: [] }
        });
    }

    private async _deleteSession(sessionId: string) {
        if (!this._view) return;

        if (this.sessionManager.removeSession(sessionId)) {
            this._view.webview.postMessage({
                type: 'sessionDeleted',
                data: { sessionId }
            });

            // 如果删除的是当前活跃会话，加载新的活跃会话
            const activeSession = this.sessionManager.getActiveSession();
            if (activeSession) {
                this._view.webview.postMessage({
                    type: 'messagesLoaded',
                    data: { messages: activeSession.messages }
                });
            } else {
                this._view.webview.postMessage({
                    type: 'messagesLoaded',
                    data: { messages: [] }
                });
            }
        }
    }

    private async _selectSession(sessionId: string) {
        if (!this._view) return;

        if (this.sessionManager.setActiveSession(sessionId)) {
            const session = this.sessionManager.getSession(sessionId);
            if (session) {
                this._view.webview.postMessage({
                    type: 'sessionSelected',
                    data: { sessionId }
                });
                
                this._view.webview.postMessage({
                    type: 'messagesLoaded',
                    data: { messages: session.messages }
                });
            }
        }
    }

    private async _renameSession(sessionId: string, newName: string) {
        if (!this._view) return;

        if (this.sessionManager.renameSession(sessionId, newName)) {
            this._view.webview.postMessage({
                type: 'sessionRenamed',
                data: { sessionId, name: newName }
            });
        }
    }

    private async _clearMessages(sessionId: string) {
        if (!this._view) return;

        if (this.sessionManager.clearSession(sessionId)) {
            this._view.webview.postMessage({
                type: 'messagesLoaded',
                data: { messages: [] }
            });
        }
    }

    private async _addReferenceFile() {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Add Reference File'
        });

        if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            const success = await this.contextProcessor.addReferenceFile(filePath);
            
            if (success && this._view) {
                const fileName = fileUri[0].path.split('/').pop() || 'Unknown';
                this._view.webview.postMessage({
                    type: 'referenceAdded',
                    data: { fileName }
                });
                
                vscode.window.showInformationMessage(`Reference file added: ${fileName}`);
            } else {
                vscode.window.showErrorMessage('Failed to add reference file');
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'panels', 'chatView.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        return htmlContent;
    }
}