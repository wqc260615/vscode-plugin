// Simple test script to verify performance monitoring functionality
// This can be run in Node.js environment to test the core logic

// Mock VS Code API
const mockVSCode = {
    window: {
        createOutputChannel: (name) => ({
            appendLine: (text) => console.log(`[${name}] ${text}`),
            show: () => console.log('Output channel shown')
        })
    }
};

// Mock PerformanceMonitor
class PerformanceMonitor {
    constructor() {
        this.outputChannel = mockVSCode.window.createOutputChannel('AI Performance');
    }

    estimateTokens(text) {
        // Simple approximation: average 4 characters per token
        return Math.ceil(text.length / 4);
    }

    categorizeSpeed(tokensPerSecond) {
        if (tokensPerSecond >= 50) return 'Fast';
        if (tokensPerSecond >= 20) return 'Good';
        if (tokensPerSecond >= 10) return 'Moderate';
        if (tokensPerSecond >= 5) return 'Slow';
        return 'Very Slow';
    }

    categorizeLatency(latencyMs) {
        if (latencyMs <= 1000) return 'Excellent';
        if (latencyMs <= 3000) return 'Good';
        if (latencyMs <= 5000) return 'Fair';
        if (latencyMs <= 10000) return 'Slow';
        return 'Poor';
    }

    logChatPerformance(startTime, endTime, inputText, outputText, model) {
        const duration = endTime - startTime;
        const inputTokens = this.estimateTokens(inputText);
        const outputTokens = this.estimateTokens(outputText);
        const totalTokens = inputTokens + outputTokens;
        const tokensPerSecond = totalTokens / (duration / 1000);
        
        const speedCategory = this.categorizeSpeed(tokensPerSecond);
        const latencyCategory = this.categorizeLatency(duration);
        
        // Console output (simplified)
        console.log(`\n=== CHAT PERFORMANCE REPORT ===`);
        console.log(`Model: ${model}`);
        console.log(`Duration: ${duration}ms (${latencyCategory})`);
        console.log(`Input: ${inputTokens} tokens`);
        console.log(`Output: ${outputTokens} tokens`);
        console.log(`Speed: ${tokensPerSecond.toFixed(1)} tokens/sec (${speedCategory})`);
        console.log(`================================\n`);

        // Output channel logging
        this.outputChannel.appendLine(`Chat Performance - Model: ${model}, Duration: ${duration}ms, Speed: ${tokensPerSecond.toFixed(1)} t/s`);
    }
}

// Test the performance monitoring
console.log('Testing Performance Monitor...\n');

const monitor = new PerformanceMonitor();

// Test Case 1: Fast response
const startTime1 = Date.now();
const endTime1 = startTime1 + 2000; // 2 seconds
const input1 = "What is the weather like today?";
const output1 = "I'm sorry, but I don't have access to real-time weather data. To get current weather information, you would need to check a weather service like weather.com, use a weather app on your phone, or ask a voice assistant with internet access.";

monitor.logChatPerformance(startTime1, endTime1, input1, output1, 'gemma3:4b');

// Test Case 2: Slower response
const startTime2 = Date.now();
const endTime2 = startTime2 + 8000; // 8 seconds
const input2 = "Explain the concept of quantum computing";
const output2 = "Quantum computing is a revolutionary computational paradigm that leverages the principles of quantum mechanics to process information in fundamentally different ways than classical computers. Unlike classical bits that exist in definite states of 0 or 1, quantum computers use quantum bits (qubits) that can exist in superposition - simultaneously representing both 0 and 1 until measured. This property, combined with quantum entanglement and interference, allows quantum computers to perform certain calculations exponentially faster than classical computers for specific problems.";

monitor.logChatPerformance(startTime2, endTime2, input2, output2, 'gemma3:4b');

// Test Case 3: Very fast response
const startTime3 = Date.now();
const endTime3 = startTime3 + 500; // 0.5 seconds
const input3 = "Hi";
const output3 = "Hello! How can I help you today?";

monitor.logChatPerformance(startTime3, endTime3, input3, output3, 'gemma3:4b');

console.log('Performance monitoring test completed!');
