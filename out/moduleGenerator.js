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
exports.ModuleGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cp = __importStar(require("child_process"));
const util = __importStar(require("util"));
const exec = util.promisify(cp.exec);
class ModuleGenerator {
    config;
    constructor(config) {
        this.config = config;
    }
    // 检查字段验证类型
    checkFieldValidation(fieldType) {
        // 数组类型检查
        if (fieldType.includes('repeated')) {
            return 'array';
        }
        // map类型检查
        if (fieldType.includes('map<')) {
            return 'map';
        }
        // 字符串类型检查
        if (fieldType.includes('string')) {
            return 'string';
        }
        // 数值类型检查
        const numericTypes = [
            'int32', 'int64', 'uint32', 'uint64',
            'sint32', 'sint64', 'fixed32', 'fixed64',
            'sfixed32', 'sfixed64', 'float', 'double', 'bool'
        ];
        if (numericTypes.includes(fieldType)) {
            return 'number';
        }
        return 'other';
    }
    // 解析proto文件获取字段
    async parseProtoFile() {
        const result = new Map();
        if (!this.config.protoFile || !fs.existsSync(this.config.protoFile)) {
            return result;
        }
        try {
            const content = fs.readFileSync(this.config.protoFile, 'utf8');
            const lines = content.split('\n');
            let currentMessage = '';
            let inMessage = false;
            let braceCount = 0;
            for (let line of lines) {
                line = line.trim();
                // 查找message定义
                const messageMatch = line.match(/^message\s+([A-Za-z_][A-Za-z0-9_]*)\s*{/);
                if (messageMatch) {
                    currentMessage = messageMatch[1];
                    inMessage = true;
                    braceCount = 1;
                    result.set(currentMessage, []);
                    continue;
                }
                if (inMessage) {
                    // 统计大括号
                    for (const char of line) {
                        if (char === '{')
                            braceCount++;
                        if (char === '}')
                            braceCount--;
                    }
                    if (braceCount === 0) {
                        inMessage = false;
                        currentMessage = '';
                        continue;
                    }
                    // 移除注释
                    line = line.replace(/\/\/.*$/, '').replace(/#.*$/, '').trim();
                    // 匹配字段行
                    const fieldMatch = line.match(/(repeated\s+)?([a-zA-Z0-9_.<>]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[0-9]+/);
                    if (fieldMatch) {
                        const [, repeated, fieldType, fieldName] = fieldMatch;
                        const isRepeated = !!repeated;
                        const isMap = fieldType.includes('map<');
                        result.get(currentMessage)?.push({
                            fieldType,
                            fieldName,
                            isRepeated,
                            isMap
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error('解析proto文件失败:', error);
        }
        return result;
    }
    // 获取Req消息
    async getReqMessages() {
        const reqMessages = [];
        if (!this.config.protoFile) {
            return reqMessages;
        }
        try {
            const content = fs.readFileSync(this.config.protoFile, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.match(/^message\s+([A-Za-z_][A-Za-z0-9_]*)Req\s*{/);
                if (match) {
                    reqMessages.push(match[1] + 'Req');
                }
            }
        }
        catch (error) {
            console.error('读取proto文件失败:', error);
        }
        return reqMessages;
    }
    // 生成验证代码
    generateValidationCode(reqMsg, fields) {
        let validationCode = '';
        for (const field of fields) {
            const validationType = this.checkFieldValidation(field.fieldType);
            const moduleName = this.config.moduleName;
            switch (validationType) {
                case 'array':
                    validationCode += `    -- 检查数组字段: ${field.fieldName}
    if not msg.${field.fieldName} or #msg.${field.fieldName} == 0 then
        Log.warning(pid, "[${moduleName}] ${reqMsg}.${field.fieldName} 为空数组")
        return nil
    end

`;
                    break;
                case 'map':
                    validationCode += `    -- 检查map字段: ${field.fieldName}
    if not msg.${field.fieldName} or table_is_empty(msg.${field.fieldName}) then
        Log.warning(pid, "[${moduleName}] ${reqMsg}.${field.fieldName} 为空map")
        return nil
    end

`;
                    break;
                case 'string':
                    validationCode += `    -- 检查字符串字段: ${field.fieldName}
    if not msg.${field.fieldName} or msg.${field.fieldName} == "" then
        Log.warning(pid, "[${moduleName}] ${reqMsg}.${field.fieldName} 为空字符串")
        return nil
    end

`;
                    break;
                case 'number':
                    // bool类型不检查
                    if (field.fieldType === 'bool') {
                        continue;
                    }
                    validationCode += `    -- 检查数值字段: ${field.fieldName}
    if not msg.${field.fieldName} or msg.${field.fieldName} <= 0 then
        Log.warning(pid, "[${moduleName}] ${reqMsg}.${field.fieldName} 无效数值: " .. tostring(msg.${field.fieldName}))
        return nil
    end

`;
                    break;
            }
        }
        return validationCode;
    }
    // 创建目录
    async createDirectories() {
        const mainDir = path.join(this.config.outputDir, this.config.moduleName);
        const innerDir = path.join(mainDir, 'inner');
        if (fs.existsSync(mainDir)) {
            throw new Error(`模块文件夹已存在: ${mainDir}`);
        }
        fs.mkdirSync(mainDir, { recursive: true });
        fs.mkdirSync(innerDir, { recursive: true });
        return { mainDir, innerDir };
    }
    // 生成tools文件
    generateToolsFile(innerDir) {
        const toolsFile = path.join(innerDir, `${this.config.moduleName}_tools.lua`);
        const content = `---@class ${this.config.moduleName.charAt(0).toUpperCase() + this.config.moduleName.slice(1)}HandlerTools
local M = hotupdate_module()

return M
`;
        fs.writeFileSync(toolsFile, content);
    }
    // 生成event文件
    generateEventFile(mainDir) {
        const eventFile = path.join(mainDir, 'event.lua');
        const content = `local gamedefines = require "lualib.public.gamedefines"

local M = hotupdate_module()

---@type map<integer, {[1]:function, [2]:map<integer, boolean>}>
local events = {
}
if not table_is_empty(events) then
    G_RegisterModuleEvent(M, function ()
        return events
    end)
end

return M
`;
        fs.writeFileSync(eventFile, content);
    }
    // 生成gm文件
    generateGmFile(mainDir) {
        const gmFile = path.join(mainDir, 'gm.lua');
        const content = `local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

return M
`;
        fs.writeFileSync(gmFile, content);
    }
    // 生成主模块文件
    generateMainFile(mainDir) {
        const mainFile = path.join(mainDir, `${this.config.moduleName}.lua`);
        const content = `local playerhandler = require "player.playerhandler.init"
local ${this.config.moduleName}_tools = require "player.playerhandler.${this.config.moduleName}.inner.${this.config.moduleName}_tools"

local M = hotupdate_module()

return M
`;
        fs.writeFileSync(mainFile, content);
    }
    // 生成network文件
    async generateNetworkFile(mainDir, protoFields) {
        const networkFile = path.join(mainDir, 'network.lua');
        let content = `local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

`;
        if (this.config.protoFile) {
            const reqMessages = await this.getReqMessages();
            if (reqMessages.length === 0) {
                content += '# 未找到Req协议\n';
            }
            else {
                for (const reqMsg of reqMessages) {
                    const funcName = reqMsg.replace('Req', '');
                    const funcNameLower = funcName.charAt(0).toLowerCase() + funcName.slice(1);
                    content += `function M.Net_${funcName}Req(pid, msg)
`;
                    if (this.config.enableValidation) {
                        content += `    -- 参数校验, 自动根据协议来进行一些简单的判空校验, 可能会误判, 需要开发人员复查代码检查是否存在误判
`;
                        const fields = protoFields.get(reqMsg) || [];
                        if (fields.length > 0) {
                            const validationCode = this.generateValidationCode(reqMsg, fields);
                            content += validationCode;
                        }
                    }
                    content += `    -- 调用handler内的同名接口
    local result = playerhandler.${this.config.moduleName}.${funcName}Req(pid, msg)
    -- 内部自行处理返回消息包
    if result == nil then
        return
    end
    -- 自动将返回结果推送给客户端
    return "${funcName}Resp", result
end

`;
                }
            }
        }
        else {
            content += '# 无协议处理函数(未提供proto文件)\n';
        }
        content += 'return M\n';
        fs.writeFileSync(networkFile, content);
    }
    // 生成协议ID（如果提供了proto文件）
    async generateMsgId() {
        if (!this.config.protoFile) {
            return;
        }
        try {
            // 这里需要根据你的实际路径调整
            const scriptPath = path.join(__dirname, '../../bin/lua');
            const generateScript = path.join(__dirname, '../../shell/geneate_msg_id.lua');
            if (fs.existsSync(generateScript) && fs.existsSync(scriptPath)) {
                await exec(`${scriptPath} ${generateScript} ${this.config.protoFile}`);
            }
        }
        catch (error) {
            console.error('生成协议ID失败:', error);
        }
    }
    // 执行生成
    async generate() {
        try {
            // 1. 创建目录
            const { mainDir, innerDir } = await this.createDirectories();
            // 2. 解析proto文件
            const protoFields = await this.parseProtoFile();
            // 3. 生成文件
            this.generateToolsFile(innerDir);
            this.generateEventFile(mainDir);
            this.generateGmFile(mainDir);
            this.generateMainFile(mainDir);
            await this.generateNetworkFile(mainDir, protoFields);
            // 4. 生成协议ID
            await this.generateMsgId();
            return { mainDir, innerDir };
        }
        catch (error) {
            throw error;
        }
    }
    // 获取生成结果摘要
    getSummary(mainDir, innerDir, reqMessages) {
        let summary = `==========================================
✅ 完成！已生成以下文件：
==========================================
📁 ${mainDir}/
   ├── ${this.config.moduleName}.lua
   ├── event.lua
   ├── gm.lua
   ├── network.lua
   └── inner/
       └── ${this.config.moduleName}_tools.lua

🔧 参数检查状态: ${this.config.enableValidation}
`;
        if (reqMessages.length > 0) {
            summary += '\n📋 network.lua 中包含的函数：\n';
            for (const reqMsg of reqMessages) {
                const funcName = reqMsg.replace('Req', '');
                summary += `   📋 Net_${funcName}Req\n`;
            }
            if (this.config.enableValidation) {
                summary += '\n🔍 生成的字段校验：\n';
                // 这里可以添加具体的校验信息
                summary += '   📋 根据字段类型自动生成校验代码\n';
            }
            else {
                summary += '\n⚠️  参数检查已禁用，未生成字段校验代码\n';
            }
        }
        return summary;
    }
}
exports.ModuleGenerator = ModuleGenerator;
//# sourceMappingURL=moduleGenerator.js.map