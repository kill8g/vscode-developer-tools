import * as fs from 'fs';

interface ProtocolInfo {
    name: string;
    module: string;
    id: number;
}

// 新增接口：协议模块ID范围
interface ProtocolModuleRange {
    moduleName: string;
    minId: number;
    maxId: number;
    protocolCount: number;
    protocols: ProtocolInfo[];
}

export class NetDefinesParser {
    private protocols: Map<number, ProtocolInfo> = new Map();
    private moduleProtocols: Map<string, ProtocolInfo[]> = new Map();
    private maxProtocolId: number = -1; // 用于缓存最大协议ID

    /**
     * 解析 netdefines.lua 文件
     * @param filePath Lua文件路径
     */
    parseFile(filePath: string): void {
        if (!fs.existsSync(filePath)) {
            console.error(`文件不存在: ${filePath}`);
            return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        this.parseContent(content);
    }

    /**
     * 解析 Lua 文件内容
     * @param content Lua文件内容
     */
    private parseContent(content: string): void {
        // 查找所有 GS2C_ALL 模块的定义
        const moduleRegex = /GS2C_ALL\.(\w+)\s*=\s*\{([^}]+)\}/g;

        let match;
        while ((match = moduleRegex.exec(content)) !== null) {
            const moduleName = match[1];

            // 过滤掉 oldPb 模块
            if (moduleName === 'oldPb') {
                console.log(`跳过模块: ${moduleName} (已过滤)`);
                continue;
            }

            const moduleContent = match[2];
            this.parseModule(moduleName, moduleContent);
        }
    }

    /**
     * 解析单个模块的协议定义
     * @param moduleName 模块名
     * @param moduleContent 模块内容
     */
    private parseModule(moduleName: string, moduleContent: string): void {
        // 清理内容，移除注释和空行
        const cleanedContent = moduleContent
            .replace(/--[^\n]*/g, '')  // 移除行注释
            .replace(/\s+/g, ' ')      // 压缩空白字符
            .trim();

        // 匹配协议定义：协议名 = 数字
        const protocolRegex = /(\w+)\s*=\s*(\d+)/g;

        const moduleProtocols: ProtocolInfo[] = [];

        let match;
        while ((match = protocolRegex.exec(cleanedContent)) !== null) {
            const protocolName = match[1];
            const protocolId = parseInt(match[2], 10);

            const protocolInfo: ProtocolInfo = {
                name: protocolName,
                module: moduleName,
                id: protocolId
            };

            // 保存到 id -> (name, module) 映射
            this.protocols.set(protocolId, protocolInfo);

            // 保存到模块分组
            moduleProtocols.push(protocolInfo);

            // 更新最大协议ID
            if (protocolId > this.maxProtocolId) {
                this.maxProtocolId = protocolId;
            }

            // console.log(`找到协议: id=${protocolId}, name=${protocolName}, module=${moduleName}`);
        }

        this.moduleProtocols.set(moduleName, moduleProtocols);
    }

    /**
     * 按 ID 排序输出所有协议
     */
    logAllProtocols(): void {
        console.log('\n=== 所有协议 (按ID排序) ===');
        console.log(`协议总数: ${this.protocols.size}`);
        console.log(`最大协议ID: ${this.maxProtocolId}`);

        // 按 ID 排序
        const sortedProtocols = Array.from(this.protocols.entries())
            .sort(([idA], [idB]) => idA - idB);

        for (const [id, protocol] of sortedProtocols) {
            console.log(`ID: ${id} -> 协议名: "${protocol.name}", 模块: "${protocol.module}"`);
        }
    }

	updateNetdefinesFile(filePath : string) {
		var content = `
local M = {}

local C2GS = {}
local GS2C = {}
M.C2GS = C2GS
M.GS2C = GS2C

local C2GS_BY_NAME = {}
local GS2C_BY_NAME = {}
M.C2GS_BY_NAME = C2GS_BY_NAME
M.GS2C_BY_NAME = GS2C_BY_NAME

local C2GS_DEFINES = {}
local GS2C_DEFINES = {}

-- -------------------------------------------------
local GS2C_ALL = {}

-- 编号1-100的协议由客户端内部使用

`

		var tmpMap = new Map<string, string>();
		for (const [moduleName, protos] of this.moduleProtocols) {
			const sortedProtocols = Array.from(protos.entries()).sort(([idA], [idB]) => idA - idB);
			var tmp = `GS2C_ALL.${moduleName} = {\n`
			for (const [id, protocol] of sortedProtocols) {
				tmp = tmp + `    ${protocol.name} = ${protocol.id},\n`
			}
			tmp = tmp + '}\n\n'
			tmpMap.set(moduleName, tmp)
		}

		const sortedProtocols = Array.from(this.protocols.entries()).sort(([idA], [idB]) => idA - idB);
		for (const [id, protocol] of sortedProtocols) {
			var str = tmpMap.get(protocol.module)
			if (str) {
				content = content + str
				tmpMap.delete(protocol.module)
			}
		}

		content = content + `
--GS2C END

for k, v in pairs(C2GS_DEFINES) do
    for k2, v2 in pairs(v) do
        assert(not C2GS[v2], string.format("netdefines C2GS error %s %s %s", k, k2, v2))
        assert(not C2GS_BY_NAME[k2], string.format("netdefines C2GS_BY_NAME error %s %s %s", k, k2, v2))
        C2GS[v2] = {k, k2}
        C2GS_BY_NAME[k2] = v2
    end
end

for k, v in pairs(GS2C_DEFINES) do
    for k2, v2 in pairs(v) do
        assert(not GS2C[v2], string.format("netdefines GS2C error %s %s %s", k, k2, v2))
        assert(not GS2C_BY_NAME[k2], string.format("netdefines GS2C_BY_NAME error %s %s %s", k, k2, v2))
        GS2C[v2] = {k, k2}
        GS2C_BY_NAME[k2] = v2
    end
end

for k, v in pairs(GS2C_ALL) do
    for k2, v2 in pairs(v) do
        assert(not GS2C[v2], string.format("netdefines GS2C error %s %s %s", k, k2, v2))
        assert(not GS2C_BY_NAME[k2], string.format("netdefines GS2C_BY_NAME error %s %s %s", k, k2, v2))
        GS2C[v2] = {k, k2}
        GS2C_BY_NAME[k2] = v2
        C2GS[v2] = {k, k2}
        C2GS_BY_NAME[k2] = v2
    end
end


return M
`
		console.log(filePath)
		fs.writeFileSync(filePath, content, 'utf-8');
	}

	findProto(protocolName : string): boolean {
		for (const protocol of this.protocols.values()) {
            if (protocol.name === protocolName) {
                return true
            }
        }
		return false
	}

	findModule(moduleName : string) {
		for (const protocol of this.protocols.values()) {
            if (protocol.module === moduleName) {
                return this.getProtocolModuleRange(protocol.name);
            }
        }
		return null;
	}

	addProto(moduleName : string, protocolName : string, protocolId: number): void {
		const protocolInfo: ProtocolInfo = {
			name: protocolName,
			module: moduleName,
			id: protocolId
		};

		// 保存到 id -> (name, module) 映射
		this.protocols.set(protocolId, protocolInfo);

		var module = this.moduleProtocols.get(moduleName);
		if (module) {
			module.push(protocolInfo)
		} else {
			this.moduleProtocols.set(moduleName, [protocolInfo])
		}
		console.log(`新增协议protocolId:${protocolId} protocolName:${protocolName}`)
	}

    /**
     * 根据协议名获取该协议所属模块的ID范围
     * @param protocolName 协议名
     * @returns 协议模块ID范围信息，未找到返回null
     */
    getProtocolModuleRange(protocolName: string): ProtocolModuleRange | null {
        // 先找到协议信息
        let targetProtocol: ProtocolInfo | null = null;

        for (const protocol of this.protocols.values()) {
            if (protocol.name === protocolName) {
                targetProtocol = protocol;
                break;
            }
        }

        if (!targetProtocol) {
            console.warn(`未找到协议: ${protocolName}`);
            return null;
        }

        const moduleName = targetProtocol.module;
        const moduleProtocols = this.moduleProtocols.get(moduleName);

        if (!moduleProtocols || moduleProtocols.length === 0) {
            console.warn(`模块 ${moduleName} 没有协议数据`);
            return null;
        }

        // 按ID排序
        const sortedProtocols = [...moduleProtocols].sort((a, b) => a.id - b.id);

        // 计算ID范围
        const minId = sortedProtocols[0].id;
        const maxId = sortedProtocols[sortedProtocols.length - 1].id;

        return {
            moduleName,
            minId,
            maxId,
            protocolCount: sortedProtocols.length,
            protocols: sortedProtocols
        };
    }

    /**
     * 打印指定协议所属模块的ID范围
     * @param protocolName 协议名
     */
    logProtocolModuleRange(protocolName: string): void {
        const range = this.getProtocolModuleRange(protocolName);

        if (!range) {
            console.log(`未找到协议 "${protocolName}" 的信息`);
            return;
        }

        console.log(`\n=== 协议 "${protocolName}" 所属模块信息 ===`);
        console.log(`模块名: ${range.moduleName}`);
        console.log(`ID范围: ${range.minId} ~ ${range.maxId}`);
        console.log(`协议数量: ${range.protocolCount}`);
        console.log(`范围跨度: ${range.maxId - range.minId + 1}`);

        console.log('\n模块内所有协议:');
        for (const protocol of range.protocols) {
            const isTarget = protocol.name === protocolName ? '←' : '';
            console.log(`  ID: ${protocol.id}, 协议名: ${protocol.name} ${isTarget}`);
        }
    }

    /**
     * 获取所有协议中的最大ID
     * @returns 最大协议ID，如果没有协议则返回-1
     */
    getMaxProtocolId(): number {
        return this.maxProtocolId;
    }
}