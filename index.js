const peg = require("pegjs");
const promisesfs = require('fs/promises');

function createSource(file, line) {
    return '#line ' + line + ' "' + file + '"\n';
}
// convert modifier to c# style
function modifierToCSharp(modifier) {
    switch (modifier) {
        case "pub":
            return "public";
        case "protect":
            return "protected";
        case "virtual":
            return "virtual";
        case "noinst":
            return "static";
        default:
            return '/* not implement */';
    }
}

// convert this tree to c# code
let file = '[memory].gr';

function astWalker(node) {
    if (node.type == 'Ast') {
        return node.body.reduce((total, curr) => {
            return total + astWalker(curr) + '\n';
        }, '');
    } else if (node.type == 'ImportStatement') {
        return 'using ' + astWalker(node.target) + ';';
    } else if (node.type == 'StaticAccess') {
        return astWalker(node.curr) + (node.next ? '.' + astWalker(node.next) : '');
    } else if (node.type == 'Identifier') {
        return node.value;
    } else if (node.type == 'TypeDeclaration') {
        let result = '';
        if (node.modifiers)
            result += node.modifiers.map(value => modifierToCSharp(value)).join(' ') + ' ';
        result += 'class ' + astWalker(node.typeName) + ' ' + astWalker(node.body) + '\n';
        return result;
    } else if (node.type == 'Block') {
        return '{\n' + node.value.reduce((total, curr) => {
            return total + astWalker(curr) + (node.blockType == 'code' && !['WhileStatement', 'IfStatement'].includes(curr.type) ? ';' : '') + '\n';
        }, '') + '}';
    } else if (node.type == 'FunctionDeclaration') {
        let result = '';
        if (node.modifiers)
            result += node.modifiers.map(value => modifierToCSharp(value)).join(' ') + ' ';
        if (node.returnType)
            result += astWalker(node.returnType);
        else result += 'void';
        result += ' ' + astWalker(node.functionName) + '(';
        result += node.argList.map(item => astWalker(item)).join(', ');
        result += ') ' + astWalker(node.body);
        return result;
    } else if (node.type == 'VariableDeclarator') {
        return astWalker(node.varType) + ' ' + astWalker(node.varName) + (node.defaultValue ? ' = ' + astWalker(node.defaultValue) : '');
    } else if (node.type == 'Call') {
        return astWalker(node.callee) + '(' + node.args.map(item => astWalker(item)).join(',') + ')';
    } else if (node.type == 'ExpressionAccess') {
        return astWalker(node.left) + '.' + astWalker(node.right);
    } else if (node.type == 'StringLiteral') {
        return '"' + node.value + '"';
    } else if (node.type == 'NumberLiteral') {
        return node.value;
    } else if (node.type == 'BooleanLiteral') {
        return node.value;
    } else if (node.type == 'IfStatement') {
        return 'if (' + astWalker(node.condition) + ') ' + astWalker(node.body);
    } else if (node.type == 'WhileStatement') {
        return 'while (' + astWalker(node.condition) + ') ' + astWalker(node.body);
    } else if (node.type == 'ReturnStatement') {
        return 'return ' + astWalker(node.value);
    } else if (node.type == 'InfixExpression') {
        return astWalker(node.left) + ' ' + node.operator + ' ' + astWalker(node.right);
    } else if (node.type == 'VariableDeclaration') {
        return astWalker(node.declarator);
    } else if (node.type == 'MemberDeclaration') {
        let result = '';
        if (node.modifiers)
            result += node.modifiers.map(value => modifierToCSharp(value)).join(' ') + ' ';
        result += astWalker(node.declarator) + ';';
        return result;
    } else if (node.type == 'PropertyDeclaration') {
        let result = '';
        if (node.modifiers)
            result += node.modifiers.map(value => modifierToCSharp(value)).join(' ') + ' ';
        result += astWalker(node.declarator.varType) + ' ';
        result += astWalker(node.declarator.varName) + ' {\n';
        result += Object.keys(node.content).map(key => {
            return key.substring(0, 3) + ' ' + astWalker(node.content[key]) + '\n';
        }).join('\n');
        result += '}';
        if (node.declarator.defaultValue)
            result += ' = ' + astWalker(node.declarator.defaultValue) + ';';
        return result;
    } else if (node.type == 'Assignment') {
        return astWalker(node.dest) + ' = ' + astWalker(node.src);
    } else if (node.type == 'ObjectCreateExpression') {
        return 'new ' + astWalker(node.target);
    } else if (node.type == 'ArrayStaticAccess') {
        return astWalker(node.target) + '[]';
    } else if (node.type == 'ArrayAccessExpression') {
        return astWalker(node.src) + '[' + astWalker(node.index) + ']';

    }
    return '/* not implement */'
}

(async() => {
    try {
        let code = await promisesfs.readFile('test.kusa', 'utf8');
        let document = await promisesfs.readFile('kusalang.txt');
        let parser = peg.generate(document.toString());
        let ast = parser.parse(code);
        console.log(astWalker(ast));
    } catch (e) {
        console.log(e);
    }
})();