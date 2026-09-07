---
title: "Shell 速查表"
date: 2026-09-07
description: "本文章记录Shell脚本常用的语法与技巧，包含变量、条件判断、循环、数组、函数与输入输出等，算是个快速查阅的文档，整体偏向于教学性质"
image: ""
tags: ["Shell", "编程"]
pinned: false
---

## 一、脚本基础结构

### 1.1 指定解释器 Shebang（#!/bin/bash）

语法作用：脚本文件的第一行，告诉系统用哪个解释器执行这个脚本。必须顶格写，前面不能有空格或空行。

```shell
#!/bin/bash
# 这是注释
echo "Hello World"
```

结果：系统调用 /bin/bash 来执行脚本内容。

### 1.2 给脚本添加执行权限 chmod +x

语法作用：脚本文件必须拥有执行权限才能直接运行（用 ./script.sh 的方式）。

```shell
chmod +x script.sh   # 给脚本添加执行权限
./script.sh          # 直接运行
bash script.sh       # 或者用 bash 命令运行（不需要执行权限）
```

结果：脚本开始执行。

## 二、变量

### 2.1 定义和使用变量

语法作用：变量名=值，等号两边不能有空格。引用变量时加 $。变量名区分大小写，通常用大写表示常量。

```shell
#!/bin/bash
name="张三"
age=25
echo "我的名字是 $name"
echo "我今年 ${age} 岁"    # 花括号可以隔开边界，推荐使用
```

结果：输出"我的名字是 张三"、"我今年 25 岁"。

### 2.2 只读变量 readonly

语法作用：将变量设为只读，后续不能修改它的值。

```shell
#!/bin/bash
readonly PI=3.14159
PI=3.14   # 这一行会报错
```

结果：报错 ./test.sh: line 3: PI: readonly variable。

### 2.3 删除变量 unset

语法作用：删除已定义的变量（不能删除只读变量）。

```shell
#!/bin/bash
name="张三"
unset name
echo "名字是 $name"   # 输出空行，因为变量已删除
```

结果：$name 变成空字符串。

### 2.4 命令替换 $()（将命令结果赋给变量）

语法作用：执行括号内的命令，把输出结果赋值给变量。

```shell
#!/bin/bash
current_date=$(date)      # date 命令的输出赋给变量
echo "现在是 $current_date"

# 旧写法（反引号，不推荐）：current_date=`date`
```

结果：输出当前日期时间。

## 三、特殊变量（脚本参数）

### 3.1 接收命令行参数 $0、$1、$#...

语法作用：脚本运行时传入的参数会按顺序存入特殊变量中。

| 变量 | 含义 |
|---|---|
| `$0` | 脚本自身的文件名 |
| `$1`、`$2`、`$3`... | 第 1、2、3 个传入的参数 |
| `$#` | 传入参数的总个数 |
| `$@` | 所有参数（用空格隔开） |
| `$*` | 所有参数（合并成一个字符串） |
| `$?` | 上一条命令的执行状态（0=成功，非0=失败） |
| `$$` | 当前 Shell 的进程 ID |

```shell
#!/bin/bash
echo "脚本名: $0"
echo "第一个参数: $1"
echo "第二个参数: $2"
echo "参数个数: $#"
```

结果：执行 ./test.sh hello world 时输出：

```
脚本名: ./test.sh
第一个参数: hello
第二个参数: world
参数个数: 2
```

### 3.2 检查上一条命令是否成功 $?

语法作用：$? 返回 0 表示上一条命令执行成功，非 0 表示失败。

```shell
#!/bin/bash
ls /tmp
echo "退出码: $?"   # 输出 0（成功）

ls /不存在的目录
echo "退出码: $?"   # 输出非 0（失败）
```

结果：第一个 $? 输出 0，第二个输出非 0（通常是 2）。

## 四、条件判断（if / case）

### 4.1 基本 if 结构

语法作用：如果条件成立则执行 then 后的代码，否则执行 else 后的代码。[ 和 ] 两边必须有空格。

```shell
#!/bin/bash
if [ 条件 ]; then
    命令
elif [ 另一个条件 ]; then
    命令
else
    命令
fi
```

结果：根据条件真假执行对应分支。

### 4.2 文件/目录判断 -f / -d / -e

语法作用：检查文件是否存在（-f）、目录是否存在（-d）、是否存在（-e，不限类型）。

```shell
#!/bin/bash
if [ -f "/etc/passwd" ]; then
    echo "文件存在"
else
    echo "文件不存在"
fi
```

结果：输出"文件存在"。

```shell
if [ -d "/home" ]; then
    echo "目录存在"
fi
```

### 4.3 数值比较 -eq / -ne / -gt / -lt / -ge / -le

语法作用：比较两个整数的大小关系。

| 运算符 | 含义 |
|---|---|
| `-eq` | 等于（equal） |
| `-ne` | 不等于（not equal） |
| `-gt` | 大于（greater than） |
| `-lt` | 小于（less than） |
| `-ge` | 大于等于（greater or equal） |
| `-le` | 小于等于（less or equal） |

```shell
#!/bin/bash
score=85
if [ $score -ge 60 ]; then
    echo "及格"
else
    echo "不及格"
fi
```

结果：输出"及格"。

### 4.4 字符串比较 = / != / -z / -n

语法作用：比较字符串是否相同、是否为空。

```shell
#!/bin/bash
str="hello"
if [ "$str" = "hello" ]; then
    echo "匹配"
fi

if [ -z "$str" ]; then
    echo "字符串为空"
else
    echo "字符串不为空"
fi
```

结果：输出"匹配"、"字符串不为空"。

注意：字符串变量建议用双引号括起来，防止变量为空时语法报错。

### 4.5 逻辑组合（与/或/非）

语法作用：多个条件组合。-a（AND，与）、-o（OR，或）、!（NOT，非）。

```shell
#!/bin/bash
age=25
if [ $age -ge 18 ] && [ $age -le 60 ]; then
    echo "成年人"
fi

# 也可以用 -a 写法
if [ $age -ge 18 -a $age -le 60 ]; then
    echo "成年人"
fi
```

结果：输出"成年人"。

### 4.6 case 多分支匹配

语法作用：类似于其他语言的 switch，根据变量的值匹配多个模式执行不同代码。

```shell
#!/bin/bash
read -p "输入 yes 或 no: " answer
case $answer in
    yes|y|Y|Yes)
        echo "你同意了"
        ;;
    no|n|N|No)
        echo "你拒绝了"
        ;;
    *)
        echo "输入无效"
        ;;
esac
```

结果：输入 yes 输出"你同意了"，输入 no 输出"你拒绝了"，输入其他输出"输入无效"。

## 五、循环

### 5.1 for 循环遍历列表

语法作用：把列表里的值依次赋给变量，循环执行命令。

```shell
#!/bin/bash
for file in *.txt; do
    echo "处理文件: $file"
done
```

结果：把当前目录下所有 .txt 文件名依次打印出来。

```shell
#!/bin/bash
for name in 张三 李四 王五; do
    echo "你好, $name"
done
```

结果：分别输出三条问候。

### 5.2 for 循环数字区间 {起始..结束}

语法作用：用数字范围控制循环次数。

```shell
#!/bin/bash
for i in {1..5}; do
    echo "第 $i 次循环"
done
```

结果：打印第 1 到 第 5 次循环。

```shell
# 带步长（Bash 4.0+ 支持）
for i in {1..10..2}; do
    echo $i   # 输出 1,3,5,7,9
done
```

### 5.3 C 语言风格 for 循环

语法作用：使用类似 C 语言的语法，适合精确控制循环次数。

```shell
#!/bin/bash
for ((i=0; i<5; i++)); do
    echo "计数: $i"
done
```

结果：输出 0 到 4。

### 5.4 while 条件循环

语法作用：只要条件成立就一直循环。

```shell
#!/bin/bash
count=1
while [ $count -le 5 ]; do
    echo "计数: $count"
    count=$((count + 1))
done
```

结果：打印计数 1 到 5。

### 5.5 until 直到循环（条件为假才执行）

语法作用：条件为假时执行循环，直到条件变为真才停止（与 while 相反）。

```shell
#!/bin/bash
count=1
until [ $count -gt 5 ]; do
    echo "计数: $count"
    count=$((count + 1))
done
```

结果：打印计数 1 到 5（直到 count > 5 才停）。

### 5.6 break 和 continue（跳出/跳过循环）

语法作用：break 立即退出整个循环，continue 跳过当前这一次循环，继续下一次。

```shell
#!/bin/bash
for i in {1..10}; do
    if [ $i -eq 5 ]; then
        continue   # 跳过 5
    fi
    if [ $i -gt 8 ]; then
        break      # 大于 8 就退出
    fi
    echo $i
done
```

结果：输出 1,2,3,4,6,7,8（跳过了 5，9 和 10 没来得及输出）。

## 六、数组

### 6.1 定义和访问数组

语法作用：用括号 () 定义数组，用索引访问元素（索引从 0 开始）。

```shell
#!/bin/bash
names=("张三" "李四" "王五")
echo "第一个: ${names[0]}"
echo "所有: ${names[@]}"
```

结果：输出"第一个: 张三"、"所有: 张三 李四 王五"。

### 6.2 获取数组长度

语法作用：在数组变量前加 # 获取元素个数。

```shell
#!/bin/bash
names=("张三" "李四" "王五")
echo "数组长度: ${#names[@]}"
```

结果：输出"数组长度: 3"。

### 6.3 遍历数组

语法作用：用 for 循环遍历数组的所有元素。

```shell
#!/bin/bash
names=("张三" "李四" "王五")
for name in "${names[@]}"; do
    echo "名字: $name"
done
```

结果：依次输出"名字: 张三"、"名字: 李四"、"名字: 王五"。

## 七、算术运算

### 7.1 整数运算 $((表达式))

语法作用：用 $((...)) 进行整数运算，支持 +、-、*、/、%（取余）、**（幂）。

```shell
#!/bin/bash
a=10
b=3
echo "加法: $((a + b))"
echo "减法: $((a - b))"
echo "乘法: $((a * b))"
echo "除法: $((a / b))"   # 整数除法，结果是 3（不是 3.33）
echo "取余: $((a % b))"   # 10 % 3 = 1
echo "幂: $((2 ** 3))"    # 2 的 3 次方 = 8
```

结果：输出加法 13、减法 7、乘法 30、除法 3、取余 1、幂 8。

### 7.2 自增/自减

语法作用：用 ((变量++)) 或 ((变量--)) 实现自增自减。

```shell
#!/bin/bash
count=0
((count++))
echo $count   # 输出 1
((count += 5))
echo $count   # 输出 6
```

结果：输出 1、6。

## 八、函数

### 8.1 定义和调用函数

语法作用：用 function 函数名() { ... } 或 函数名() { ... } 定义函数，直接用函数名调用。

```shell
#!/bin/bash
# 定义函数
say_hello() {
    echo "你好！"
}

# 调用函数
say_hello
```

结果：输出"你好！"。

### 8.2 带参数的函数

语法作用：在函数内部用 $1、$2... 接收传入的参数（与脚本参数类似）。

```shell
#!/bin/bash
greet() {
    echo "你好, $1！今天是 $2"
}

greet "张三" "周一"
```

结果：输出"你好, 张三！今天是 周一"。

### 8.3 函数返回值 return

语法作用：用 return 返回一个数字（0~255），作为函数的退出状态码。$? 获取返回值。

```shell
#!/bin/bash
add() {
    return $(( $1 + $2 ))
}

add 3 5
echo "结果是: $?"   # 输出 8
```

结果：输出"结果是: 8"。注意：return 只能返回 0~255 的数字，超过会溢出。想返回更大的数，用 echo 输出并通过 $() 捕获。

### 8.4 函数返回字符串（用 echo + 命令替换）

语法作用：用 echo 输出字符串，调用方用 $() 捕获输出作为返回值。

```shell
#!/bin/bash
get_name() {
    echo "张三"
}

name=$(get_name)
echo "名字是: $name"
```

结果：输出"名字是: 张三"。

## 九、输入输出

### 9.1 读取用户输入 read

语法作用：暂停脚本执行，等待用户输入，输入内容存入变量。

```shell
#!/bin/bash
read -p "你叫什么名字？" username
echo "你好, $username！"
```

结果：脚本停下等待输入，输入后输出"你好, XX！"。

```shell
# 静默输入（适合密码）
read -s -p "输入密码: " password
echo
echo "密码已保存"
```

### 9.2 输出文本 echo / printf

语法作用：echo 简单输出并自动换行，printf 更强大但不自动换行（类似 C 语言的 printf）。

```shell
#!/bin/bash
echo "普通输出"
echo -n "不换行"   # 不换行
echo "输出"

printf "格式化: %s，数字: %d\n" "张三" 25
```

结果：

```
普通输出
不换行输出
格式化: 张三，数字: 25
```

### 9.3 重定向 >（覆盖）和 >>（追加）

语法作用：> 覆盖写入文件，>> 追加到文件末尾。2> 重定向错误输出。

```shell
#!/bin/bash
echo "第一行" > log.txt   # 文件里只有这一行
echo "第二行" >> log.txt  # 文件里有两行了
ls /不存在的目录 2> error.log  # 错误信息写入文件
```

结果：log.txt 内容为"第一行""第二行"，error.log 包含错误信息。

## 十、常用脚本技巧

### 10.1 检查脚本是否以 root 运行

语法作用：检查 $EUID（有效用户 ID），root 的 EUID 为 0。

```shell
#!/bin/bash
if [ $EUID -ne 0 ]; then
    echo "请用 root 运行此脚本"
    exit 1
fi
echo "当前是 root"
```

### 10.2 检查上一条命令是否成功

语法作用：用 $? 判断，如果失败则退出脚本。

```shell
#!/bin/bash
mkdir /some/directory
if [ $? -ne 0 ]; then
    echo "创建目录失败，退出"
    exit 1
fi
echo "成功"
```

### 10.3 从文件中逐行读取

语法作用：用 while read 循环读取文件的每一行。

```shell
#!/bin/bash
while read line; do
    echo "行内容: $line"
done < file.txt
```

结果：逐行输出 file.txt 的内容。

### 10.4 默认值 ${变量:-默认值}

语法作用：如果变量未定义或为空，则使用默认值。

```shell
#!/bin/bash
echo "名字: ${name:-无名氏}"   # name 未定义，输出"无名氏"
```

结果：输出"名字: 无名氏"。

### 10.5 脚本所在目录（防止 cd 后路径丢失）

语法作用：获取脚本自身所在的目录，无论从哪里执行都能准确定位。

```shell
#!/bin/bash
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
echo "脚本在: $SCRIPT_DIR"
```

结果：输出脚本所在的绝对路径，不受 cd 影响。

### 10.6 临时文件 mktemp

语法作用：生成一个唯一的临时文件或目录，避免多个脚本实例冲突。

```shell
#!/bin/bash
temp_file=$(mktemp)
echo "临时文件: $temp_file"
# 使用完后删除
rm -f "$temp_file"
```

结果：生成一个类似 /tmp/tmp.xyz123 的临时文件。