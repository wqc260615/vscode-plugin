import * as vscode from 'vscode';
import { SessionManager, ChatSession } from '../services/sessionManager';
import { OllamaService } from '../services/ollamaService';
import { ProjectContextProcessor } from '../services/projectContextProcessor';

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
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Assistant</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: var(--vscode-sideBar-background);
                    color: var(--vscode-sideBar-foreground);
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }

                .sessions-header {
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                    background-color: var(--vscode-sideBarSectionHeader-background);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .sessions-header h3 {
                    margin: 0;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--vscode-sideBarSectionHeader-foreground);
                }

                .new-session-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-icon-foreground);
                    cursor: pointer;
                    padding: 2px;
                    font-size: 16px;
                }

                .new-session-btn:hover {
                    color: var(--vscode-foreground);
                }

                .sessions-list {
                    max-height: 200px;
                    overflow-y: auto;
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                }

                .session-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                }

                .session-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .session-item.active {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }

                .session-name {
                    flex: 1;
                    font-size: 13px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .session-actions {
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .session-item:hover .session-actions {
                    opacity: 1;
                }

                .session-action-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-icon-foreground);
                    cursor: pointer;
                    padding: 2px;
                    font-size: 12px;
                }

                .session-action-btn:hover {
                    color: var(--vscode-foreground);
                }

                .chat-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }

                .messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .message {
                    padding: 8px 10px;
                    border-radius: 6px;
                    max-width: 90%;
                    word-wrap: break-word;
                    line-height: 1.4;
                    font-size: 13px;
                }

                .user-message {
                    align-self: flex-end;
                    background-color: var(--vscode-inputOption-activeBackground);
                    color: var(--vscode-inputOption-activeForeground);
                }

                .assistant-message {
                    align-self: flex-start;
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textBlockQuote-border);
                }

                .thinking {
                    align-self: flex-start;
                    background-color: var(--vscode-textBlockQuote-background);
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }

                .input-area {
                    padding: 8px;
                    border-top: 1px solid var(--vscode-sideBar-border);
                    background-color: var(--vscode-sideBar-background);
                }

                .input-row {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 6px;
                }

                .input-row input {
                    flex: 1;
                    padding: 6px 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    font-size: 13px;
                }

                .input-row input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }

                .control-row {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }

                .model-select {
                    flex: 1;
                    padding: 4px 6px;
                    background-color: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 3px;
                    font-size: 12px;
                }

                .btn {
                    padding: 4px 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-icon {
                    background: none;
                    border: none;
                    color: var(--vscode-icon-foreground);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 3px;
                }

                .btn-icon:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                }

                .status {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                    min-height: 16px;
                }

                .empty-state {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 13px;
                    text-align: center;
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Sessions管理 -->
                <div class="sessions-header">
                    <h3>Sessions</h3>
                    <button class="new-session-btn" onclick="createNewSession()" title="New Session">+</button>
                </div>
                <div class="sessions-list" id="sessionsList">
                    <!-- Sessions will be populated here -->
                </div>

                <!-- 聊天区域 -->
                <div class="chat-area">
                    <div class="messages" id="messages">
                        <div class="empty-state">
                            Select a session to start chatting
                        </div>
                    </div>
                    
                    <div class="input-area">
                        <div class="input-row">
                            <input type="text" id="messageInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
                        </div>
                        <div class="control-row">
                            <button class="btn-icon" onclick="addReferenceFile()" title="Add Reference File">📎</button>
                            <select id="modelSelect" class="model-select">
                                <option>Loading...</option>
                            </select>
                            <button class="btn" id="sendBtn" onclick="sendMessage()">Send</button>
                        </div>
                        <div class="status" id="status"></div>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentSessions = [];
                let activeSessionId = null;
                let currentAiMessageElement = null;

                // 页面加载完成后通知扩展
                window.addEventListener('load', () => {
                    vscode.postMessage({ type: 'ready' });
                });

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    handleExtensionMessage(message);
                });

                function handleExtensionMessage(message) {
                    switch (message.type) {
                        case 'sessionsLoaded':
                            loadSessions(message.data.sessions, message.data.activeSessionId);
                            break;
                        case 'messagesLoaded':
                            loadMessages(message.data.messages);
                            break;
                        case 'modelsLoaded':
                            loadModels(message.data.models);
                            break;
                        case 'sessionCreated':
                            addSession(message.data.session);
                            break;
                        case 'sessionDeleted':
                            removeSession(message.data.sessionId);
                            break;
                        case 'sessionSelected':
                            selectSession(message.data.sessionId);
                            break;
                        case 'sessionRenamed':
                            renameSession(message.data.sessionId, message.data.name);
                            break;
                        case 'messageAdded':
                            addMessage(message.data.message);
                            break;
                        case 'aiThinking':
                            if (message.data.thinking) {
                                showAiThinking();
                            } else {
                                hideAiThinking();
                            }
                            break;
                        case 'aiResponse':
                            updateAiResponse(message.data.content, message.data.isComplete);
                            break;
                        case 'referenceAdded':
                            showStatus('Reference added: ' + message.data.fileName);
                            break;
                        case 'error':
                            showStatus('Error: ' + message.data.message, true);
                            break;
                    }
                }

                function loadSessions(sessions, activeId) {
                    currentSessions = sessions;
                    activeSessionId = activeId;
                    
                    const sessionsList = document.getElementById('sessionsList');
                    sessionsList.innerHTML = '';
                    
                    sessions.forEach(session => {
                        addSessionElement(session);
                    });
                }

                function addSessionElement(session) {
                    const sessionsList = document.getElementById('sessionsList');
                    const sessionElement = document.createElement('div');
                    sessionElement.className = 'session-item' + (session.id === activeSessionId ? ' active' : '');
                    sessionElement.dataset.sessionId = session.id;
                    
                    sessionElement.innerHTML = \`
                        <div class="session-name" ondblclick="editSessionName('\${session.id}')">\${session.name}</div>
                        <div class="session-actions">
                            <button class="session-action-btn" onclick="event.stopPropagation(); editSessionName('\${session.id}')" title="Rename">✏️</button>
                            <button class="session-action-btn" onclick="event.stopPropagation(); deleteSession('\${session.id}')" title="Delete">🗑️</button>
                        </div>
                    \`;
                    
                    sessionElement.onclick = () => selectSessionLocal(session.id);
                    sessionsList.appendChild(sessionElement);
                }

                function addSession(session) {
                    currentSessions.push(session);
                    addSessionElement(session);
                    selectSessionLocal(session.id);
                }

                function removeSession(sessionId) {
                    currentSessions = currentSessions.filter(s => s.id !== sessionId);
                    const element = document.querySelector(\`[data-session-id="\${sessionId}"]\`);
                    if (element) {
                        element.remove();
                    }
                }

                function selectSession(sessionId) {
                    activeSessionId = sessionId;
                    updateSessionSelection();
                }

                function selectSessionLocal(sessionId) {
                    if (sessionId !== activeSessionId) {
                        vscode.postMessage({
                            type: 'selectSession',
                            data: { sessionId }
                        });
                    }
                }

                function updateSessionSelection() {
                    document.querySelectorAll('.session-item').forEach(item => {
                        item.classList.remove('active');
                        if (item.dataset.sessionId === activeSessionId) {
                            item.classList.add('active');
                        }
                    });
                }

                function loadMessages(messages) {
                    const messagesDiv = document.getElementById('messages');
                    messagesDiv.innerHTML = '';
                    
                    if (messages.length === 0) {
                        messagesDiv.innerHTML = '<div class="empty-state">Start a conversation...</div>';
                        return;
                    }
                    
                    messages.forEach(message => {
                        addMessageElement(message);
                    });
                    
                    scrollToBottom();
                }

                function addMessage(message) {
                    // 移除空状态
                    const messagesDiv = document.getElementById('messages');
                    const emptyState = messagesDiv.querySelector('.empty-state');
                    if (emptyState) {
                        emptyState.remove();
                    }
                    
                    addMessageElement(message);
                    scrollToBottom();
                }

                function addMessageElement(message) {
                    const messagesDiv = document.getElementById('messages');
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message ' + (message.isUser ? 'user-message' : 'assistant-message');
                    messageElement.textContent = message.content;
                    messagesDiv.appendChild(messageElement);
                }

                function showAiThinking() {
                    const messagesDiv = document.getElementById('messages');
                    currentAiMessageElement = document.createElement('div');
                    currentAiMessageElement.className = 'message thinking';
                    currentAiMessageElement.textContent = 'AI is thinking...';
                    messagesDiv.appendChild(currentAiMessageElement);
                    scrollToBottom();
                }

                function updateAiResponse(content, isComplete) {
                    if (currentAiMessageElement) {
                        currentAiMessageElement.className = 'message assistant-message';
                        currentAiMessageElement.textContent = content;
                        
                        if (isComplete) {
                            currentAiMessageElement = null;
                        }
                        
                        scrollToBottom();
                    }
                }

                function hideAiThinking() {
                    // This is handled by updateAiResponse
                }

                function loadModels(models) {
                    const modelSelect = document.getElementById('modelSelect');
                    modelSelect.innerHTML = '';
                    
                    if (models.length === 0) {
                        modelSelect.innerHTML = '<option>No models available</option>';
                        return;
                    }
                    
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        modelSelect.appendChild(option);
                    });
                }

                function createNewSession() {
                    const name = prompt('Enter session name:', 'New Session');
                    if (name && name.trim()) {
                        vscode.postMessage({
                            type: 'createSession',
                            data: { name: name.trim() }
                        });
                    }
                }

                function editSessionName(sessionId) {
                    const session = currentSessions.find(s => s.id === sessionId);
                    if (session) {
                        const newName = prompt('Enter new session name:', session.name);
                        if (newName && newName.trim() && newName.trim() !== session.name) {
                            vscode.postMessage({
                                type: 'renameSession',
                                data: { sessionId, name: newName.trim() }
                            });
                        }
                    }
                }

                function deleteSession(sessionId) {
                    if (confirm('Are you sure you want to delete this session?')) {
                        vscode.postMessage({
                            type: 'deleteSession',
                            data: { sessionId }
                        });
                    }
                }

                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const modelSelect = document.getElementById('modelSelect');
                    const sendBtn = document.getElementById('sendBtn');
                    
                    const message = input.value.trim();
                    const model = modelSelect.value;
                    
                    if (!message) {
                        showStatus('Please enter a message', true);
                        return;
                    }
                    
                    if (!model) {
                        showStatus('Please select a model', true);
                        return;
                    }
                    
                    if (!activeSessionId) {
                        showStatus('Please create or select a session first', true);
                        return;
                    }
                    
                    sendBtn.disabled = true;
                    input.value = '';
                    
                    vscode.postMessage({
                        type: 'sendMessage',
                        data: { message, model }
                    });
                    
                    setTimeout(() => {
                        sendBtn.disabled = false;
                    }, 2000);
                }

                function addReferenceFile() {
                    vscode.postMessage({ type: 'addReference' });
                }

                function handleKeyPress(event) {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                    }
                }

                function scrollToBottom() {
                    const messagesDiv = document.getElementById('messages');
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }

                function showStatus(message, isError = false) {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.style.color = isError ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)';
                    
                    setTimeout(() => {
                        status.textContent = '';
                    }, 3000);
                }

                function renameSession(sessionId, newName) {
                    const session = currentSessions.find(s => s.id === sessionId);
                    if (session) {
                        session.name = newName;
                        const element = document.querySelector(\`[data-session-id="\${sessionId}"] .session-name\`);
                        if (element) {
                            element.textContent = newName;
                        }
                    }
                }
            </script>
        </body>
        </html>`;
        }
    }