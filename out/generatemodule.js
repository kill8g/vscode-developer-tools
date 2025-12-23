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
exports.ModuleCreationManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const protobufjs_1 = require("protobufjs");
const protobuf = __importStar(require("protobufjs"));
const fs = __importStar(require("fs"));
// ==================== 通用工具函数 ====================
function formatNowDate() {
    const now = new Date();
    const y = now.getFullYear();
    const M = String(now.getMonth() + 1).padStart(2, '0');
    const D = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${M}-${D} ${h}:${m}:${s}`;
}
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function isNumericType(type) {
    const numericTypes = [
        'int32', 'int64', 'uint32', 'uint64',
        'sint32', 'sint64', 'fixed32', 'fixed64',
        'sfixed32', 'sfixed64', 'float', 'double'
    ];
    return numericTypes.includes(type);
}
class LuaFileGenerator {
    config;
    constructor(config) {
        this.config = config;
    }
    createFileHeader(fileName) {
        return `--[[
 * File name: ${fileName}
 * Created by vscode.
 * Author: vscode-plug-in@wph
 * Date time: ${formatNowDate()}
 * Copyright (C) 2025.
 * Description: 模块内部私有接口, 不提供给其他模块调用, 仅供模块内部使用
--]]`;
    }
    getToolsRequirePath() {
        return `require "player.playerhandler.${this.config.moduleName}.inner.${this.config.moduleName}_tools"`;
    }
    getBaseModuleContent(description, additionalRequires = [], handlerFunctions = []) {
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

${handlerFunctions.length > 0 ? handlerFunctions.join('\n\n') : ''}

return M`;
    }
    generateToolsFile() {
        const fileName = `${this.config.moduleName}_tools.lua`;
        const filePath = path.join(this.config.targetModulePath, 'inner', fileName);
        const content = `${this.createFileHeader(fileName)}
local playerhandler = require "player.playerhandler.init"

---@class ${capitalizeFirstLetter(this.config.moduleName)}HandlerTools
local M = hotupdate_module()

return M`;
        return { fileName, filePath, content };
    }
    generateGmFile() {
        const fileName = 'gm.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);
        const content = `${this.createFileHeader(fileName)}
local playerhandler = require "player.playerhandler.init"
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}

local M = hotupdate_module()

return M`;
        return { fileName, filePath, content };
    }
    generateEventFile() {
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
    generateMainFile(handlerFunctions = []) {
        const fileName = `${this.config.moduleName}.lua`;
        const filePath = path.join(this.config.targetModulePath, fileName);
        const content = this.getBaseModuleContent('模块公共接口, 暴露给其他模块使用', [], handlerFunctions);
        return { fileName, filePath, content };
    }
    generateNetworkFile() {
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
    generateInitFile() {
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
    generateFieldChecks(message, messageName) {
        let checkCode = '';
        const respName = messageName.replace(/Req$/, 'Resp');
        // 获取消息字段
        let fields = [];
        try {
            if (message.fields) {
                // 从fields对象中获取所有字段
                fields = Object.values(message.fields);
            }
            else if (message.fieldsArray) {
                // 使用fieldsArray
                fields = message.fieldsArray;
            }
        }
        catch (error) {
            console.warn(`无法获取消息 ${messageName} 的字段:`, error);
        }
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
            }
            else if (fieldType === 'string') {
                checkCode += `    if msg.${fieldName} == "" then\n`;
                checkCode += `        Log.warning(pid, "${messageName} param:${fieldName} is invalid")\n`;
                checkCode += `        return "${respName}", {ret = RetCode.protocolParamError}\n`;
                checkCode += `    end\n`;
            }
            else if (isNumericType(fieldType)) {
                checkCode += `    if msg.${fieldName} <= 0 then\n`;
                checkCode += `        Log.warning(pid, "${messageName} param:${fieldName} is invalid")\n`;
                checkCode += `        return "${respName}", {ret = RetCode.protocolParamError}\n`;
                checkCode += `    end\n`;
            }
        }
        return checkCode || '    -- 无需参数检查';
    }
    generateHandlerFunction(messageName) {
        return `---${messageName}请求处理函数
---@param pid integer 玩家ID
---@param msg table 请求消息
---@return table|nil 返回响应消息，如果为nil则表示内部处理返回协议
function M.${messageName}(pid, msg)
    -- TODO: 实现${messageName}的业务逻辑
    return nil
end`;
    }
    parseProtoMessages(protoRoot, protoFileName) {
        const messages = [];
        // 解析proto文件
        const files = [
            'protobuf/common.proto',
            `protobuf/${protoFileName}`
        ];
        const root = new protobufjs_1.Root();
        for (const file of files) {
            const fullPath = path.join(protoRoot, file);
            try {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                (0, protobufjs_1.parse)(fileContent, root, { keepCase: true, alternateCommentMode: true });
            }
            catch (error) {
                console.warn(`无法读取或解析文件 ${fullPath}:`, error);
            }
        }
        // 获取所有消息定义
        try {
            // 尝试不同的方式获取消息
            const allMessages = root.nestedArray?.filter(item => item instanceof protobuf.Type) || [];
            for (const message of allMessages) {
                const messageName = message.name;
                if (messageName && messageName.endsWith('Req')) {
                    // 尝试获取字段
                    let fields = [];
                    try {
                        if (message.fields) {
                            fields = Object.values(message.fields);
                        }
                        else if (message.fieldsArray) {
                            fields = message.fieldsArray;
                        }
                    }
                    catch (error) {
                        console.warn(`无法获取消息 ${messageName} 的字段:`, error);
                    }
                    messages.push({
                        name: messageName,
                        fields: fields
                    });
                }
            }
        }
        catch (error) {
            console.error('解析proto消息时出错:', error);
        }
        return messages;
    }
    generateProtoNetworkFile(protoRoot, protoFileName) {
        const fileName = 'network.lua';
        const filePath = path.join(this.config.targetModulePath, fileName);
        let content = `${this.createFileHeader(fileName)}
local ${this.config.moduleName}_tools = ${this.getToolsRequirePath()}
local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

-- ******************************************** ↓协议接口↓ ********************************************
`;
        const messages = this.parseProtoMessages(protoRoot, protoFileName);
        const handlerFunctions = [];
        for (const message of messages) {
            const messageName = message.name;
            const functionName = `${messageName}`;
            const checkCode = this.generateFieldChecks(message, messageName);
            const respName = messageName.replace(/Req$/, 'Resp');
            // 生成网络处理函数
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
            // 生成对应的handler函数
            handlerFunctions.push(this.generateHandlerFunction(messageName));
        }
        content += `\n-- ******************************************** ↓RPC接口↓ ********************************************`;
        content += `\nreturn M`;
        const networkFile = { fileName, filePath, content };
        return { networkFile, handlerFunctions };
    }
    generateAllFiles(isProtoModule = false, protoRoot, protoFileName) {
        const files = [
            this.generateToolsFile(),
            this.generateGmFile(),
            this.generateEventFile(),
        ];
        if (isProtoModule && protoRoot && protoFileName) {
            try {
                const { networkFile, handlerFunctions } = this.generateProtoNetworkFile(protoRoot, protoFileName);
                files.push(this.generateMainFile(handlerFunctions));
                files.push(networkFile);
            }
            catch (error) {
                console.error('生成Proto模块文件时出错:', error);
                // 如果出错，回退到普通模式
                files.push(this.generateMainFile());
                files.push(this.generateNetworkFile());
            }
        }
        else {
            files.push(this.generateMainFile());
            files.push(this.generateNetworkFile());
        }
        // files.push(this.generateInitFile());
        return files;
    }
}
// ==================== 模块创建管理器 ====================
class ModuleCreationManager {
    async selectTargetFolder() {
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
    async checkAndCreateFolder(moduleName, targetFolderPath) {
        const targetModulePath = path.join(targetFolderPath, moduleName);
        // 检查文件夹是否已存在
        if (fs.existsSync(targetModulePath)) {
            const overwrite = await vscode.window.showWarningMessage(`模块 "${moduleName}" 已经存在，是否覆盖？`, { modal: true }, '覆盖', '取消');
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
    writeFiles(files) {
        for (const file of files) {
            // 确保目录存在
            const dir = path.dirname(file.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(file.filePath, file.content);
        }
    }
    showSuccessMessage(moduleName, modulePath) {
        vscode.window.showInformationMessage(`模块 "${moduleName}" 创建成功！路径: ${modulePath}`);
        // 在资源管理器中显示新创建的文件夹
        const uri = vscode.Uri.file(modulePath);
        vscode.commands.executeCommand('revealFileInOS', uri);
    }
    async createEmptyModule() {
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
            const config = {
                moduleName,
                targetModulePath: modulePath
            };
            const generator = new LuaFileGenerator(config);
            const files = generator.generateAllFiles();
            this.writeFiles(files);
            this.showSuccessMessage(moduleName, modulePath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`创建空模块时出错: ${error}`);
        }
    }
    async createProtoModule() {
        try {
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
            const config = {
                moduleName,
                targetModulePath: modulePath
            };
            const generator = new LuaFileGenerator(config);
            const files = generator.generateAllFiles(true, protoRoot, fileName);
            this.writeFiles(files);
            this.showSuccessMessage(moduleName, modulePath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`创建Proto模块时出错: ${error}`);
            console.error('创建Proto模块详细错误:', error);
        }
    }
}
exports.ModuleCreationManager = ModuleCreationManager;
//# sourceMappingURL=generatemodule.js.map