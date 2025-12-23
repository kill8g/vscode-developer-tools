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
exports.ModifySetting = ModifySetting;
const vscode = __importStar(require("vscode"));
// 环境变量管理器
class EnvManager {
    envKey;
    constructor() {
        this.envKey = 'W_DEVELOPER_TOOLS';
    }
    // 保存配置到环境变量 - Base64 版本
    async saveToEnvironmentVariables(config) {
        try {
            // 1. 将配置转换为 JSON 字符串
            const configJson = JSON.stringify(config);
            console.log('原始JSON字符串长度:', configJson.length);
            // 2. 使用 Base64 编码避免中文字符问题
            const buffer = Buffer.from(configJson, 'utf8');
            const base64String = buffer.toString('base64');
            console.log('Base64编码后的字符串:', base64String);
            // 3. 保存 Base64 编码的字符串到环境变量
            await this.setEnvVar(this.envKey, base64String);
            // 4. 同时在当前进程环境变量中保存（可选）
            process.env[this.envKey] = base64String;
            console.log('配置已保存为 Base64 格式');
            return true;
        }
        catch (error) {
            console.error('保存配置到环境变量失败:', error);
            throw error;
        }
    }
    // 设置单个环境变量
    async setEnvVar(key, value) {
        return new Promise((resolve, reject) => {
            try {
                const winreg = require('winreg');
                const regKey = new winreg({
                    hive: winreg.HKCU,
                    key: '\\Environment'
                });
                regKey.set(key, winreg.REG_SZ, value, (err) => {
                    if (err) {
                        console.error('设置环境变量错误:', err);
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (error) {
                console.error('设置环境变量异常:', error);
                reject(error);
            }
        });
    }
    async readRegistryAsync(regKey, valueName) {
        return new Promise((resolve, reject) => {
            try {
                regKey.get(valueName, (err, item) => {
                    if (err) {
                        console.error('读取注册表项失败:', err);
                        resolve(undefined);
                    }
                    else {
                        resolve(item ? item.value : undefined);
                    }
                });
            }
            catch (error) {
                console.error('读取注册表失败:', error);
                resolve(undefined);
            }
        });
    }
    async loadFromEnvironmentVariables() {
        try {
            console.log('=== 从环境变量加载配置（Base64版本）===');
            let base64String;
            try {
                const winreg = require('winreg');
                const regKey = new winreg({
                    hive: winreg.HKCU,
                    key: '\\Environment'
                });
                // 读取注册表
                base64String = await this.readRegistryAsync(regKey, this.envKey);
                // 如果从注册表读取到，更新当前进程的环境变量
                if (base64String) {
                    process.env[this.envKey] = base64String;
                }
            }
            catch (regError) {
                console.log('注册表读取失败:', regError);
            }
            // 如果注册表读取失败，尝试从进程环境变量读取
            if (!base64String && process.env[this.envKey]) {
                base64String = process.env[this.envKey];
                console.log('从进程环境变量读取到配置');
            }
            if (!base64String) {
                console.log('没有找到配置数据，返回空配置');
                return {
                    projects: [],
                    currentProjectId: ''
                };
            }
            console.log('Base64字符串长度:', base64String.length);
            // 解码 Base64 字符串
            try {
                // 从 Base64 解码
                const buffer = Buffer.from(base64String, 'base64');
                const configJson = buffer.toString('utf8');
                console.log('解码后的JSON长度:', configJson.length);
                // 解析 JSON
                const config = JSON.parse(configJson);
                console.log('JSON解析成功');
                // 确保配置的完整性
                return {
                    projects: config.projects || [],
                    currentProjectId: config.currentProjectId || (config.projects?.length > 0 ? config.projects[0].id : '')
                };
            }
            catch (decodeError) {
                console.error('Base64解码或JSON解析失败:', decodeError);
                throw new Error('配置数据格式错误, 既不是有效的Base64也不是有效的JSON');
            }
        }
        catch (error) {
            console.error('从环境变量加载配置失败:', error);
            // 返回空配置
            return {
                projects: [],
                currentProjectId: ''
            };
        }
    }
    // 清除环境变量
    async clearEnvironmentVariables() {
        try {
            // 删除主环境变量
            await this.deleteEnvVar(this.envKey);
            // 从当前进程中清除
            delete process.env[this.envKey];
            return true;
        }
        catch (error) {
            console.error('清除环境变量失败:', error);
            throw error;
        }
    }
    // 删除单个环境变量
    async deleteEnvVar(key) {
        return new Promise((resolve, reject) => {
            try {
                const winreg = require('winreg');
                const regKey = new winreg({
                    hive: winreg.HKCU,
                    key: '\\Environment'
                });
                regKey.remove(key, (err) => {
                    if (err && !err.message.includes('unable to find')) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    // 获取环境变量注册表路径
    getRegistryPath() {
        return 'HKEY_CURRENT_USER\\Environment';
    }
    // 获取环境变量主键
    getEnvKey() {
        return this.envKey;
    }
}
// 主函数
async function ModifySetting(context) {
    try {
        const envManager = new EnvManager();
        // 获取当前配置
        const currentConfig = envManager.loadFromEnvironmentVariables();
        // 创建 WebView 面板
        const panel = vscode.window.createWebviewPanel('wDeveloperToolsConfig', 'W Developer Tools 配置', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'media'),
                vscode.Uri.joinPath(context.extensionUri, 'out')
            ]
        });
        // 设置 WebView HTML 内容 - 直接传入从环境变量读取的配置
        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, await currentConfig);
        // 处理来自 WebView 的消息
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveConfig':
                    try {
                        const configData = message.config;
                        // 计算保存的信息统计
                        const projectCount = configData.projects?.length || 0;
                        let totalPathPairs = 0;
                        const projectNames = [];
                        if (configData.projects) {
                            configData.projects.forEach((project) => {
                                projectNames.push(project.projectName);
                                totalPathPairs += project.svn_path_pairs?.length || 0;
                            });
                        }
                        // 保存到环境变量
                        await envManager.saveToEnvironmentVariables(configData);
                        // 显示详细的保存信息
                        const envPath = envManager.getRegistryPath();
                        const envKey = envManager.getEnvKey();
                        const saveInfo = [
                            '✅ 配置已成功保存！',
                            '',
                            '📁 保存位置：',
                            `  注册表路径：${envPath}`,
                            `  环境变量主键：${envKey}`,
                        ].join('\n');
                        vscode.window.showInformationMessage(saveInfo, { modal: false });
                        console.log('🔧 W Developer Tools - 配置保存详情：');
                        console.log(`   注册表路径：${envPath}`);
                        console.log(`   环境变量主键：${envKey}`);
                        // 通知 WebView 保存成功
                        panel.webview.postMessage({
                            command: 'saveSuccess',
                            message: '配置保存成功！',
                            config: configData // 返回最新的配置
                        });
                    }
                    catch (error) {
                        const errorMsg = `保存配置失败: ${error}`;
                        vscode.window.showErrorMessage(errorMsg);
                        panel.webview.postMessage({
                            command: 'saveError',
                            message: errorMsg
                        });
                    }
                    break;
                case 'requestClearConfirm':
                    // 显示 VS Code 原生确认对话框
                    const confirmResult = await vscode.window.showWarningMessage('确定要清除所有配置吗？此操作会删除环境变量中的配置，不可撤销。', { modal: true }, '确定清除', '取消');
                    if (confirmResult === '确定清除') {
                        try {
                            await envManager.clearEnvironmentVariables();
                            const clearInfo = [
                                '🗑️ 配置已清除',
                                '',
                                '📁 清除位置：',
                                `  注册表路径：${envManager.getRegistryPath()}`,
                                `  环境变量主键：${envManager.getEnvKey()}`,
                                '',
                                '⚠️ 配置环境变量已被删除。'
                            ].join('\n');
                            vscode.window.showInformationMessage(clearInfo, { modal: false });
                            // 直接通知 WebView 清除成功
                            panel.webview.postMessage({
                                command: 'clearSuccess',
                                message: '配置已清除'
                            });
                        }
                        catch (error) {
                            vscode.window.showErrorMessage(`清除配置失败: ${error}`);
                            // 通知 WebView 清除失败
                            panel.webview.postMessage({
                                command: 'clearError',
                                message: `清除配置失败: ${error}`
                            });
                        }
                    }
                    break;
                case 'close':
                    panel.dispose();
                    break;
            }
        }, undefined, context.subscriptions);
    }
    catch (error) {
        vscode.window.showErrorMessage(`初始化失败: ${error}`);
    }
}
// 获取 WebView HTML 内容
function getWebviewContent(webview, extensionUri, currentConfig) {
    // 序列化整个配置
    const projectsJson = JSON.stringify(currentConfig.projects || []);
    const currentProjectId = currentConfig.currentProjectId || '';
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>W Developer Tools 配置</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }

                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                }

                h1 {
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                    margin-bottom: 30px;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                input[type="text"],
                input[type="password"] {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 2px;
                    box-sizing: border-box;
                }

                input[type="text"]:focus,
                input[type="password"]:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }

                .form-hint {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }

                .buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background-color 0.2s;
                }

                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                .btn-primary:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .btn-success {
                    background-color: var(--vscode-gitDecoration-addedResourceForeground);
                    color: white;
                }

                .btn-success:hover {
                    opacity: 0.9;
                }

                .btn-danger {
                    background-color: var(--vscode-errorForeground);
                    color: white;
                }

                .btn-danger:hover {
                    opacity: 0.9;
                }

                .status-message {
                    margin-top: 15px;
                    padding: 10px;
                    border-radius: 3px;
                    display: none;
                }

                .success {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    color: var(--vscode-inputValidation-infoForeground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                }

                .error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }

                .config-info {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textBlockQuote-border);
                    padding: 10px 15px;
                    margin-bottom: 20px;
                    font-size: 13px;
                }

                .project-container {
                    background-color: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 15px;
                }

                .project-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .project-title {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    font-size: 16px;
                }

                .project-controls {
                    display: flex;
                    gap: 10px;
                }

                .remove-project-btn {
                    background-color: transparent;
                    color: var(--vscode-errorForeground);
                    padding: 4px 8px;
                    font-size: 12px;
                }

                .path-pair-container {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 15px;
                }

                .path-pair-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }

                .path-pair-title {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    font-size: 14px;
                }

                .remove-pair-btn {
                    background-color: transparent;
                    color: var(--vscode-errorForeground);
                    padding: 4px 8px;
                    font-size: 12px;
                }

                .add-pair-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    width: 100%;
                    margin-top: 10px;
                    margin-bottom: 10px;
                }

                .pair-controls {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                }

                .path-pair-group {
                    flex: 1;
                }

                .empty-state {
                    text-align: center;
                    padding: 20px;
                    color: var(--vscode-descriptionForeground);
                    border: 2px dashed var(--vscode-widget-border);
                    border-radius: 4px;
                    margin-bottom: 15px;
                }

                .project-selector {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    padding: 10px;
                    background-color: var(--vscode-editorWidget-background);
                    border-radius: 4px;
                }

                .project-selector label {
                    margin-bottom: 0;
                    font-weight: 600;
                }

                .project-selector select {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 2px;
                }

                .project-section {
                    display: none;
                }

                .project-section.active {
                    display: block;
                }

                .path-pair-section {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .path-pair-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .path-pair-section-title {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    font-size: 14px;
                }

                /* 空状态样式 */
                .empty-state-main {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--vscode-descriptionForeground);
                    border: 2px dashed var(--vscode-widget-border);
                    border-radius: 8px;
                    margin: 40px 0;
                    background-color: var(--vscode-editorWidget-background);
                }

                .empty-state-main h3 {
                    margin-bottom: 15px;
                    color: var(--vscode-foreground);
                }

                .empty-state-main p {
                    margin-bottom: 25px;
                    font-size: 14px;
                }

                .create-first-project-btn {
                    padding: 12px 24px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                }

                .create-first-project-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .empty-selector {
                    opacity: 0.7;
                }

                .config-area {
                    min-height: 300px;
                }

                .storage-info {
                    background-color: var(--vscode-settings-headerBackground);
                    border: 1px solid var(--vscode-settings-dropdownBorder);
                    border-radius: 4px;
                    padding: 10px;
                    margin-bottom: 15px;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>W Developer Tools 配置</h1>

                <div class="config-info">
                    <strong>配置说明：</strong><br/>
                    📋 支持创建多个项目，每个项目有独立的 SVN 账号<br/>
                    📋 每个项目可以配置多个子项目<br/>
                    📋 配置将保存到系统环境变量<br/>
                    📋 环境变量主键: W_DEVELOPER_TOOLS<br/>
                    📋 环境变量详细路径: HKEY_CURRENT_USER\\Environment<br/>
                </div>

                <div class="storage-info">
                    💡 <strong>存储方式优化：</strong><br/>
                    所有配置数据都保存在单个环境变量 <code>W_DEVELOPER_TOOLS</code> 中，
                    使用 JSON 格式存储，便于管理和维护。
                </div>

                <div class="project-selector">
                    <label for="projectSelect">当前项目：</label>
                    <select id="projectSelect">
                        <!-- 项目选项将动态生成 -->
                    </select>
                    <button type="button" id="newProjectBtn" class="btn-success">新建项目</button>
                </div>

                <div class="config-area" id="configArea">
                    <!-- 配置表单将动态生成 -->
                </div>

                <div class="buttons">
                    <button type="button" id="saveBtn" class="btn-primary">保存配置</button>
                    <button type="button" id="clearBtn" class="btn-danger">清除配置</button>
                    <button type="button" id="closeBtn" class="btn-secondary">关闭</button>
                </div>

                <div id="statusMessage" class="status-message"></div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let projects = ${projectsJson};
                let currentProjectId = "${escapeHtml(currentProjectId)}";
                let projectCounter = projects.length;
                let pairCounter = {};

                // 初始化
                function initialize() {
                    // 初始化每个项目的pair计数器
                    projects.forEach((project) => {
                        pairCounter[project.id] = project.svn_path_pairs.length;
                    });

                    // 初始化项目选择器
                    updateProjectSelector();

                    // 显示项目或空状态
                    if (projects.length === 0) {
                        showEmptyState();
                        disableButtons(true);
                    } else {
                        if (!currentProjectId || currentProjectId === '') {
                            currentProjectId = projects[0].id;
                        }
                        showProject(currentProjectId);
                        disableButtons(false);
                    }
                }

                // 更新项目选择器
                function updateProjectSelector() {
                    const projectSelect = document.getElementById('projectSelect');
                    projectSelect.innerHTML = '';

                    if (projects.length === 0) {
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '暂无项目';
                        emptyOption.disabled = true;
                        emptyOption.classList.add('empty-selector');
                        projectSelect.appendChild(emptyOption);
                        projectSelect.disabled = true;
                        return;
                    }

                    projectSelect.disabled = false;

                    projects.forEach((project) => {
                        const option = document.createElement('option');
                        option.value = project.id;
                        option.textContent = \`\${project.projectName} (ID: \${project.id})\`;
                        if (project.id === currentProjectId) {
                            option.selected = true;
                        }
                        projectSelect.appendChild(option);
                    });

                    // 添加事件监听
                    projectSelect.addEventListener('change', (e) => {
                        if (e.target.value) {
                            currentProjectId = e.target.value;
                            showProject(currentProjectId);
                        }
                    });
                }

                // 显示空状态
                function showEmptyState() {
                    const configArea = document.getElementById('configArea');
                    configArea.innerHTML = \`
                        <div class="empty-state-main">
                            <h3>暂无项目配置</h3>
                            <p>当前没有从环境变量中读取到任何项目配置。<br/>点击下方按钮开始创建第一个项目。</p>
                            <button id="createFirstProject" class="create-first-project-btn">
                                创建第一个项目
                            </button>
                        </div>
                    \`;

                    // 添加事件监听
                    document.getElementById('createFirstProject').addEventListener('click', () => {
                        createNewProject();
                    });
                }

                // 显示指定项目
                function showProject(projectId) {
                    const configArea = document.getElementById('configArea');
                    const project = projects.find(p => p.id === projectId);

                    if (!project) {
                        showEmptyState();
                        return;
                    }

                    let projectSection = document.getElementById(\`project-\${projectId}\`);

                    if (!projectSection) {
                        projectSection = createProjectSection(project);
                        configArea.innerHTML = '';
                        configArea.appendChild(projectSection);
                    } else {
                        configArea.innerHTML = '';
                        configArea.appendChild(projectSection);
                    }

                    // 初始化项目路径显示
                    initializePathPairs(projectId);
                }

                // 创建项目区域 - 修复了删除按钮的data属性问题
                function createProjectSection(project) {
                    const section = document.createElement('div');
                    section.id = \`project-\${project.id}\`;
                    section.className = 'project-section active';

                    // 判断是否为新项目（刚创建的，还没有保存过的）
                    const isNewProject = project.projectName === \`新项目 \${projectCounter}\` || !project.svn_user;

                    section.innerHTML = \`
                        <div class="project-container">
                            <div class="project-header">
                                <div class="project-title">项目配置：\${escapeHtml(project.projectName)}</div>
                                <div class="project-controls">
                                    \${isNewProject ? '' : '<button type="button" class="btn-secondary rename-project-btn" data-project-id="' + project.id + '">重命名</button>'}
                                    <button type="button" class="remove-project-btn" data-project-id="\${project.id}">删除项目</button>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="projectName_\${project.id}">项目名称</label>
                                <input type="text" id="projectName_\${project.id}"
                                       value="\${escapeHtml(project.projectName)}"
                                       placeholder="请输入项目名称">
                            </div>

                            <div class="form-group">
                                <label for="svnUser_\${project.id}">SVN 用户名</label>
                                <input type="text" id="svnUser_\${project.id}"
                                       value="\${escapeHtml(project.svn_user)}"
                                       placeholder="用于 SVN 认证的用户名">
                            </div>

                            <div class="form-group">
                                <label for="svnPwd_\${project.id}">SVN 密码</label>
                                <input type="password" id="svnPwd_\${project.id}"
                                       value="\${escapeHtml(project.svn_pwd)}"
                                       placeholder="SVN 认证密码">
                            </div>

                            <div class="path-pair-section">
                                <div class="path-pair-section-header">
                                    <div class="path-pair-section-title">SVN 项目路径配置</div>
                                </div>

                                <button type="button"
                                        class="add-pair-btn"
                                        data-project-id="\${project.id}"
                                        style="display:block;
                                            margin-top:8px;
                                            background:#1890ff;
                                            color:#fff;
                                            border:none;
                                            padding:6px 12px;
                                            border-radius:4px;">
                                    添加 SVN 项目路径
                                </button>

                                <div id="pathPairsContainer_\${project.id}">
                                    <!-- 项目路径将在这里动态添加 -->
                                </div>

                                <div class="form-hint">每对路径包含一个 cs_common 路径和一个对应的 Server 路径</div>
                            </div>
                        </div>
                    \`;

                    // 添加事件监听 - 修复后的代码
                    const removeBtn = section.querySelector('.remove-project-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', function() {
                            const projId = this.getAttribute('data-project-id');
                            removeProject(projId);
                        });
                    }

                    if (!isNewProject) {
                        const renameBtn = section.querySelector('.rename-project-btn');
                        if (renameBtn) {
                            renameBtn.addEventListener('click', function() {
                                const projId = this.getAttribute('data-project-id');
                                renameProject(projId);
                            });
                        }
                    }

                    // 添加项目路径按钮事件
                    const addPairBtn = section.querySelector('.add-pair-btn');
                    if (addPairBtn) {
                        addPairBtn.addEventListener('click', function() {
                            const projId = this.getAttribute('data-project-id');
                            addPathPairToUI(projId);
                        });
                    }

                    return section;
                }

                // 创建新项目
                function createNewProject() {
                    const projectId = \`project_\${++projectCounter}\`;
                    const newProject = {
                        id: projectId,
                        projectName: \`新项目 \${projectCounter}\`,
                        svn_user: '',
                        svn_pwd: '',
                        svn_path_pairs: []
                    };

                    projects.push(newProject);
                    currentProjectId = projectId;
                    pairCounter[projectId] = 0;

                    updateProjectSelector();

                    // 清空配置区域然后显示新项目
                    const configArea = document.getElementById('configArea');
                    configArea.innerHTML = '';

                    showProject(projectId);
                    disableButtons(false);
                }

                // 重命名项目
                function renameProject(projectId) {
                    const project = projects.find(p => p.id === projectId);
                    if (!project) return;

                    const newName = prompt('请输入新的项目名称：', project.projectName);
                    if (newName && newName.trim()) {
                        project.projectName = newName.trim();
                        updateProjectSelector();

                        // 更新当前显示的项目标题
                        const projectTitle = document.querySelector(\`#project-\${projectId} .project-title\`);
                        if (projectTitle) {
                            projectTitle.textContent = \`项目配置：\${newName}\`;
                        }

                        const projectNameInput = document.getElementById(\`projectName_\${projectId}\`);
                        if (projectNameInput) {
                            projectNameInput.value = newName.trim();
                        }
                    }
                }

                // 删除项目
                function removeProject(projectId) {
                    if (confirm('确定要删除这个项目吗？此操作不可撤销。')) {
                        // 从数组中移除
                        const projectIndex = projects.findIndex(p => p.id === projectId);
                        if (projectIndex === -1) return;

                        projects.splice(projectIndex, 1);

                        // 移除对应的项目区域
                        const projectSection = document.getElementById(\`project-\${projectId}\`);
                        if (projectSection && projectSection.parentNode) {
                            projectSection.parentNode.removeChild(projectSection);
                        }

                        // 如果删除的是当前项目，切换到第一个项目
                        if (projectId === currentProjectId) {
                            currentProjectId = projects.length > 0 ? projects[0].id : '';
                        }

                        // 更新选择器
                        updateProjectSelector();

                        if (projects.length === 0) {
                            showEmptyState();
                            disableButtons(true);
                            // 重置当前项目ID
                            currentProjectId = '';
                        } else {
                            // 重新渲染当前项目
                            const configArea = document.getElementById('configArea');
                            configArea.innerHTML = ''; // 清空现有内容
                            showProject(currentProjectId);
                        }

                        // 清理计数器
                        delete pairCounter[projectId];
                    }
                }

                // 初始化项目路径显示
                function initializePathPairs(projectId) {
                    const container = document.getElementById(\`pathPairsContainer_\${projectId}\`);
                    const project = projects.find(p => p.id === projectId);

                    if (!project || project.svn_path_pairs.length === 0) {
                        container.innerHTML = '<div class="empty-state">暂无SVN项目路径点击"添加SVN项目路径"按钮添加</div>';
                        return;
                    }

                    container.innerHTML = '';
                    project.svn_path_pairs.forEach((pair, index) => {
                        addPathPairToUI(projectId, pair, index);
                    });
                }

                // 添加项目路径到UI - 修复了删除按钮的data属性问题
                function addPathPairToUI(projectId, pair = null, index = null) {
                    const container = document.getElementById(\`pathPairsContainer_\${projectId}\`);
                    const project = projects.find(p => p.id === projectId);

                    if (!project) return;

                    // 移除空状态提示
                    if (container.querySelector('.empty-state')) {
                        container.innerHTML = '';
                    }

                    if (index === null) {
                        index = pairCounter[projectId] || 0;
                        pairCounter[projectId] = index + 1;
                    } else {
                        if (pairCounter[projectId] === undefined) {
                            pairCounter[projectId] = 0;
                        }
                        if (index >= pairCounter[projectId]) {
                            pairCounter[projectId] = index + 1;
                        }
                    }

                    const csPath = pair ? pair.cs_common_svn_path : '';
                    const serverPath = pair ? pair.server_svn_path : '';

                    const pairElement = document.createElement('div');
                    pairElement.className = 'path-pair-container';
                    pairElement.innerHTML = \`
                        <div class="path-pair-header">
                            <div class="path-pair-title">SVN项目路径 #\${index + 1}</div>
                            <button type="button" class="remove-pair-btn"
                                    data-project-id="\${projectId}"
                                    data-index="\${index}">删除</button>
                        </div>
                        <div class="pair-controls">
                            <div class="path-pair-group">
                                <label for="csPath_\${projectId}_\${index}">cs_common SVN 路径</label>
                                <input type="text"
                                       id="csPath_\${projectId}_\${index}"
                                       data-project-id="\${projectId}"
                                       data-index="\${index}"
                                       data-type="cs"
                                       value="\${escapeHtml(csPath)}"
                                       placeholder="例如: svn://server/path/to/cs-common">
                            </div>
                            <div class="path-pair-group">
                                <label for="serverPath_\${projectId}_\${index}">Server SVN 路径</label>
                                <input type="text"
                                       id="serverPath_\${projectId}_\${index}"
                                       data-project-id="\${projectId}"
                                       data-index="\${index}"
                                       data-type="server"
                                       value="\${escapeHtml(serverPath)}"
                                       placeholder="例如: svn://server/path/to/server-code">
                            </div>
                        </div>
                    \`;

                    container.appendChild(pairElement);

                    // 添加到项目数据中
                    if (!pair) {
                        if (!project.svn_path_pairs) {
                            project.svn_path_pairs = [];
                        }
                        project.svn_path_pairs.push({
                            id: \`pair_\${index}\`,
                            cs_common_svn_path: '',
                            server_svn_path: ''
                        });
                    }

                    // 添加删除事件
                    const removeBtn = pairElement.querySelector('.remove-pair-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', function() {
                            const projId = this.getAttribute('data-project-id');
                            const idx = parseInt(this.getAttribute('data-index'));
                            removePathPair(projId, idx);
                        });
                    }
                }

                // 移除项目路径
                function removePathPair(projectId, index) {
                    if (confirm('确定要删除这个SVN项目路径吗?')) {
                        const project = projects.find(p => p.id === projectId);
                        if (project) {
                            // 从数组中移除
                            project.svn_path_pairs = project.svn_path_pairs.filter((pair, i) => {
                                if (pair.id && pair.id.startsWith('pair_')) {
                                    const pairNum = parseInt(pair.id.split('_')[1]);
                                    return pairNum !== index;
                                }
                                return i !== index;
                            });

                            // 重新渲染
                            initializePathPairs(projectId);
                        }
                    }
                }

                // 收集配置数据
                function collectConfigData() {
                    const config = {
                        projects: [],
                        currentProjectId: currentProjectId
                    };

                    // 收集每个项目的数据
                    projects.forEach(project => {
                        const projectId = project.id;

                        // 获取项目基本信息
                        const projectName = document.getElementById(\`projectName_\${projectId}\`)?.value.trim() || '未命名项目';
                        const svnUser = document.getElementById(\`svnUser_\${projectId}\`)?.value.trim() || '';
                        const svnPwd = document.getElementById(\`svnPwd_\${projectId}\`)?.value.trim() || '';

                        // 收集项目路径数据
                        const pathPairs = [];
                        const csInputs = document.querySelectorAll(\`input[data-project-id="\${projectId}"][data-type="cs"]\`);

                        csInputs.forEach(input => {
                            const index = parseInt(input.getAttribute('data-index'));
                            const csPath = input.value.trim();
                            const serverPath = document.getElementById(\`serverPath_\${projectId}_\${index}\`)?.value.trim() || '';

                            if (csPath || serverPath) {
                                pathPairs.push({
                                    id: \`pair_\${index}\`,
                                    cs_common_svn_path: csPath,
                                    server_svn_path: serverPath
                                });
                            }
                        });

                        config.projects.push({
                            id: projectId,
                            projectName: projectName,
                            svn_user: svnUser,
                            svn_pwd: svnPwd,
                            svn_path_pairs: pathPairs
                        });
                    });

                    return config;
                }

                // 禁用/启用按钮
                function disableButtons(disabled) {
                    const saveBtn = document.getElementById('saveBtn');
                    const clearBtn = document.getElementById('clearBtn');

                    if (disabled) {
                        saveBtn.disabled = true;
                        saveBtn.style.opacity = '0.5';
                        saveBtn.style.cursor = 'not-allowed';

                        clearBtn.disabled = false; // 清除按钮仍然可用
                    } else {
                        saveBtn.disabled = false;
                        saveBtn.style.opacity = '1';
                        saveBtn.style.cursor = 'pointer';

                        clearBtn.disabled = false;
                    }
                }

                // 新建项目按钮事件
                document.getElementById('newProjectBtn').addEventListener('click', () => {
                    createNewProject();
                });

                // 保存配置
                document.getElementById('saveBtn').addEventListener('click', () => {
                    const config = collectConfigData();

                    // 验证必填项
                    let hasError = false;
                    let errorMessage = '';

                    config.projects.forEach(project => {
                        if (!project.svn_user || !project.svn_pwd) {
                            hasError = true;
                            errorMessage = \`项目"\${project.projectName}"的SVN用户名和密码为必填项\`;
                        }

                        // 检查项目路径
                        project.svn_path_pairs.forEach((pair, index) => {
                            if (pair.cs_common_svn_path && !pair.server_svn_path) {
                                hasError = true;
                                errorMessage = \`项目"\${project.projectName}"的第\${index + 1}个项目路径缺少Server路径\`;
                            } else if (!pair.cs_common_svn_path && pair.server_svn_path) {
                                hasError = true;
                                errorMessage = \`项目"\${project.projectName}"的第\${index + 1}个项目路径缺少cs_common路径\`;
                            }
                        });
                    });

                    if (hasError) {
                        showMessage(errorMessage, 'error');
                        return;
                    }

                    vscode.postMessage({
                        command: 'saveConfig',
                        config: config
                    });
                });

                // 清除配置
                document.getElementById('clearBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'requestClearConfirm'
                    });
                });

                // 关闭面板
                document.getElementById('closeBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'close'
                    });
                });

                // 显示状态消息
                function showMessage(message, type = 'success') {
                    const statusEl = document.getElementById('statusMessage');
                    statusEl.textContent = message;
                    statusEl.className = 'status-message ' + type;
                    statusEl.style.display = 'block';
                    setTimeout(() => {
                        statusEl.style.display = 'none';
                    }, 3000);
                }

                // 处理来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'saveSuccess':
                            showMessage(message.message, 'success');
                            // 更新本地数据
                            if (message.config) {
                                projects = message.config.projects;
                                currentProjectId = message.config.currentProjectId;
                                updateProjectSelector();
                                if (projects.length > 0) {
                                    showProject(currentProjectId);
                                }
                            }
                            break;

                        case 'saveError':
                            showMessage(message.message, 'error');
                            break;

                        case 'clearSuccess':
                            // 重置为默认状态
                            projects = [];
                            currentProjectId = '';
                            projectCounter = 0;
                            pairCounter = {};

                            // 清空表单并重新初始化
                            updateProjectSelector();
                            showEmptyState();
                            disableButtons(true);

                            showMessage(message.message, 'success');
                            break;
                    }
                });

                // HTML转义函数
                function escapeHtml(text) {
                    if (!text) return '';
                    return text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                // 初始化
                initialize();
            </script>
        </body>
        </html>
    `;
}
// HTML转义函数
function escapeHtml(text) {
    if (!text)
        return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
//# sourceMappingURL=setting.js.map