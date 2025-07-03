import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ReferenceFile {
    path: string;
    name: string;
    content: string;
    type: 'source' | 'reference';
}

export class ProjectContextProcessor {
    private referenceFiles: ReferenceFile[] = [];
    private sourceFiles: ReferenceFile[] = [];
    private maxContextFiles: number;

    constructor() {
        this.maxContextFiles = vscode.workspace.getConfiguration('aiAssistant')
            .get('maxContextFiles', 50);
        
        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.maxContextFiles')) {
                this.maxContextFiles = vscode.workspace.getConfiguration('aiAssistant')
                    .get('maxContextFiles', 50);
            }
        });
    }

    /**
     * 添加用户手动选择的参考文件
     */
    public async addReferenceFile(filePath: string): Promise<boolean> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            
            const referenceFile: ReferenceFile = {
                path: filePath,
                name: fileName,
                content: content,
                type: 'reference'
            };

            // 检查是否已经添加过
            const existingIndex = this.referenceFiles.findIndex(f => f.path === filePath);
            if (existingIndex >= 0) {
                this.referenceFiles[existingIndex] = referenceFile;
            } else {
                this.referenceFiles.push(referenceFile);
            }

            return true;
        } catch (error) {
            console.error('Error adding reference file:', error);
            return false;
        }
    }

    /**
     * 移除参考文件
     */
    public removeReferenceFile(filePath: string): boolean {
        const index = this.referenceFiles.findIndex(f => f.path === filePath);
        if (index >= 0) {
            this.referenceFiles.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 获取当前项目的源文件上下文
     */
    public async initProjectContext(): Promise<void> {
        this.sourceFiles = [];
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        try {
            // 查找项目中的源代码文件
            const files = await vscode.workspace.findFiles(
                '**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,php,rb,go,rs,swift,kt}',
                '**/node_modules/**',
                this.maxContextFiles
            );

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const fileName = path.basename(file.fsPath);
                    
                    // 如果是Java文件，提取类和方法信息
                    let content = document.getText();
                    if (fileName.endsWith('.java')) {
                        content = this.extractJavaStructure(content);
                    } else if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
                        content = this.extractTypeScriptStructure(content);
                    } else {
                        // 对于其他文件，限制内容长度
                        content = content.substring(0, 2000);
                    }

                    const sourceFile: ReferenceFile = {
                        path: file.fsPath,
                        name: fileName,
                        content: content,
                        type: 'source'
                    };

                    this.sourceFiles.push(sourceFile);
                } catch (error) {
                    console.error(`Error processing file ${file.fsPath}:`, error);
                }
            }
        } catch (error) {
            console.error('Error initializing project context:', error);
        }
    }

    /**
     * 提取Java文件的结构信息
     */
    private extractJavaStructure(content: string): string {
        const lines = content.split('\n');
        const structure: string[] = [];
        
        let currentClass = '';
        let indentLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // 跟踪缩进级别
            const leadingSpaces = line.length - line.trimLeft().length;
            indentLevel = Math.floor(leadingSpaces / 4);

            // 匹配类声明
            const classMatch = trimmed.match(/(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)/);
            if (classMatch) {
                currentClass = classMatch[1];
                structure.push(`Class: ${currentClass}`);
                continue;
            }

            // 匹配接口声明
            const interfaceMatch = trimmed.match(/(?:public|private|protected)?\s*interface\s+(\w+)/);
            if (interfaceMatch) {
                currentClass = interfaceMatch[1];
                structure.push(`Interface: ${interfaceMatch[1]}`);
                continue;
            }

            // 匹配方法声明
            const methodMatch = trimmed.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*[{;]/);
            if (methodMatch && !trimmed.includes('=') && indentLevel > 0) {
                structure.push(`  Method: ${methodMatch[1]}`);
                continue;
            }

            // 匹配字段声明
            const fieldMatch = trimmed.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*(\w+)\s+(\w+)\s*[=;]/);
            if (fieldMatch && indentLevel > 0) {
                structure.push(`  Field: ${fieldMatch[2]} (${fieldMatch[1]})`);
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    /**
     * 提取TypeScript/JavaScript文件的结构信息
     */
    private extractTypeScriptStructure(content: string): string {
        const lines = content.split('\n');
        const structure: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // 匹配类声明
            const classMatch = trimmed.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
            if (classMatch) {
                structure.push(`Class: ${classMatch[1]}`);
                continue;
            }

            // 匹配接口声明
            const interfaceMatch = trimmed.match(/(?:export\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                structure.push(`Interface: ${interfaceMatch[1]}`);
                continue;
            }

            // 匹配函数声明
            const functionMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (functionMatch) {
                structure.push(`Function: ${functionMatch[1]}`);
                continue;
            }

            // 匹配方法声明
            const methodMatch = trimmed.match(/(\w+)\s*\([^)]*\)\s*[:{]/);
            if (methodMatch && trimmed.includes('(') && !trimmed.includes('=')) {
                structure.push(`  Method: ${methodMatch[1]}`);
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    /**
     * 生成完整的提示词
     */
    public async generateFullPrompt(userMessage: string): Promise<string> {
        let prompt = "You are an AI assistant that helps developers understand and work with code.\n";
        prompt += "You will be provided with reference files of a project.\n\n";

        // 添加项目源文件上下文
        if (this.sourceFiles.length > 0) {
            prompt += "=== Project Source Files ===\n";
            for (let i = 0; i < this.sourceFiles.length; i++) {
                const file = this.sourceFiles[i];
                prompt += `\n--- Source File ${i + 1}: ${file.name} ---\n`;
                prompt += file.content + '\n';
            }
        }

        // 添加用户手动添加的参考文件
        if (this.referenceFiles.length > 0) {
            prompt += "\n=== Reference Files (Manually Added) ===\n";
            for (let i = 0; i < this.referenceFiles.length; i++) {
                const file = this.referenceFiles[i];
                prompt += `\n--- Reference File ${i + 1}: ${file.name} ---\n`;
                prompt += file.content + '\n';
            }
        }

        prompt += "\n=== User Question ===\n";
        prompt += userMessage;

        return prompt;
    }

    /**
     * 获取当前添加的参考文件列表
     */
    public getReferenceFiles(): ReferenceFile[] {
        return [...this.referenceFiles];
    }

    /**
     * 获取项目源文件列表
     */
    public getSourceFiles(): ReferenceFile[] {
        return [...this.sourceFiles];
    }

    /**
     * 清除所有参考文件
     */
    public clearReferenceFiles(): void {
        this.referenceFiles = [];
    }

    /**
     * 清除项目上下文
     */
    public clearProjectContext(): void {
        this.sourceFiles = [];
    }

    /**
     * 获取上下文统计信息
     */
    public getContextStats(): {
        referenceFiles: number;
        sourceFiles: number;
        totalSize: number;
    } {
        const totalSize = [...this.referenceFiles, ...this.sourceFiles]
            .reduce((sum, file) => sum + file.content.length, 0);

        return {
            referenceFiles: this.referenceFiles.length,
            sourceFiles: this.sourceFiles.length,
            totalSize: totalSize
        };
    }
}