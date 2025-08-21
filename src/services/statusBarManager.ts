import * as vscode from 'vscode';
import { OllamaService } from './ollamaService';
import { LLMErrorHandler } from './errorHandler';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private ollamaService: OllamaService;
    private errorHandler: LLMErrorHandler;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(ollamaService: OllamaService) {
        this.ollamaService = ollamaService;
        this.errorHandler = LLMErrorHandler.getInstance();
        
        // 创建状态栏项
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'aiAssistant.checkConnection';
        this.statusBarItem.show();
        
        // 启动定期检查
        this.startPeriodicCheck();
        
        // 立即检查一次
        this.checkStatus();
    }

    private startPeriodicCheck() {
        // 每30秒检查一次连接状态
        this.checkInterval = setInterval(() => {
            this.checkStatus();
        }, 30000);
    }

    private async checkStatus() {
        try {
            const isAvailable = await this.ollamaService.isServiceAvailable();
            
            if (isAvailable) {
                this.statusBarItem.text = '$(check) Ollama Connected';
                this.statusBarItem.color = undefined;
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Ollama service is running and available';
            } else {
                this.statusBarItem.text = '$(warning) Ollama Disconnected';
                this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.statusBarItem.tooltip = 'Ollama service is not available. Click to check connection.';
            }
        } catch (error) {
            this.statusBarItem.text = '$(error) Ollama Error';
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = 'Error checking Ollama service. Click for help.';
        }
    }

    public async handleStatusBarClick() {
        const isAvailable = await this.ollamaService.isServiceAvailable();
        
        if (!isAvailable) {
            const action = await vscode.window.showWarningMessage(
                'Ollama service is not available. Would you like to see troubleshooting help?',
                'Help',
                'Check Again',
                'Dismiss'
            );

            switch (action) {
                case 'Help':
                    this.showTroubleshootingHelp();
                    break;
                case 'Check Again':
                    this.checkStatus();
                    break;
            }
        } else {
            // 显示连接信息
            try {
                const models = await this.ollamaService.getModels();
                vscode.window.showInformationMessage(
                    `✅ Ollama is connected! Available models: ${models.length > 0 ? models.join(', ') : 'No models installed'}`
                );
            } catch (error) {
                vscode.window.showInformationMessage('✅ Ollama is connected!');
            }
        }
    }

    private showTroubleshootingHelp() {
        const panel = vscode.window.createWebviewPanel(
            'ollamaTroubleshooting',
            'Ollama Troubleshooting',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getTroubleshootingHtml();
    }

    private getTroubleshootingHtml(): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ollama Troubleshooting</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    line-height: 1.6;
                }
                h1 { 
                    color: var(--vscode-textLink-foreground); 
                    border-bottom: 1px solid var(--vscode-textBlockQuote-border);
                    padding-bottom: 10px;
                }
                h2 { 
                    color: var(--vscode-textLink-foreground); 
                    margin-top: 25px;
                }
                .step { 
                    margin: 15px 0; 
                    padding: 15px;
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                }
                .command { 
                    font-family: monospace; 
                    background: var(--vscode-textCodeBlock-background);
                    padding: 8px 12px;
                    border-radius: 4px;
                    display: inline-block;
                    margin: 5px 0;
                }
                .warning {
                    color: var(--vscode-editorWarning-foreground);
                    font-weight: bold;
                }
                ul { padding-left: 20px; }
                li { margin-bottom: 8px; }
            </style>
        </head>
        <body>
            <h1>🔧 Ollama Connection Troubleshooting</h1>
            
            <h2>1. Check if Ollama is Installed</h2>
            <div class="step">
                <p>First, verify that Ollama is installed on your system:</p>
                <div class="command">ollama --version</div>
                <p>If this command fails, please install Ollama from: <a href="https://ollama.ai">https://ollama.ai</a></p>
            </div>

            <h2>2. Start the Ollama Service</h2>
            <div class="step">
                <p>Start the Ollama service by running:</p>
                <div class="command">ollama serve</div>
                <p>This will start Ollama on the default port (11434). Keep this terminal open.</p>
            </div>

            <h2>3. Install a Model</h2>
            <div class="step">
                <p>If you haven't installed any models yet, install one:</p>
                <div class="command">ollama pull llama2</div>
                <p>Or try a smaller model:</p>
                <div class="command">ollama pull tinyllama</div>
            </div>

            <h2>4. Verify Service is Running</h2>
            <div class="step">
                <p>Check if Ollama is responding:</p>
                <div class="command">ollama list</div>
                <p>This should show your installed models.</p>
            </div>

            <h2>5. Check VS Code Settings</h2>
            <div class="step">
                <p>Verify your Ollama URL setting in VS Code:</p>
                <ul>
                    <li>Open VS Code Settings (Ctrl/Cmd + ,)</li>
                    <li>Search for "AI Assistant Ollama URL"</li>
                    <li>Default should be: <span class="command">http://localhost:11434</span></li>
                    <li>Update if you're running Ollama on a different host/port</li>
                </ul>
            </div>

            <h2>6. Common Issues</h2>
            <div class="step">
                <p><span class="warning">Port already in use:</span> If port 11434 is busy, start Ollama on a different port:</p>
                <div class="command">OLLAMA_HOST=0.0.0.0:11435 ollama serve</div>
                <p>Then update the VS Code setting accordingly.</p>
                
                <br>
                
                <p><span class="warning">Firewall issues:</span> Ensure your firewall allows connections to the Ollama port.</p>
                
                <br>
                
                <p><span class="warning">Network issues:</span> If using Ollama on a remote server, ensure the URL is correct and the server is reachable.</p>
            </div>

            <h2>Need More Help?</h2>
            <div class="step">
                <p>If you're still having issues:</p>
                <ul>
                    <li>Check the VS Code Output panel (View → Output → AI Assistant Errors)</li>
                    <li>Visit the Ollama documentation: <a href="https://github.com/jmorganca/ollama">https://github.com/jmorganca/ollama</a></li>
                    <li>Report issues with this extension on GitHub</li>
                </ul>
            </div>
        </body>
        </html>`;
    }

    public dispose() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.statusBarItem.dispose();
    }
}
