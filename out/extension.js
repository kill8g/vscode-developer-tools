"use strict";
// vscode 插件
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const tools = __importStar(require("./tools"));
const parselua_1 = require("./parselua");
const generatemodule_1 = require("./generatemodule");
const popwindow_1 = require("./popwindow");
const nc_1 = require("./nc");
// ==================== 命令注册 ====================
const moduleManager = new generatemodule_1.ModuleCreationManager();
const createEmptyModule = vscode.commands.registerCommand('w-developer-tools.createEmptyModule', () => moduleManager.createEmptyModule());
const createProtoModule = vscode.commands.registerCommand('w-developer-tools.createProtoModule', () => moduleManager.createProtoModule());
const protoMsgId = vscode.commands.registerCommand('w-developer-tools.protoMsgId', async () => {
    let activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        let fileUri = activeEditor.document.uri;
        let absolutePath = fileUri.fsPath.replaceAll('\\', '/');
        // 2. 验证文件扩展名
        if (!absolutePath.toLowerCase().endsWith('.proto')) {
            vscode.window.showErrorMessage('请选择.proto文件');
            return;
        }
        const fileName = path.basename(absolutePath);
        const luaFilePath = absolutePath.replace(fileName, '').replace('proto/protobuf/', '') + 'code/src/netdefines.lua';
        // 解析文件
        const parser = new parselua_1.NetDefinesParser();
        console.log(`开始解析文件: ${luaFilePath}`);
        parser.parseFile(luaFilePath);
        const fileStream = fs.createReadStream(absolutePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity // 识别所有换行符
        });
        const moduleName = fileName.replace('.proto', '');
        let lineNumber = 0;
        var maxId = parser.getMaxProtocolId() / 100 * 100 + 300;
        for await (const line of rl) {
            lineNumber++;
            if (line.includes("message") && (line.includes("Req") || line.includes("Resp") || line.includes("Ntf"))) {
                var protoName = line.replace(/\s+/g, '').replace('message', '').replace('{', '');
                const has = parser.findProto(protoName);
                if (has) {
                    // 协议已经存在了, 不用处理
                }
                else {
                    var module = parser.findModule(moduleName);
                    if (module) {
                        parser.addProto(module.moduleName, protoName, ++module.maxId);
                    }
                    else {
                        parser.addProto(moduleName, protoName, ++maxId);
                    }
                }
            }
        }
        // parser.logAllProtocols();
        parser.updateNetdefinesFile(luaFilePath);
        vscode.window.showInformationMessage('更新完毕!');
    }
    else {
        vscode.window.showWarningMessage('没有打开的文件编辑器！');
    }
});
function HotfixServerCodeEvent(context) {
    const hotfixServerCode = vscode.commands.registerCommand('w-developer-tools.hotfixServerCode', async () => {
        var activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('请打开需要热更的.lua文件');
            return;
        }
        var fileUri = activeEditor.document.uri;
        var absolutePath = fileUri.fsPath.replaceAll('\\', '/');
        if (!absolutePath.toLowerCase().endsWith('.lua')) {
            vscode.window.showErrorMessage('请选择需要热更的.lua文件');
            return;
        }
        if (!absolutePath.includes('src/WService')) {
            vscode.window.showErrorMessage('选择的lua文件无法通过插件热更');
            return;
        }
        const parts = absolutePath.split('src/WService');
        const rootPath = parts[0];
        const iniPath = rootPath + 'cfg/launch/server.ini';
        const nodes = tools.GetAllNodeByIniConfig(iniPath);
        var items = [];
        for (const node of nodes.entries()) {
            items.push(node[0]);
        }
        items.sort();
        var filePath = ('src/WService' + parts[1]).replace('.lua', '');
        filePath = filePath.replaceAll('/', '.');
        const panel = new popwindow_1.SelectionPanel(context, `准备热更文件${filePath}, 请选择热更哪个服务器, 双击选择节点执行热更新`, items);
        const result = panel.show();
        var node = (await result).value;
        const port = nodes.get(node);
        if (!port) {
            vscode.window.showErrorMessage('没有找到该节点的热更端口');
            return;
        }
        console.log(node, port, filePath);
        (0, nc_1.netcat)('127.0.0.1', port, `update_code ${filePath}`);
    });
    return hotfixServerCode;
}
function HotfixConfigEvent(context) {
    const hotfixConfig = vscode.commands.registerCommand('w-developer-tools.hotfixConfig', async () => {
        const nodes = tools.FindIniConfig();
        var items = [];
        for (const node of (await nodes).entries()) {
            items.push(node[0]);
        }
        items.sort();
        const panel = new popwindow_1.SelectionPanel(context, "请选择热更哪个服务器", items);
        const result = panel.show();
        var node = (await result).value;
        const port = (await nodes).get(node);
        if (!port) {
            vscode.window.showErrorMessage('没有找到该节点的热更端口');
            return;
        }
        (0, nc_1.netcat)('127.0.0.1', port, `update_res`);
    });
    return hotfixConfig;
}
function HotfixProtoEvent(context) {
    const hotfixProto = vscode.commands.registerCommand('w-developer-tools.hotfixProto', async () => {
        const nodes = tools.FindIniConfig();
        for (const node of (await nodes).entries()) {
            if (node[0] == 'gateway') {
                const port = node[1];
                (0, nc_1.netcat)('127.0.0.1', port, `update_proto`);
                break;
            }
        }
    });
    return hotfixProto;
}
function activate(context) {
    context.subscriptions.push(createProtoModule);
    context.subscriptions.push(createEmptyModule);
    context.subscriptions.push(protoMsgId);
    context.subscriptions.push(HotfixServerCodeEvent(context));
    context.subscriptions.push(HotfixConfigEvent(context));
    context.subscriptions.push(HotfixProtoEvent(context));
}
//# sourceMappingURL=extension.js.map