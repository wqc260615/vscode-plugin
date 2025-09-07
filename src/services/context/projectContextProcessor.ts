import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parse as parseTypeScript } from '@typescript-eslint/parser';
import { parse as parseBabel } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

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
    private maxPromptLength: number;
    private maxFileContentLength: number;

    constructor() {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        this.maxContextFiles = config.get('maxContextFiles', 50);
        this.maxPromptLength = config.get('maxPromptLength', 50000); // 50KB max prompt
        this.maxFileContentLength = config.get('maxFileContentLength', 3000); // 3KB per file
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiAssistant')) {
                const newConfig = vscode.workspace.getConfiguration('aiAssistant');
                this.maxContextFiles = newConfig.get('maxContextFiles', 50);
                this.maxPromptLength = newConfig.get('maxPromptLength', 50000);
                this.maxFileContentLength = newConfig.get('maxFileContentLength', 3000);
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
                    
                    // Extract structure based on file type or truncate content
                    let content = document.getText();
                    if (fileName.endsWith('.java')) {
                        content = this.extractJavaStructure(content);
                    } else if (fileName.endsWith('.ts') || fileName.endsWith('.js') || fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
                        content = this.extractTypeScriptStructure(content, file.fsPath);
                    } else {
                        // For other files, limit content length
                        content = this.truncateContent(content, this.maxFileContentLength);
                    }

                    // Ensure the content does not exceed the maximum length
                    content = this.truncateContent(content, this.maxFileContentLength);

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
     * Extract Java file structure using an improved parsing approach
     * Note: This uses a more precise logic than regex, though not a full AST parser
     */
    private extractJavaStructure(content: string): string {
        try {
            const structure: string[] = [];
            const lines = content.split('\n');
            
            let braceDepth = 0;
            let inClass = false;
            let inInterface = false;
            let inMethod = false;
            let inComment = false;
            let currentClass = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // Handle multi-line comments
                if (trimmed.includes('/*')) {
                    inComment = true;
                }
                if (trimmed.includes('*/')) {
                    inComment = false;
                    continue;
                }
                if (inComment || trimmed.startsWith('//') || trimmed === '') {
                    continue;
                }

                // Track brace depth (more precise)
                let tempBraceDepth = braceDepth;
                for (const char of line) {
                    if (char === '{') {
                        tempBraceDepth++;
                    }
                    if (char === '}') {
                        tempBraceDepth--;
                    }
                }
                
                // Handle package declarations and imports
                if (trimmed.startsWith('package ')) {
                    structure.push(trimmed);
                    continue;
                }
                if (trimmed.startsWith('import ')) {
                    structure.push(trimmed);
                    continue;
                }

                // Class declaration detection (more precise)
                if (this.isJavaClassDeclaration(trimmed)) {
                    const className = this.extractJavaClassName(trimmed);
                    if (className) {
                        currentClass = className;
                        structure.push(`\nClass: ${className}`);
                        if (trimmed.includes('extends')) {
                            const extendsMatch = trimmed.match(/extends\s+(\w+)/);
                            if (extendsMatch) {
                                structure[structure.length - 1] += ` extends ${extendsMatch[1]}`;
                            }
                        }
                        if (trimmed.includes('implements')) {
                            const implementsMatch = trimmed.match(/implements\s+([\w\s,]+)/);
                            if (implementsMatch) {
                                structure[structure.length - 1] += ` implements ${implementsMatch[1].trim()}`;
                            }
                        }
                        inClass = true;
                    }
                }

                // Interface declaration detection
                if (this.isJavaInterfaceDeclaration(trimmed)) {
                    const interfaceName = this.extractJavaInterfaceName(trimmed);
                    if (interfaceName) {
                        structure.push(`\nInterface: ${interfaceName}`);
                        inInterface = true;
                    }
                }

                // Method declaration detection (inside class or interface)
                if ((inClass || inInterface) && braceDepth > 0) {
                    if (this.isJavaMethodDeclaration(trimmed)) {
                        const methodInfo = this.extractJavaMethodInfo(trimmed);
                        if (methodInfo) {
                            structure.push(`  Method: ${methodInfo}`);
                        }
                    }
                    
                    // Field declaration detection
                    if (this.isJavaFieldDeclaration(trimmed, braceDepth)) {
                        const fieldInfo = this.extractJavaFieldInfo(trimmed);
                        if (fieldInfo) {
                            structure.push(`  Field: ${fieldInfo}`);
                        }
                    }
                }

                // Update brace depth
                braceDepth = tempBraceDepth;

                // Detect end of class/interface
                if (braceDepth <= 0 && (inClass || inInterface)) {
                    inClass = false;
                    inInterface = false;
                }
            }

            return structure.length > 0 ? structure.join('\n') : this.truncateContent(content, 1000);
        } catch (error) {
            console.warn('Java parsing failed, falling back to truncated content:', error);
            return this.truncateContent(content, 1000);
        }
    }

    // Java parsing helper methods
    private isJavaClassDeclaration(line: string): boolean {
        // Check for class declaration, excluding complex cases like inner classes
        const classPattern = /^(?:(?:public|private|protected|abstract|final|static)\s+)*class\s+\w+/;
        return classPattern.test(line) && !line.includes('=') && !line.includes('new ');
    }

    private isJavaInterfaceDeclaration(line: string): boolean {
        const interfacePattern = /^(?:(?:public|private|protected)\s+)*interface\s+\w+/;
        return interfacePattern.test(line);
    }

    private extractJavaClassName(line: string): string | null {
        const match = line.match(/class\s+(\w+)/);
        return match ? match[1] : null;
    }

    private extractJavaInterfaceName(line: string): string | null {
        const match = line.match(/interface\s+(\w+)/);
        return match ? match[1] : null;
    }

    private isJavaMethodDeclaration(line: string): boolean {
        // Check method declaration pattern
        return line.includes('(') && line.includes(')') && 
               !line.includes('=') && 
               !line.includes('new ') &&
               !line.includes('if ') &&
               !line.includes('while ') &&
               !line.includes('for ') &&
               (line.includes('public ') || line.includes('private ') || line.includes('protected ') || 
                line.includes('static ') || line.includes('final ') || line.includes('abstract ') ||
                Boolean(line.match(/^\s*\w+\s+\w+\s*\(/))); // simple "returnType methodName(" pattern
    }

    private extractJavaMethodInfo(line: string): string | null {
        // Extract method name and parameters
        const methodMatch = line.match(/(\w+)\s*\(([^)]*)\)/);
        if (methodMatch) {
            const methodName = methodMatch[1];
            const params = methodMatch[2].trim();
            const shortParams = params.length > 50 ? params.substring(0, 50) + '...' : params;
            return `${methodName}(${shortParams})`;
        }
        return null;
    }

    private isJavaFieldDeclaration(line: string, braceDepth: number): boolean {
        // Field declaration: inside a class, has type and variable name, ends with semicolon
        return braceDepth > 0 && 
               !line.includes('(') && 
               !line.includes('{') &&
               (line.includes(';') || line.includes('=')) &&
               !line.includes('if ') &&
               !line.includes('while ') &&
               !line.includes('for ') &&
               (line.includes('public ') || line.includes('private ') || line.includes('protected ') || 
                line.includes('static ') || line.includes('final ') ||
                Boolean(line.match(/^\s*\w+\s+\w+/))); // type and variable name pattern
    }

    private extractJavaFieldInfo(line: string): string | null {
        // Extract field type and name
        const fieldMatch = line.match(/(?:public|private|protected|static|final|\s)+(\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)/);
        if (fieldMatch) {
            return `${fieldMatch[2]} : ${fieldMatch[1]}`;
        }
        return null;
    }

    /**
     * Extract TypeScript/JavaScript file structure using AST parsing
     */
    private extractTypeScriptStructure(content: string, filePath: string): string {
        try {
            const structure: string[] = [];
            
            // Use Babel parser which is more tolerant to various syntax
            const ast = parseBabel(content, {
                sourceType: 'module',
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true,
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                    'functionBind',
                    'exportDefaultFrom',
                    'exportNamespaceFrom',
                    'dynamicImport',
                    'nullishCoalescingOperator',
                    'optionalChaining'
                ]
            });

            // Traverse AST nodes
            traverse(ast, {
                // Import declarations
                ImportDeclaration(path: any) {
                    const node = path.node;
                    if (t.isStringLiteral(node.source)) {
                        structure.push(`import ... from '${node.source.value}'`);
                    }
                },

                // Export declarations
                ExportNamedDeclaration(path: any) {
                    const node = path.node;
                    if (node.declaration) {
                        if (t.isVariableDeclaration(node.declaration)) {
                            structure.push(`export ${node.declaration.kind} ...`);
                        } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
                            structure.push(`export function ${node.declaration.id.name}`);
                        }
                    }
                },

                // Class declarations
                ClassDeclaration(path: any) {
                    const node = path.node;
                    if (node.id) {
                        let classInfo = `\nClass: ${node.id.name}`;
                        if (node.superClass && t.isIdentifier(node.superClass)) {
                            classInfo += ` extends ${node.superClass.name}`;
                        }
                        structure.push(classInfo);
                    }
                },

                // Interface declarations (TypeScript)
                TSInterfaceDeclaration(path: any) {
                    const node = path.node;
                    let interfaceInfo = `\nInterface: ${node.id.name}`;
                    if (node.extends && node.extends.length > 0) {
                        const extendsList = node.extends.map((ext: any) => 
                            t.isIdentifier(ext.expression) ? ext.expression.name : 'unknown'
                        ).join(', ');
                        interfaceInfo += ` extends ${extendsList}`;
                    }
                    structure.push(interfaceInfo);
                },

                // Type alias declarations (TypeScript)
                TSTypeAliasDeclaration(path: any) {
                    const node = path.node;
                    structure.push(`Type: ${node.id.name}`);
                },

                // Function declarations
                FunctionDeclaration(path: any) {
                    const node = path.node;
                    if (node.id) {
                        const params = node.params.map((param: any) => {
                            if (t.isIdentifier(param)) {
                                return param.name;
                            } else if (t.isObjectPattern(param)) {
                                return '{ ... }';
                            } else if (t.isArrayPattern(param)) {
                                return '[ ... ]';
                            }
                            return '...';
                        }).join(', ');
                        structure.push(`Function: ${node.id.name}(${params})`);
                    }
                },

                // Method definitions
                ClassMethod(path: any) {
                    const node = path.node;
                    if (t.isIdentifier(node.key)) {
                        const params = node.params.map((param: any) => {
                            if (t.isIdentifier(param)) {
                                return param.name;
                            }
                            return '...';
                        }).join(', ');
                        
                        let methodType = '';
                        if (node.kind === 'constructor') {
                            methodType = 'Constructor';
                        } else if (node.kind === 'get') {
                            methodType = 'Getter';
                        } else if (node.kind === 'set') {
                            methodType = 'Setter';
                        } else {
                            methodType = node.static ? 'Static Method' : 'Method';
                        }
                        
                        structure.push(`  ${methodType}: ${node.key.name}(${params})`);
                    }
                },

                // Class properties
                ClassProperty(path: any) {
                    const node = path.node;
                    if (t.isIdentifier(node.key)) {
                        const access = node.static ? 'Static Property' : 'Property';
                        structure.push(`  ${access}: ${node.key.name}`);
                    }
                },

                // Variable declarations
                VariableDeclaration(path: any) {
                    const node = path.node;
                    // Only handle top-level variable declarations
                    if (path.scope.parent === null || path.getFunctionParent() === null) {
                        node.declarations.forEach((declarator: any) => {
                            if (t.isIdentifier(declarator.id)) {
                                structure.push(`${node.kind} ${declarator.id.name}`);
                            }
                        });
                    }
                }
            });

            return structure.length > 0 ? structure.join('\n') : this.truncateContent(content, 1000);
        } catch (error) {
            console.warn('AST parsing failed, falling back to truncated content:', error);
            return this.truncateContent(content, 1000);
        }
    }

    /**
     * Intelligently truncate content while preserving code structure
     */
    private truncateContent(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }

        // Try truncating at a full line boundary
        const truncated = content.substring(0, maxLength);
        const lastNewlineIndex = truncated.lastIndexOf('\n');
        
        if (lastNewlineIndex > maxLength * 0.8) {
            // If the last newline position is reasonable, truncate there
            return truncated.substring(0, lastNewlineIndex) + '\n\n// ... (content truncated)';
        } else {
            // Otherwise, truncate directly and add a marker
            return truncated + '\n\n// ... (content truncated)';
        }
    }

    /**
     * Prioritize files (important first)
     */
    private prioritizeFiles(files: ReferenceFile[]): ReferenceFile[] {
        return files.sort((a, b) => {
            // Priority: config > main source > tests > others
            const getPriority = (file: ReferenceFile): number => {
                const name = file.name.toLowerCase();
                const path = file.path.toLowerCase();
                
                // Config files highest priority
                if (name.includes('config') || name.includes('package.json') || name.includes('tsconfig') || name.includes('pom.xml')) {
                    return 10;
                }
                
                // Main source files
                if (name.includes('main') || name.includes('index') || name.includes('app') || path.includes('src/main')) {
                    return 8;
                }
                
                // Service and core feature files
                if (name.includes('service') || name.includes('manager') || name.includes('provider') || name.includes('controller')) {
                    return 7;
                }
                
                // Test files lower priority
                if (name.includes('test') || name.includes('spec') || path.includes('test/') || path.includes('__tests__')) {
                    return 3;
                }
                
                // Other files
                return 5;
            };
            
            return getPriority(b) - getPriority(a);
        });
    }

    /**
     * Generate a full prompt with smart length control
     */
    public async generateFullPrompt(userMessage: string): Promise<string> {
        let prompt = "You are an AI assistant that helps developers understand and work with code.\n";
        prompt += "You will be provided with reference files of a project.\n\n";

        let currentLength = prompt.length + userMessage.length + 100; // leave some buffer space
        const maxAllowedLength = this.maxPromptLength - currentLength;

        // Merge and prioritize all files
        const allFiles = [...this.referenceFiles, ...this.sourceFiles];
        const prioritizedFiles = this.prioritizeFiles(allFiles);

        // Add file content until reaching the length limit
        const addedFiles: ReferenceFile[] = [];
        let totalAddedLength = 0;

        for (const file of prioritizedFiles) {
            const fileSection = `\n--- ${file.type === 'reference' ? 'Reference' : 'Source'} File: ${file.name} ---\n${file.content}\n`;
            
            if (totalAddedLength + fileSection.length > maxAllowedLength) {
                // If adding this file exceeds the limit, try truncating
                const remainingSpace = maxAllowedLength - totalAddedLength;
                if (remainingSpace > 500) { // add only if at least 500 characters are available
                    const truncatedContent = this.truncateContent(file.content, remainingSpace - 200);
                    const truncatedSection = `\n--- ${file.type === 'reference' ? 'Reference' : 'Source'} File: ${file.name} (truncated) ---\n${truncatedContent}\n`;
                    addedFiles.push({...file, content: truncatedContent});
                    totalAddedLength += truncatedSection.length;
                }
                break;
            }

            addedFiles.push(file);
            totalAddedLength += fileSection.length;
        }

        // Build the final prompt
        const referenceFiles = addedFiles.filter(f => f.type === 'reference');
        const sourceFiles = addedFiles.filter(f => f.type === 'source');

        // Add project source file context
        if (sourceFiles.length > 0) {
            prompt += "=== Project Source Files ===\n";
            for (let i = 0; i < sourceFiles.length; i++) {
                const file = sourceFiles[i];
                prompt += `\n--- Source File ${i + 1}: ${file.name} ---\n`;
                prompt += file.content + '\n';
            }
        }

        // Add user-added reference files
        if (referenceFiles.length > 0) {
            prompt += "\n=== Reference Files (Manually Added) ===\n";
            for (let i = 0; i < referenceFiles.length; i++) {
                const file = referenceFiles[i];
                prompt += `\n--- Reference File ${i + 1}: ${file.name} ---\n`;
                prompt += file.content + '\n';
            }
        }

        // Add statistics
        const skippedFiles = prioritizedFiles.length - addedFiles.length;
        if (skippedFiles > 0) {
            prompt += `\n--- Context Summary ---\n`;
            prompt += `Included ${addedFiles.length} files (${sourceFiles.length} source, ${referenceFiles.length} reference)\n`;
            prompt += `Skipped ${skippedFiles} files due to length constraints\n`;
        }

        prompt += "\n=== User Question ===\n";
        prompt += userMessage;

        // Final length check
        if (prompt.length > this.maxPromptLength) {
            console.warn(`Generated prompt length (${prompt.length}) exceeds max length (${this.maxPromptLength}), truncating...`);
            prompt = prompt.substring(0, this.maxPromptLength - 100) + '\n\n... (prompt truncated due to length)';
        }

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