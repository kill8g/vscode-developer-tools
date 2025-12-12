"use strict";
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
exports.GetRootForCurrentFile = GetRootForCurrentFile;
exports.GetAllNodeByIniConfig = GetAllNodeByIniConfig;
exports.FindIniConfig = FindIniConfig;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const ini = __importStar(require("ini"));
class SessionMemory {
    // 内存存储，重启后自动清空
    static memoryStore = new Map();
    // 存储临时数据
    static set(key, value) {
        this.memoryStore.set(key, value);
    }
    // 获取临时数据
    static get(key) {
        return this.memoryStore.get(key);
    }
    // 删除临时数据
    static delete(key) {
        return this.memoryStore.delete(key);
    }
    // 清空所有数据
    static clear() {
        this.memoryStore.clear();
    }
}
function GetRootForCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const fileUri = editor.document.uri;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        return workspaceFolder?.uri.fsPath;
    }
    return undefined;
}
function GetAllNodeByIniConfig(iniFilePath) {
    if (!fs.existsSync(iniFilePath)) {
        vscode.window.showErrorMessage('INI 文件不存在');
        return new Map();
    }
    // 读取文件内容
    const content = fs.readFileSync(iniFilePath, 'utf-8');
    // 解析 INI
    const config = ini.parse(content);
    var nodePortMap = new Map();
    for (const key in config) {
        if (key.match('_ports')) {
            const node = key.replace('_ports', '');
            if (node !== 'robot') {
                const nDictatorPort = config[key]['nDictatorPort'];
                nodePortMap.set(node, nDictatorPort);
            }
        }
    }
    return nodePortMap;
}
async function FindIniConfig() {
    const rootPath = GetRootForCurrentFile();
    const key = `${rootPath}:w-developer-tools:ini-path`;
    var filePath = SessionMemory.get(key);
    console.log("w-developer-tools:ini-path : ", filePath);
    if (!filePath) {
        // 1. 选择文件
        const fileUris = await vscode.window.showOpenDialog({
            title: '选择服务器server.ini配置文件',
            filters: {
                'ini文件': ['ini'],
                '所有文件': ['*']
            },
            canSelectMany: false,
            openLabel: '选择'
        });
        if (!fileUris || fileUris.length === 0) {
            vscode.window.showInformationMessage('未选择ini配置文件');
            return new Map();
        }
        const selectedFile = fileUris[0];
        // 2. 验证文件扩展名
        if (!selectedFile.fsPath.toLowerCase().endsWith('.ini')) {
            vscode.window.showErrorMessage('请选择.ini配置文件');
            return new Map();
        }
        filePath = selectedFile.fsPath;
        SessionMemory.set(key, filePath);
    }
    return GetAllNodeByIniConfig(filePath);
}
//# sourceMappingURL=tools.js.map