import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
    // 创建Mocha测试实例
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000, // 30秒超时，增加超时时间以处理新服务和异步操作
        slow: 5000 // 5秒被认为是慢测试
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise(async (resolve, reject) => {
        try {
            // 查找所有测试文件
            const files = await glob('**/**.test.js', { cwd: testsRoot });

            // 添加测试文件到Mocha
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            // 运行测试
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
} 