# Core Tests
- **`extension.test.ts`** - Tests for the main extension activation and basic functionality
- **`completionManager.test.ts`** - Tests for the AI code completion manager
- **`projectContextProcessor.test.ts`** - Tests for project context processing and file management
- **`sessionManager.test.ts`** - Tests for chat session management
- **`ollamaService.test.ts`** - Tests for Ollama AI service integration
- **`errorHandler.test.ts`** - Tests for the LLM error handling and response caching system
- **`inlineChatProvider.test.ts`** - Tests for the inline chat functionality
- **`statusBarManager.test.ts`** - Tests for the status bar management and connection monitoring

# Test Utilities
- **`testConfig.ts`** - Test configuration and utility functions for creating mocks

# Test Structure

The tests are organized using the Mocha testing framework with the TDD (Test-Driven Development) interface. Each test file focuses on a specific service or component of the extension.

# Running Tests

## From VS Code
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Select "Developer: Run Extension Tests"
3. The tests will run in a new VS Code window

## From Terminal
```bash
# Navigate to the extension root directory
cd vscode-plugin

# Install dependencies if not already done
npm install

# Run tests
npm test
```