
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as ini from 'ini';

class SessionMemory {
    // 内存存储，重启后自动清空
    private static memoryStore = new Map<string, any>();

    // 存储临时数据
    static set<T>(key: string, value: T): void {
        this.memoryStore.set(key, value);
    }

    // 获取临时数据
    static get<T>(key: string): T | undefined {
        return this.memoryStore.get(key);
    }

    // 删除临时数据
    static delete(key: string): boolean {
        return this.memoryStore.delete(key);
    }

    // 清空所有数据
    static clear(): void {
        this.memoryStore.clear();
    }
}

export function GetRootForCurrentFile(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const fileUri = editor.document.uri;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        return workspaceFolder?.uri.fsPath;
    }
    return undefined;
}

export function GetAllNodeByIniConfig(iniFilePath : string) {
    if (!fs.existsSync(iniFilePath)) {
        vscode.window.showErrorMessage('INI 文件不存在');
        return new Map<string, number>();
    }

    // 读取文件内容
    const content = fs.readFileSync(iniFilePath, 'utf-8');

    // 解析 INI
    const config = ini.parse(content);
    var nodePortMap = new Map<string, number>();
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

export async function FindIniConfig() {
    const rootPath = GetRootForCurrentFile();
    const key = `${rootPath}:w-developer-tools:ini-path`;
    var filePath = SessionMemory.get<string>(key);
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
            return new Map<string, number>();
        }

        const selectedFile = fileUris[0];
        // 2. 验证文件扩展名
        if (!selectedFile.fsPath.toLowerCase().endsWith('.ini')) {
            vscode.window.showErrorMessage('请选择.ini配置文件');
            return new Map<string, number>();
        }

        filePath = selectedFile.fsPath;

        SessionMemory.set(key, filePath);
    }
    return GetAllNodeByIniConfig(filePath);
}
