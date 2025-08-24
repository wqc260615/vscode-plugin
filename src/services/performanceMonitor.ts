import * as vscode from 'vscode';

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AI Assistant Performance');
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * 记录聊天响应性能
     */
    public logChatPerformance(
        prompt: string,
        response: string,
        startTime: number,
        endTime: number,
        model: string
    ): void {
        const duration = endTime - startTime;
        const tokenCount = this.estimateTokenCount(response);
        const tokensPerSecond = (tokenCount / duration) * 1000;

        const performanceLog = [
            `=== Chat Response Performance ===`,
            `Time: ${new Date().toLocaleTimeString()}`,
            `Model: ${model}`,
            `Prompt Length: ${prompt.length} characters`,
            `Response Length: ${response.length} characters`,
            `Estimated Tokens: ${tokenCount}`,
            `Response Time: ${duration.toFixed(2)}ms`,
            `Token Generation Speed: ${tokensPerSecond.toFixed(2)} tokens/sec`,
            `Average Speed: ${this.getSpeedCategory(tokensPerSecond)}`,
            `-----------------------------------\n`
        ];

        console.log(performanceLog.join('\n'));
        this.outputChannel.appendLine(performanceLog.join('\n'));
    }

    /**
     * 记录代码补全性能
     */
    public logCompletionPerformance(
        context: string,
        completion: string,
        startTime: number,
        endTime: number,
        model: string
    ): void {
        const duration = endTime - startTime;
        const tokenCount = this.estimateTokenCount(completion);

        const performanceLog = [
            `=== Code Completion Performance ===`,
            `Time: ${new Date().toLocaleTimeString()}`,
            `Model: ${model}`,
            `Context Length: ${context.length} characters`,
            `Completion Length: ${completion.length} characters`,
            `Estimated Tokens: ${tokenCount}`,
            `Response Time: ${duration.toFixed(2)}ms`,
            `Performance: ${this.getLatencyCategory(duration)}`,
            `-----------------------------------\n`
        ];

        console.log(performanceLog.join('\n'));
        this.outputChannel.appendLine(performanceLog.join('\n'));
    }

    /**
     * 记录内联聊天性能
     */
    public logInlineChatPerformance(
        userInput: string,
        generatedCode: string,
        startTime: number,
        endTime: number,
        model: string
    ): void {
        const duration = endTime - startTime;
        const tokenCount = this.estimateTokenCount(generatedCode);
        const tokensPerSecond = (tokenCount / duration) * 1000;

        const performanceLog = [
            `=== Inline Chat Performance ===`,
            `Time: ${new Date().toLocaleTimeString()}`,
            `Model: ${model}`,
            `User Input: "${userInput.substring(0, 50)}${userInput.length > 50 ? '...' : ''}"`,
            `Generated Code Length: ${generatedCode.length} characters`,
            `Estimated Tokens: ${tokenCount}`,
            `Response Time: ${duration.toFixed(2)}ms`,
            `Token Generation Speed: ${tokensPerSecond.toFixed(2)} tokens/sec`,
            `Performance: ${this.getLatencyCategory(duration)}`,
            `-----------------------------------\n`
        ];

        console.log(performanceLog.join('\n'));
        this.outputChannel.appendLine(performanceLog.join('\n'));
    }

    /**
     * 记录端到端延迟（从用户操作到首次响应）
     */
    public logEndToEndLatency(
        operation: string,
        inputLength: number,
        firstChunkLength: number,
        startTime: number,
        endTime: number
    ): void {
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
        this.outputChannel.appendLine(performanceLog.join('\n'));
    }

    /**
     * 估算token数量（简单估算：按空格分割）
     */
    private estimateTokenCount(text: string): number {
        if (!text || text.trim().length === 0) {
            return 0;
        }
        // 简单估算：大约每4个字符为1个token，或按单词数计算
        const wordCount = text.trim().split(/\s+/).length;
        const charCount = text.length;
        return Math.max(wordCount, Math.floor(charCount / 4));
    }

    /**
     * 获取速度分类
     */
    private getSpeedCategory(tokensPerSecond: number): string {
        if (tokensPerSecond >= 20) {
            return '🚀 Excellent (>20 tokens/sec)';
        } else if (tokensPerSecond >= 10) {
            return '✅ Good (10-20 tokens/sec)';
        } else if (tokensPerSecond >= 5) {
            return '⚠️ Fair (5-10 tokens/sec)';
        } else {
            return '🐌 Slow (<5 tokens/sec)';
        }
    }

    /**
     * 获取延迟分类
     */
    private getLatencyCategory(latencyMs: number): string {
        if (latencyMs < 500) {
            return '🚀 Excellent (<0.5s)';
        } else if (latencyMs < 1000) {
            return '✅ Good (0.5-1s)';
        } else if (latencyMs < 3000) {
            return '⚠️ Fair (1-3s)';
        } else if (latencyMs < 5000) {
            return '🐌 Slow (3-5s)';
        } else {
            return '🔴 Very Slow (>5s)';
        }
    }

    /**
     * 显示性能输出面板
     */
    public showPerformanceOutput(): void {
        this.outputChannel.show();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
