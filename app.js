const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { DefaultAzureCredential } = require('@azure/identity');
const { ComputeManagementClient } = require('@azure/arm-compute');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
require('dotenv').config();

const subscriptionId = process.env.SUBSCRIPTION_ID;
const resourceGroupName = process.env.RESOURCE_GROUP_NAME;
const vm = process.env.VM_NAME;
const passwd = process.env.PASS;
const secretKey = process.env.SECRET_KEY;

// 使用 DefaultAzureCredential 来认证（确保环境变量正确设置）
const credential = new DefaultAzureCredential();

// 创建 ComputeManagementClient 实例
const computeClient = new ComputeManagementClient(credential, subscriptionId);

// 身份验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    return res.status(401).json({ error: '未登录' });
  }

  jwt.verify(token, secretKey, (err, data) => {
    if (err) {
      return res.status(403).json({ error: '登录失效' });
    }
    req.vmName = data.vmname;
    next();
  });
}

// app.get('/', (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (!token) {
//     // 如果未提供令牌，重定向到登录页
//     res.redirect('/login');
//   } else {
//     // 如果提供了令牌，验证令牌并继续处理请求
//     next();
//   }
// });

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { vmn, pass } = req.body;

  // 在实际应用中，你可以根据自己的用户存储方式（如数据库）来验证凭证
  if (vmn === vm && pass === passwd) {
    // 用户凭证验证成功
    const user = { vmname: vmn };
    const token = jwt.sign(user, secretKey);

    return res.status(200).json({ token: token });
  } else {
    // 用户凭证验证失败
    return res.status(401).json({ error: '账号或密码错误' });
  }
});


app.post('/api/start', authenticateToken, async (req, res) => {
  try {
    console.log(`Starting VM: ${req.vmName}...`);
    await computeClient.virtualMachines.beginStart(resourceGroupName, req.vmName);
    console.log(`${req.vmName} started.`);
    res.status(200).send('开机指令已发送');
  } catch (error) {
    console.error(`Failed to start VM: ${error}`);
    res.status(500).send('开机失败');
  }
});


app.post('/api/stop', authenticateToken, async (req, res) => {
  try {
    console.log(`Stopping VM: ${req.vmName}...`);
    await computeClient.virtualMachines.beginPowerOff(resourceGroupName, req.vmName);
    console.log(`${req.vmName} stopped.`);
    res.status(200).send('关机指令已发送');
  } catch (error) {
    console.error(`Failed to stop VM: ${error}`);
    res.status(500).send('关机失败');
  }
});


app.get('/api/info', authenticateToken, async (req, res) => {
  try {
    // const vmInfo = await computeClient.virtualMachines.get(resourceGroupName, req.vmName);
    const vmInfo = await computeClient.virtualMachines.instanceView(resourceGroupName, req.vmName);
    res.status(200).json(vmInfo);
    // res.status(200).json(`VM info: ${JSON.stringify(vmInfo, null, 2)}`);
  } catch (error) {
    console.error(`Failed to get VM info: ${error}`);
    res.status(500).send('获取信息失败');
  }
});


PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});