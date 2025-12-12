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
exports.FileGeneratorService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * 文件生成服务
 */
class FileGeneratorService {
    /**
     * 根据模块名生成完整的文件结构
     * @param moduleName 模块名
     * @param basePath 基础路径（可选，如果不提供则打开文件夹选择器）
     */
    async generateModuleStructure(moduleName, basePath) {
        try {
            // 1. 如果未提供基础路径，让用户选择文件夹
            let targetPath = basePath;
            if (!targetPath) {
                targetPath = await this.selectTargetFolder();
                if (!targetPath) {
                    vscode.window.showWarningMessage('未选择目标文件夹，操作已取消');
                    return;
                }
            }
            // 2. 创建模块文件夹
            const modulePath = path.join(targetPath, moduleName);
            await this.createFolder(modulePath);
            // 3. 创建inner子文件夹
            const innerPath = path.join(modulePath, 'inner');
            await this.createFolder(innerPath);
            // 4. 生成各个文件
            await this.generateFiles(moduleName, modulePath, innerPath);
            // 5. 显示成功信息并打开文件夹
            vscode.window.showInformationMessage(`模块 "${moduleName}" 创建成功！`);
            // 可选：在资源管理器中显示生成的文件夹
            await this.revealInExplorer(modulePath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`生成模块失败: ${error}`);
        }
    }
    /**
     * 选择目标文件夹
     */
    async selectTargetFolder() {
        const folderUris = await vscode.window.showOpenDialog({
            title: '选择模块存放的文件夹',
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择文件夹'
        });
        if (folderUris && folderUris.length > 0) {
            return folderUris[0].fsPath;
        }
        return undefined;
    }
    /**
     * 创建文件夹
     */
    async createFolder(folderPath) {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
    }
    /**
     * 生成所有文件
     */
    async generateFiles(moduleName, modulePath, innerPath) {
        const files = this.getFileTemplates(moduleName);
        for (const file of files) {
            const filePath = path.join(file.isInner ? innerPath : modulePath, file.name);
            await this.writeFile(filePath, file.content);
        }
    }
    /**
     * 获取文件模板
     */
    getFileTemplates(moduleName) {
        // 工具类文件名
        const toolsFileName = `${moduleName}_tools.lua`;
        return [
            {
                name: 'event.lua',
                content: this.getEventTemplate(moduleName),
                isInner: false
            },
            {
                name: `${moduleName}.lua`,
                content: this.getModuleTemplate(moduleName),
                isInner: false
            },
            {
                name: 'gm.lua',
                content: this.getGmTemplate(moduleName),
                isInner: false
            },
            {
                name: 'network.lua',
                content: this.getNetworkTemplate(moduleName),
                isInner: false
            },
            {
                name: toolsFileName,
                content: this.getToolsTemplate(moduleName),
                isInner: true
            }
        ];
    }
    /**
     * event.lua 模板
     */
    getEventTemplate(moduleName) {
        const handlerPath = this.getHandlerPath(moduleName);
        return `local gamedefines = require "lualib.public.gamedefines"

local M = hotupdate_module()

---@type map<integer, {[1]:function, [2]:map<integer, boolean>}>
local events = {
    -- 事件注册示例：
    -- [gamedefines.EVENT_TYPE.EXAMPLE] = {
    --     function(event_data)
    --         -- 处理事件逻辑
    --     end,
    --     {
    --         [gamedefines.MODULE_TYPE.PLAYER] = true,
    --     }
    -- },
}

if not table_is_empty(events) then
    G_RegisterModuleEvent(M, function ()
        return events
    end)
end

return M
`;
    }
    /**
     * 模块主文件模板
     */
    getModuleTemplate(moduleName) {
        const handlerPath = this.getHandlerPath(moduleName);
        const toolsFileName = `${moduleName}_tools.lua`;
        return `local playerhandler = require "player.playerhandler.init"
local ${moduleName}_tools = require "player.playerhandler.${moduleName}.inner.${toolsFileName}"

local M = hotupdate_module()

-- 模块初始化
function M.init()
    -- 初始化逻辑
end

-- 模块卸载
function M.uninit()
    -- 清理逻辑
end

-- 示例接口
function M.example_function(pid, params)
    -- 业务逻辑
    return true
end

return M
`;
    }
    /**
     * gm.lua 模板
     */
    getGmTemplate(moduleName) {
        const handlerPath = this.getHandlerPath(moduleName);
        return `local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

-- GM命令示例
-- function M.gm_command_example(pid, args)
--     -- GM命令处理逻辑
--     return true, "执行成功"
-- end

return M
`;
    }
    /**
     * network.lua 模板
     */
    getNetworkTemplate(moduleName) {
        const handlerPath = this.getHandlerPath(moduleName);
        return `local playerhandler = require "player.playerhandler.init"

local M = hotupdate_module()

-- 网络请求处理示例
-- function M.Net_ExampleReq(pid, msg)
--     -- 调用handler内的同名接口
--     local result = playerhandler.${moduleName}.ExampleReq(pid, msg)
--     -- 内部自行处理返回消息包
--     if result == nil then
--         return
--     end
--     -- 自动将返回结果推送给客户端
--     return "ExampleResp", result
-- end

return M
`;
    }
    /**
     * tools.lua 模板
     */
    getToolsTemplate(moduleName) {
        return `---@class ${this.capitalizeFirstLetter(moduleName)}HandlerTools
local M = hotupdate_module()

-- 工具函数示例
-- function M.format_data(data)
--     -- 数据处理逻辑
--     return formatted_data
-- end

-- 配置读取示例
-- function M.get_config(id)
--     return config_manager.get("${moduleName}_config", id)
-- end

return M
`;
    }
    /**
     * 获取handler路径
     */
    getHandlerPath(moduleName) {
        return `player.playerhandler.${moduleName}`;
    }
    /**
     * 首字母大写
     */
    capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    /**
     * 写入文件
     */
    async writeFile(filePath, content) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, content, 'utf8', (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * 在资源管理器中显示文件夹
     */
    async revealInExplorer(folderPath) {
        // 创建URI
        const uri = vscode.Uri.file(folderPath);
        // 方法1：在文件资源管理器中显示
        await vscode.commands.executeCommand('revealFileInOS', uri);
        // 方法2：在VSCode的资源管理器中显示（可选）
        // vscode.window.showTextDocument(uri);
        // 方法3：打开文件夹（如果需要）
        // await vscode.commands.executeCommand('vscode.openFolder', uri);
    }
}
exports.FileGeneratorService = FileGeneratorService;
//# sourceMappingURL=generater.js.map