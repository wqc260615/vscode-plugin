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
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant.maxContextFiles')) {
                this.maxContextFiles = vscode.workspace.getConfiguration('aiAssistant')
                    .get('maxContextFiles', 50);
            }
        });
    }

    /**
     * Add a manually selected reference file
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

            // Check whether the file has already been added
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
     * Remove a reference file
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
     * Initialize current project source file context
     */
    public async initProjectContext(): Promise<void> {
        this.sourceFiles = [];
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        try {
            // Find source code files in the project
            const files = await vscode.workspace.findFiles(
                '**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,php,rb,go,rs,swift,kt}',
                '**/node_modules/**',
                this.maxContextFiles
            );

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const fileName = path.basename(file.fsPath);
                    
                    // For Java files, extract class and method info
                    let content = document.getText();
                    if (fileName.endsWith('.java')) {
                        content = this.extractJavaStructure(content);
                    } else if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
                        content = this.extractTypeScriptStructure(content);
                    } else {
                        // For other files, limit content length
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
     * Extract structural info from Java files
     */
    private extractJavaStructure(content: string): string {
        const lines = content.split('\n');
        const structure: string[] = [];
        
        let currentClass = '';
        let indentLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Track indentation level
            const leadingSpaces = line.length - line.trimLeft().length;
            indentLevel = Math.floor(leadingSpaces / 4);

            // Match class declaration
            const classMatch = trimmed.match(/(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)/);
            if (classMatch) {
                currentClass = classMatch[1];
                structure.push(`Class: ${currentClass}`);
                continue;
            }

            // Match interface declaration
            const interfaceMatch = trimmed.match(/(?:public|private|protected)?\s*interface\s+(\w+)/);
            if (interfaceMatch) {
                currentClass = interfaceMatch[1];
                structure.push(`Interface: ${interfaceMatch[1]}`);
                continue;
            }

            // Match method declaration
            const methodMatch = trimmed.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*[{;]/);
            if (methodMatch && !trimmed.includes('=') && indentLevel > 0) {
                structure.push(`  Method: ${methodMatch[1]}`);
                continue;
            }

            // Match field declaration
            const fieldMatch = trimmed.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*(\w+)\s+(\w+)\s*[=;]/);
            if (fieldMatch && indentLevel > 0) {
                structure.push(`  Field: ${fieldMatch[2]} (${fieldMatch[1]})`);
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    /**
     * Extract structural info from TypeScript/JavaScript files
     */
    private extractTypeScriptStructure(content: string): string {
        const lines = content.split('\n');
        const structure: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Match class declaration
            const classMatch = trimmed.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
            if (classMatch) {
                structure.push(`Class: ${classMatch[1]}`);
                continue;
            }

            // Match interface declaration
            const interfaceMatch = trimmed.match(/(?:export\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                structure.push(`Interface: ${interfaceMatch[1]}`);
                continue;
            }

            // Match function declaration
            const functionMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (functionMatch) {
                structure.push(`Function: ${functionMatch[1]}`);
                continue;
            }

            // Match method declaration
            const methodMatch = trimmed.match(/(\w+)\s*\([^)]*\)\s*[:{]/);
            if (methodMatch && trimmed.includes('(') && !trimmed.includes('=')) {
                structure.push(`  Method: ${methodMatch[1]}`);
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    /**
     * Generate the full prompt
     */
    public async generateFullPrompt(userMessage: string): Promise<string> {
        let prompt = "You are an AI assistant that helps developers understand and work with code.\n";
        prompt += "You will be provided with reference files of a project.\n\n";

        // Add project source file context
        if (this.sourceFiles.length > 0) {
            prompt += "=== Project Source Files ===\n";
            for (let i = 0; i < this.sourceFiles.length; i++) {
                const file = this.sourceFiles[i];
                prompt += `\n--- Source File ${i + 1}: ${file.name} ---\n`;
                prompt += file.content + '\n';
            }
        }

        // Add manually added reference files
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
     * Get the list of currently added reference files
     */
    public getReferenceFiles(): ReferenceFile[] {
        return [...this.referenceFiles];
    }

    /**
     * Get the list of project source files
     */
    public getSourceFiles(): ReferenceFile[] {
        return [...this.sourceFiles];
    }

    /**
     * Clear all reference files
     */
    public clearReferenceFiles(): void {
        this.referenceFiles = [];
    }

    /**
     * Clear project context
     */
    public clearProjectContext(): void {
        this.sourceFiles = [];
    }

    /**
     * Get context statistics
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