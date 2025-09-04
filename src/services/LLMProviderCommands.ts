import * as vscode from 'vscode';
import { LLMServiceManager } from './LLMServiceManager';
import { LLMServiceConfig } from './LLMServiceConfig';

/**
 * LLM provider management commands
 * Provides commands to switch and configure different LLM services
 */
export class LLMProviderCommands {
    private llmServiceManager: LLMServiceManager;
    private config: LLMServiceConfig;

    constructor() {
        this.llmServiceManager = LLMServiceManager.getInstance();
        this.config = LLMServiceConfig.getInstance();
    }

    /**
     * Register all commands
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Switch LLM provider
        const switchProviderCommand = vscode.commands.registerCommand(
            'aiAssistant.switchLLMProvider',
            () => this.switchProvider()
        );

        // Show current configuration
        const showConfigCommand = vscode.commands.registerCommand(
            'aiAssistant.showLLMConfig',
            () => this.showConfig()
        );

        // Test connection
        const testConnectionCommand = vscode.commands.registerCommand(
            'aiAssistant.testLLMConnection',
            () => this.testConnection()
        );

        // Refresh service
        const refreshServiceCommand = vscode.commands.registerCommand(
            'aiAssistant.refreshLLMService',
            () => this.refreshService()
        );

        context.subscriptions.push(
            switchProviderCommand,
            showConfigCommand,
            testConnectionCommand,
            refreshServiceCommand
        );
    }

    /**
     * Switch LLM provider
     */
    private async switchProvider(): Promise<void> {
        const availableProviders = this.config.getAvailableProviders();
        const currentProvider = this.config.getCurrentProvider();

        const selectedProvider = await vscode.window.showQuickPick(
            availableProviders.map(provider => ({
                label: provider === currentProvider ? `$(check) ${provider} (Current)` : provider,
                description: this.getProviderDescription(provider),
                value: provider
            })),
            {
                placeHolder: 'Select LLM Provider',
                title: 'Switch LLM Provider'
            }
        );

        if (selectedProvider) {
            try {
                await this.config.setProvider(selectedProvider.value);
                await this.llmServiceManager.switchProvider();
                
                vscode.window.showInformationMessage(
                    `Successfully switched to ${selectedProvider.value}`
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to switch to ${selectedProvider.value}: ${error}`
                );
            }
        }
    }

    /**
     * Show current configuration
     */
    private async showConfig(): Promise<void> {
        const configSummary = this.config.getConfigSummary();
        const currentProvider = this.config.getCurrentProvider();
        const availableProviders = this.config.getAvailableProviders();

        const panel = vscode.window.createWebviewPanel(
            'llmConfig',
            'LLM Service Configuration',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getConfigHtml(configSummary, currentProvider, availableProviders);
    }

    /**
     * Test connection
     */
    private async testConnection(): Promise<void> {
        const currentProvider = this.config.getCurrentProvider();
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Testing ${currentProvider} connection...`,
            cancellable: false
        }, async (progress) => {
            try {
                const isAvailable = await this.llmServiceManager.isServiceAvailable();
                
                if (isAvailable) {
                    const models = await this.llmServiceManager.getModels();
                    vscode.window.showInformationMessage(
                        `✅ ${currentProvider} connection successful! Available models: ${models.join(', ')}`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `❌ ${currentProvider} connection failed. Please check your configuration.`
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `❌ ${currentProvider} connection test failed: ${error}`
                );
            }
        });
    }

    /**
     * Refresh service
     */
    private async refreshService(): Promise<void> {
        try {
            await this.llmServiceManager.switchProvider();
            vscode.window.showInformationMessage('LLM service refreshed successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh LLM service: ${error}`);
        }
    }

    /**
     * Get provider description
     */
    private getProviderDescription(provider: string): string {
        switch (provider) {
            case 'ollama':
                return 'Local Ollama service for running open-source models';
            case 'localai':
                return 'LocalAI service for running various AI models locally';
            default:
                return 'Unknown provider';
        }
    }

    /**
     * Generate configuration HTML
     */
    private getConfigHtml(configSummary: string, currentProvider: string, availableProviders: string[]): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>LLM Service Configuration</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
                    .config-section { margin-bottom: 20px; }
                    .provider-item { 
                        padding: 10px; 
                        margin: 5px 0; 
                        border: 1px solid #ccc; 
                        border-radius: 4px;
                        background-color: ${currentProvider === 'ollama' ? '#e8f5e8' : '#f5f5f5'};
                    }
                    .current-provider { border-color: #4caf50; background-color: #e8f5e8; }
                    .config-summary { 
                        background-color: #f8f9fa; 
                        padding: 15px; 
                        border-radius: 4px; 
                        font-family: monospace; 
                        white-space: pre-wrap; 
                    }
                    .button { 
                        background-color: #007acc; 
                        color: white; 
                        border: none; 
                        padding: 8px 16px; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        margin: 5px; 
                    }
                    .button:hover { background-color: #005a9e; }
                </style>
            </head>
            <body>
                <h1>LLM Service Configuration</h1>
                
                <div class="config-section">
                    <h2>Current Configuration</h2>
                    <div class="config-summary">${configSummary}</div>
                </div>

                <div class="config-section">
                    <h2>Available Providers</h2>
                    ${availableProviders.map(provider => `
                        <div class="provider-item ${provider === currentProvider ? 'current-provider' : ''}">
                            <strong>${provider}</strong> ${provider === currentProvider ? '(Current)' : ''}
                            <br>
                            <small>${this.getProviderDescription(provider)}</small>
                        </div>
                    `).join('')}
                </div>

                <div class="config-section">
                    <h2>Actions</h2>
                    <button class="button" onclick="switchProvider()">Switch Provider</button>
                    <button class="button" onclick="testConnection()">Test Connection</button>
                    <button class="button" onclick="refreshService()">Refresh Service</button>
                </div>

                <script>
                    function switchProvider() {
                        vscode.postMessage({ command: 'switchProvider' });
                    }
                    
                    function testConnection() {
                        vscode.postMessage({ command: 'testConnection' });
                    }
                    
                    function refreshService() {
                        vscode.postMessage({ command: 'refreshService' });
                    }
                </script>
            </body>
            </html>
        `;
    }
}
