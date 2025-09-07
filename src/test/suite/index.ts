import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
    // Create Mocha test instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000, // 30s timeout; allow extra time for services and async ops
        slow: 5000 // Tests slower than 5s are considered slow
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise(async (resolve, reject) => {
        try {
            // Find all test files
            const files = await glob('**/**.test.js', { cwd: testsRoot });

            // Add test files to Mocha
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            // Run tests
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