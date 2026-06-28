# Urban Co-creation 

Urban Co-creation is a platform for interactive urban grid layout and optimization using Multi-Agent Proximal Policy Optimization (MAPPO).
本系统是一个城市格网交互规划与优化平台，集成了基于 MAPPO（多智能体强化学习）算法的智能推荐。

---

## 🛠️ Environmental Configuration from Scratch (从零配置环境)

### Step 1: Install Node.js (第一步：安装 Node.js)
To run this project, the only prerequisite is **Node.js** (v18.0.0+ / LTS version recommended).
运行本项目唯一的前置环境依赖为 **Node.js**（推荐安装 v18.0.0 以上的长期支持版 LTS）。

* **Windows**:
  Open **PowerShell (Administrator)** and run:
  打开 **PowerShell（管理员）** 运行以下命令进行命令行安装：
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
  *Alternatively, download and run the installer from the [Node.js Official Website](https://nodejs.org/).*
  *或者直接前往 [Node.js 官网](https://nodejs.org/) 下载安装包安装。*

* **macOS**:
  Install via Homebrew:
  使用 Homebrew 安装：
  ```bash
  brew install node
  ```

* **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install nodejs npm
  ```

*Verify installation (验证安装是否成功):*
```bash
node -v
npm -v
```

---

## 🚀 One-Click Setup & Startup (一键安装与启动)

Once Node.js is installed, you can set up and start the website using the one-click script in the project root directory.
安装好 Node.js 后，您只需使用项目根目录下的一键脚本即可自动下载依赖并启动网站。

### Windows Users (Windows 用户):
1. **Navigate to the project root directory (使用 cd 命令导航至项目根目录)**:
   ```powershell
   cd "C:\path\to\your\Urban_Co-creation"
   ```
2. **Execute the script (运行一键脚本)**:
   ```powershell
   .\run.ps1
   ```
   > [!NOTE]
   > **常见问题：Windows 提示“此系统禁止运行脚本”**
   > 如果运行 `.\run.ps1` 时报错提示“此系统禁止运行脚本”，这是 Windows 的默认安全策略导致的。您可以通过以下任一方法解决：
   > 
   > * **方法一（临时绕过，推荐）：** 在终端直接执行以下命令临时运行脚本：
   >   ```powershell
   >   PowerShell -ExecutionPolicy Bypass -File .\run.ps1
   >   ```
   > * **方法二（为当前用户解锁）：** 在 PowerShell 中执行以下命令，只需设置一次：
   >   ```powershell
   >   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   >   ```
   > * **方法三（全局解锁）：** 以管理员身份打开 PowerShell，然后运行：
   >   ```powershell
   >   Set-ExecutionPolicy RemoteSigned
   >   ```


### macOS / Linux Users (macOS / Linux 用户):
1. **Navigate to the project root directory (使用 cd 命令导航至项目根目录)**:
   ```bash
   cd /path/to/your/Urban_Co-creation
   ```
2. **Execute the script (运行一键脚本)**:
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

---

## 🔧 Manual Setup & Startup (手动配置与启动 - 备用)

If you prefer to start the server manually without using the scripts:
如果不使用一键脚本，也可以手动在命令行输入命令进行配置：

1. **Navigate to the project root directory (使用 cd 命令导航至项目根目录)**:
   ```bash
   cd /path/to/your/Urban_Co-creation
   ```
2. **Install dependencies (安装项目依赖包)**:
   ```bash
   npm install
   ```
3. **Start the local server (启动本地开发服务器)**:
   ```bash
   npm run dev
   ```

---

## 🌐 Open the Website (访问网页)

Once the local server has started, open your browser and navigate to:
开发服务器成功启动后，打开浏览器访问以下地址即可进入系统：
👉 **[http://localhost:3001](http://localhost:3001)**
