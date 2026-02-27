const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'huayu-crm-secret-key-2024';
const DATA_DIR = path.join(__dirname, 'data');
const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_API_URL = 'api.moonshot.cn';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 数据存储 ====================
const DATA_FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  customers: path.join(DATA_DIR, 'customers.json'),
  products: path.join(DATA_DIR, 'products.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  inquiries: path.join(DATA_DIR, 'inquiries.json')
};

let users = [];
let customers = [];
let products = [];
let orders = [];
let inquiries = [];

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 加载数据
function loadData(filename, defaultData = []) {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`加载 ${filename} 失败:`, e.message);
  }
  return defaultData;
}

// 保存数据
function saveData(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`保存 ${filename} 失败:`, e.message);
  }
}

// 初始化数据
function initData() {
  users = loadData(DATA_FILES.users);
  customers = loadData(DATA_FILES.customers);
  products = loadData(DATA_FILES.products);
  orders = loadData(DATA_FILES.orders);
  inquiries = loadData(DATA_FILES.inquiries);
  
  // 如果没有用户，创建默认管理员
  if (users.length === 0) {
    users.push({
      id: '1',
      username: 'SCHYBH',
      password: bcrypt.hashSync('123456', 10),
      name: '系统管理员',
      role: 'admin',
      createdAt: new Date()
    });
    saveData(DATA_FILES.users, users);
  }
  
  // 如果没有产品，初始化默认产品
  if (products.length === 0) {
    products = [
      { id: 'P001', name: '重型卡车板簧', category: '重型车系列', spec: '60Si2MnA', thickness: '12-20mm', width: '70-120mm', price: 0, unit: '吨', description: '适用于重型卡车，承载能力强' },
      { id: 'P002', name: '轻型卡车板簧', category: '轻型车系列', spec: '55Si2Mn', thickness: '8-14mm', width: '50-90mm', price: 0, unit: '吨', description: '适用于轻型卡车，弹性好' },
      { id: 'P003', name: '客车板簧', category: '客车系列', spec: '50CrVA', thickness: '10-16mm', width: '60-100mm', price: 0, unit: '吨', description: '适用于客车，舒适性佳' },
      { id: 'P004', name: '挂车板簧', category: '挂车系列', spec: '60Si2CrA', thickness: '12-22mm', width: '80-130mm', price: 0, unit: '吨', description: '适用于挂车，耐磨耐用' },
      { id: 'P005', name: '工程车板簧', category: '工程车系列', spec: '55SiMnVB', thickness: '14-25mm', width: '90-140mm', price: 0, unit: '吨', description: '适用于工程车辆，承重极佳' }
    ];
    saveData(DATA_FILES.products, products);
  }
  
  console.log('数据加载完成:', {
    users: users.length,
    customers: customers.length,
    products: products.length,
    orders: orders.length,
    inquiries: inquiries.length
  });
}

// ==================== 工具函数 ====================
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ==================== 认证中间件 ====================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '请先登录' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = users.find(u => u.id === decoded.id);
    if (!req.user) return res.status(401).json({ success: false, message: '用户不存在' });
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '登录已过期' });
  }
};

// ==================== API路由 ====================

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ 
    success: true, 
    token, 
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  });
});

// 获取当前用户
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: { ...req.user, password: undefined } });
});

// ==================== 客户管理 ====================

app.get('/api/customers', authMiddleware, (req, res) => {
  const { search, status, country, type, level } = req.query;
  let result = [...customers];
  
  if (search) {
    const keyword = search.toLowerCase();
    result = result.filter(c => 
      c.name.toLowerCase().includes(keyword) || 
      c.company?.toLowerCase().includes(keyword) ||
      c.email?.toLowerCase().includes(keyword)
    );
  }
  if (status) result = result.filter(c => c.status === status);
  if (country) result = result.filter(c => c.country === country);
  if (type) result = result.filter(c => c.type === type);
  if (level) result = result.filter(c => c.level === level);
  
  res.json({ success: true, data: result, total: result.length });
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const customer = {
    id: generateId(),
    ...req.body,
    createdAt: new Date(),
    createdBy: req.user.name
  };
  customers.push(customer);
  saveData(DATA_FILES.customers, customers);
  res.json({ success: true, message: '客户添加成功', data: customer });
});

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '客户不存在' });
  
  customers[index] = { ...customers[index], ...req.body, updatedAt: new Date() };
  saveData(DATA_FILES.customers, customers);
  res.json({ success: true, message: '客户更新成功', data: customers[index] });
});

app.delete('/api/customers/:id', authMiddleware, (req, res) => {
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '客户不存在' });
  
  customers.splice(index, 1);
  saveData(DATA_FILES.customers, customers);
  res.json({ success: true, message: '客户删除成功' });
});

// ==================== 产品管理 ====================

app.get('/api/products', authMiddleware, (req, res) => {
  res.json({ success: true, data: products });
});

app.post('/api/products', authMiddleware, (req, res) => {
  const product = { id: 'P' + generateId().toUpperCase(), ...req.body };
  products.push(product);
  saveData(DATA_FILES.products, products);
  res.json({ success: true, message: '产品添加成功', data: product });
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '产品不存在' });
  
  products[index] = { ...products[index], ...req.body };
  saveData(DATA_FILES.products, products);
  res.json({ success: true, message: '产品更新成功', data: products[index] });
});

// ==================== 订单管理 ====================

app.get('/api/orders', authMiddleware, (req, res) => {
  const { status, customerId } = req.query;
  let result = [...orders];
  
  if (status) result = result.filter(o => o.status === status);
  if (customerId) result = result.filter(o => o.customerId === customerId);
  
  res.json({ success: true, data: result, total: result.length });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const order = {
    id: 'ORD' + Date.now(),
    ...req.body,
    status: 'pending',
    createdAt: new Date(),
    createdBy: req.user.name
  };
  orders.push(order);
  saveData(DATA_FILES.orders, orders);
  res.json({ success: true, message: '订单创建成功', data: order });
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '订单不存在' });
  
  orders[index].status = req.body.status;
  orders[index].updatedAt = new Date();
  saveData(DATA_FILES.orders, orders);
  res.json({ success: true, message: '订单状态更新成功', data: orders[index] });
});

// ==================== 询盘管理 ====================

app.get('/api/inquiries', authMiddleware, (req, res) => {
  const { status } = req.query;
  let result = [...inquiries];
  
  if (status) result = result.filter(i => i.status === status);
  
  res.json({ success: true, data: result, total: result.length });
});

app.post('/api/inquiries', authMiddleware, (req, res) => {
  const inquiry = {
    id: 'INQ' + Date.now(),
    ...req.body,
    status: 'new',
    createdAt: new Date(),
    createdBy: req.user.name
  };
  inquiries.push(inquiry);
  saveData(DATA_FILES.inquiries, inquiries);
  res.json({ success: true, message: '询盘添加成功', data: inquiry });
});

app.put('/api/inquiries/:id', authMiddleware, (req, res) => {
  const index = inquiries.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '询盘不存在' });
  
  inquiries[index] = { ...inquiries[index], ...req.body, updatedAt: new Date() };
  saveData(DATA_FILES.inquiries, inquiries);
  res.json({ success: true, message: '询盘更新成功', data: inquiries[index] });
});

// ==================== 统计数据 ====================

app.get('/api/stats', authMiddleware, (req, res) => {
  const customerCountries = {};
  customers.forEach(c => {
    customerCountries[c.country] = (customerCountries[c.country] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: {
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalInquiries: inquiries.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      newInquiries: inquiries.filter(i => i.status === 'new').length,
      customerCountries,
      recentOrders: orders.slice(-5).reverse(),
      recentInquiries: inquiries.slice(-5).reverse()
    }
  });
});

// ==================== AI分析功能 ====================

// 基础Kimi API调用
function callKimiAPI(messages, apiKey, tools = null) {
  return new Promise((resolve, reject) => {
    const requestBodyObj = {
      model: 'moonshot-v1-8k',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    };
    
    if (tools) {
      requestBodyObj.tools = tools;
    }
    
    const requestBody = JSON.stringify(requestBodyObj);

    const options = {
      hostname: KIMI_API_URL,
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'API Error'));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('解析响应失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(requestBody);
    req.end();
  });
}

// 带联网搜索的Kimi API调用
async function callKimiWithWebSearch(messages, apiKey) {
  // 第1次请求：告诉Kimi可以使用搜索工具
  const tools = [{
    type: 'builtin_function',
    function: { name: '$web_search' }
  }];
  
  console.log('=== Kimi Web Search Request ===');
  console.log('Messages:', JSON.stringify(messages, null, 2));
  console.log('Tools:', JSON.stringify(tools, null, 2));
  
  const firstResponse = await callKimiAPI(messages, apiKey, tools);
  
  console.log('=== Kimi First Response ===');
  console.log('Full response:', JSON.stringify(firstResponse, null, 2));
  console.log('finish_reason:', firstResponse.choices[0].finish_reason);
  
  // 判断是否需要搜索
  if (firstResponse.choices[0].finish_reason === 'tool_calls') {
    console.log('=== Tool calls detected! ===');
    const toolCall = firstResponse.choices[0].message.tool_calls[0];
    console.log('Tool call ID:', toolCall.id);
    console.log('Tool call function:', toolCall.function.name);
    console.log('Tool call arguments:', toolCall.function.arguments);
    
    // 第2次请求：把搜索结果返回给Kimi总结
    const secondMessages = [
      ...messages,
      firstResponse.choices[0].message,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: '$web_search',
        content: toolCall.function.arguments
      }
    ];
    
    console.log('=== Sending second request ===');
    const finalResponse = await callKimiAPI(secondMessages, apiKey);
    console.log('=== Final response received ===');
    return finalResponse.choices[0].message.content;
  }
  
  // 如果Kimi觉得不需要搜索，直接返回答案
  console.log('=== No tool calls, direct response ===');
  return firstResponse.choices[0].message.content;
}

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  const { message, apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ success: false, message: '请提供API Key' });
  }
  
  if (!message) {
    return res.status(400).json({ success: false, message: '请输入问题' });
  }

  const systemPrompt = `你是四川华玉车辆板簧有限公司的AI助手，专门帮助分析客户数据和业务情况。

当前数据库信息：
- 客户总数：${customers.length}
- 订单总数：${orders.length}
- 询盘总数：${inquiries.length}
- 产品总数：${products.length}

客户类型分布：分销商=${customers.filter(c=>c.type==='distributor').length}, 底盘商=${customers.filter(c=>c.type==='chassis').length}, 制造商=${customers.filter(c=>c.type==='manufacturer').length}
客户等级分布：A级=${customers.filter(c=>c.level==='A').length}, B级=${customers.filter(c=>c.level==='B').length}, C级=${customers.filter(c=>c.level==='C').length}

客户数据：${JSON.stringify(customers.slice(0, 20), null, 2)}
订单数据：${JSON.stringify(orders.slice(0, 10), null, 2)}
询盘数据：${JSON.stringify(inquiries.slice(0, 10), null, 2)}
产品数据：${JSON.stringify(products, null, 2)}

客户类型说明：distributor=分销商, chassis=底盘商, manufacturer=制造商
客户等级说明：A级=核心客户, B级=重要客户, C级=普通客户

请用中文回答用户问题，提供专业的业务分析和建议。如果用户问的是数据分析，请给出具体的数字和洞察。`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    const response = await callKimiAPI(messages, apiKey);
    res.json({ success: true, response: response.choices[0].message.content });
  } catch (error) {
    console.error('AI API Error:', error.message);
    res.status(500).json({ success: false, message: 'AI请求失败: ' + error.message });
  }
});

// 联网搜索公司信息
app.post('/api/ai/web-search', authMiddleware, async (req, res) => {
  const { query, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ success: false, message: '请提供API Key' });
  }
  
  if (!query) {
    return res.status(400).json({ success: false, message: '请输入搜索内容' });
  }

  const systemPrompt = `你是四川华玉车辆板簧有限公司的AI助手，专门帮助分析潜在客户。

重要提示：请尽你所能提供关于"${query}"的详细信息。如果可以访问互联网，请搜索最新信息；如果不能访问，请基于你的训练数据提供信息。

请提供以下信息：

1. 公司基本信息（成立时间、规模、主营业务、总部位置）
2. 产品类型和特点（特别关注是否与车辆、卡车、板簧相关）
3. 目标市场和客户群体
4. 可能的采购需求分析（为什么可能需要板簧产品）
5. 联系方式（如果有公开信息）
6. 与四川华玉车辆板簧有限公司的业务匹配度分析
7. 开发建议（如何接触、什么产品适合、谈判策略）

请用中文回答，格式清晰，使用Markdown格式。如果某些信息不确定或无法获取，请明确说明。`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请详细分析这家公司：${query}` }
    ];

    let aiResponse;
    try {
      // 尝试使用联网搜索
      aiResponse = await callKimiWithWebSearch(messages, apiKey);
    } catch (webError) {
      console.log('Web search failed, falling back to normal AI:', webError.message);
      // 如果联网搜索失败，使用普通AI调用
      const response = await callKimiAPI(messages, apiKey);
      aiResponse = response.choices[0].message.content;
    }
    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Web Search API Error:', error.message);
    res.status(500).json({ success: false, message: '分析失败: ' + error.message });
  }
});

app.post('/api/ai/analyze-customer/:id', authMiddleware, async (req, res) => {
  const { apiKey } = req.body;
  const customerId = req.params.id;
  
  if (!apiKey) {
    return res.status(400).json({ success: false, message: '请提供API Key' });
  }

  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: '客户不存在' });
  }

  const customerOrders = orders.filter(o => o.customerId === customerId);
  const customerInquiries = inquiries.filter(i => i.customerId === customerId);

  const systemPrompt = `你是四川华玉车辆板簧有限公司的AI助手，专门分析客户信息。

客户信息：${JSON.stringify(customer, null, 2)}
客户订单：${JSON.stringify(customerOrders, null, 2)}
客户询盘：${JSON.stringify(customerInquiries, null, 2)}

请分析这个客户，提供：
1. 客户价值评估
2. 合作建议
3. 潜在需求分析
4. 跟进建议`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请分析这个客户' }
    ];

    const response = await callKimiAPI(messages, apiKey);
    res.json({ success: true, response: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ success: false, message: 'AI分析失败: ' + error.message });
  }
});

// ==================== 启动服务器 ====================

initData();

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  四川华玉车辆板簧有限公司');
  console.log('  外贸客户管理系统');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  默认账号: SCHYBH`);
  console.log(`  默认密码: 123456`);
  console.log(`  数据目录: ${DATA_DIR}`);
  console.log('========================================');
});