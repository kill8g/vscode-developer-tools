import * as net from 'net';
import * as vscode from 'vscode';

/**
 * 最简单的 nc 客户端（单次请求-响应）
 */
export async function netcat(
    host: string,
    port: number,
    message: string
): Promise<string> {
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
        client.on('data', (data: Buffer) => {
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
            } else {
                vscode.window.showErrorMessage(`连接到服务器${host}:${port}超时`);
                reject(new Error('连接超时'));
            }
        });
    });
}
