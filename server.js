const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'huayu-crm-secret-key-2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 内存数据库 ====================
const users = [];
const customers = [];
const products = [];
const orders = [];
const inquiries = [];

// 初始化管理员账号
users.push({
  id: '1',
  username: 'admin',
  password: bcrypt.hashSync('admin123', 10),
  name: '系统管理员',
  role: 'admin',
  createdAt: new Date()
});

// 初始化产品数据（板簧产品）
const initProducts = [
  { id: 'P001', name: '重型卡车板簧', category: '重型车系列', spec: '60Si2MnA', thickness: '12-20mm', width: '70-120mm', price: 0, unit: '吨', description: '适用于重型卡车，承载能力强' },
  { id: 'P002', name: '轻型卡车板簧', category: '轻型车系列', spec: '55Si2Mn', thickness: '8-14mm', width: '50-90mm', price: 0, unit: '吨', description: '适用于轻型卡车，弹性好' },
  { id: 'P003', name: '客车板簧', category: '客车系列', spec: '50CrVA', thickness: '10-16mm', width: '60-100mm', price: 0, unit: '吨', description: '适用于客车，舒适性佳' },
  { id: 'P004', name: '挂车板簧', category: '挂车系列', spec: '60Si2CrA', thickness: '12-22mm', width: '80-130mm', price: 0, unit: '吨', description: '适用于挂车，耐磨耐用' },
  { id: 'P005', name: '工程车板簧', category: '工程车系列', spec: '55SiMnVB', thickness: '14-25mm', width: '90-140mm', price: 0, unit: '吨', description: '适用于工程车辆，承重极佳' }
];
products.push(...initProducts);

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

// 获取客户列表
app.get('/api/customers', authMiddleware, (req, res) => {
  const { search, status, country } = req.query;
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
  
  res.json({ success: true, data: result, total: result.length });
});

// 添加客户
app.post('/api/customers', authMiddleware, (req, res) => {
  const customer = {
    id: generateId(),
    ...req.body,
    createdAt: new Date(),
    createdBy: req.user.name
  };
  customers.push(customer);
  res.json({ success: true, message: '客户添加成功', data: customer });
});

// 更新客户
app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '客户不存在' });
  
  customers[index] = { ...customers[index], ...req.body, updatedAt: new Date() };
  res.json({ success: true, message: '客户更新成功', data: customers[index] });
});

// 删除客户
app.delete('/api/customers/:id', authMiddleware, (req, res) => {
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '客户不存在' });
  
  customers.splice(index, 1);
  res.json({ success: true, message: '客户删除成功' });
});

// ==================== 产品管理 ====================

// 获取产品列表
app.get('/api/products', authMiddleware, (req, res) => {
  res.json({ success: true, data: products });
});

// 添加产品
app.post('/api/products', authMiddleware, (req, res) => {
  const product = { id: 'P' + generateId().toUpperCase(), ...req.body };
  products.push(product);
  res.json({ success: true, message: '产品添加成功', data: product });
});

// 更新产品
app.put('/api/products/:id', authMiddleware, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '产品不存在' });
  
  products[index] = { ...products[index], ...req.body };
  res.json({ success: true, message: '产品更新成功', data: products[index] });
});

// ==================== 订单管理 ====================

// 获取订单列表
app.get('/api/orders', authMiddleware, (req, res) => {
  const { status, customerId } = req.query;
  let result = [...orders];
  
  if (status) result = result.filter(o => o.status === status);
  if (customerId) result = result.filter(o => o.customerId === customerId);
  
  res.json({ success: true, data: result, total: result.length });
});

// 添加订单
app.post('/api/orders', authMiddleware, (req, res) => {
  const order = {
    id: 'ORD' + Date.now(),
    ...req.body,
    status: 'pending',
    createdAt: new Date(),
    createdBy: req.user.name
  };
  orders.push(order);
  res.json({ success: true, message: '订单创建成功', data: order });
});

// 更新订单状态
app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '订单不存在' });
  
  orders[index].status = req.body.status;
  orders[index].updatedAt = new Date();
  res.json({ success: true, message: '订单状态更新成功', data: orders[index] });
});

// ==================== 询盘管理 ====================

// 获取询盘列表
app.get('/api/inquiries', authMiddleware, (req, res) => {
  const { status } = req.query;
  let result = [...inquiries];
  
  if (status) result = result.filter(i => i.status === status);
  
  res.json({ success: true, data: result, total: result.length });
});

// 添加询盘
app.post('/api/inquiries', authMiddleware, (req, res) => {
  const inquiry = {
    id: 'INQ' + Date.now(),
    ...req.body,
    status: 'new',
    createdAt: new Date(),
    createdBy: req.user.name
  };
  inquiries.push(inquiry);
  res.json({ success: true, message: '询盘添加成功', data: inquiry });
});

// 更新询盘
app.put('/api/inquiries/:id', authMiddleware, (req, res) => {
  const index = inquiries.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '询盘不存在' });
  
  inquiries[index] = { ...inquiries[index], ...req.body, updatedAt: new Date() };
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

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  四川华玉车辆板簧有限公司');
  console.log('  外贸客户管理系统');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  默认账号: admin`);
  console.log(`  默认密码: admin123`);
  console.log('========================================');
});