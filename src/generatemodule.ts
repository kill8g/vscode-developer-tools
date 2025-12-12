import * as vscode from 'vscode';
import * as path from 'path';
import { Root, parse } from 'protobufjs';
import * as protobuf from "protobufjs";
import * as fs from 'fs';

// ==================== 通用工具函数 ====================

function formatNowDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const M = String(now.getMonth() + 1).padStart(2, '0');
    const D = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${M}-${D} ${h}:${m}:${s}`;
}

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function isNumericType(type: string): boolean {
    const numericTypes = [
        'int32', 'int64', 'uint32', 'uint64',
        'sint32', 'sint64', 'fixed32', 'fixed64',
        'sfixed32', 'sfixed64', 'float', 'double'
    ];
    return numericTypes.includes(type);
}

// ==================== 文件创建接口 ====================

interface LuaFileTemplate {
    fileName: string;
    filePath: string;
    content: string;
}

interface ModuleCreationConfig {
    moduleName: string;
    targetModulePath: string;
}

class LuaFileGenerator {
    private config: ModuleCreationConfig;

    constructor(config: ModuleCreationConfig) {
        this.config = config;
    }

    private createFileHeader(fileName: string): string {
        return `--[[
 * File name: ${fileName}
 * Created by vscode.
 * Author: vscode-plug-in@wph
 * Date time: ${formatNowDate()}
 * Copyright (C) 2025.
 * Description: 模块内部私有接口, 不提供给其他模块调用, 仅供模块内部使用
--]]`;
    }

    private getToolsRequirePath(): string {
        return `require "player.playerhandler.${this.config.moduleName}.inner.${this.config.moduleName}_tools"`;
    }

    private getBaseModuleContent(description: string, additionalRequires: string[] = []): string {
        const requires = [
            `local playerhandler = require "player.playerhandler.init"`,
            `local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}`,
            `require "player.playerhandler.${this.config.moduleName}.event"`,
            `require "player.playerhandler.${this.config.moduleName}.gm"`
        ];

        if (additionalRequires.length > 0) {
            requires.push(...additionalRequires);
        }

        return `${this.createFileHeader(this.config.moduleName + '.lua')}

${requires.join('\n')}

local M = hotupdate_module()

return M`;
    }

    generateToolsFile(): LuaFileTemplate {
        const fileName = `${this.config.moduleName}_tools.lua`;
        const filePath = path.join(this.config.targetModulePath, 'inner', fileName);

        const content = `${this.createFileHeader(fileName)}
local playerhandler = require "player.playerhandler.init"

---@class ${capitalizeFirstLetter(this.config.moduleName)}HandlerTools
local M = hotupdate_module()

return M`;

        return { fileName, filePath, content };
    }

    generateGmFile(): LuaFileTemplate {
        const fileName = 'gm.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);

        const content = `${this.createFileHeader(fileName)}
local playerhandler = require "player.playerhandler.init"
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}

local M = hotupdate_module()

return M`;

        return { fileName, filePath, content };
    }

    generateEventFile(): LuaFileTemplate {
        const fileName = 'event.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);

        const content = `${this.createFileHeader(fileName)}

local gamedefines = require "lualib.public.gamedefines"
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}

local M = hotupdate_module()

---@type map<integer, {[1]:function, [2]:map<integer, boolean>}>
local events = {
}
if not table_is_empty(events) then
    G_RegisterModuleEvent(M, function ()
        return events
    end)
end

return M`;

        return { fileName, filePath, content };
    }

    generateMainFile(): LuaFileTemplate {
        const fileName = `${this.config.moduleName}.lua`;
        const filePath = path.join(this.config.targetModulePath, fileName);

        const content = this.getBaseModuleContent('模块公共接口, 暴露给其他模块使用');

        return { fileName, filePath, content };
    }

    generateNetworkFile(): LuaFileTemplate {
        const fileName = 'network.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);

        const content = `${this.createFileHeader(fileName)}
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}
local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

-- 网络消息处理函数示例
-- function M.NetCmd_XXXReq(pid, msg)
--     -- 参数检查
--     if msg.param <= 0 then
--         Log.warning(pid, "XXXReq param:param is invalid")
--         return "XXXResp", {ret = RetCode.protocolParamError}
--     end
--
--     local result = playerhandler.${this.config.moduleName}.XXXReq(pid, msg)
--     if result == nil then
--         -- 模块内部处理返回协议相关的逻辑
--         return
--     end
--     return "XXXResp", result
-- end

return M`;

        return { fileName, filePath, content };
    }

    generateInitFile(): LuaFileTemplate {
        const fileName = 'init.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);

        const content = `${this.createFileHeader(fileName)}

-- 自动加载所有子模块
local M = hotupdate_module()

-- 加载子模块
M.${this.config.moduleName} = require("player.playerhandler.${this.config.moduleName}.${this.config.moduleName}")
M.gm = require("player.playerhandler.${this.config.moduleName}.gm")
M.event = require("player.playerhandler.${this.config.moduleName}.event")
M.network = require("player.playerhandler.${this.config.moduleName}.network")

-- 模块初始化函数（可选）
-- function M.init()
--     -- 初始化逻辑
-- end

return M`;

        return { fileName, filePath, content };
    }

    generateProtoNetworkFile(protoRoot: string, protoFileName: string): LuaFileTemplate {
        const fileName = 'network.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);

        let content = `${this.createFileHeader(fileName)}
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}
local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()
`;

        // 解析proto文件
        const files = [
            'protobuf/common.proto',
            `protobuf/${protoFileName}`
        ];

        const root = new Root();
        for (const file of files) {
            const fullPath = path.join(protoRoot, file);
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            parse(fileContent, root, { keepCase: true, alternateCommentMode: true });
        }

        const messages = root.nestedArray.filter(item => item instanceof protobuf.Type);
        for (const message of messages) {
            const messageName = message.name;
            if (messageName.endsWith('Req')) {
                const functionName = `${messageName}`;
                const checkCode = this.generateFieldChecks(message, messageName);
                const respName = messageName.replace(/Req$/, 'Resp');
                content += `
function M.${functionName}(pid, msg)
${checkCode}
    local result = playerhandler.${this.config.moduleName}.${messageName}(pid, msg)
    if result == nil then
        -- 模块内部处理返回协议相关的逻辑
        return
    end
    return "${respName}", result
end
`;
            }
        }

        content += `\nreturn M`;

        return { fileName, filePath, content };
    }

    private generateFieldChecks(message: protobuf.Type, messageName: string): string {
        let checkCode = '';
        const fields = message.fieldsArray;
        const respName = messageName.replace(/Req$/, 'Resp');

        for (const field of fields) {
            const fieldName = field.name;
            const fieldType = field.type;
            const isRepeated = field.repeated;
            const isMap = field.map;

            if (isMap || isRepeated) {
                checkCode += `    if table_is_empty(msg.${fieldName}) then\n`;
                checkCode += `        Log.warning(pid, "${messageName} param:${fieldName} is invalid")\n`;
                checkCode += `        return "${respName}", {ret = RetCode.protocolParamError}\n`;
                checkCode += `    end\n`;
            } else if (fieldType === 'string') {
                checkCode += `    if msg.${fieldName} == "" then\n`;
                checkCode += `        Log.warning(pid, "${messageName} param:${fieldName} is invalid")\n`;
                checkCode += `        return "${respName}", {ret = RetCode.protocolParamError}\n`;
                checkCode += `    end\n`;
            } else if (isNumericType(fieldType)) {
                checkCode += `    if msg.${fieldName} <= 0 then\n`;
                checkCode += `        Log.warning(pid, "${messageName} param:${fieldName} is invalid")\n`;
                checkCode += `        return "${respName}", {ret = RetCode.protocolParamError}\n`;
                checkCode += `    end\n`;
            }
        }

        return checkCode || '    -- 无需参数检查';
    }

    generateAllFiles(isProtoModule: boolean = false, protoRoot?: string, protoFileName?: string): LuaFileTemplate[] {
        const files: LuaFileTemplate[] = [
            this.generateToolsFile(),
            this.generateGmFile(),
            this.generateEventFile(),
            this.generateMainFile(),
        ];

        if (isProtoModule && protoRoot && protoFileName) {
            files.push(this.generateProtoNetworkFile(protoRoot, protoFileName));
        } else {
            files.push(this.generateNetworkFile());
        }

        // files.push(this.generateInitFile());

        return files;
    }
}

// ==================== 模块创建管理器 ====================

export class ModuleCreationManager {
    private async selectTargetFolder(): Promise<string | null> {
        const targetFolderUri = await vscode.window.showOpenDialog({
            title: '请选择模块创建路径',
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '请选择模块创建路径',
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
        });

        if (!targetFolderUri || targetFolderUri.length === 0) {
            return null;
        }

        return targetFolderUri[0].fsPath;
    }

    private async checkAndCreateFolder(moduleName: string, targetFolderPath: string): Promise<string | null> {
        const targetModulePath = path.join(targetFolderPath, moduleName);

        // 检查文件夹是否已存在
        if (fs.existsSync(targetModulePath)) {
            const overwrite = await vscode.window.showWarningMessage(
                `模块 "${moduleName}" 已经存在，是否覆盖？`,
                { modal: true },
                '覆盖',
                '取消'
            );

            if (overwrite !== '覆盖') {
                vscode.window.showInformationMessage('操作已取消');
                return null;
            }

            // 删除现有文件夹
            fs.rmSync(targetModulePath, { recursive: true, force: true });
        }

        // 创建主模块文件夹
        fs.mkdirSync(targetModulePath, { recursive: true });

        // 创建子文件夹
        const subFolders = ['inner'];
        subFolders.forEach(folder => {
            fs.mkdirSync(path.join(targetModulePath, folder), { recursive: true });
        });

        return targetModulePath;
    }

    private writeFiles(files: LuaFileTemplate[]): void {
        for (const file of files) {
            fs.writeFileSync(file.filePath, file.content);
        }
    }

    private showSuccessMessage(moduleName: string, modulePath: string): void {
        vscode.window.showInformationMessage(`模块 "${moduleName}" 创建成功！路径: ${modulePath}`);

        // 在资源管理器中显示新创建的文件夹
        const uri = vscode.Uri.file(modulePath);
        vscode.commands.executeCommand('revealFileInOS', uri);
    }

    async createEmptyModule(): Promise<void> {
        try {
            // 1. 获取模块名称
            const moduleName = await vscode.window.showInputBox({
                title: '请输入模块名称',
                placeHolder: '例如: hero|building|login',
                prompt: '模块名称将用于创建目录和文件',
                validateInput: (value) => {
                    if (!value) {
                        return '模块名称不能为空';
                    }
                    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
                        return '模块名称只能以字母开头，可以包含字母、数字和下划线';
                    }
                    return null;
                }
            });

            if (!moduleName) {
                vscode.window.showInformationMessage('操作已取消');
                return;
            }

            // 2. 选择目标文件夹
            const targetFolderPath = await this.selectTargetFolder();
            if (!targetFolderPath) {
                return;
            }

            // 3. 检查并创建文件夹
            const modulePath = await this.checkAndCreateFolder(moduleName, targetFolderPath);
            if (!modulePath) {
                return;
            }

            // 4. 创建文件
            const config: ModuleCreationConfig = {
                moduleName,
                targetModulePath: modulePath
            };

            const generator = new LuaFileGenerator(config);
            const files = generator.generateAllFiles();

            this.writeFiles(files);
            this.showSuccessMessage(moduleName, modulePath);

        } catch (error) {
            vscode.window.showErrorMessage(`创建空模块时出错: ${error}`);
        }
    }

    async createProtoModule(): Promise<void> {

        try {
            // 1. 选择Proto文件
            // const fileUris = await vscode.window.showOpenDialog({
            //     title: '选择Proto文件',
            //     filters: {
            //         'Protocol Buffer文件': ['proto'],
            //         '所有文件': ['*']
            //     },
            //     canSelectMany: false,
            //     openLabel: '选择'
            // });

            // if (!fileUris || fileUris.length === 0) {
            //     vscode.window.showInformationMessage('未选择文件');
            //     return;
            // }

            // const selectedFile = fileUris[0];
            // const filePath = selectedFile.fsPath;

            // // 2. 验证文件扩展名
            // if (!filePath.toLowerCase().endsWith('.proto')) {
            //     vscode.window.showErrorMessage('请选择.proto文件');
            //     return;
            // }

            // 1. 选择Proto文件
            let activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('请选择protobuf协议文件');
                return;
            }

            let fileUri = activeEditor.document.uri;
            let filePath = fileUri.fsPath.replaceAll('\\', '/');

            // 2. 验证文件扩展名
            if (!filePath.toLowerCase().endsWith('.proto')) {
                vscode.window.showErrorMessage('请选择.proto文件');
                return;
            }

            // 3. 获取文件信息
            const fileName = path.basename(filePath);
            const moduleName = path.basename(fileName, '.proto');

            // 4. 选择目标文件夹
            const targetFolderPath = await this.selectTargetFolder();
            if (!targetFolderPath) {
                return;
            }

            // 5. 检查并创建文件夹
            const modulePath = await this.checkAndCreateFolder(moduleName, targetFolderPath);
            if (!modulePath) {
                return;
            }

            // 6. 获取Proto根目录
            const protoRoot = filePath.replace(fileName, '').replace('protobuf', '');

            // 7. 创建文件
            const config: ModuleCreationConfig = {
                moduleName,
                targetModulePath: modulePath
            };

            const generator = new LuaFileGenerator(config);
            const files = generator.generateAllFiles(true, protoRoot, fileName);

            this.writeFiles(files);
            this.showSuccessMessage(moduleName, modulePath);

        } catch (error) {
            vscode.window.showErrorMessage(`创建Proto模块时出错: ${error}`);
        }
    }
}