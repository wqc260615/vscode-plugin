/**
 * 测试改进后的AST解析功能
 */

const fs = require('fs');
const path = require('path');

// 创建测试的TypeScript文件内容
const testTypeScriptContent = `
import { vscode } from './types';
import * as fs from 'fs';

export class TestClass extends BaseClass implements ITestInterface {
    private name: string;
    public count: number = 0;
    private static readonly MAX_SIZE = 100;

    constructor(name: string) {
        super();
        this.name = name;
    }

    public async processData(data: any[], options?: ProcessOptions): Promise<void> {
        // Process implementation
        console.log('Processing data');
    }

    private validateInput(input: string): boolean {
        return input && input.length > 0;
    }

    get displayName(): string {
        return this.name;
    }
}

export interface ITestInterface {
    processData(data: any[]): Promise<void>;
}

export function helperFunction(param: string): number {
    return param.length;
}
`;

// 创建测试的Java文件内容
const testJavaContent = `
package com.example.test;

import java.util.List;
import java.util.ArrayList;

public class TestService implements ITestService {
    private String name;
    public int count = 0;
    private static final int MAX_SIZE = 100;

    public TestService(String name) {
        this.name = name;
    }

    @Override
    public void processData(List<String> data, ProcessOptions options) {
        // Implementation
        System.out.println("Processing data");
    }

    private boolean validateInput(String input) {
        return input != null && !input.isEmpty();
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}

interface ITestService {
    void processData(List<String> data, ProcessOptions options);
}
`;

console.log('Testing AST parsing improvements...');
console.log('TypeScript content length:', testTypeScriptContent.length);
console.log('Java content length:', testJavaContent.length);

// 写入测试文件
fs.writeFileSync('test.ts', testTypeScriptContent);
fs.writeFileSync('test.java', testJavaContent);

console.log('Test files created successfully!');
console.log('You can now test the improved AST parsing in your VS Code extension.');
