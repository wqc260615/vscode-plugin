import * as vscode from 'vscode';
import { SessionManager, ChatSession } from '../services/sessionManager';
import { OllamaService } from '../services/ollamaService';
import { ProjectContextProcessor } from '../services/projectContextProcessor';
import { LLMErrorHandler } from '../services/errorHandler';
import * as path from 'path';
import * as fs from 'fs';

export class AIChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiAssistant.chatView';
    private _view?: vscode.WebviewView;
    private sessionManager: SessionManager;
    private ollamaService: OllamaService;
    private contextProcessor: ProjectContextProcessor;
    private errorHandler: LLMErrorHandler;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        context: vscode.ExtensionContext
    ) {
        this.sessionManager = new SessionManager(context);
        this.ollamaService = new OllamaService();
        this.contextProcessor = new ProjectContextProcessor();
        this.errorHandler = LLMErrorHandler.getInstance();
        
        // Initialize project context
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

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this._handleMessage(data);
        });

        // Load initial data
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
        if (!this._view) {
            return;
        }

        // Load session list
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

        // Load messages for the current session
        if (activeSession) {
            this._view.webview.postMessage({
                type: 'messagesLoaded',
                data: { messages: activeSession.messages }
            });
        }

        // Load model list
        await this._loadModels();
    }

    private async _loadModels() {
        if (!this._view) {
            return;
        }

        try {
            const models = await this.ollamaService.getModels();
            const preferredModel = await this.ollamaService.getPreferredModel();
            
            this._view.webview.postMessage({
                type: 'modelsLoaded',
                data: { 
                    models,
                    preferredModel 
                }
            });
        } catch (error) {
            const errorDetails = this.errorHandler.handleError(error, { operation: 'loadModels' });
            this._view.webview.postMessage({
                type: 'error',
                data: { message: errorDetails.userMessage }
            });
        }
    }

    private async _handleSendMessage(data: any) {
        if (!this._view) {
            return;
        }

        // Record the time when user action starts (when they click enter/send)
        const userActionStartTime = performance.now();
        
        const { message } = data;
        let { model } = data;
        
        // If no model specified or unavailable, use the preferred model
        if (!model) {
            model = await this.ollamaService.getPreferredModel();
        }
        
        const activeSession = this.sessionManager.getActiveSession();
        
        if (!activeSession) {
            vscode.window.showErrorMessage('No active session. Please create a new session first.');
            return;
        }

        try {
            // Add user message to session
            this.sessionManager.addMessage(activeSession.id, message, true);
            
            // Update UI to show user message
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

            // Build full prompt
            const fullPrompt = await this.contextProcessor.generateFullPrompt(message);
            console.log(fullPrompt);
            // Show AI thinking state
            this._view.webview.postMessage({
                type: 'aiThinking',
                data: { thinking: true }
            });

            let responseContent = '';
            
            // Call Ollama API (streaming) - pass the user action start time
            await this.ollamaService.chatStream(
                model,
                fullPrompt,
                activeSession,
                (chunk: string) => {
                    // Handle streaming response
                    responseContent += chunk;
                    this._view?.webview.postMessage({
                        type: 'aiResponse',
                        data: { content: responseContent, isComplete: false }
                    });
                },
                () => {
                    // Response completed
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
                    // Handle error
                    this._view?.webview.postMessage({
                        type: 'error',
                        data: { message: 'Error: ' + error.message }
                    });
                    this._view?.webview.postMessage({
                        type: 'aiThinking',
                        data: { thinking: false }
                    });
                },
                userActionStartTime // Pass user action start time
            );

        } catch (error) {
            this._view.webview.postMessage({
                type: 'error',
                data: { message: 'Failed to send message: ' + error }
            });
        }
    }

    private async _createSession(name: string) {
        if (!this._view) {
            return;
        }

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

        // Clear messages display
        this._view.webview.postMessage({
            type: 'messagesLoaded',
            data: { messages: [] }
        });
    }

    private async _deleteSession(sessionId: string) {
        if (!this._view) {
            return;
        }

        if (this.sessionManager.removeSession(sessionId)) {
            this._view.webview.postMessage({
                type: 'sessionDeleted',
                data: { sessionId }
            });

            // If the deleted session was active, load the new active session
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
        if (!this._view) {
            return;
        }

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
        if (!this._view) {
            return;
        }

        if (this.sessionManager.renameSession(sessionId, newName)) {
            this._view.webview.postMessage({
                type: 'sessionRenamed',
                data: { sessionId, name: newName }
            });
        }
    }

    private async _clearMessages(sessionId: string) {
        if (!this._view) {
            return;
        }

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