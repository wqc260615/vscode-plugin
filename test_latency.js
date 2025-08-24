// Test script to verify the updated end-to-end latency measurement
// This simulates the new timing behavior

// Mock performance and console
const performance = {
    now: () => Date.now() + Math.random() * 10 // Simulate varying times
};

// Mock PerformanceMonitor to test the new functionality
class TestPerformanceMonitor {
    getLatencyCategory(latencyMs) {
        if (latencyMs <= 1000) return 'Excellent';
        if (latencyMs <= 3000) return 'Good';
        if (latencyMs <= 5000) return 'Fair';
        if (latencyMs <= 10000) return 'Slow';
        return 'Poor';
    }

    logEndToEndLatency(operation, inputLength, firstChunkLength, startTime, endTime) {
        const duration = endTime - startTime;

        const performanceLog = [
            `=== End-to-End Response Latency ===`,
            `Operation: ${operation}`,
            `Time: ${new Date().toLocaleTimeString()}`,
            `Input Length: ${inputLength} characters`,
            `First Chunk Length: ${firstChunkLength} characters`,
            `Time to First Response: ${duration.toFixed(2)}ms`,
            `Performance: ${this.getLatencyCategory(duration)}`,
            `📊 Measurement: User action → First AI response chunk`,
            `-----------------------------------\n`
        ];

        console.log(performanceLog.join('\n'));
    }

    logChatPerformance(prompt, completeResponse, startTime, endTime, model) {
        const duration = endTime - startTime;
        console.log(`\n=== FULL CHAT PERFORMANCE ===`);
        console.log(`Model: ${model}`);
        console.log(`Full Response Time: ${duration.toFixed(2)}ms`);
        console.log(`Response Length: ${completeResponse.length} chars`);
        console.log(`================================\n`);
    }
}

// Simulate the new chatStream behavior
function simulateChatStream() {
    console.log('🧪 Testing updated end-to-end latency measurement...\n');
    
    const monitor = new TestPerformanceMonitor();
    
    // Simulate user action timing
    const userActionStartTime = performance.now();
    console.log(`👤 User clicks send button at: ${userActionStartTime.toFixed(2)}ms`);
    
    // Simulate some processing delay
    setTimeout(() => {
        const requestStartTime = performance.now();
        console.log(`🔄 Request processing starts at: ${requestStartTime.toFixed(2)}ms`);
        
        // Simulate first chunk arrival
        setTimeout(() => {
            const firstChunkTime = performance.now();
            const firstChunk = "Hello! I can help";
            console.log(`✨ First chunk received at: ${firstChunkTime.toFixed(2)}ms`);
            console.log(`📝 First chunk content: "${firstChunk}"\n`);
            
            // Log end-to-end latency (user action to first response)
            monitor.logEndToEndLatency(
                'Chat Response Time',
                50, // input length
                firstChunk.length,
                userActionStartTime, // From user action
                firstChunkTime
            );
            
            // Simulate complete response
            setTimeout(() => {
                const completeTime = performance.now();
                const fullResponse = "Hello! I can help you with your questions. What would you like to know?";
                console.log(`✅ Complete response at: ${completeTime.toFixed(2)}ms\n`);
                
                // Log full chat performance
                monitor.logChatPerformance(
                    "What can you help me with?",
                    fullResponse,
                    requestStartTime, // From request start
                    completeTime,
                    'gemma3:4b'
                );
                
            }, 1500); // Additional 1.5s for full response
            
        }, 800); // 800ms to first chunk
        
    }, 200); // 200ms processing delay
}

// Test different scenarios
console.log('Testing End-to-End Latency Measurement\n');
console.log('Scenario 1: Normal response time');
simulateChatStream();

setTimeout(() => {
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('Scenario 2: Fast response');
    
    const monitor = new TestPerformanceMonitor();
    const userStart = performance.now();
    const firstResponseTime = userStart + 300; // Very fast 300ms
    
    monitor.logEndToEndLatency(
        'Chat Response Time',
        25,
        12,
        userStart,
        firstResponseTime
    );
}, 4000);

setTimeout(() => {
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('Scenario 3: Slow response');
    
    const monitor = new TestPerformanceMonitor();
    const userStart = performance.now();
    const firstResponseTime = userStart + 6000; // Slow 6s
    
    monitor.logEndToEndLatency(
        'Chat Response Time',
        100,
        5,
        userStart,
        firstResponseTime
    );
}, 6000);
