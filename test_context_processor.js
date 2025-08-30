// Test script for improved Context Processor
// This tests the AST parsing and length control improvements

// Mock TypeScript example for testing AST parsing
const mockTSFile = `
import * as vscode from 'vscode';
import { SomeInterface } from './types';

export interface MyInterface<T> {
    id: string;
    data: T;
    optional?: boolean;
}

export type MyType = string | number;

export class MyService implements SomeInterface {
    private _config: vscode.WorkspaceConfiguration;
    public readonly id: string;
    
    constructor(config: vscode.WorkspaceConfiguration) {
        this._config = config;
        this.id = 'test-service';
    }
    
    public async processData<T>(input: T, options?: ProcessOptions): Promise<Result<T>> {
        return this.internalProcess(input, options);
    }
    
    private internalProcess<T>(data: T, opts: ProcessOptions): Result<T> {
        // Implementation here
        return { success: true, data };
    }
    
    get config(): vscode.WorkspaceConfiguration {
        return this._config;
    }
    
    set config(value: vscode.WorkspaceConfiguration) {
        this._config = value;
    }
}

export function utilityFunction(param1: string, param2: number): boolean {
    return param1.length > param2;
}
`;

// Mock Java example for testing AST parsing
const mockJavaFile = `
package com.example.service;

import java.util.List;
import java.util.Map;
import com.example.model.User;

public interface UserService {
    User findById(Long id);
    List<User> findAll();
    User save(User user);
}

public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private static final Logger logger = LoggerFactory.getLogger(UserServiceImpl.class);
    
    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @Override
    public User findById(Long id) throws UserNotFoundException {
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));
    }
    
    @Override
    public List<User> findAll() {
        return userRepository.findAll();
    }
    
    @Override 
    public User save(User user) {
        validateUser(user);
        return userRepository.save(user);
    }
    
    private void validateUser(User user) {
        if (user.getName() == null || user.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("User name cannot be empty");
        }
    }
    
    public Map<String, Object> getUserStats() {
        // Implementation
        return Collections.emptyMap();
    }
}
`;

// Mock ProjectContextProcessor for testing
class TestProjectContextProcessor {
    constructor() {
        this.maxFileContentLength = 3000;
    }

    extractJavaStructure(content) {
        const lines = content.split('\n');
        const structure = [];
        
        let braceDepth = 0;
        let inClass = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') {
                continue;
            }

            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            braceDepth += openBraces - closeBraces;

            if (trimmed.startsWith('package ') || trimmed.startsWith('import ')) {
                structure.push(trimmed);
                continue;
            }

            const classMatch = trimmed.match(/^(?:(?:public|private|protected|final|abstract)\s+)*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{?/);
            if (classMatch) {
                structure.push(`\nClass: ${classMatch[1]}`);
                inClass = true;
                continue;
            }

            const interfaceMatch = trimmed.match(/^(?:(?:public|private|protected)\s+)*interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{?/);
            if (interfaceMatch) {
                structure.push(`\nInterface: ${interfaceMatch[1]}`);
                inClass = true;
                continue;
            }

            const methodMatch = trimmed.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*(?:[\w<>\[\]]+\s+)+(\w+)\s*\([^)]*\)(?:\s+throws\s+[\w,\s]+)?\s*[{;]?/);
            if (methodMatch && inClass && braceDepth > 0 && !trimmed.includes('=') && !trimmed.includes('new ')) {
                const paramMatch = trimmed.match(/\(([^)]*)\)/);
                const params = paramMatch && paramMatch[1] ? paramMatch[1].trim() : '';
                structure.push(`  Method: ${methodMatch[1]}(${params.length > 30 ? params.substring(0, 30) + '...' : params})`);
                continue;
            }

            const fieldMatch = trimmed.match(/^(?:(?:public|private|protected|static|final)\s+)+([\w<>\[\]]+)\s+(\w+)(?:\s*=.*)?[;,]?/);
            if (fieldMatch && inClass && braceDepth > 0 && !trimmed.includes('(')) {
                structure.push(`  Field: ${fieldMatch[2]} : ${fieldMatch[1]}`);
            }

            if (braceDepth <= 0 && inClass) {
                inClass = false;
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    extractTypeScriptStructure(content) {
        const lines = content.split('\n');
        const structure = [];
        let braceDepth = 0;
        let inClass = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') {
                continue;
            }

            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            braceDepth += openBraces - closeBraces;

            if (trimmed.startsWith('import ') || trimmed.startsWith('export ') && !trimmed.includes('class') && !trimmed.includes('interface') && !trimmed.includes('function')) {
                structure.push(trimmed);
                continue;
            }

            const classMatch = trimmed.match(/^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w<>]+)?(?:\s+implements\s+[\w<>,\s]+)?\s*\{?/);
            if (classMatch) {
                structure.push(`\nClass: ${classMatch[1]}`);
                inClass = true;
                continue;
            }

            const interfaceMatch = trimmed.match(/^(?:export\s+)?(?:declare\s+)?interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w<>,\s]+)?\s*\{?/);
            if (interfaceMatch) {
                structure.push(`\nInterface: ${interfaceMatch[1]}`);
                inClass = true;
                continue;
            }

            const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=/);
            if (typeMatch) {
                structure.push(`Type: ${typeMatch[1]}`);
                continue;
            }

            const functionMatch = trimmed.match(/^(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s+(\w+)(?:<[^>]*>)?\s*\([^)]*\)/);
            if (functionMatch && braceDepth === 0) {
                const paramMatch = trimmed.match(/\(([^)]*)\)/);
                const params = paramMatch && paramMatch[1] ? paramMatch[1].trim() : '';
                structure.push(`Function: ${functionMatch[1]}(${params.length > 30 ? params.substring(0, 30) + '...' : params})`);
                continue;
            }

            if (inClass && braceDepth > 0) {
                const methodMatch = trimmed.match(/^(?:(?:public|private|protected|static|readonly|async|get|set)\s+)*(\w+)(?:<[^>]*>)?\s*\([^)]*\)\s*[:{]/);
                if (methodMatch && !trimmed.includes('=') && !trimmed.includes('new ')) {
                    const paramMatch = trimmed.match(/\(([^)]*)\)/);
                    const params = paramMatch && paramMatch[1] ? paramMatch[1].trim() : '';
                    structure.push(`  Method: ${methodMatch[1]}(${params.length > 30 ? params.substring(0, 30) + '...' : params})`);
                    continue;
                }

                const propertyMatch = trimmed.match(/^(?:(?:public|private|protected|static|readonly)\s+)*(\w+)(?:\?)?:\s*([\w<>\[\]|&\s]+)(?:\s*=.*)?[;,]?$/);
                if (propertyMatch && !trimmed.includes('(')) {
                    structure.push(`  Property: ${propertyMatch[1]} : ${propertyMatch[2]}`);
                }
            }

            if (braceDepth <= 0 && inClass) {
                inClass = false;
            }
        }

        return structure.length > 0 ? structure.join('\n') : content.substring(0, 1000);
    }

    truncateContent(content, maxLength) {
        if (content.length <= maxLength) {
            return content;
        }

        const truncated = content.substring(0, maxLength);
        const lastNewlineIndex = truncated.lastIndexOf('\n');
        
        if (lastNewlineIndex > maxLength * 0.8) {
            return truncated.substring(0, lastNewlineIndex) + '\n\n// ... (content truncated)';
        } else {
            return truncated + '\n\n// ... (content truncated)';
        }
    }
}

// Run tests
console.log('🧪 Testing improved Context Processor...\n');

const processor = new TestProjectContextProcessor();

console.log('📝 Testing TypeScript AST Parsing:');
console.log('='.repeat(50));
const tsStructure = processor.extractTypeScriptStructure(mockTSFile);
console.log(tsStructure);

console.log('\n📝 Testing Java AST Parsing:');
console.log('='.repeat(50));
const javaStructure = processor.extractJavaStructure(mockJavaFile);
console.log(javaStructure);

console.log('\n📏 Testing Content Truncation:');
console.log('='.repeat(50));
const longContent = "This is a very long content that should be truncated.\n".repeat(100);
console.log(`Original length: ${longContent.length} characters`);
const truncated = processor.truncateContent(longContent, 500);
console.log(`Truncated length: ${truncated.length} characters`);
console.log('Truncated content preview:');
console.log(truncated.substring(truncated.length - 100));

console.log('\n✅ All tests completed!');
