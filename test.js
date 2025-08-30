"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass = void 0;
exports.helperFunction = helperFunction;
class TestClass extends BaseClass {
    name;
    count = 0;
    static MAX_SIZE = 100;
    constructor(name) {
        super();
        this.name = name;
    }
    async processData(data, options) {
        // Process implementation
        console.log('Processing data');
    }
    validateInput(input) {
        return input && input.length > 0;
    }
    get displayName() {
        return this.name;
    }
}
exports.TestClass = TestClass;
function helperFunction(param) {
    return param.length;
}
//# sourceMappingURL=test.js.map