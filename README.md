# AI Assistant for VS Code

A comprehensive AI-powered assistant for Visual Studio Code that integrates with Ollama to provide intelligent code completion, chat assistance, and project context analysis.

## 🌟 Features

### 🤖 **AI Chat Interface**
- **Interactive chat panel** with syntax-highlighted code responses
- **Project context awareness** - automatically includes relevant files
- **Session management** with conversation history
- **Streaming responses** for real-time interaction
- **Model selection** with live model availability checking

### ⚡ **Intelligent Code Completion**
- **Context-aware suggestions** using surrounding code
- **Multi-language support** (JavaScript, TypeScript, Python, Java, C++, C#, PHP, Ruby, Go, Rust, Swift, Kotlin)
- **Customizable behavior** with enable/disable toggle
- **Performance optimized** with intelligent caching

### 💬 **Inline Chat**
- **Quick code assistance** without leaving your editor
- **Context-sensitive help** based on current selection
- **Code generation and explanation** in-place
- **Keyboard shortcuts** for seamless workflow

### 📁 **Smart Project Context**
- **Automatic project analysis** and structure understanding  
- **Reference file management** for focused assistance
- **Real-time context updates** on file changes
- **Tree view** for easy context navigation

### 🛡️ **Robust Error Handling**
- **Intelligent error categorization** (connection, timeout, model issues, etc.)
- **Automatic retry mechanisms** with exponential backoff
- **Graceful fallbacks** with response caching
- **User-friendly error messages** with actionable guidance
- **Real-time connection monitoring** with status bar indicator

### 🔧 **Connection Management**
- **Visual status indicator** showing Ollama connection state
- **Automatic health checks** every 30 seconds
- **One-click troubleshooting** with comprehensive help
- **Interactive diagnostics** for quick issue resolution

## 🚀 Quick Start

### Prerequisites
1. **Install Ollama** from [https://ollama.ai](https://ollama.ai)
2. **Start Ollama service**: `ollama serve`
3. **Install a model**: `ollama pull llama2` (or `tinyllama` for a smaller model)

### Installation
1. Install the extension from VS Code marketplace
2. Open the command palette (`Ctrl+Shift+P`)
3. Run "AI Assistant: Check Ollama Connection" to verify setup
4. Start chatting with the AI assistant!

## 📋 Usage

### Chat Interface
1. Click the **robot icon** in the activity bar
2. Type your question or request
3. Get intelligent responses with code examples
4. Use **reference files** to provide additional context

### Code Completion
1. Start typing code in any supported language
2. AI suggestions appear automatically
3. Press `Tab` to accept suggestions
4. Toggle completion with the status bar item

### Inline Chat
1. Select code or place cursor
2. Use `Ctrl+Shift+P` → "Show Inline Chat"
3. Ask questions about the selected code
4. Get explanations and improvements

### Project Context
1. Extension automatically analyzes your project
2. Add reference files via the context tree view
3. Chat responses include relevant project information
4. Context updates automatically on file changes

## ⚙️ Configuration

### Basic Settings
```json
{
  "aiAssistant.ollamaUrl": "http://localhost:11434",
  "aiAssistant.enableCodeCompletion": true,
  "aiAssistant.defaultModel": "llama2",
  "aiAssistant.maxTokens": 2048
}
```

### Error Handling Settings
```json
{
  "aiAssistant.errorHandling": {
    "showDetailedErrors": true,
    "enableRetry": true,
    "maxRetries": 3,
    "cacheResponses": true,
    "showConnectionWarnings": true
  }
}
```

### Code Completion Settings
```json
{
  "aiAssistant.completion": {
    "enabled": true,
    "maxLines": 10,
    "contextLines": 50,
    "debounceMs": 200
  }
}
```

## 🎯 Key Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `AI Assistant: Show Inline Chat` | Open inline chat | `Ctrl+Shift+A` |
| `AI Assistant: Toggle Code Completion` | Enable/disable completion | - |
| `AI Assistant: Check Connection` | Test Ollama connection | - |
| `AI Assistant: Add Reference File` | Add file to context | - |
| `AI Assistant: Refresh Project Context` | Update project analysis | - |

## 📊 Status Bar Indicators

### Connection Status
- ✅ **"$(check) Ollama Connected"** - Service running and available
- ⚠️ **"$(warning) Ollama Disconnected"** - Service unavailable  
- ❌ **"$(error) Ollama Error"** - Connection or service error

### Features Status
- 🤖 **"$(robot) AI Assistant"** - Open chat interface
- 💡 **"$(lightbulb) AI Completion"** - Toggle code completion

*Click any status bar item for quick actions and troubleshooting.*

## 🔍 Troubleshooting

### Common Issues

#### "Ollama Disconnected" Error
1. **Check if Ollama is running**: `ollama --version`
2. **Start the service**: `ollama serve`  
3. **Verify models**: `ollama list`
4. **Check VS Code settings** for correct URL

#### Code Completion Not Working
1. **Check if enabled** in settings or status bar
2. **Verify model availability** in chat interface
3. **Check file language** is supported
4. **Restart VS Code** if needed

#### Chat Responses are Slow
1. **Use smaller models** (tinyllama, phi3)
2. **Reduce max tokens** in settings
3. **Check system resources** (RAM, CPU)
4. **Consider GPU acceleration** for Ollama

### Advanced Troubleshooting
Click the Ollama status bar item → "Help" for comprehensive troubleshooting guide with:
- Step-by-step installation verification
- Network connectivity tests  
- Configuration validation
- Common issue solutions
- Performance optimization tips

## 🏗️ Architecture

### Core Components
- **Extension Host**: Main extension entry point
- **Chat Provider**: WebView-based chat interface  
- **Completion Manager**: Inline completion engine
- **Ollama Service**: AI model communication layer
- **Error Handler**: Comprehensive error management
- **Status Manager**: Connection monitoring and UI updates
- **Context Processor**: Project analysis and context extraction
- **Session Manager**: Chat history and state management

### Error Handling System
- **8 Error Categories**: Connection, timeout, model, auth, rate limit, response, service, unknown
- **Retry Logic**: Exponential backoff with configurable attempts
- **Fallback Strategies**: Cached responses, graceful degradation
- **User Experience**: Clear messages, actionable guidance, no technical jargon

### Performance Features
- **Intelligent Caching**: Response caching for offline fallback
- **Debounced Completion**: Reduced API calls during typing
- **Context Optimization**: Smart context selection and trimming
- **Background Monitoring**: Non-blocking health checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Development Setup
```bash
git clone <repository-url>
cd vscode-ai-assistant
npm install
npm run compile
```

### Testing
```bash
npm run test
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Ollama team** for the excellent local AI runtime
- **VS Code team** for the comprehensive extension API
- **Contributors** who help improve this extension

---

**Ready to supercharge your coding with AI? Install the extension and start coding smarter!** 🚀
