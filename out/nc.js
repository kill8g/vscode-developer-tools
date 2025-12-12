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
exports.netcat = netcat;
const net = __importStar(require("net"));
const vscode = __importStar(require("vscode"));
/**
 * 最简单的 nc 客户端（单次请求-响应）
 */
async function netcat(host, port, message) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let response = '';
        console.log(`connect to host:${host} port:${port} message:${message}`);
        // 连接配置
        client.connect(port, host);
        // 设置超时（10秒）
        client.setTimeout(10000);
        // 连接成功
        client.on('connect', () => {
            console.log("send msg: " + message);
            client.write(message + '\n');
        });
        // 接收数据
        client.on('data', (data) => {
            response += data.toString();
            vscode.window.showInformationMessage(`热更新代码完毕`);
            // 接收到数据后，等待一小段时间确保数据完整，然后关闭连接
            setTimeout(() => {
                console.log("数据接收完成，关闭连接");
                client.destroy();
                resolve(response);
            }, 200); // 200ms延迟确保数据完整
        });
        // 连接正常结束
        client.on('close', () => {
            console.log("连接关闭，返回响应");
            resolve(response);
        });
        // 错误处理
        client.on('error', (err) => {
            console.error("连接错误:", err);
            vscode.window.showErrorMessage(`连接到服务器${host}:${port}出现错误`);
            reject(new Error(`连接错误: ${err.message}`));
        });
        // 超时处理
        client.on('timeout', () => {
            console.log("连接超时，当前已接收数据:", response);
            client.destroy();
            if (response) {
                console.log("已有数据，返回成功");
                resolve(response); // 已有数据，不报错
            }
            else {
                vscode.window.showErrorMessage(`连接到服务器${host}:${port}超时`);
                reject(new Error('连接超时'));
            }
        });
    });
}
//# sourceMappingURL=nc.js.map