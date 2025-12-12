# w-developer-tools README

## Features
该插件包含以下几个功能:
1. 空模块生成, 右键点击`打开的lua文件`, 呼出右键菜单后, 点击 `w-developer-tools:创建空模块`, 在输入框中输入`模块名`, 然后选择`模块路径`, 就会生成一个W框架下的最小化空模块;
2. 打开proto协议文件, 右键点击该`协议文件`呼出右键菜单后, 点击 `w-developer-tools:创建协议模块`, 选择协议文件后, 然后选择`模块路径`, 生成模块文件夹, 然后会读取你选中的协议文件, 每一条`Req`上行协议, 都会生成一个对应的接口到`network.lua`中, 然后会加上`协议参数检查`, 如不需要, 这些检查代码, 可自行删除;
3. 打开需要生成协议id的proto协议文件, 呼出右键菜单, 点击`w-developer-tools:生成协议ID`, 会自动读取协议, 然后更新`netdefines.lua`;
4. 热更新服务器代码, 右键点击`需要热更的lua文件`, 呼出右键菜单后, 点击`w-developer-tools:热更服务器代码`, 然后`双击选择`更新的服务器节点, 即可进行热更操作;
5. 热更新策划配置, 右键点击`任意lua文件`, 呼出右键菜单后, 点击`w-developer-tools:热更策划配置`, 然后`双击选择`更新的服务器节点, 即可进行热更操作, 首次进行该操作需要手动指定`server.ini`文件的路径;
6. 热更新协议结构, 右键点击`需要热更的proto协议文件`, 呼出右键菜单后, 点击`w-developer-tools:热更协议`, 即可进行热更操作, 首次进行该操作需要手动指定`server.ini`文件的路径;

## Requirements
暂无

## Extension Settings
暂无

## Known Issues
Call me @W:罗勒

## version:1.0.0
添加`w-developer-tools`基础功能

---

**Enjoy!**
