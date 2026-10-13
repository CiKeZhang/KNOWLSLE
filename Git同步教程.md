# GitHub 代码同步教程

> 适用于 KNOWLSLE 项目：项目文件改动后，如何同步到 GitHub

---

## 一、首次使用（只需做一次）

### 1. 安装 Git

下载地址：https://git-scm.com/download/win

安装时一路默认即可，安装完成后**重启终端**或电脑。

验证安装是否成功（在终端中输入）：
```bash
git --version
```

### 2. 配置 Git 身份

打开终端（PowerShell 或 Git Bash），执行：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub注册邮箱"
```

### 3. 初始化本地仓库

在项目根目录（`KNOWLSLE-main` 文件夹）下执行：

```bash
git init
```

### 4. 在 GitHub 上创建远程仓库

1. 登录 https://github.com
2. 点击右上角 **+** → **New repository**
3. 填写仓库名（例如 `KNOWLSLE`），选择 **Public** 或 **Private**
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 **Create repository**

### 5. 关联远程仓库并首次提交

```bash
# 添加所有文件到暂存区
git add .

# 提交到本地仓库
git commit -m "首次提交：项目初始化"

# 关联远程仓库（把下面的地址换成你自己的）
git remote add origin https://github.com/你的用户名/KNOWLSLE.git

# 推送到 GitHub（首次推送）
git push -u origin main
```

> 注意：如果提示默认分支是 `master`，把上面的 `main` 换成 `master`。

---

## 二、日常同步流程（每次改动后做）

### 标准三步法

```bash
# 第1步：查看改了哪些文件（可选，建议每次都看看）
git status

# 第2步：添加所有改动到暂存区
git add .

# 第3步：提交并写清楚改了什么
git commit -m "修复打卡功能bug"

# 第4步：推送到 GitHub
git push
```

### 提交信息怎么写？

用简洁的话描述这次改动，例如：

- ✅ 好的提交信息：
  - `新增学生进度档案页面`
  - `修复导师看板统计数据错误`
  - `优化AI推荐算法`
  - `更新部署文档`

- ❌ 不好的提交信息：
  - `更新`
  - `修改`
  - `fix bug`
  - `asdf`

---

## 三、常用命令速查

| 命令 | 作用 |
| ---- | ---- |
| `git status` | 查看当前文件改动状态 |
| `git add .` | 添加所有改动文件到暂存区 |
| `git add 文件名` | 添加指定文件到暂存区 |
| `git commit -m "描述"` | 提交到本地仓库 |
| `git push` | 推送到远程仓库（GitHub） |
| `git pull` | 从远程仓库拉取最新代码 |
| `git log` | 查看提交历史（按 q 退出） |
| `git diff` | 查看具体改动内容 |
| `git branch` | 查看当前分支 |
| `git checkout -b 分支名` | 创建并切换到新分支 |

---

## 四、常见场景

### 场景1：我改了文件，想看看改了什么

```bash
git status          # 看哪些文件改了
git diff            # 看具体改了哪些行
```

### 场景2：我误改了一个文件，想还原

```bash
git checkout -- 文件名    # 还原单个文件
git checkout .           # 还原所有改动（慎用！）
```

### 场景3：别人也改了代码，我推送失败

```bash
# 先拉取别人的最新代码
git pull

# 如果有冲突，手动解决后再提交推送
git add .
git commit -m "合并冲突"
git push
```

### 场景4：我想创建新功能分支

```bash
# 创建并切换到新分支
git checkout -b feature/ai-recommend

# 开发完后切换回主分支
git checkout main

# 合并新分支
git merge feature/ai-recommend

# 删除旧分支
git branch -d feature/ai-recommend
```

---

## 五、本项目已忽略的文件

`.gitignore` 文件已经配置好，以下内容**不会**被提交到 GitHub：

- `node_modules/` — 依赖包（太大，不需要提交）
- `.env` — 环境变量（包含密钥等敏感信息）
- `dist/` / `build/` — 编译产物
- `*.db` — 数据库文件
- `uploads/` / `backups/` — 上传和备份文件
- `.vscode/` / `.idea/` — 编辑器配置
- `*.log` — 日志文件

---

## 六、推荐工作流

### 单人开发

直接在 `main` 分支上开发：
```
写代码 → git add . → git commit → git push
```

### 多人协作

1. 每人创建自己的功能分支
2. 开发完后提交 Pull Request
3. 代码审核后合并到主分支

---

## 七、常见问题

### Q: 提示 `git` 不是内部或外部命令？
A: Git 没安装或没重启终端，安装后重启即可。

### Q: 推送时要求输入用户名密码？
A: 现在 GitHub 不支持密码登录了，需要用 **Personal Access Token** 代替密码。
生成方法：GitHub 右上角头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 `repo` 权限，生成后保存好（只显示一次）。

### Q: 我不小心提交了敏感文件怎么办？
A: 立刻从 Git 历史中移除，参考：`git rm --cached 文件名`，然后重新提交。

### Q: 如何查看远程仓库地址？
```bash
git remote -v
```

---

## 八、一句话总结

> 改完代码后，**add → commit → push** 三步走，搞定！
