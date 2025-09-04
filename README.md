# AI Assistant for VS Code

A local LLM-powered AI assistant that integrates with Ollama to provide intelligent code completion, chat assistance, and project context analysis.

## Features

- **🤖 AI Chat Interface** - Interactive chat panel with syntax-highlighted responses
- **⚡ Code Completion** - Context-aware suggestions for 13+ programming languages
- **💬 Inline Chat** - Quick code assistance without leaving your editor
- **📁 Project Context** - Automatic project analysis and reference file management
- **🛡️ Error Handling** - Robust error management with automatic retry mechanisms
- **🔧 Connection Management** - Visual status indicators and health monitoring

## Quick Start

### Prerequisites
1. Install [Ollama](https://ollama.ai)
2. Start Ollama: `ollama serve`
3. Install a model: `ollama pull llama2` (or `tinyllama` for smaller models)

### Installation
1. Install the extension from VS Code marketplace
2. Open command palette (`Ctrl+Shift+P`)
3. Run "AI Assistant: Check Ollama Connection"
4. Click the robot icon in the activity bar to start chatting

## Usage

### Chat Interface
- Click the **robot icon** in the activity bar
- Type questions or requests
- Get intelligent responses with code examples

### Code Completion
- Start typing in any supported language
- AI suggestions appear automatically
- Press `Tab` to accept suggestions
- Toggle with status bar item

### Inline Chat
- Select code or place cursor
- Use `Ctrl+Shift+P` → "Show Inline Chat"
- Get explanations and improvements

## Configuration

```json
{
  "aiAssistant.ollamaUrl": "http://localhost:11434",
  "aiAssistant.enableCodeCompletion": true,
  "aiAssistant.defaultModel": "llama2",
  "aiAssistant.maxTokens": 2048
}
```

## Key Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Show Inline Chat | `Ctrl+Shift+A` | Open inline chat |
| Toggle Code Completion | `Ctrl+Alt+C` | Enable/disable completion |
| Check Connection | - | Test Ollama connection |
| Send to Assistant | `Ctrl+Shift+A` | Send selected code to chat |

## Status Bar

- ✅ **"$(check) Ollama Connected"** - Service running
- ⚠️ **"$(warning) Ollama Disconnected"** - Service unavailable
- 🤖 **"$(robot) AI Assistant"** - Open chat interface
- 💡 **"$(lightbulb) AI Completion"** - Toggle completion

## Troubleshooting

### Common Issues

**"Ollama Disconnected" Error:**
1. Check if Ollama is running: `ollama --version`
2. Start the service: `ollama serve`
3. Verify models: `ollama list`

**Code Completion Not Working:**
1. Check if enabled in settings or status bar
2. Verify model availability in chat interface
3. Check file language is supported

**Slow Responses:**
1. Use smaller models (tinyllama, phi3)
2. Reduce max tokens in settings
3. Check system resources

## Supported Languages

JavaScript, TypeScript, Python, Java, C++, C#, PHP, Ruby, Go, Rust, Swift, Kotlin


---
