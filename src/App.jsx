import React, { useState, useRef, useEffect } from 'react';
import { Upload, PieChart, Calculator, TrendingUp, Book, Wallet, Coffee, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// Claude API 相关常量
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_ATTACHMENT_URL = 'https://api.anthropic.com/v1/attachments';

// 读取 Netlify 环境变量
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const ExpenseAnalyzer = () => {
  // 用户状态管理  
  const [user, setUser] = useState({ username: '用户' });
  
  // 基本信息状态
  const [basicInfo, setBasicInfo] = useState({
    salary: '',
    currentMonth: new Date().toISOString().slice(0, 7),
    yearlyTravel: ''
  });

  // 手动输入的费用状态
  const [manualExpenses, setManualExpenses] = useState({
    food: '', entertainment: '', shopping: '', transportation: '', utilities: '', phone: '', household: '', others_expense: '',
    books: '', courses: '', training: '', certification: '',
    epf: '', stocks: '', fixedDeposit: '', insurance: '', emergencyFund: '', others_savings: ''
  });
  
  // 账单和分析状态
  const [uploadedBills, setUploadedBills] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // 删除 claudeApiKey 状态
  
  // UI状态
  const [activeTab, setActiveTab] = useState('basic');
  const [inputMethod, setInputMethod] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const fileInputRef = useRef(null);

  // 日历相关函数
  const getCurrentYear = () => new Date().getFullYear();
  const getCurrentMonth = () => new Date().getMonth();
  
  const [calendarYear, setCalendarYear] = useState(getCurrentYear());
  const [calendarMonth, setCalendarMonth] = useState(getCurrentMonth());

  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const formatMonthValue = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
  const parseMonthValue = (value) => { const [year, month] = value.split('-'); return { year: parseInt(year), month: parseInt(month) - 1 }; };
  const selectMonth = (year, month) => {
    const monthValue = formatMonthValue(year, month);
    setBasicInfo({...basicInfo, currentMonth: monthValue});
    setCalendarYear(year);
    setCalendarMonth(month);
    setShowCalendar(false);
  };

  useEffect(() => {
    const { year, month } = parseMonthValue(basicInfo.currentMonth);
    setCalendarYear(year);
    setCalendarMonth(month);
  }, [basicInfo.currentMonth]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && activeTab === 'details' && inputMethod === 'manual') {
        analyzeManualExpenses();
      }
      if (e.key === 'Escape' && showCalendar) {
        setShowCalendar(false);
      }
    };
    const handleClickOutside = (e) => {
      if (showCalendar && !e.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeTab, inputMethod, showCalendar]);

  // 文件上传处理 - 使用 Claude API
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const billEntry = {
        id: Date.now() + Math.random(),
        file: file,
        fileName: file.name,
        extractedData: null,
        uploadTime: new Date().toLocaleString(),
        status: 'processing'
      };
      setUploadedBills(prev => [...prev, billEntry]);
      try {
        const claudeResult = await analyzeWithClaude(file);
        setUploadedBills(prev => prev.map(bill => 
          bill.id === billEntry.id 
            ? { ...bill, extractedData: claudeResult, status: 'completed' }
            : bill
        ));
      } catch (error) {
        setUploadedBills(prev => prev.map(bill => 
          bill.id === billEntry.id 
            ? { ...bill, status: 'error', error: error.message }
            : bill
        ));
      }
    }
  };

  // 使用 Claude API 分析账单（支持图片和 PDF）
  const analyzeWithClaude = async (file) => {
    if (!CLAUDE_API_KEY) throw new Error('请在 Netlify 环境变量中设置 VITE_CLAUDE_API_KEY');
    // 1. 上传文件到 Claude，获取 attachment id
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch(CLAUDE_ATTACHMENT_URL, {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY },
      body: formData
    });
    if (!uploadRes.ok) throw new Error('PDF/图片上传失败: ' + (await uploadRes.text()));
    const uploadData = await uploadRes.json();
    const fileId = uploadData.attachment?.id || uploadData.id;
    if (!fileId) throw new Error('未获取到文件ID');
    // 2. 调用 Claude API 进行分析
    const prompt = `请分析这个账单（图片或PDF），提取以下信息并以JSON格式返回：\n{\n  "vendor": "商家名称",\n  "amount": "金额数字（只要数字，不要货币符号）",\n  "date": "日期（YYYY-MM-DD格式）",\n  "category": "类别（从以下选择：开销、学习、储蓄）",\n  "items": ["具体购买的项目列表"]\n}\n分类规则：\n- 开销：餐饮、娱乐、购物、交通、水电、手机、家用等日常消费\n- 学习：书籍、课程、培训、旅游、教育相关支出\n- 储蓄：EPF、投资、保险、定存等储蓄投资\n请确保返回有效的JSON格式。`;
    const body = {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'attachment', attachment: { id: fileId, type: file.type } }
        ] }
      ]
    };
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Claude API 错误: ' + (await res.text()));
    const data = await res.json();
    // Claude 返回内容可能带有代码块格式，需清理
    let text = data?.content?.[0]?.text || JSON.stringify(data, null, 2);
    text = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('无法解析 Claude 返回的账单信息: ' + text);
    }
  };

  // 重试分析功能
  const retryAnalysis = async (bill) => {
    setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'processing', error: null } : b));
    try {
      const claudeResult = await analyzeWithClaude(bill.file);
      setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, extractedData: claudeResult, status: 'completed' } : b));
    } catch (error) {
      setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'error', error: error.message } : b));
    }
  };

  // 处理 API Key 输入
  // 删除 handleApiKeyChange 函数

  // 分析手动输入的费用
  const analyzeManualExpenses = () => {
    const expenses = Object.entries(manualExpenses).map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: parseFloat(value) || 0
    }));
    setAnalysisResult({
      totalExpenses: expenses.reduce((sum, item) => sum + item.value, 0),
      categories: expenses.reduce((acc, item) => {
        const category = item.name.toLowerCase().replace(/\s/g, '');
        if (category in acc) {
          acc[category] += item.value;
        } else {
          acc[category] = item.value;
        }
        return acc;
      }, {})
    });
  };

  // 计算总收入
  const calculateTotalIncome = () => {
    const salary = parseFloat(basicInfo.salary) || 0;
    const yearlyTravel = parseFloat(basicInfo.yearlyTravel) || 0;
    return salary + yearlyTravel;
  };

  // 计算总支出
  const calculateTotalExpenses = () => {
    const uploadedExpenses = uploadedBills.map(bill => bill.extractedData?.amount || 0).reduce((sum, val) => sum + val, 0);
    const manualExpensesSum = Object.values(manualExpenses).reduce((sum, val) => sum + parseFloat(val) || 0, 0);
    return uploadedExpenses + manualExpensesSum;
  };

  // 计算结余
  const calculateSurplus = () => {
    const totalIncome = calculateTotalIncome();
    const totalExpenses = calculateTotalExpenses();
    return totalIncome - totalExpenses;
  };

  // 计算各类别占比
  const calculateCategoryRatio = () => {
    const totalExpenses = calculateTotalExpenses();
    if (totalExpenses === 0) return {};
    return Object.entries(analysisResult?.categories || {}).map(([name, value]) => ({
      name,
      value: (value / totalExpenses) * 100
    }));
  };

  // 处理日期选择
  const handleDateChange = (e) => {
    setBasicInfo({ ...basicInfo, [e.target.name]: e.target.value });
  };

  // 处理手动输入费用
  const handleManualExpenseChange = (e) => {
    setManualExpenses({ ...manualExpenses, [e.target.name]: e.target.value });
  };

  // 处理基本信息保存
  const handleBasicInfoSave = () => {
    // 实际保存逻辑
    console.log('保存基本信息:', basicInfo);
    alert('基本信息已保存！');
  };

  // 处理手动输入费用保存
  const handleManualExpensesSave = () => {
    // 实际保存逻辑
    console.log('保存手动输入费用:', manualExpenses);
    alert('手动输入费用已保存！');
  };

  // 处理账单上传保存
  const handleBillsSave = () => {
    // 实际保存逻辑
    console.log('保存账单:', uploadedBills);
    alert('账单已保存！');
  };

  // 处理分析结果保存
  const handleAnalysisResultSave = () => {
    // 实际保存逻辑
    console.log('保存分析结果:', analysisResult);
    alert('分析结果已保存！');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Claude PDF 账单分析器</h1>
        {/* 在 UI 中移除 API Key 输入框 */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">上传 PDF 账单</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFileUpload}
            className="w-full"
          />
        </div>
        <button
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? '分析中...' : '开始分析'}
        </button>
        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
        {result && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">分析结果：</h2>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto max-h-96">{result}</pre>
          </div>
        )}
      </div>
      <footer className="mt-8 text-gray-400 text-xs">&copy; {new Date().getFullYear()} Claude PDF 账单分析器</footer>
    </div>
  );
} 

export default ExpenseAnalyzer; 